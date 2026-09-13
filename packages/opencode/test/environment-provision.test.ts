import { describe, expect } from "bun:test"
import { Project } from "@/project/project"
import { CrossSpawnSpawner } from "@opencode-ai/core/cross-spawn-spawner"
import { Database } from "@opencode-ai/core/database/database"
import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { Cause, Effect, Exit } from "effect"
import { provisionSandboxEnvironment, selectionFor } from "@/control-plane/environment"
import { tmpdirScoped } from "./fixture/fixture"
import { testEffect } from "./lib/effect"

const provisionTestNode = LayerNode.group([Project.node, Database.node, CrossSpawnSpawner.node])
const it = testEffect(AppNodeBuilder.build(provisionTestNode))

const failureMessage = (exit: Exit.Exit<unknown, unknown>) => {
  if (!Exit.isFailure(exit)) throw new Error("Expected the effect to fail")
  return String(Cause.squash(exit.cause))
}

describe("provisionSandboxEnvironment", () => {
  it.live("reuses an already-provisioned sandbox without network", () =>
    Effect.gen(function* () {
      const projects = yield* Project.Service
      const tmp = yield* tmpdirScoped()
      const created = yield* projects.fromDirectory(tmp)
      yield* projects.update({
        projectID: created.project.id,
        environment: { kind: "sandbox", remoteURL: "https://sandbox.example", directory: tmp },
      })

      const selection = yield* selectionFor(created.project.id)
      expect(selection.kind).toBe("sandbox")

      const result = yield* provisionSandboxEnvironment(created.project.id)
      expect(result).toEqual({ reused: true, url: "https://sandbox.example" })
    }),
  )

  it.live("refuses to provision a local project", () =>
    Effect.gen(function* () {
      const projects = yield* Project.Service
      const tmp = yield* tmpdirScoped()
      const created = yield* projects.fromDirectory(tmp)

      const exit = yield* Effect.exit(provisionSandboxEnvironment(created.project.id))
      expect(failureMessage(exit)).toContain("not a sandbox environment")
    }),
  )

  it.live("fails explicitly when no provider credentials exist", () =>
    Effect.gen(function* () {
      const projects = yield* Project.Service
      const tmp = yield* tmpdirScoped()
      const created = yield* projects.fromDirectory(tmp)
      yield* projects.update({
        projectID: created.project.id,
        environment: { kind: "sandbox", directory: tmp },
      })

      const exit = yield* Effect.exit(
        provisionSandboxEnvironment(created.project.id, { provider: "e2b", env: {} }),
      )
      expect(failureMessage(exit)).toContain("E2B_API_KEY")
    }),
  )

  it.live("fails before any network when boot is requested without credentials", () =>
    Effect.gen(function* () {
      const projects = yield* Project.Service
      const tmp = yield* tmpdirScoped()
      const created = yield* projects.fromDirectory(tmp)
      yield* projects.update({
        projectID: created.project.id,
        environment: { kind: "sandbox", directory: tmp },
      })

      const exit = yield* Effect.exit(
        provisionSandboxEnvironment(created.project.id, {
          provider: "e2b",
          env: {},
          boot: { start: { cmd: "serve" } },
        }),
      )
      expect(failureMessage(exit)).toContain("E2B_API_KEY")
    }),
  )
})
