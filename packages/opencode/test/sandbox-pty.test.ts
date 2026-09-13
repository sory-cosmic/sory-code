import { describe, expect, test } from "bun:test"
import type { PtyID } from "@opencode-ai/core/pty/schema"
import type { CommandResult, Provider } from "@/control-plane/adapters/sandbox-provider"
import {
  createSandboxPty,
  feedSandboxPty,
  getSandboxPty,
  isSandboxPty,
  listSandboxPtys,
  removeSandboxPty,
} from "@/control-plane/sandbox-pty"

const ok = (stdout: string): CommandResult => ({ stdout, stderr: "", exitCode: 0, success: true })

function scripted(handler: (cmd: string) => CommandResult) {
  const seen: string[] = []
  const provider: Provider = {
    kind: "e2b",
    info: () => undefined,
    create: () => Promise.reject(new Error("must not create in pty tests")),
    publicUrl: (port: number) => `https://fake:${port}`,
    runCommand: (input) => {
      seen.push([input.cmd, ...(input.args ?? [])].join(" "))
      return Promise.resolve(handler([input.cmd, ...(input.args ?? [])].join(" ")))
    },
    writeFile: () => Promise.resolve(),
    readFile: () => Promise.resolve(""),
    listFiles: () => Promise.resolve([]),
    terminate: () => Promise.resolve(),
    isAlive: () => Promise.resolve(true),
  }
  return { provider, seen }
}

function session(provider: Provider, id: string) {
  removeSandboxPty(id)
  return createSandboxPty({
    id: id as PtyID,
    provider,
    projectID: "p",
    cwd: "/repo",
    url: "https://fake:4096",
  })
}

describe("sandbox-pty registry", () => {
  test("create announces the sandbox banner in the replay", () => {
    const { provider } = scripted(() => ok(""))
    const created = session(provider, "pty_banner")
    expect(isSandboxPty("pty_banner")).toBe(true)
    expect(created.replay).toContain("Connected to e2b sandbox")
    expect(created.replay.endsWith("sandbox$ ")).toBe(true)
    expect(getSandboxPty("pty_banner")?.cursor).toBe(created.replay.length)
    expect(listSandboxPtys().some((item) => item.id === "pty_banner")).toBe(true)
    removeSandboxPty("pty_banner")
    expect(isSandboxPty("pty_banner")).toBe(false)
  })
})

describe("feedSandboxPty", () => {
  test("echoes typing and runs complete lines in the sandbox", async () => {
    const { provider, seen } = scripted((cmd) => ok(cmd.includes("echo hi") ? "hi\n" : ""))
    const created = session(provider, "pty_echo")
    const typed = await feedSandboxPty(created, "echo hi")
    expect(typed.closed).toBe(false)
    expect(typed.chunks.join("")).toBe("echo hi")
    const submitted = await feedSandboxPty(created, "\r")
    expect(submitted.chunks.join("")).toContain("hi\n")
    expect(submitted.chunks.join("").endsWith("sandbox$ ")).toBe(true)
    expect(seen.some((line) => line.includes("echo hi"))).toBe(true)
    removeSandboxPty("pty_echo")
  })

  test("handles backspace, empty lines and Ctrl-C", async () => {
    const { provider, seen } = scripted(() => ok("x\n"))
    const created = session(provider, "pty_edit")
    await feedSandboxPty(created, "ab")
    const erased = await feedSandboxPty(created, "\x7f")
    expect(erased.chunks.join("")).toBe("\b \b")
    const cancelled = await feedSandboxPty(created, "\x03")
    expect(cancelled.chunks.join("")).toBe("^C\r\nsandbox$ ")
    const empty = await feedSandboxPty(created, "\r")
    expect(empty.chunks.join("")).toBe("\r\nsandbox$ ")
    expect(seen).toEqual([])
    removeSandboxPty("pty_edit")
  })

  test("surfaces nonzero exits explicitly", async () => {
    const { provider } = scripted(() => ({ stdout: "", stderr: "boom\n", exitCode: 3, success: false }))
    const created = session(provider, "pty_exit")
    const result = await feedSandboxPty(created, "fail\r")
    expect(result.chunks.join("")).toContain("boom\n")
    expect(result.chunks.join("")).toContain("[exit 3]")
    removeSandboxPty("pty_exit")
  })

  test("Ctrl-D on an empty line closes the session", async () => {
    const { provider } = scripted(() => ok(""))
    const created = session(provider, "pty_close")
    const kept = await feedSandboxPty(created, "ab\x04")
    expect(kept.closed).toBe(false)
    const closed = await feedSandboxPty(
      { ...created, buffer: "" },
      "\x04",
    )
    expect(closed.closed).toBe(true)
    removeSandboxPty("pty_close")
  })
})
