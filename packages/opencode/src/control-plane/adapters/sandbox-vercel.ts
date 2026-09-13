import type { Sandbox } from "@vercel/sandbox"
import type { CommandResult, CreateInput, Provider, RunCommand, SandboxInfo } from "./sandbox-provider"

const workdir = "/vercel/sandbox"
const defaultTimeoutMs = 300_000
const defaultPort = 5173
const skipped = new Set(["node_modules", ".git", ".next", "dist", "build"])

export interface VercelProviderInput {
  readonly token?: string
  readonly teamId?: string
  readonly projectId?: string
  readonly timeoutMs?: number
  readonly port?: number
}

function fullPath(path: string) {
  return path.startsWith("/") ? path : `${workdir}/${path}`
}

function relative(root: string, path: string) {
  return path === root ? "" : path.slice(root.length + 1)
}

export function createVercelSandboxProvider(providerInput: VercelProviderInput = {}): Provider {
  let sandbox: Sandbox | undefined
  let current: SandboxInfo | undefined
  const port = providerInput.port ?? defaultPort

  const active = () => {
    if (!sandbox) throw new Error("No active Vercel sandbox. Call create() first.")
    return sandbox
  }

  const collect = async (directory: string, out: string[]) => {
    const entries = await active().fs.readdir(fullPath(directory))
    for (const entry of entries) {
      const name = typeof entry === "string" ? entry : entry.name
      if (!name || skipped.has(name)) continue
      const path = directory ? `${directory}/${name}` : name
      const stat = await active().fs.stat(fullPath(path))
      if (stat.isDirectory()) await collect(path, out)
      else out.push(path)
    }
  }

  return {
    kind: "vercel",
    info: () => current,
    create: async (input?: CreateInput) => {
      if (sandbox) await sandbox.stop().catch(() => {})
      sandbox = undefined
      current = undefined
      const { Sandbox: SandboxClient } = await import("@vercel/sandbox")
      const created = await SandboxClient.create({
        timeout: providerInput.timeoutMs ?? defaultTimeoutMs,
        runtime: "node22",
        ports: input?.ports ?? [port],
        ...(providerInput.token && providerInput.teamId && providerInput.projectId
          ? { token: providerInput.token, teamId: providerInput.teamId, projectId: providerInput.projectId }
          : {}),
      })
      sandbox = created
      current = {
        sandboxId: created.name,
        url: created.domain(port),
        provider: "vercel",
        createdAt: Date.now(),
      }
      return current
    },
    runCommand: async (command: RunCommand) => {
      const result = await active().runCommand({
        cmd: command.cmd,
        args: command.args ?? [],
        cwd: command.cwd ?? workdir,
      })
      const stdout = await result.stdout()
      const stderr = await result.stderr()
      const output: CommandResult = { stdout, stderr, exitCode: result.exitCode, success: result.exitCode === 0 }
      return output
    },
    writeFile: async (path: string, content: string) => {
      await active().fs.writeFile(fullPath(path), content, "utf8")
    },
    readFile: async (path: string) => {
      return active().fs.readFile(fullPath(path), "utf8")
    },
    listFiles: async (directory = "") => {
      const root = directory.replace(/^\/+|\/+$/g, "")
      const out: string[] = []
      await collect(root, out)
      return out.map((path) => relative(root, path)).filter((path) => path !== "")
    },
    terminate: async () => {
      if (sandbox) await sandbox.stop().catch(() => {})
      sandbox = undefined
      current = undefined
    },
    publicUrl: (port: number) => active().domain(port),
    isAlive: async () => sandbox !== undefined,
  }
}

export * as SandboxVercel from "./sandbox-vercel"
