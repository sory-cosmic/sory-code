import { Effect, Schema } from "effect"
import type { ProjectV2 } from "@opencode-ai/core/project"
import { Config, Kind } from "@opencode-ai/core/environment"
import { Project } from "@/project/project"
import { getEnvironmentAdapter } from "./adapters/environments"
import {
  createSandboxProvider,
  resolveProviderKind,
  type ProviderCredentials,
  type ProviderEnv,
  type ProviderKind,
  type SandboxInfo,
} from "./adapters/sandbox-provider"
import { sandboxCredentials } from "./sandbox-credentials"
import { bootWorkspaceServer, type BootInput } from "./sandbox-boot"
import { codespaceToken } from "./codespace-credentials"
import { createCodespace, getCodespace, listCodespaces, waitForCodespace } from "./codespace"
import { HttpClient } from "effect/unstable/http"

export const Selection = Schema.Struct({
  projectID: Schema.String,
  kind: Kind,
  config: Config,
})
export type Selection = Schema.Schema.Type<typeof Selection>

/**
 * Derive the authoritative selection from a persisted project row. The
 * database (written by `PATCH /project/:projectID`) is the source of truth;
 * projects created before environments existed resolve to local execution.
 */
export function selectionFromProject(project: Pick<Project.Info, "id" | "worktree" | "environment">): Selection {
  const environment = project.environment ?? { kind: "local" as const, directory: project.worktree }
  return {
    projectID: String(project.id),
    kind: environment.kind,
    config: { ...environment, directory: environment.directory ?? project.worktree },
  }
}

/**
 * Load the authoritative selection for a project from the database instead
 * of the in-memory `EnvironmentManager` map.
 */
export const selectionFor = Effect.fn("Environment.selectionFor")(function* (projectID: ProjectV2.ID) {
  const projects = yield* Project.Service
  const project = yield* projects.get(projectID)
  if (!project) throw new Error(`Project not found: ${projectID}`)
  return selectionFromProject(project)
})

/**
 * Resolve the workspace target for a project from its persisted environment.
 * Sandbox selections without a provisioned `remoteURL` fail explicitly here
 * instead of executing anywhere unintended.
 */
export const targetFor = Effect.fn("Environment.targetFor")(function* (projectID: ProjectV2.ID, workspaceID?: string) {
  const selection = yield* selectionFor(projectID)
  const adapter = getEnvironmentAdapter(selection.kind)
  return adapter.target(selection.config, { projectID: String(projectID), workspaceID })
})

export type ProvisionResult =
  | { readonly reused: true; readonly url: string }
  | { readonly reused: false; readonly info: SandboxInfo }

/**
 * Provision the sandbox backing a project's `sandbox` environment and store
 * the resulting URL back on `Project.environment`.
 *
 * Already-provisioned projects short-circuit with `{ reused: true }` and
 * never touch the network. Otherwise the provider is selected via
 * `SANDBOX_PROVIDER`, credentials come from the integration store with
 * environment fallback, and the live sandbox URL is persisted. Booting the
 * workspace server inside the sandbox is the documented follow-up; the URL
 * stored here is a real, reachable sandbox.
 */
export const provisionSandboxEnvironment = Effect.fn("Environment.provisionSandbox")(function* (
  projectID: ProjectV2.ID,
  input: {
    readonly provider?: ProviderKind
    readonly overrides?: ProviderCredentials
    readonly env?: ProviderEnv
    readonly boot?: BootInput
  } = {},
) {
  const projects = yield* Project.Service
  const selection = yield* selectionFor(projectID)
  if (selection.kind !== "sandbox") {
    throw new Error(`Project ${projectID} is not a sandbox environment (kind: ${selection.kind})`)
  }
  if (selection.config.remoteURL) return { reused: true as const, url: selection.config.remoteURL }
  const kind = input.provider ?? resolveProviderKind(input.env)
  const stored = yield* sandboxCredentials(kind).pipe(Effect.catchCause(() => Effect.succeed({})))
  const provider = yield* Effect.promise(() => createSandboxProvider(kind, { ...stored, ...input.overrides }, input.env))
  const info = yield* Effect.promise(() => provider.create(input.boot ? { ports: [input.boot.port ?? 4096] } : undefined))
  if (!input.boot) {
    yield* projects.update({ projectID, environment: { ...selection.config, remoteURL: info.url } })
    return { reused: false as const, info }
  }
  const booted = yield* Effect.promise(() => bootWorkspaceServer(provider, input.boot))
  yield* projects.update({ projectID, environment: { ...selection.config, remoteURL: booted.url } })
  return { reused: false as const, info: { ...info, url: booted.url } }
})

export const provisionCodespaceEnvironment = Effect.fn("Environment.provisionCodespace")(function* (
  projectID: ProjectV2.ID,
  input: { branch?: string; machine?: string } = {},
) {
  const projects = yield* Project.Service
  const http = yield* HttpClient.HttpClient
  const selection = yield* selectionFor(projectID)
  if (selection.kind !== "codespaces") {
    throw new Error(`Project ${projectID} is not a codespaces environment (kind: ${selection.kind})`)
  }
  if (selection.config.remoteURL) return { reused: true as const, url: selection.config.remoteURL }
  if (!selection.config.repository) throw new Error(`Codespaces repository not configured for project ${projectID}`)
  const token = yield* codespaceToken().pipe(
    Effect.flatMap((t) => (t ? Effect.succeed(t) : Effect.fail(new Error('GitHub not connected. Connect via Settings → Integrations → GitHub (device flow or PAT), or set GITHUB_TOKEN.')))),
  )
  const existing = yield* listCodespaces(http, token).pipe(Effect.catch(() => Effect.succeed([] as any)))
  const match = (existing as any[]).find((c) => c.repository === selection.config.repository && (!input.branch || c.git_status?.ref === input.branch || c.git_status?.ref === `refs/heads/${input.branch}`))
  if (match?.web_url) {
    yield* projects.update({ projectID, environment: { ...selection.config, remoteURL: match.web_url } })
    return { reused: true as const, url: match.web_url }
  }
  const created = yield* createCodespace(http, token, {
    repository: selection.config.repository!,
    branch: input.branch ?? selection.config.branch,
    machine: input.machine ?? selection.config.machine,
  })
  const ready = created.state === "Available" ? created : yield* waitForCodespace(http, token, created.name).pipe(Effect.catch(() => Effect.succeed(created)))
  const url = (ready as any).web_url ?? `https://${(ready as any).name}.github.dev`
  yield* projects.update({ projectID, environment: { ...selection.config, remoteURL: url } })
  return { reused: false as const, info: ready as any, url }
})

