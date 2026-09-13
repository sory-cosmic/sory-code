import { describe, expect, test } from "bun:test"
import type { CommandResult, Provider, RunCommand } from "@/control-plane/adapters/sandbox-provider"
import {
  buildShellStartCommand,
  openInteractiveShell,
  readShellOutput,
  writeShellCommand,
  type InteractiveShellInput,
} from "@/control-plane/sandbox-shell"

function scripted(responses: CommandResult[], files: Record<string, string> = {}) {
  const seen: string[] = []
  let calls = 0
  const provider: Provider = {
    kind: "e2b",
    info: () => undefined,
    create: () => Promise.reject(new Error("must not create in shell tests")),
    publicUrl: (port: number) => `https://fake:${port}`,
    runCommand: (input: RunCommand) => {
      calls += 1
      seen.push(`${input.cmd} ${(input.args ?? []).join(" ")}`)
      return Promise.resolve(responses[Math.min(calls - 1, responses.length - 1)] ?? { stdout: "", stderr: "", exitCode: 0, success: true })
    },
    writeFile: (path, content) => {
      files[path] = content
      return Promise.resolve()
    },
    readFile: (path) => {
      if (!(path in files)) return Promise.reject(new Error("not found"))
      return Promise.resolve(files[path])
    },
    listFiles: () => Promise.resolve([]),
    terminate: () => Promise.resolve(),
    isAlive: () => Promise.resolve(true),
  }
  return { provider, seen, files }
}

describe("sandbox-shell command builders", () => {
  test("starts bash detached and prints pid", () => {
    const cmd = buildShellStartCommand({})
    expect(cmd.cmd).toBe("sh")
    expect(cmd.args?.[0]).toBe("-c")
    expect(cmd.args?.[1]).toContain("nohup '/bin/bash' -i")
    expect(cmd.args?.[1]).toContain("echo $!")
  })

  test("prefixes a preCommand and respects custom shell", () => {
    const cmd = buildShellStartCommand({ shell: "/bin/zsh", preCommand: "cd /home/user/app" })
    expect(cmd.args?.[1]).toContain("cd /home/user/app && ")
    expect(cmd.args?.[1]).toContain("'/bin/zsh' -i")
  })
})

describe("openInteractiveShell", () => {
  test("rejects invalid ports", async () => {
    const { provider } = scripted([])
    await expect(openInteractiveShell(provider, { port: 0 })).rejects.toThrow("Invalid shell port")
    await expect(openInteractiveShell(provider, { port: 70000 })).rejects.toThrow("Invalid shell port")
  })

  test("returns a stable handle with the launched pid", async () => {
    const { provider } = scripted([{ stdout: "12345\n", stderr: "", exitCode: 0, success: true }])
    const handle = await openInteractiveShell(provider, { port: 4097 })
    expect(handle).toEqual({ id: "12345", port: 4097, pid: "12345" })
  })

  test("aborts when the shell launch fails", async () => {
    const { provider } = scripted([{ stdout: "", stderr: "no shell", exitCode: 1, success: false }])
    await expect(openInteractiveShell(provider, { port: 4097 })).rejects.toThrow("Failed to start sandbox shell")
  })
})

describe("readShellOutput / writeShellCommand", () => {
  test("readShellOutput tails the log file", async () => {
    const log = Array.from({ length: 250 }, (_, index) => `line ${index + 1}`).join("\n")
    const { provider } = scripted([], { "/tmp/sorycode-shell.log": log })
    const out = await readShellOutput(provider, { id: "1", port: 4097 }, 10)
    expect(out.split("\n")).toHaveLength(10)
    expect(out.split("\n").at(0)).toBe("line 241")
  })

  test("writeShellCommand appends a shell-safe command to the in pipe", async () => {
    const { provider, files } = scripted([])
    await writeShellCommand(provider, { id: "1", port: 4097 }, "echo hi there")
    expect(files["/tmp/sorycode-shell.in"]).toBe("echo hi there\n")
  })

  test("writeShellCommand escapes single quotes", async () => {
    const { provider, files } = scripted([])
    await writeShellCommand(provider, { id: "1", port: 4097 }, "echo it's")
    expect(files["/tmp/sorycode-shell.in"]).toBe(`echo it'\\''s\n`)
  })
})
