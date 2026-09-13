import type { PtyID } from "@opencode-ai/core/pty/schema"
import type { Provider } from "./adapters/sandbox-provider"

export interface SandboxPtySession {
  readonly id: string
  readonly provider: Provider
  readonly projectID: string
  readonly cwd: string
  readonly url: string
  buffer: string
  replay: string
  cursor: number
}

const sessions = new Map<string, SandboxPtySession>()
const maxReplay = 64 * 1024

export function isSandboxPty(ptyID: string) {
  return sessions.has(ptyID)
}

export function getSandboxPty(ptyID: string) {
  return sessions.get(ptyID)
}

export function listSandboxPtys() {
  return [...sessions.values()]
}

export function removeSandboxPty(ptyID: string) {
  sessions.delete(ptyID)
}

/**
 * Virtual PTY session backed by a sandbox provider. There is no local
 * process (pid 0): every submitted line runs through `provider.runCommand`
 * and the answer comes back from the sandbox, never from the local PC.
 */
export function createSandboxPty(input: {
  id: PtyID
  provider: Provider
  projectID: string
  cwd: string
  url: string
}) {
  const banner = `Connected to ${input.provider.kind} sandbox · ${input.url}\r\nsandbox$ `
  const session: SandboxPtySession = {
    id: String(input.id),
    provider: input.provider,
    projectID: input.projectID,
    cwd: input.cwd,
    url: input.url,
    buffer: "",
    replay: banner,
    cursor: banner.length,
  }
  sessions.set(session.id, session)
  return session
}

function push(session: SandboxPtySession, text: string) {
  session.replay = (session.replay + text).slice(-maxReplay)
  session.cursor += text.length
  return text
}

export interface FeedResult {
  readonly chunks: string[]
  readonly closed: boolean
}

/**
 * Feed raw terminal input. Returns display chunks (echo + results) and
 * whether the client asked to close (Ctrl-D on an empty line). One submitted
 * line = one `sh -c` execution inside the sandbox. No persistent shell state
 * exists yet (no `cd` persistence, no interactive programs, no Ctrl-C of a
 * running command) — that arrives with the workspace server boot.
 */
export async function feedSandboxPty(session: SandboxPtySession, data: string): Promise<FeedResult> {
  const chunks: string[] = []
  for (const char of data) {
    if (char === "\x03") {
      session.buffer = ""
      chunks.push(push(session, "^C\r\nsandbox$ "))
      continue
    }
    if (char === "\x04") {
      if (session.buffer.length === 0) return { chunks, closed: true }
      continue
    }
    if (char === "\x7f") {
      if (session.buffer.length > 0) {
        session.buffer = session.buffer.slice(0, -1)
        chunks.push(push(session, "\b \b"))
      }
      continue
    }
    if (char === "\r" || char === "\n") {
      const line = session.buffer
      session.buffer = ""
      chunks.push(push(session, "\r\n"))
      if (line.trim().length === 0) {
        chunks.push(push(session, "sandbox$ "))
        continue
      }
      const result = await session.provider.runCommand({ cmd: "sh", args: ["-c", line] })
      const output = result.stdout + (result.stderr ? (result.stdout.endsWith("\n") || result.stdout === "" ? "" : "\n") + result.stderr : "")
      chunks.push(push(session, output.endsWith("\n") || output === "" ? output : `${output}\r\n`))
      if (result.exitCode !== 0) chunks.push(push(session, `[exit ${result.exitCode}]\r\n`))
      chunks.push(push(session, "sandbox$ "))
      continue
    }
    session.buffer += char
    chunks.push(push(session, char))
  }
  return { chunks, closed: false }
}

export * as SandboxPty from "./sandbox-pty"
