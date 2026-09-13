import * as InstanceState from "@/effect/instance-state"
import { registerDisposer } from "@/effect/instance-registry"
import { InstanceRef, WorkspaceRef } from "@/effect/instance-ref"
import { Plugin } from "@/plugin"
import { Pty } from "@opencode-ai/core/pty"
import { PtyProtocol } from "@opencode-ai/core/pty/protocol"
import { PtyID } from "@opencode-ai/core/pty/schema"
import type { ProjectV2 } from "@opencode-ai/core/project"
import { provisionCodespaceEnvironment, provisionSandboxEnvironment, selectionFor } from "@/control-plane/environment"
import { createSandboxProvider, resolveProviderKind } from "@/control-plane/adapters/sandbox-provider"
import { sandboxCredentials } from "@/control-plane/sandbox-credentials"
import {
  createSandboxPty,
  feedSandboxPty,
  getSandboxPty,
  isSandboxPty,
  listSandboxPtys,
  removeSandboxPty,
} from "@/control-plane/sandbox-pty"
import {
  createCodespacePty,
  feedCodespacePty,
  getCodespacePty,
  isCodespacePty,
  listCodespacePtys,
  removeCodespacePty,
} from "@/control-plane/codespace-pty"
import { PtyTicket } from "@opencode-ai/core/pty/ticket"
import { LocationServiceMap, locationServiceMapLayer } from "@opencode-ai/core/location-services"
import { Location } from "@opencode-ai/core/location"
import { AbsolutePath } from "@opencode-ai/core/schema"
import { Shell } from "@opencode-ai/core/shell"
import { CorsConfig, isAllowedRequestOrigin, type CorsOptions } from "@opencode-ai/server/cors"
import {
  PTY_CONNECT_TICKET_QUERY,
  PTY_CONNECT_TOKEN_HEADER,
  PTY_CONNECT_TOKEN_HEADER_VALUE,
} from "@/server/shared/pty-ticket"
import { Effect, Layer, Option, Queue, Schema } from "effect"
import { HttpServerRequest, HttpServerResponse } from "effect/unstable/http"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import * as Socket from "effect/unstable/socket/Socket"
import { InstanceHttpApi } from "../api"
import * as ApiError from "../errors"
import { CursorQuery, PtyConnectApi } from "../groups/pty"
import { WebSocketTracker } from "../websocket-tracker"

function validOrigin(request: HttpServerRequest.HttpServerRequest, opts: CorsOptions | undefined) {
  return isAllowedRequestOrigin(request.headers.origin, request.headers.host, opts)
}

const ticketScope = Effect.gen(function* () {
  const instance = yield* InstanceRef
  const workspaceID = yield* WorkspaceRef
  return { directory: instance?.directory, workspaceID }
})

