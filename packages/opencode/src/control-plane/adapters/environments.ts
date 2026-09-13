import type { Adapter, Kind } from "@opencode-ai/core/environment"
import { CodespacesEnvironmentAdapter, SandboxEnvironmentAdapter } from "./environment-remote"
import { LocalEnvironmentAdapter } from "./environment-local"

export const ENVIRONMENT_ADAPTERS: Record<Kind, Adapter> = {
  local: LocalEnvironmentAdapter,
  codespaces: CodespacesEnvironmentAdapter,
  sandbox: SandboxEnvironmentAdapter,
}

export function getEnvironmentAdapter(kind: Kind) {
  return ENVIRONMENT_ADAPTERS[kind]
}

export function listEnvironmentAdapters() {
  return Object.values(ENVIRONMENT_ADAPTERS).map((adapter) => ({
    kind: adapter.kind,
    name: adapter.name,
    description: adapter.description,
  }))
}
