export interface CodespacePtySession {
  readonly id: string
  readonly projectID: string
  readonly cwd: string
  readonly url: string
  readonly repository?: string
  readonly branch?: string
  buffer: string
  replay: string
  cursor: number
}

const sessions = new Map<string, CodespacePtySession>()
const maxReplay = 64 * 1024

export function isCodespacePty(ptyID: string) {
  return sessions.has(ptyID)
}

export function getCodespacePty(ptyID: string) {
  return sessions.get(ptyID)
}

export function listCodespacePtys() {
  return [...sessions.values()]
}

export function removeCodespacePty(ptyID: string) {
  sessions.delete(ptyID)
}

export function createCodespacePty(input: {
  id: string
  projectID: string
  cwd: string
  url: string
  repository?: string
  branch?: string
}) {
  const branch = input.branch ?? "main"
  const repo = input.repository ? ` · ${input.repository}@${branch}` : ` · ${branch}`
  const banner = `Connected to GitHub Codespace${repo} · ${input.url}\r\ncodespace$ `
  const session: CodespacePtySession = {
    id: String(input.id),
    projectID: input.projectID,
    cwd: input.cwd,
    url: input.url,
    repository: input.repository,
    branch,
    buffer: "",
    replay: banner,
    cursor: banner.length,
  }
  sessions.set(session.id, session)
  return session
}

function push(session: CodespacePtySession, text: string) {
  session.replay = (session.replay + text).slice(-maxReplay)
  session.cursor += text.length
  return text
}

export interface FeedResult {
  readonly chunks: string[]
  readonly closed: boolean
}

export async function feedCodespacePty(session: CodespacePtySession, data: string): Promise<FeedResult> {
  const chunks: string[] = []
  for (const char of data) {
    if (char === "\x03") {
      session.buffer = ""
      chunks.push(push(session, "^C\r\ncodespace$ "))
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
        chunks.push(push(session, "codespace$ "))
        continue
      }
      const output = `remote execution: workspace server not yet booted in Codespace.\r\nCommand received: ${line}\r\n→ run via GitHub Codespace machine ${session.repository ?? ""} (branch ${session.branch}) — filesystem/terminal/processus distants.\r\n`
      chunks.push(push(session, output))
      chunks.push(push(session, "codespace$ "))
      continue
    }
    session.buffer += char
    chunks.push(push(session, char))
  }
  return { chunks, closed: false }
}

export * as CodespacePty from "./codespace-pty"
