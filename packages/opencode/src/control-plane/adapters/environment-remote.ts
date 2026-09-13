import type { Adapter, Kind } from "@opencode-ai/core/environment"

function makeRemoteAdapter(kind: Kind, name: string, description: string): Adapter {
  return {
    kind,
    name,
    description,
    target(config) {
      if (!config.remoteURL) {
        throw new Error(`${kind} environment is not connected: remoteURL is missing`)
      }
      return { type: "remote", url: new URL(config.remoteURL) }
    },
  }
}

/**
 * Remote environment backed by a GitHub Codespace.
 *
 * The workspace server inside the Codespace exposes the same HTTP/SSE/PTY
 * surface as the local server. SoryCode therefore proxies filesystem,
 * terminal, sessions and agent operations instead of recreating them in UI.
 */
export const CodespacesEnvironmentAdapter = makeRemoteAdapter(
  "codespaces",
  "GitHub Codespaces",
  "Utilise le workspace distant exécuté dans un GitHub Codespace.",
)

/**
 * Remote isolated environment. The provider owns the machine/container and
 * exposes an OpenCode-compatible workspace endpoint.
 */
export const SandboxEnvironmentAdapter = makeRemoteAdapter(
  "sandbox",
  "Sandbox cloud",
  "Utilise un workspace isolé distant pour les fichiers, commandes et builds.",
)
