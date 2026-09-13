import { Effect, Schema } from "effect"
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/unstable/http"

export const CodespaceState = Schema.Literal(
  "Unknown",
  "Created",
  "Queued",
  "Provisioning",
  "Available",
  "Awaiting",
  "Unavailable",
  "Deleted",
  "Moved",
  "Shutdown",
  "Archived",
  "Starting",
  "ShuttingDown",
  "Failed",
  "Exporting",
  "Updating",
  "Rebuilding",
)

export const Codespace = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  display_name: Schema.optional(Schema.String),
  state: CodespaceState,
  repository: Schema.optional(Schema.String),
  git_status: Schema.optional(
    Schema.Struct({
      ref: Schema.optional(Schema.String),
      has_uncommitted_changes: Schema.optional(Schema.Boolean),
    }),
  ),
  web_url: Schema.optional(Schema.String),
})

export type Codespace = Schema.Schema.Type<typeof Codespace>

const CodespaceList = Schema.Struct({
  total_count: Schema.Number,
  codespaces: Schema.Array(Codespace),
})

const CreateInput = Schema.Struct({
  repository_id: Schema.optional(Schema.Number),
  pull_request: Schema.optional(Schema.Struct({ pull_request_number: Schema.Number, repository_id: Schema.Number })),
  ref: Schema.optional(Schema.String),
  location: Schema.optional(Schema.String),
  geo: Schema.optional(Schema.String),
  client_ip: Schema.optional(Schema.String),
  machine: Schema.optional(Schema.String),
  devcontainer_path: Schema.optional(Schema.String),
  multi_repo_permissions_opt_out: Schema.optional(Schema.Boolean),
  working_directory: Schema.optional(Schema.String),
  idle_timeout_minutes: Schema.optional(Schema.Number),
  retention_period_minutes: Schema.optional(Schema.Number),
  display_name: Schema.optional(Schema.String),
})

export interface CreateCodespaceInput {
  readonly repository: string
  readonly branch?: string
  readonly machine?: string
  readonly displayName?: string
}

export function parseRepository(input: string) {
  const trimmed = input.trim()
  if (!trimmed) throw new Error("Repository is required (owner/repo)")
  const parts = trimmed.split("/")
  if (parts.length !== 2 || !parts[0] || !parts[1]) throw new Error(`Invalid repository "${input}". Expected "owner/repo"`)
  return { owner: parts[0], repo: parts[1], full: `${parts[0]}/${parts[1]}` }
}

function auth(token: string) {
  return HttpClientRequest.bearerToken(token).pipe(
    (req) => HttpClientRequest.setHeader("User-Agent", "SoryCode")(req as any),
  ) as any
}

export const listCodespaces = Effect.fn("Codespace.list")(function* (http: HttpClient.HttpClient, token: string) {
  const request = HttpClientRequest.get("https://api.github.com/user/codespaces").pipe(
    HttpClientRequest.acceptJson,
    HttpClientRequest.bearerToken(token),
    HttpClientRequest.setHeader("User-Agent", "SoryCode"),
  )
  const response = yield* http.execute(request).pipe(Effect.flatMap(HttpClientResponse.filterStatusOk))
  const body = yield* HttpClientResponse.schemaBodyJson(CodespaceList)(response)
  return body.codespaces
})

export const getCodespace = Effect.fn("Codespace.get")(function* (http: HttpClient.HttpClient, token: string, name: string) {
  const request = HttpClientRequest.get(`https://api.github.com/user/codespaces/${encodeURIComponent(name)}`).pipe(
    HttpClientRequest.acceptJson,
    HttpClientRequest.bearerToken(token),
    HttpClientRequest.setHeader("User-Agent", "SoryCode"),
  )
  const response = yield* http.execute(request).pipe(Effect.flatMap(HttpClientResponse.filterStatusOk))
  return yield* HttpClientResponse.schemaBodyJson(Codespace)(response)
})

export const createCodespace = Effect.fn("Codespace.create")(function* (
  http: HttpClient.HttpClient,
  token: string,
  input: CreateCodespaceInput,
) {
  const { owner, repo } = parseRepository(input.repository)
  const repoReq = HttpClientRequest.get(`https://api.github.com/repos/${owner}/${repo}`).pipe(
    HttpClientRequest.acceptJson,
    HttpClientRequest.bearerToken(token),
    HttpClientRequest.setHeader("User-Agent", "SoryCode"),
  )
  const repoRes = yield* http.execute(repoReq).pipe(Effect.flatMap(HttpClientResponse.filterStatusOk))
  const repoInfo = yield* HttpClientResponse.schemaBodyJson(Schema.Struct({ id: Schema.Number }))(repoRes)
  const body: Record<string, unknown> = {
    repository_id: repoInfo.id,
    ref: input.branch,
    machine: input.machine,
    display_name: input.displayName,
  }
  for (const key of Object.keys(body)) if ((body as any)[key] === undefined) delete (body as any)[key]
  const request = HttpClientRequest.post("https://api.github.com/user/codespaces").pipe(
    HttpClientRequest.acceptJson,
    HttpClientRequest.bearerToken(token),
    HttpClientRequest.setHeader("User-Agent", "SoryCode"),
    HttpClientRequest.schemaBodyJson(Schema.Record(Schema.String, Schema.Unknown))(body as any),
    Effect.flatMap((req) => http.execute(req as any)),
    Effect.flatMap(HttpClientResponse.filterStatusOk),
    Effect.flatMap(HttpClientResponse.schemaBodyJson(Codespace)),
  )
  return yield* request
})

export const waitForCodespace = Effect.fn("Codespace.wait")(function* (
  http: HttpClient.HttpClient,
  token: string,
  name: string,
  input: { timeoutMs?: number; intervalMs?: number } = {},
) {
  const timeoutMs = input.timeoutMs ?? 5 * 60 * 1000
  const intervalMs = input.intervalMs ?? 5000
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const codespace = yield* getCodespace(http, token, name)
    if (codespace.state === "Available") return codespace
    if (codespace.state === "Failed" || codespace.state === "Unavailable" || codespace.state === "Deleted") {
      return yield* Effect.fail(new Error(`Codespace ${name} entered terminal state: ${codespace.state}`))
    }
    yield* Effect.sleep(intervalMs)
  }
  return yield* Effect.fail(new Error(`Timed out waiting for codespace ${name} to become Available`))
})

export * as CodespaceClient from "./codespace"
