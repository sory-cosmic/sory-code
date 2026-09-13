import { Effect } from "effect"
import type { ProjectV2 } from "@opencode-ai/core/project"
import { type Target, type WorkspaceAdapter, type WorkspaceAdapterContext, WorkspaceInfo } from "../types"
import { targetFor } from "../environment"

const decodeInfo = (info: WorkspaceInfo) => ({
  projectID: info.projectID,
  directory: info.directory ?? null,
})

/**
 * Workspace adapter whose `target()` is the authoritative project
 * environment. Workspace routing already calls
 * `WorkspaceAdapterRuntime.target(workspace)`; registering this adapter for
 * a project makes that lookup resolve through the persisted
 * `Project.environment` instead of the legacy worktree target.
 *
 * Local projects resolve to a `local` target pointing at the worktree.
 * Sandbox/codespaces selections resolve to `remote` with the configured
 * `remoteURL`. Missing or unprovisioned remote URLs fail explicitly — the
 * upstream `SandboxEnvironmentAdapter.target` already does this.
 */
export const EnvironmentAdapter: WorkspaceAdapter = {
  name: "Project environment",
  description: "Run filesystem, PTY and build operations in the project's selected environment.",
  configure(info) {
    return info
  },
  async create() {
    // The environment itself is created through the sandbox/codespaces
    // provider lifecycle; the workspace merely records the target.
  },
  async remove() {
    // No-op: closing the environment is owned by the provider factory.
  },
  target(info, context?: WorkspaceAdapterContext): Target | Promise<Target> {
    const { projectID } = decodeInfo(info)
    const workspaceID = context?.workspaceID
    return Effect.runPromise(targetFor(projectID as ProjectV2.ID, workspaceID))
  },
}

export const EnvironmentAdapterType = "environment"

export function registerEnvironmentAdapter(register: (type: string, adapter: WorkspaceAdapter) => void) {
  register(EnvironmentAdapterType, EnvironmentAdapter)
}

export * as EnvironmentAdapterModule from "./environment-adapter"
