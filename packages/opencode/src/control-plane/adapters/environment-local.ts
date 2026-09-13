import type { Adapter } from "@opencode-ai/core/environment"

export const LocalEnvironmentAdapter: Adapter = {
  kind: "local",
  name: "PC local",
  description: "Exécute le projet directement sur la machine locale.",
  target(config) {
    if (!config.directory) throw new Error("Local environment requires a directory")
    return { type: "local", directory: config.directory }
  },
}
