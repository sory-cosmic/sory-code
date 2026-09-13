import { describe, expect, test } from "bun:test"
import { Credential } from "@opencode-ai/core/credential"
import { Integration } from "@opencode-ai/core/integration"
import { ProjectV2 } from "@opencode-ai/core/project"
import { selectionFromProject } from "@/control-plane/environment"
import { credentialToOverrides } from "@/control-plane/sandbox-credentials"

const project = (environment: Parameters<typeof selectionFromProject>[0]["environment"]) =>
  selectionFromProject({ id: ProjectV2.ID.make("p"), worktree: "/repo", environment })

describe("selectionFromProject", () => {
  test("defaults to local execution on the project worktree", () => {
    expect(project(undefined)).toEqual({
      projectID: "p",
      kind: "local",
      config: { kind: "local", directory: "/repo" },
    })
  })

  test("preserves a persisted sandbox selection", () => {
    expect(project({ kind: "sandbox", remoteURL: "https://sandbox.example", directory: "/repo" })).toEqual({
      projectID: "p",
      kind: "sandbox",
      config: { kind: "sandbox", remoteURL: "https://sandbox.example", directory: "/repo" },
    })
  })

  test("backfills the worktree directory when missing", () => {
    const selection = project({ kind: "codespaces", repository: "owner/repo" })
    expect(selection.kind).toBe("codespaces")
    expect(selection.config.directory).toBe("/repo")
  })
})

describe("credentialToOverrides", () => {
  test("maps a stored e2b key to overrides", () => {
    expect(credentialToOverrides("e2b", Credential.Key.make({ type: "key", key: "k" }))).toEqual({ e2bApiKey: "k" })
  })

  test("maps a stored vercel key to a token override", () => {
    expect(credentialToOverrides("vercel", Credential.Key.make({ type: "key", key: "k" }))).toEqual({
      vercelToken: "k",
    })
  })

  test("ignores missing and non-key credentials so env stays authoritative", () => {
    expect(credentialToOverrides("e2b", undefined)).toEqual({})
    const oauth = Credential.OAuth.make({
      type: "oauth",
      methodID: Integration.MethodID.make("m"),
      refresh: "r",
      access: "a",
      expires: Date.now() + 1000,
    })
    expect(credentialToOverrides("e2b", oauth)).toEqual({})
  })
})
