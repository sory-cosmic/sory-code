import { describe, expect, test } from "bun:test"
import { shellJoin, shellQuote } from "@/control-plane/adapters/sandbox-provider"
import {
  createSandboxProvider,
  isProviderAvailable,
  missingProviderCredentials,
  resolveProviderKind,
} from "@/control-plane/adapters/sandbox-provider"

const empty = {}
const e2bEnv = { E2B_API_KEY: "key" }
const oidcEnv = { VERCEL_OIDC_TOKEN: "token" }
const patEnv = { VERCEL_TOKEN: "token", VERCEL_TEAM_ID: "team", VERCEL_PROJECT_ID: "project" }

describe("resolveProviderKind", () => {
  test("defaults to vercel like open-lovable .env.example", () => {
    expect(resolveProviderKind(empty)).toBe("vercel")
  })

  test("selects e2b from SANDBOX_PROVIDER", () => {
    expect(resolveProviderKind({ SANDBOX_PROVIDER: "e2b" })).toBe("e2b")
  })

  test("rejects unknown providers instead of silently falling back", () => {
    expect(() => resolveProviderKind({ SANDBOX_PROVIDER: "aws" })).toThrow("Unknown sandbox provider")
  })
})

describe("provider availability", () => {
  test("e2b needs E2B_API_KEY", () => {
    expect(isProviderAvailable("e2b", empty)).toBe(false)
    expect(isProviderAvailable("e2b", e2bEnv)).toBe(true)
    expect(missingProviderCredentials("e2b", empty)).toEqual(["E2B_API_KEY"])
  })

  test("vercel accepts OIDC alone", () => {
    expect(isProviderAvailable("vercel", oidcEnv)).toBe(true)
    expect(missingProviderCredentials("vercel", oidcEnv)).toEqual([])
  })

  test("vercel accepts the full PAT triple", () => {
    expect(isProviderAvailable("vercel", patEnv)).toBe(true)
    expect(isProviderAvailable("vercel", { VERCEL_TOKEN: "token" })).toBe(false)
    expect(missingProviderCredentials("vercel", { VERCEL_TOKEN: "token" })).toEqual([
      "VERCEL_TEAM_ID",
      "VERCEL_PROJECT_ID",
    ])
  })

  test("explicit overrides satisfy availability without env", () => {
    expect(isProviderAvailable("e2b", empty, { e2bApiKey: "key" })).toBe(true)
    expect(
      isProviderAvailable("vercel", empty, { vercelToken: "t", vercelTeamId: "team", vercelProjectId: "p" }),
    ).toBe(true)
  })
})

describe("createSandboxProvider", () => {
  test("throws with the exact missing e2b variable when unconfigured", () => {
    return expect(createSandboxProvider("e2b", {}, empty)).rejects.toThrow("E2B_API_KEY")
  })

  test("throws with the exact missing vercel variables when unconfigured", () => {
    return expect(createSandboxProvider("vercel", {}, empty)).rejects.toThrow("VERCEL_TOKEN")
  })

  test("builds the selected provider without network when configured", async () => {
    const e2b = await createSandboxProvider("e2b", {}, e2bEnv)
    expect(e2b.kind).toBe("e2b")
    expect(e2b.info()).toBeUndefined()
    expect(await e2b.isAlive()).toBe(false)
    const vercel = await createSandboxProvider("vercel", {}, oidcEnv)
    expect(vercel.kind).toBe("vercel")
    expect(await vercel.isAlive()).toBe(false)
  })

  test("provider operations require create() first", async () => {
    const provider = await createSandboxProvider("e2b", {}, e2bEnv)
    return expect(provider.runCommand({ cmd: "echo" })).rejects.toThrow("Call create() first")
  })
})

describe("shellQuote", () => {
  test("quotes words with spaces and embedded quotes", () => {
    expect(shellQuote("hello world")).toBe("'hello world'")
    expect(shellQuote("it's")).toBe("'it'\\''s'")
    expect(shellQuote("plain")).toBe("'plain'")
  })

  test("joins commands for single-string shells", () => {
    expect(shellJoin("echo", ["hello world", "it's"])).toBe(`echo 'hello world' 'it'\\''s'`)
  })
})
