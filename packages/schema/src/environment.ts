import { Schema } from "effect"

export const Kind = Schema.Literal("local", "codespaces", "sandbox").annotate({ identifier: "Environment.Kind" })
export type Kind = Schema.Schema.Type<typeof Kind>

/**
 * Connection details identifying a project's execution environment.
 * Credentials deliberately belong to the credential store, never here.
 */
export const Config = Schema.Struct({
  kind: Kind,
  repository: Schema.optional(Schema.String),
  branch: Schema.optional(Schema.String),
  directory: Schema.optional(Schema.String),
  remoteURL: Schema.optional(Schema.String),
  machine: Schema.optional(Schema.String),
}).annotate({ identifier: "Environment.Config" })
export interface Config extends Schema.Schema.Type<typeof Config> {}
