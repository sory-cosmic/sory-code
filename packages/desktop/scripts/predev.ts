import { $ } from "bun"
import { downloadCliToResources } from "./utils"

try {
  await $`bun run install-electron`
} catch {
  console.warn("install-electron skipped (offline/fetch failed)")
}

await $`bun ./scripts/copy-icons.ts ${process.env.OPENCODE_CHANNEL ?? "dev"}`

await $`cd ../opencode && bun script/build-node.ts`
await downloadCliToResources()