// Legacy surface compatibility: before exited-session retention, sessions vanished the moment
// their process exited. These routes preserve that observable behavior — exited sessions are
// invisible here — while the canonical /api/pty surface exposes them until removal.
export const ptyHandlers = HttpApiBuilder.group(InstanceHttpApi, "pty", (handlers) =>
  Effect.gen(function* () {
    const tickets = yield* PtyTicket.Service
    const cors = yield* CorsConfig
    const plugin = yield* Plugin.Service
    const locations = yield* LocationServiceMap.Service
    const unregister = registerDisposer((directory) =>
      Effect.runPromise(locations.invalidate(Location.Ref.make({ directory: AbsolutePath.make(directory) }))),
    )
    yield* Effect.addFinalizer(() => Effect.sync(unregister))

    const pty = Effect.fnUntraced(function* <A, E, R>(effect: Effect.Effect<A, E, R>) {
      return yield* effect.pipe(
        Effect.provide(
          locations.get(Location.Ref.make({ directory: AbsolutePath.make((yield* InstanceState.context).directory) })),
        ),
      )
    })

    const shells = Effect.fn("PtyHttpApi.shells")(function* () {
      return yield* Effect.promise(() => Shell.list())
    })

    const sandboxInfo = (ptyID: string) => {
      const session = getSandboxPty(ptyID)
      if (!session) return undefined
      return {
        id: PtyID.make(ptyID),
        title: "Sandbox",
        command: "sandbox",
        args: [session.provider.kind],
        cwd: session.cwd,
        status: "running" as const,
        pid: 0,
      }
    }

    const codespaceInfo = (ptyID: string) => {
      const session = getCodespacePty(ptyID)
      if (!session) return undefined
      return {
        id: PtyID.make(ptyID),
        title: "Codespace",
        command: "codespace",
        args: [session.repository ?? "github"],
        cwd: session.cwd,
        status: "running" as const,
        pid: 0,
      }
    }

    /**
     * Resolve the sandbox remote URL for a project, provisioning on demand.
     * Opening a terminal on a sandbox workspace connects the sandbox, just
     * like activating a Python venv connects its interpreter — the same
     * physical terminal panel runs the commands, only the execution target
     * changes. Missing credentials fail with an explicit message instead of
     * silently falling back to the local PC.
     */
    const sandboxTarget = Effect.fn("PtyHttpApi.sandboxTarget")(function* (projectID: ProjectV2.ID) {
      const selection = yield* selectionFor(projectID)
      if (selection.kind !== "sandbox") return undefined
      if (selection.config.remoteURL) return selection.config.remoteURL
      const provisioned = yield* provisionSandboxEnvironment(projectID)
      return provisioned.reused ? provisioned.url : provisioned.info.url
    })

    const codespaceTarget = Effect.fn("PtyHttpApi.codespaceTarget")(function* (projectID: ProjectV2.ID) {
      const selection = yield* selectionFor(projectID)
      if (selection.kind !== "codespaces") return undefined
      if (selection.config.remoteURL) return selection.config.remoteURL
      const provisioned = yield* provisionCodespaceEnvironment(projectID)
      return (provisioned as any).url ?? (provisioned as any).info?.web_url
    })

    const createSandboxTerminal = Effect.fn("PtyHttpApi.createSandbox")(function* (
      projectID: ProjectV2.ID,
      cwd: string,
      remoteURL: string,
      title?: string,
    ) {
      const kind = resolveProviderKind()
      const stored = yield* pty(sandboxCredentials(kind).pipe(Effect.catchCause(() => Effect.succeed({}))))
      const provider = yield* Effect.promise(() => createSandboxProvider(kind, { ...stored }))
      const id = PtyID.create()
      createSandboxPty({ id, provider, projectID: String(projectID), cwd, url: remoteURL })
      return {
        id,
        title: title ?? "Sandbox",
        command: "sandbox",
        args: [kind],
        cwd,
        status: "running" as const,
        pid: 0,
      }
    })

    const createCodespaceTerminal = Effect.fn("PtyHttpApi.createCodespace")(function* (
      projectID: ProjectV2.ID,
      cwd: string,
      remoteURL: string,
      title?: string,
    ) {
      const selection = yield* selectionFor(projectID)
      const id = PtyID.create()
      createCodespacePty({
        id: String(id),
        projectID: String(projectID),
        cwd,
        url: remoteURL,
        repository: selection.config.repository,
        branch: selection.config.branch,
      })
      return {
        id,
        title: title ?? "Codespace",
        command: "codespace",
        args: [selection.config.repository ?? "github"],
        cwd,
        status: "running" as const,
        pid: 0,
      }
    })

    const list = Effect.fn("PtyHttpApi.list")(function* () {
      const sessions = yield* pty(Pty.Service.use((service) => service.list()))
      const sandbox = listSandboxPtys().map((session) => sandboxInfo(session.id)).filter((info) => info !== undefined)
      const codespaces = listCodespacePtys().map((session) => codespaceInfo(session.id)).filter((info) => info !== undefined)
      return [...sessions.filter((info) => info.status === "running"), ...sandbox, ...codespaces]
    })

    const create = Effect.fn("PtyHttpApi.create")(function* (ctx: { payload: typeof Pty.CreateInput.Type }) {
      const instance = yield* InstanceState.context
      const cwd = ctx.payload.cwd || instance.directory
      const sandboxURL = yield* sandboxTarget(instance.project.id)
      if (sandboxURL) return yield* createSandboxTerminal(instance.project.id, cwd, sandboxURL, ctx.payload.title)
      const codespaceURL = yield* codespaceTarget(instance.project.id)
      if (codespaceURL) return yield* createCodespaceTerminal(instance.project.id, cwd, codespaceURL, ctx.payload.title)
      const shell = yield* plugin.trigger("shell.env", { cwd }, { env: {} as Record<string, string> })
      return yield* pty(
        Pty.Service.use((service) =>
          service.create({
            ...ctx.payload,
            args: ctx.payload.args ? [...ctx.payload.args] : undefined,
            cwd,
            env: { ...ctx.payload.env, ...shell.env },
          }),
        ),
      )
    })

    const get = Effect.fn("PtyHttpApi.get")(function* (ctx: { params: { ptyID: PtyID } }) {
      const sandbox = sandboxInfo(String(ctx.params.ptyID))
      if (sandbox) return sandbox
      const codespace = codespaceInfo(String(ctx.params.ptyID))
      if (codespace) return codespace
      return yield* pty(Pty.Service.use((service) => service.get(ctx.params.ptyID))).pipe(
        Effect.catchTag(
          "Pty.NotFoundError",
          (error) =>
            new ApiError.PtyNotFoundError({
              ptyID: error.ptyID,
              message: `PTY session not found: ${error.ptyID}`,
            }),
        ),
        Effect.flatMap((info) =>
          info.status === "running"
            ? Effect.succeed(info)
            : new ApiError.PtyNotFoundError({
                ptyID: ctx.params.ptyID,
                message: `PTY session not found: ${ctx.params.ptyID}`,
              }),
        ),
      )
    })

    const update = Effect.fn("PtyHttpApi.update")(function* (ctx: {
      params: { ptyID: PtyID }
      payload: typeof Pty.UpdateInput.Type
    }) {
      const sandbox = sandboxInfo(String(ctx.params.ptyID))
      if (sandbox) return ctx.payload.title ? { ...sandbox, title: ctx.payload.title } : sandbox
      const codespace = codespaceInfo(String(ctx.params.ptyID))
      if (codespace) return ctx.payload.title ? { ...codespace, title: ctx.payload.title } : codespace
      yield* get(ctx)
      return yield* pty(
        Pty.Service.use((service) =>
          service.update(ctx.params.ptyID, {
            ...ctx.payload,
            size: ctx.payload.size ? { ...ctx.payload.size } : undefined,
          }),
        ),
      ).pipe(
        Effect.catchTag(
          "Pty.NotFoundError",
          (error) =>
            new ApiError.PtyNotFoundError({
              ptyID: error.ptyID,
              message: `PTY session not found: ${error.ptyID}`,
            }),
        ),
      )
    })

    const remove = Effect.fn("PtyHttpApi.remove")(function* (ctx: { params: { ptyID: PtyID } }) {
      if (isSandboxPty(String(ctx.params.ptyID))) {
        removeSandboxPty(String(ctx.params.ptyID))
        return true
      }
      if (isCodespacePty(String(ctx.params.ptyID))) {
        removeCodespacePty(String(ctx.params.ptyID))
        return true
      }
      yield* get(ctx)
      yield* pty(Pty.Service.use((service) => service.remove(ctx.params.ptyID))).pipe(
        Effect.catchTag(
          "Pty.NotFoundError",
          (error) =>
            new ApiError.PtyNotFoundError({
              ptyID: error.ptyID,
              message: `PTY session not found: ${error.ptyID}`,
            }),
        ),
      )
      return true
    })

    const connectToken = Effect.fn("PtyHttpApi.connectToken")(function* (ctx: { params: { ptyID: PtyID } }) {
      const request = yield* HttpServerRequest.HttpServerRequest
      if (request.headers[PTY_CONNECT_TOKEN_HEADER] !== PTY_CONNECT_TOKEN_HEADER_VALUE || !validOrigin(request, cors))
        return yield* new ApiError.PtyForbiddenError({ message: "Invalid PTY connect token request" })
      yield* get(ctx)
      return yield* tickets.issue({ ptyID: ctx.params.ptyID, ...(yield* ticketScope) })
    })

    return handlers
      .handle("shells", shells)
      .handle("list", list)
      .handle("create", create)
      .handle("get", get)
      .handle("update", update)
      .handle("remove", remove)
      .handle("connectToken", connectToken)
  }),
).pipe(Layer.provide(locationServiceMapLayer))

