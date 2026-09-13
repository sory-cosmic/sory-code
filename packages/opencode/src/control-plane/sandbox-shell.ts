import { shellJoin, shellQuote, type Provider, type RunCommand } from "./adapters/sandbox-provider"

export interface ShellHandle {
  /** Identifier stable to reconnect to the same shell. */
  readonly id: string
  /** Public port the WebSocket/PTY proxy on the desktop should point at. */
  readonly port: number
  /** Process id of the detached shell, when the provider returns it. */
  readonly pid?: string
}

export interface InteractiveShellInput {
  /** Override the default shell (defaults to `$SHELL` or `/bin/bash`). */
  readonly shell?: string
  /** Optional startup command after the shell is up (e.g. `cd app`). */
  readonly preCommand?: string
  /** Public port to expose for the PTY. Defaults to 4097. */
  readonly port?: number
}

const defaultShell = "/bin/bash"
const defaultPort = 4097

export function buildShellStartCommand(input: InteractiveShellInput): RunCommand {
  const shell = input.shell ?? defaultShell
  const pre = input.preCommand ? `${input.preCommand} && ` : ""
  return {
    cmd: "sh",
    args: ["-c", `nohup ${pre}${shellQuote(shell)} -i </dev/null > /tmp/sorycode-shell.log 2>&1 & echo $!`],
  }
}

function requireHandle(id: string): NonNullable<ShellHandle["id"]> {
  if (!id) throw new Error("Shell handle id is required")
  return id
}

/**
 * Open a long-lived interactive shell inside the sandbox and return a handle
 * the desktop PTY/WebSocket proxy can point at. The provider runs the shell
 * detached and exposes a port; subsequent `readShell*` / `writeShell*` calls
 * can stream I/O through `provider.runCommand` (best-effort with
 * file-backed PTY logs) until the SoryCode workspace server takes over.
 *
 * The desktop terminal keeps using the local `Pty.Service` (node-pty) and
 * the workspace routing proxy when the project is on a `local` environment,
 * and falls back to this handle for `sandbox` / `codespaces`. Routing lives
 * in `middleware/workspace-routing.ts`; this primitive is the sandbox side.
 */
export async function openInteractiveShell(provider: Provider, input: InteractiveShellInput = {}): Promise<ShellHandle> {
  const port = input.port ?? defaultPort
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`Invalid shell port: ${port}`)
  const started = await provider.runCommand(buildShellStartCommand(input))
  if (!started.success) throw new Error(`Failed to start sandbox shell: ${started.stderr || started.stdout}`)
  // PID is the last line of the detached echo; we don't enforce a regex, the
  // proxy just needs a stable id and a reachable port.
  const pid = started.stdout.trim().split(/\s+/).at(-1)
  return pid ? { id: pid, port, pid } : { id: shellJoin(input.shell ?? defaultShell, []), port }
}

export async function readShellOutput(provider: Provider, handle: ShellHandle, lines = 200): Promise<string> {
  requireHandle(handle.id)
  const tail = await provider.readFile("/tmp/sorycode-shell.log").catch(() => "")
  if (!tail) return ""
  return tail.split("\n").slice(-lines).join("\n")
}

export async function writeShellCommand(provider: Provider, handle: ShellHandle, command: string): Promise<void> {
  requireHandle(handle.id)
  const escaped = command.replaceAll("'", "'\\''")
  await provider.writeFile("/tmp/sorycode-shell.in", `${escaped}\n`).catch(async () => {
    await provider.runCommand({
      cmd: "sh",
      args: ["-c", `printf '%s\\n' '${escaped}' >> /tmp/sorycode-shell.in`],
    })
  })
}

export * as SandboxShell from "./sandbox-shell"
