export * as SandboxPlugin from "./sandbox"

import { Effect } from "effect"
import { Integration } from "../integration"
import { define } from "./internal"

/**
 * Registers the sandbox execution providers as connectable integrations so
 * API tokens are pasted once (provider connect dialog or settings) and stored
 * in the credential store — never in project config or localStorage.
 *
 * IDs are deliberately distinct from the AI provider catalog (`vercel` stays
 * the model provider; `vercel-sandbox` is the execution sandbox).
 */
export const Plugin = define({
  id: "sandbox",
  effect: Effect.fn(function* (ctx) {
    yield* ctx.integration.transform(
      Effect.fn(function* (integrations) {
        integrations.update(Integration.ID.make("e2b"), (integration) => {
          integration.name = "E2B"
        })
        integrations.method.update({
          integrationID: Integration.ID.make("e2b"),
          method: { type: "key", label: "API key" },
        })
        integrations.method.update({
          integrationID: Integration.ID.make("e2b"),
          method: { type: "env", names: ["E2B_API_KEY"] },
        })
        integrations.update(Integration.ID.make("vercel-sandbox"), (integration) => {
          integration.name = "Vercel Sandbox"
        })
        integrations.method.update({
          integrationID: Integration.ID.make("vercel-sandbox"),
          method: { type: "key", label: "Personal access token" },
        })
        integrations.method.update({
          integrationID: Integration.ID.make("vercel-sandbox"),
          method: { type: "env", names: ["VERCEL_OIDC_TOKEN"] },
        })
      }),
    )
  }),
})