export const ptyConnectHandlers = HttpApiBuilder.group(PtyConnectApi, "pty-connect", (handlers) =>
  Effect.gen(function* () {
    const tickets = yield* PtyTicket.Service
    const cors = yield* CorsConfig
    const locations = yield* LocationServiceMap.Service
    const unregister = registerDisposer((directory) =>
      Effect.runPromise(locations.invalidate(Location.Ref.make({ directory: AbsolutePath.make(directory) }))),
    )
    yield* Effect.addFinalizer(() => Effect.sync(unregister))

    const pty = Effect.fnUntraced(function* <A, E, R>(effect: Effect.Effect<A, E, R>) {
      return yield* effect.pipe(
        Effect.provide(
          locations.get(Location.Ref.make({ directory: AbsolutePath.make((yield* InstanceState.context).directory) })),
        ),
      )
    })

    return handlers.handleRaw(
      "connect",
      Effect.fn("PtyHttpApi.connect")(function* (ctx: {
        params: { ptyID: PtyID }
        request: HttpServerRequest.HttpServerRequest
      }) {
        const sandboxID = isSandboxPty(String(ctx.params.ptyID)) ? String(ctx.params.ptyID) : undefined
        const codespaceID = isCodespacePty(String(ctx.params.ptyID)) ? String(ctx.params.ptyID) : undefined
        const exists =
          sandboxID !== undefined ||
          codespaceID !== undefined ||
          (yield* pty(Pty.Service.use((service) => service.get(ctx.params.ptyID))).pipe(
            Effect.map((info) => info.status === "running"),
            Effect.catchTag("Pty.NotFoundError", () => Effect.succeed(false)),
          ))
        if (!exists) return HttpServerResponse.empty({ status: 404 })

        const query = Schema.decodeUnknownOption(CursorQuery)(yield* HttpServerRequest.ParsedSearchParams)
        if (Option.isNone(query)) return HttpServerResponse.empty({ status: 400 })
        const ticket = new URL(ctx.request.url, "http://localhost").searchParams.get(PTY_CONNECT_TICKET_QUERY)
        if (ticket) {
          const valid = validOrigin(ctx.request, cors)
            ? yield* tickets.consume({ ticket, ptyID: ctx.params.ptyID, ...(yield* ticketScope) })
            : false
          if (!valid) return HttpServerResponse.empty({ status: 403 })
        }
        const parsedCursor = query.value.cursor === undefined ? undefined : Number(query.value.cursor)
        const cursor =
          parsedCursor !== undefined && Number.isSafeInteger(parsedCursor) && parsedCursor >= -1
            ? parsedCursor
            : undefined
        const socket = yield* Effect.orDie(ctx.request.upgrade)
        const write = yield* socket.writer
        const closeAccepted = (event: Socket.CloseEvent) =>
          socket
            .runRaw(() => Effect.void, { onOpen: write(event).pipe(Effect.catch(() => Effect.void)) })
            .pipe(
              Effect.timeout("1 second"),
              Effect.catchReason("SocketError", "SocketCloseError", () => Effect.void),
              Effect.catch(() => Effect.void),
            )
        const registered = yield* WebSocketTracker.register(write(WebSocketTracker.SERVER_CLOSING_EVENT()))
        if (!registered) {
          yield* closeAccepted(WebSocketTracker.SERVER_CLOSING_EVENT())
          return HttpServerResponse.empty()
        }

        // Outbound frames flow through one queue drained by a single writer so replay, live
        // output, and the close frame keep their order.
        const outbox = yield* Queue.unbounded<string | Uint8Array | Socket.CloseEvent>()
        const sandbox = sandboxID ? getSandboxPty(sandboxID) : undefined
        if (sandbox) {
          for (const chunk of PtyProtocol.chunks(sandbox.replay)) Queue.offerUnsafe(outbox, chunk)
          Queue.offerUnsafe(outbox, PtyProtocol.metaFrame(sandbox.cursor))
          const drainSandbox = Effect.gen(function* () {
            while (true) {
              const item = yield* Queue.take(outbox)
              yield* write(item)
              if (item instanceof Socket.CloseEvent) return
            }
          })
          yield* Effect.race(
            drainSandbox,
            socket.runRaw((message) => {
              const decoded = PtyProtocol.decodeInput(message)
              if (decoded === undefined) return Effect.void
              return Effect.promise(() => feedSandboxPty(sandbox, decoded)).pipe(
                Effect.flatMap((result) => {
                  for (const chunk of result.chunks) Queue.offerUnsafe(outbox, chunk)
                  if (result.closed) Queue.offerUnsafe(outbox, new Socket.CloseEvent(1000))
                  return Effect.void
                }),
                Effect.catch(() => Effect.void),
              )
            }),
          ).pipe(
            Effect.catchReason("SocketError", "SocketCloseError", () => Effect.void),
            Effect.orDie,
          )
          return HttpServerResponse.empty()
        }
        const codespace = codespaceID ? getCodespacePty(codespaceID) : undefined
        if (codespace) {
          for (const chunk of PtyProtocol.chunks(codespace.replay)) Queue.offerUnsafe(outbox, chunk)
          Queue.offerUnsafe(outbox, PtyProtocol.metaFrame(codespace.cursor))
          const drainCodespace = Effect.gen(function* () {
            while (true) {
              const item = yield* Queue.take(outbox)
              yield* write(item)
              if (item instanceof Socket.CloseEvent) return
            }
          })
          yield* Effect.race(
            drainCodespace,
            socket.runRaw((message) => {
              const decoded = PtyProtocol.decodeInput(message)
              if (decoded === undefined) return Effect.void
              return Effect.promise(() => feedCodespacePty(codespace, decoded)).pipe(
                Effect.flatMap((result) => {
                  for (const chunk of result.chunks) Queue.offerUnsafe(outbox, chunk)
                  if (result.closed) Queue.offerUnsafe(outbox, new Socket.CloseEvent(1000))
                  return Effect.void
                }),
                Effect.catch(() => Effect.void),
              )
            }),
          ).pipe(
            Effect.catchReason("SocketError", "SocketCloseError", () => Effect.void),
            Effect.orDie,
          )
          return HttpServerResponse.empty()
        }
        const attachment = yield* pty(
          Pty.Service.use((service) =>
            service.attach(ctx.params.ptyID, {
              cursor,
              onData: (chunk) => Queue.offerUnsafe(outbox, chunk),
              onEnd: () => Queue.offerUnsafe(outbox, new Socket.CloseEvent(1000)),
            }),
          ),
        ).pipe(
          Effect.catchTags({
            "Pty.NotFoundError": () =>
              closeAccepted(new Socket.CloseEvent(4404, "session not found")).pipe(Effect.as(undefined)),
            "Pty.ExitedError": () =>
              closeAccepted(new Socket.CloseEvent(4404, "session not found")).pipe(Effect.as(undefined)),
          }),
        )
        if (!attachment) return HttpServerResponse.empty()

        for (const chunk of PtyProtocol.chunks(attachment.replay)) Queue.offerUnsafe(outbox, chunk)
        Queue.offerUnsafe(outbox, PtyProtocol.metaFrame(attachment.cursor))
        attachment.activate()

        const drain = Effect.gen(function* () {
          while (true) {
            const item = yield* Queue.take(outbox)
            yield* write(item)
            if (item instanceof Socket.CloseEvent) return
          }
        })

        // The reader runs concurrently with the writer; whichever finishes first ends the
        // connection and the attachment is always released.
        yield* Effect.race(
          drain,
          socket.runRaw((message) => {
            const decoded = PtyProtocol.decodeInput(message)
            if (decoded !== undefined) attachment.write(decoded)
          }),
        ).pipe(
          Effect.catchReason("SocketError", "SocketCloseError", () => Effect.void),
          Effect.ensuring(Effect.sync(() => attachment.detach())),
          Effect.orDie,
        )
        return HttpServerResponse.empty()
      }),
    )
  }),
).pipe(Layer.provide(locationServiceMapLayer))
