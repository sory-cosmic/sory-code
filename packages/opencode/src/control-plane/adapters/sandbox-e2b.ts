import type { Sandbox } from "e2b"
import type { CommandResult, CreateInput, Provider, RunCommand, SandboxInfo } from "./sandbox-provider"
import { shellJoin } from "./sandbox-provider"

const workdir = "/home/user/app"
const defaultTimeoutMs = 300_000
const defaultPort = 5173
const skipped = new Set(["node_modules", ".git", ".next", "dist", "build"])

export interface E2BProviderInput {
  readonly apiKey?: string
  readonly timeoutMs?: number
  readonly template?: string
  readonly port?: number
}

function fullPath(path: string) {
  return path.startsWith("/") ? path : `${workdir}/${path}`
}

export function createE2BSandboxProvider(input: E2BProviderInput = {}): Provider {
  let sandbox: Sandbox | undefined
  let current: SandboxInfo | undefined
  const port = input.port ?? defaultPort

  const active = () => {
    if (!sandbox) throw new Error("No active E2B sandbox. Call create() first.")
    return sandbox
  }

  const collect = async (directory: string, out: string[]) => {
    const entries = await active().files.list(fullPath(directory))
    for (const entry of entries) {
      if (!entry.name || skipped.has(entry.name)) continue
      const path = directory ? `${directory}/${entry.name}` : entry.name
      if (String(entry.type) === "dir") await collect(path, out)
      else out.push(path)
    }
  }

  return {
    kind: "e2b",
    info: () => current,
    create: async (_input?: CreateInput) => {
      if (sandbox) await sandbox.kill().catch(() => {})
      sandbox = undefined
      current = undefined
      const { Sandbox: SandboxClient } = await import("e2b")
      const created = await SandboxClient.create({
        apiKey: input.apiKey ?? process.env.E2B_API_KEY,
        timeoutMs: input.timeoutMs ?? defaultTimeoutMs,
        template: input.template,
      })
      await created.setTimeout(input.timeoutMs ?? defaultTimeoutMs).catch(() => {})
      sandbox = created
      current = {
        sandboxId: created.sandboxId,
        url: `https://${created.getHost(port)}`,
        provider: "e2b",
        createdAt: Date.now(),
      }
      return current
    },
    runCommand: async (command: RunCommand) => {
      const result = await active().commands.run(
        shellJoin(command.cmd, command.args ?? []),
        command.cwd ? { cwd: command.cwd } : undefined,
      )
      const output: CommandResult = {
        stdout: result.stdout,
        stderr: result.error ? `${result.stderr}\n${result.error}`.trim() : result.stderr,
        exitCode: result.exitCode,
        success: !result.error && result.exitCode === 0,
      }
      return output
    },
    writeFile: async (path: string, content: string) => {
      await active().files.write(fullPath(path), content)
    },
    readFile: async (path: string) => {
      return active().files.read(fullPath(path))
    },
    listFiles: async (directory = "") => {
      const root = directory.replace(/^\/+|\/+$/g, "")
      const out: string[] = []
      await collect(root, out)
      return out
    },
    terminate: async () => {
      if (sandbox) await sandbox.kill().catch(() => {})
      sandbox = undefined
      current = undefined
    },
    publicUrl: (port: number) => `https://${active().getHost(port)}`,
    isAlive: async () => {
      if (!sandbox) return false
      return sandbox.isRunning().catch(() => false)
    },
  }
}

export * as SandboxE2B from "./sandbox-e2b"
