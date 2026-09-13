export * as GithubPlugin from "./github"

import { Duration, Effect, Schema } from "effect"
import type { Scope } from "effect"
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/unstable/http"
import { Credential } from "../credential"
import { Integration } from "../integration"
import { define } from "./internal"

const integrationID = Integration.ID.make("github")
const methodID = Integration.MethodID.make("oauth-device")
const githubAuthorize = "https://github.com/login/oauth/authorize"
const githubDeviceCode = "https://github.com/login/device/code"
const githubAccessToken = "https://github.com/login/oauth/access_token"
const githubApi = "https://api.github.com"
const defaultClientID = "01ab8ac9400c4e429b23"
const scopes = "repo codespace read:user user:email"

const Device = Schema.Struct({
  device_code: Schema.String,
  user_code: Schema.String,
  verification_uri: Schema.String,
  verification_uri_complete: Schema.optional(Schema.String),
  expires_in: Schema.Number,
  interval: Schema.Number,
})

const TokenSuccess = Schema.Struct({
  access_token: Schema.String,
  token_type: Schema.String,
  scope: Schema.String,
})

const TokenPending = Schema.Struct({
  error: Schema.String,
  error_description: Schema.optional(Schema.String),
  error_uri: Schema.optional(Schema.String),
})

const DeviceToken = Schema.Union([TokenSuccess, TokenPending])

const GithubUser = Schema.Struct({
  id: Schema.Number,
  login: Schema.String,
  avatar_url: Schema.optional(Schema.String),
})

function clientID() {
  return process.env.GITHUB_CLIENT_ID?.trim() || defaultClientID
}

function githubPlugin(http: HttpClient.HttpClient) {
  return {
    integrationID,
    method: {
      id: methodID,
      type: "oauth" as const,
      label: "GitHub account (Codespaces)",
    },
    authorize: () =>
      Effect.gen(function* () {
        const device = yield* postForm(http, githubDeviceCode, { client_id: clientID(), scope: scopes }, Device)
        const url = device.verification_uri_complete ?? device.verification_uri
        return {
          mode: "auto" as const,
          url,
          instructions: `Enter code: ${device.user_code}`,
          callback: poll(http, device.device_code, Duration.seconds(device.interval)),
        }
      }),
    label: (credential) => {
      if (typeof credential.metadata?.login === "string") return credential.metadata.login
      return undefined
    },
  }
}

export const Plugin = define({
  id: "github",
  effect: Effect.fn(function* (ctx) {
    const http = yield* HttpClient.HttpClient
    yield* ctx.integration.transform(
      Effect.fn(function* (integrations) {
        integrations.update(integrationID, (integration) => {
          integration.name = "GitHub"
        })
        integrations.method.update(githubPlugin(http))
        integrations.method.update({
          integrationID,
          method: { type: "key", label: "Personal access token" },
        })
        integrations.method.update({
          integrationID,
          method: { type: "env", names: ["GITHUB_TOKEN", "GH_TOKEN"] },
        })
      }),
    )
  }),
})

function poll(http: HttpClient.HttpClient, deviceCode: string, interval: Duration.Duration) {
  const loop = (wait: Duration.Duration): Effect.Effect<Credential.OAuth, unknown> =>
    Effect.gen(function* () {
      yield* Effect.sleep(wait)
      const result = yield* postForm(http, githubAccessToken, {
        client_id: clientID(),
        device_code: deviceCode,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      }, DeviceToken, false)
      if ("access_token" in result) return yield* credential(http, result)
      if (result.error === "authorization_pending") return yield* loop(wait)
      if (result.error === "slow_down") return yield* loop(Duration.sum(wait, Duration.seconds(5)))
      if (result.error === "expired_token") return yield* Effect.fail(new Error("Device code expired. Please retry."))
      return yield* Effect.fail(new Error(`GitHub authorization failed: ${result.error} ${result.error_description ?? ""}`.trim()))
    })
  return loop(interval)
}

function credential(http: HttpClient.HttpClient, token: typeof TokenSuccess.Type) {
  return Effect.gen(function* () {
    const user = yield* get(http, `${githubApi}/user`, token.access_token, GithubUser)
    return Credential.OAuth.make({
      type: "oauth" as const,
      methodID,
      access: token.access_token,
      refresh: "",
      expires: Date.now() + 1000 * 60 * 60 * 24 * 365,
      metadata: {
        login: user.login,
        accountID: String(user.id),
        avatarUrl: user.avatar_url,
        scope: token.scope,
      },
    })
  })
}

function get<S extends Schema.Top>(http: HttpClient.HttpClient, url: string, token: string, schema: S) {
  return HttpClient.filterStatusOk(http)
    .execute(HttpClientRequest.get(url).pipe(HttpClientRequest.acceptJson, HttpClientRequest.bearerToken(token), HttpClientRequest.setHeader("User-Agent", "SoryCode")))
    .pipe(Effect.flatMap(HttpClientResponse.schemaBodyJson(schema)))
}

function postForm<S extends Schema.Top>(http: HttpClient.HttpClient, url: string, body: Record<string, string>, schema: S, statusOk = true) {
  return HttpClientRequest.post(url).pipe(
    HttpClientRequest.acceptJson,
    HttpClientRequest.setHeader("Accept", "application/json"),
    HttpClientRequest.schemaBodyJson(Schema.Record(Schema.String, Schema.String))(body),
    Effect.flatMap((request) => http.execute(request)),
    Effect.flatMap((response) => (statusOk ? HttpClientResponse.filterStatusOk(response) : Effect.succeed(response))),
    Effect.flatMap(HttpClientResponse.schemaBodyJson(schema)),
  )
}

export const unusedAuthorizeUrl = githubAuthorize
