export const ProviderKinds = ["vercel", "e2b"] as const
export type ProviderKind = (typeof ProviderKinds)[number]

export interface SandboxInfo {
  readonly sandboxId: string
  readonly url: string
  readonly provider: ProviderKind
  readonly createdAt: number
}

export interface CommandResult {
  readonly stdout: string
  readonly stderr: string
  readonly exitCode: number
  readonly success: boolean
}

export interface RunCommand {
  readonly cmd: string
  readonly args?: string[]
  readonly cwd?: string
}

export interface CreateInput {
  readonly ports?: number[]
}

/** Quote one shell word with single quotes, escaping embedded quotes. */
export function shellQuote(word: string) {
  return `'${word.replace(/'/g, `'\\''`)}'`
}

export function shellJoin(cmd: string, args: string[]) {
  return [cmd, ...args.map(shellQuote)].join(" ")
}

/**
 * Sandbox lifecycle contract. Mirrors the proven surface of
 * `reference-projets/open-lovable` (`create/runCommand/files/terminate`)
 * without its Vite-scaffolding specifics: SoryCode boots a workspace server
 * inside the sandbox instead of a demo app.
 */
export interface Provider {
  readonly kind: ProviderKind
  info(): SandboxInfo | undefined
  create(input?: CreateInput): Promise<SandboxInfo>
  publicUrl(port: number): string
  runCommand(input: RunCommand): Promise<CommandResult>
  writeFile(path: string, content: string): Promise<void>
  readFile(path: string): Promise<string>
  listFiles(directory?: string): Promise<string[]>
  terminate(): Promise<void>
  isAlive(): Promise<boolean>
}

/**
 * Explicit credentials. Values come from the environment (see `resolveEnv`)
 * or from a future credential store — never hardcoded.
 */
export interface ProviderCredentials {
  readonly e2bApiKey?: string
  readonly vercelToken?: string
  readonly vercelTeamId?: string
  readonly vercelProjectId?: string
}

export type ProviderEnv = Record<string, string | undefined>

export function defaultEnv(): ProviderEnv {
  return process.env as ProviderEnv
}

/**
 * Select the sandbox provider. `SANDBOX_PROVIDER` wins, default is `vercel`
 * (same default as open-lovable's `.env.example`). Unknown values throw
 * instead of silently falling back.
 */
export function resolveProviderKind(env: ProviderEnv = defaultEnv()): ProviderKind {
  const kind = (env.SANDBOX_PROVIDER ?? "vercel").trim().toLowerCase()
  if (kind === "vercel" || kind === "e2b") return kind
  throw new Error(`Unknown sandbox provider: ${env.SANDBOX_PROVIDER}. Supported providers: vercel, e2b`)
}

function vercelTriple(env: ProviderEnv, overrides: ProviderCredentials) {
  return {
    token: overrides.vercelToken ?? env.VERCEL_TOKEN,
    teamId: overrides.vercelTeamId ?? env.VERCEL_TEAM_ID,
    projectId: overrides.vercelProjectId ?? env.VERCEL_PROJECT_ID,
  }
}

export function isProviderAvailable(
  kind: ProviderKind,
  env: ProviderEnv = defaultEnv(),
  overrides: ProviderCredentials = {},
): boolean {
  return missingProviderCredentials(kind, env, overrides).length === 0
}

/**
 * Names of the missing credential variables. Empty means the provider can be
 * created. Vercel accepts either OIDC (`VERCEL_OIDC_TOKEN`) or the full PAT
 * triple (`VERCEL_TOKEN` + `VERCEL_TEAM_ID` + `VERCEL_PROJECT_ID`).
 */
export function missingProviderCredentials(
  kind: ProviderKind,
  env: ProviderEnv = defaultEnv(),
  overrides: ProviderCredentials = {},
): string[] {
  if (kind === "e2b") {
    return overrides.e2bApiKey ?? env.E2B_API_KEY ? [] : ["E2B_API_KEY"]
  }
  if (env.VERCEL_OIDC_TOKEN) return []
  const triple = vercelTriple(env, overrides)
  const missing: string[] = []
  if (!triple.token) missing.push("VERCEL_TOKEN")
  if (!triple.teamId) missing.push("VERCEL_TEAM_ID")
  if (!triple.projectId) missing.push("VERCEL_PROJECT_ID")
  return missing
}

async function resolveVercelAuto(input: { token?: string; teamId?: string; projectId?: string }) {
  if (!input.token) return input
  if (input.teamId && input.projectId) return input
  try {
    const headers = { Authorization: `Bearer ${input.token}` } as const
    let teamId = input.teamId
    let projectId = input.projectId
    if (!teamId) {
      const res = await fetch("https://api.vercel.com/v2/teams", { headers } as any)
      if (res.ok) {
        const data = (await res.json()) as any
        teamId = data.teams?.[0]?.id ?? data.id ?? teamId
        if (!teamId) {
          const u = await fetch("https://api.vercel.com/v2/user", { headers } as any).then((r) => (r.ok ? r.json() : undefined)) as any
          teamId = u?.user?.defaultTeamId ?? teamId
        }
      }
    }
    if (!projectId && teamId) {
      const list = await fetch(`https://api.vercel.com/v9/projects?teamId=${teamId}`, { headers } as any).then((r) => (r.ok ? r.json() : undefined)) as any
      projectId = list?.projects?.[0]?.id ?? projectId
      if (!projectId) {
        const created = await fetch(`https://api.vercel.com/v9/projects?teamId=${teamId}`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" } as any,
          body: JSON.stringify({ name: "sorycode-sandbox", framework: null }),
        }).then((r) => (r.ok ? r.json() : undefined)) as any
        projectId = created?.id ?? projectId
      }
    }
    return { token: input.token, teamId, projectId }
  } catch {
    return input
  }
}

