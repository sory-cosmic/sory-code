import { describe, expect, test } from "bun:test"
import { buildEnvironment, resolveInitialEnvironment } from "./edit-project"

describe("resolveInitialEnvironment", () => {
  test("prefers the server environment over browser storage", () => {
    localStorage.setItem("sorycode.project.environment.p1", JSON.stringify({ kind: "sandbox" }))
    expect(
      resolveInitialEnvironment({
        id: "p1",
        environment: { kind: "codespaces", repository: "owner/repo", branch: "main" },
      }),
    ).toEqual({ kind: "codespaces", repository: "owner/repo", branch: "main", remoteURL: undefined })
  })

  test("falls back to browser storage when the server has none", () => {
    localStorage.setItem(
      "sorycode.project.environment.p2",
      JSON.stringify({ kind: "sandbox", remoteURL: "https://sandbox.example" }),
    )
    expect(resolveInitialEnvironment({ id: "p2", environment: undefined })).toEqual({
      kind: "sandbox",
      repository: undefined,
      branch: undefined,
      remoteURL: "https://sandbox.example",
    })
  })

  test("falls back to local when nothing is stored", () => {
    expect(resolveInitialEnvironment({ id: "p3", environment: undefined })).toEqual({
      kind: "local",
    })
  })
})

describe("buildEnvironment", () => {
  test("sandbox without URL omits remoteURL for auto-provisioning", () => {
    expect(
      buildEnvironment({ kind: "sandbox", repository: "", branch: "", sandboxURL: "   ", directory: "/repo" }),
    ).toEqual({ kind: "sandbox", remoteURL: undefined, directory: "/repo" })
  })

  test("sandbox with URL keeps it", () => {
    expect(
      buildEnvironment({
        kind: "sandbox",
        repository: "",
        branch: "",
        sandboxURL: "https://sandbox.example",
        directory: "/repo",
      }),
    ).toEqual({ kind: "sandbox", remoteURL: "https://sandbox.example", directory: "/repo" })
  })
})
