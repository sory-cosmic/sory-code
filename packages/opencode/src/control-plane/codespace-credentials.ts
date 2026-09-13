import { Effect } from "effect"
import { Credential } from "@opencode-ai/core/credential"
import { Integration } from "@opencode-ai/core/integration"

const integrationID = Integration.ID.make("github")

export function credentialToToken(value: Credential.Value | undefined): string | undefined {
  if (!value) return undefined
  if (value.type === "key") return value.key
  if (value.type === "oauth") return value.access
  return undefined
}

export const codespaceToken = Effect.fn("Codespace.token")(function* () {
  const integration = yield* Integration.Service
  const connection = yield* integration.connection.active(integrationID)
  if (!connection) return undefined
  const value = yield* integration.connection.resolve(connection)
  return credentialToToken(value)
})

export const requireCodespaceToken = Effect.fn("Codespace.requireToken")(function* () {
  const token = yield* codespaceToken()
  if (!token) return yield* Effect.fail(new Error('GitHub not connected. Connect via Settings → Integrations → GitHub (device flow or PAT), or set GITHUB_TOKEN.'))
  return token
})

export * as CodespaceCredentials from "./codespace-credentials"