/**
 * Build the provider for `kind`. Throws with the exact missing variables when
 * credentials are absent — creating without credentials would only fail later
 * inside the vendor SDK with a cryptic error.
 * Vercel auto: if token is present but team/project missing, they are fetched
 * from the Vercel API (so UI paste of a single PAT suffices).
 */
export async function createSandboxProvider(
  kind: ProviderKind = resolveProviderKind(),
  overrides: ProviderCredentials = {},
  env: ProviderEnv = defaultEnv(),
): Promise<Provider> {
  const missing = missingProviderCredentials(kind, env, overrides)
  if (missing.length > 0) {
    const triple = vercelTriple(env, overrides)
    if (kind === "vercel" && triple.token && (missing.includes("VERCEL_TEAM_ID") || missing.includes("VERCEL_PROJECT_ID"))) {
      const auto = await resolveVercelAuto(triple)
      if (auto.teamId && auto.projectId) {
        const { createVercelSandboxProvider } = await import("./sandbox-vercel")
        return createVercelSandboxProvider({ token: auto.token, teamId: auto.teamId, projectId: auto.projectId })
      }
    }
    throw new Error(
      `Sandbox provider "${kind}" is not configured. Missing: ${missing.join(", ")}. ` +
        `See docs/SANDBOX_RUNTIME.md for setup.`,
    )
  }
  if (kind === "vercel") {
    const { createVercelSandboxProvider } = await import("./sandbox-vercel")
    const triple = vercelTriple(env, overrides)
    const auto = await resolveVercelAuto(triple)
    return createVercelSandboxProvider({
      token: auto.token,
      teamId: auto.teamId,
      projectId: auto.projectId,
    })
  }
  const { createE2BSandboxProvider } = await import("./sandbox-e2b")
  return createE2BSandboxProvider({ apiKey: overrides.e2bApiKey ?? env.E2B_API_KEY })
}

export * as SandboxProvider from "./sandbox-provider"
