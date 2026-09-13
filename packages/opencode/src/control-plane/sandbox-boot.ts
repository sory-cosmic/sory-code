import type { Provider, RunCommand } from "./adapters/sandbox-provider"
import { shellJoin, shellQuote } from "./adapters/sandbox-provider"

export interface BootInput {
  /** Port the workspace server listens on inside the sandbox. */
  readonly port?: number
  /** Optional git URL cloned into `appDir` before anything else runs. */
  readonly repoUrl?: string
  /** Directory (relative to the provider workdir) the project lives in. */
  readonly appDir?: string
  /** Setup steps run sequentially in `appDir`; any non-zero exit aborts. */
  readonly setup?: RunCommand[]
  /** Server start command; launched detached with output to `log`. */
  readonly start: RunCommand
  /** Health path polled on `localhost:port` after start. */
  readonly healthPath?: string
  /** Where the detached server writes stdout/stderr. */
  readonly log?: string
  /** Healthcheck attempts and delay between them. */
  readonly attempts?: number
  readonly delayMs?: number
}

export interface BootResult {
  readonly url: string
  readonly log: string
}

const defaultPort = 4096
const defaultAppDir = "app"
const defaultLog = "/tmp/sorycode-server.log"
const defaultHealthPath = "/api/health"
const defaultAttempts = 30
const defaultDelayMs = 2000

export function buildCloneCommand(repoUrl: string, appDir: string): RunCommand {
  return { cmd: "git", args: ["clone", repoUrl, appDir] }
}

export function buildStartCommand(start: RunCommand, cwd: string, log: string): RunCommand {
  const line = `cd ${shellQuote(cwd)} && nohup ${shellJoin(start.cmd, start.args ?? [])} > ${shellQuote(log)} 2>&1 & echo $!`
  return { cmd: "sh", args: ["-c", line] }
}

export function buildHealthCommand(port: number, healthPath: string): RunCommand {
  return { cmd: "curl", args: ["-sf", `http://localhost:${port}${healthPath}`, "-o", "/dev/null"] }
}

function requirePort(port: number) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`Invalid boot port: ${port}`)
}

function requireStart(start: RunCommand) {
  if (!start.cmd.trim()) throw new Error("Boot start command is required")
}

/**
 * Boot a workspace server inside a live sandbox: optional git clone, setup
 * steps, detached start, then curl healthchecks from inside the sandbox.
 * Returns the public URL serving the API. Pure command builders above are
 * unit-tested; the live path needs real provider credentials.
 */
export async function bootWorkspaceServer(provider: Provider, input: BootInput): Promise<BootResult> {
  const port = input.port ?? defaultPort
  requirePort(port)
  requireStart(input.start)
  const appDir = input.appDir ?? defaultAppDir
  const log = input.log ?? defaultLog
  const healthPath = input.healthPath ?? defaultHealthPath
  const attempts = input.attempts ?? defaultAttempts
  const delayMs = input.delayMs ?? defaultDelayMs

  if (input.repoUrl) {
    const cloned = await provider.runCommand(buildCloneCommand(input.repoUrl, appDir))
    if (!cloned.success) throw new Error(`Sandbox git clone failed: ${cloned.stderr || cloned.stdout}`)
  }
  for (const step of input.setup ?? []) {
    const result = await provider.runCommand({ ...step, cwd: step.cwd ?? appDir })
    if (!result.success) {
      throw new Error(`Sandbox setup failed (${shellJoin(step.cmd, step.args ?? [])}): ${result.stderr || result.stdout}`)
    }
  }
  const started = await provider.runCommand(buildStartCommand(input.start, appDir, log))
  if (!started.success) throw new Error(`Sandbox server start failed: ${started.stderr || started.stdout}`)

  let last = ""
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const check = await provider.runCommand(buildHealthCommand(port, healthPath)).catch((error) => ({
      stdout: "",
      stderr: error instanceof Error ? error.message : String(error),
      exitCode: 1,
      success: false,
    }))
    if (check.success) return { url: provider.publicUrl(port), log }
    last = check.stderr || check.stdout
    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }
  throw new Error(`Sandbox server never became healthy on port ${port}: ${last}`)
}

export * as SandboxBoot from "./sandbox-boot"
