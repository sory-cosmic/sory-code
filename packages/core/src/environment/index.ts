import { Config, Kind } from "@opencode-ai/schema/environment"

export { Config, Kind }
export type { Config, Kind }

export type Target =
  | { type: "local"; directory: string }
  | { type: "remote"; url: URL | string; headers?: HeadersInit }

export interface AdapterContext {
  projectID: string
  workspaceID?: string
}

export interface Adapter {
  readonly kind: Kind
  readonly name: string
  readonly description: string
  readonly target: (config: Config, context: AdapterContext) => Target | Promise<Target>
  readonly create?: (config: Config, context: AdapterContext) => Promise<void>
  readonly remove?: (config: Config, context: AdapterContext) => Promise<void>
}

export function isRemote(kind: Kind) {
  return kind !== "local"
}
