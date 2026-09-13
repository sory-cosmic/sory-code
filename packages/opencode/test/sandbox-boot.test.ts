import { describe, expect, test } from "bun:test"
import type { CommandResult, Provider, RunCommand } from "@/control-plane/adapters/sandbox-provider"
import {
  bootWorkspaceServer,
  buildCloneCommand,
  buildHealthCommand,
  buildStartCommand,
  type BootInput,
} from "@/control-plane/sandbox-boot"

const ok = (stdout = ""): CommandResult => ({ stdout, stderr: "", exitCode: 0, success: true })
const failed = (stderr: string): CommandResult => ({ stdout: "", stderr, exitCode: 1, success: false })

function scripted(responses: CommandResult[]) {
  const seen: string[] = []
  let calls = 0
  const provider: Provider = {
    kind: "e2b",
    info: () => undefined,
    create: () => Promise.reject(new Error("must not create in boot tests")),
    publicUrl: (port: number) => `https://fake:${port}`,
    runCommand: (input: RunCommand) => {
      calls += 1
      seen.push(`${input.cmd} ${(input.args ?? []).join(" ")}`)
      return Promise.resolve(responses[Math.min(calls - 1, responses.length - 1)] ?? ok())
    },
    writeFile: () => Promise.resolve(),
    readFile: () => Promise.resolve(""),
    listFiles: () => Promise.resolve([]),
    terminate: () => Promise.resolve(),
    isAlive: () => Promise.resolve(true),
  }
  return { provider, seen }
}

describe("boot command builders", () => {
  test("clone uses git with explicit target dir", () => {
    expect(buildCloneCommand("https://example.com/repo.git", "app")).toEqual({
      cmd: "git",
      args: ["clone", "https://example.com/repo.git", "app"],
    })
  })

  test("start detaches with nohup into the log file", () => {
    expect(buildStartCommand({ cmd: "bun", args: ["run", "serve"] }, "app", "/tmp/out.log")).toEqual({
      cmd: "sh",
      args: ["-c", `cd 'app' && nohup bun 'run' 'serve' > '/tmp/out.log' 2>&1 & echo $!`],
    })
  })

  test("health probes localhost over curl", () => {
    expect(buildHealthCommand(4096, "/api/health")).toEqual({
      cmd: "curl",
      args: ["-sf", "http://localhost:4096/api/health", "-o", "/dev/null"],
    })
  })
})

describe("bootWorkspaceServer", () => {
  test("rejects invalid ports before touching the provider", async () => {
    const { provider, seen } = scripted([])
    const start: RunCommand = { cmd: "serve" }
    await expect(bootWorkspaceServer(provider, { port: 0, start })).rejects.toThrow("Invalid boot port")
    await expect(bootWorkspaceServer(provider, { port: 70000, start })).rejects.toThrow("Invalid boot port")
    expect(seen).toEqual([])
  })

  test("requires a start command", async () => {
    const { provider } = scripted([])
    await expect(bootWorkspaceServer(provider, { start: { cmd: "  " } })).rejects.toThrow("start command is required")
  })

  test("aborts when git clone fails", async () => {
    const { provider } = scripted([failed("auth denied")])
    await expect(
      bootWorkspaceServer(provider, { start: { cmd: "serve" }, repoUrl: "https://example.com/r.git" }),
    ).rejects.toThrow("git clone failed")
  })

  test("aborts when a setup step fails", async () => {
    const { provider } = scripted([failed("npm exploded")])
    await expect(
      bootWorkspaceServer(provider, { start: { cmd: "serve" }, setup: [{ cmd: "bun", args: ["install"] }] }),
    ).rejects.toThrow("setup failed")
  })

  test("gives up when health never turns green", async () => {
    const { provider, seen } = scripted([ok("123"), failed("connection refused")])
    const input: BootInput = { start: { cmd: "serve" }, port: 4096, attempts: 2, delayMs: 1 }
    await expect(bootWorkspaceServer(provider, input)).rejects.toThrow("never became healthy")
    expect(seen.filter((line) => line.startsWith("curl")).length).toBe(2)
  })

  test("returns the public serving url on success", async () => {
    const { provider, seen } = scripted([ok("123"), ok("")])
    const result = await bootWorkspaceServer(provider, {
      start: { cmd: "bun", args: ["run", "serve"] },
      port: 4096,
    })
    expect(result).toEqual({ url: "https://fake:4096", log: "/tmp/sorycode-server.log" })
    expect(seen[0]).toContain("nohup bun")
  })
})
