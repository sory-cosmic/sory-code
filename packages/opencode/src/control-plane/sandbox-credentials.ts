import { Effect } from "effect"
import { Credential } from "@opencode-ai/core/credential"
import { Integration } from "@opencode-ai/core/integration"
import type { ProviderCredentials, ProviderKind } from "./adapters/sandbox-provider"

const integrationID = (kind: ProviderKind) =>
  kind === "e2b" ? Integration.ID.make("e2b") : Integration.ID.make("vercel-sandbox")

/**
 * Map a resolved integration credential to provider overrides. Pure and
 * tested: only `key` credentials carry a pastable token, anything else (or
 * nothing) means "fall back to environment variables".
 */
export function credentialToOverrides(
  kind: ProviderKind,
  value: Credential.Value | undefined,
): ProviderCredentials {
  if (!value || value.type !== "key") return {}
  if (kind === "e2b") return { e2bApiKey: value.key }
  return { vercelToken: value.key }
}

/**
 * Resolve stored credentials for a sandbox provider into factory overrides.
 * Reads (in order): active integration connection → environment variables
 * (inside `createSandboxProvider`). Runs wherever `Integration.Service` is
 * provided — the same service the `integration.connect.key` API handler uses.
 */
export const sandboxCredentials = Effect.fn("Sandbox.credentials")(function* (kind: ProviderKind) {
  const integration = yield* Integration.Service
  const connection = yield* integration.connection.active(integrationID(kind))
  if (!connection) return {}
  const value = yield* integration.connection.resolve(connection)
  return credentialToOverrides(kind, value)
})

export * as SandboxCredentials from "./sandbox-credentials"
