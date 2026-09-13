import { chromium } from "@playwright/test"

const errors: string[] = []

const browser = await chromium.launch()
const page = await browser.newPage()
page.on("pageerror", (error) => errors.push(String(error)))

await page.goto("http://localhost:4444/", { waitUntil: "networkidle", timeout: 60000 })
await page.screenshot({ path: "/tmp/sorycode/repro-home.png" })

// Open the first project edit dialog via the ... menu is fragile; instead go
// through a new-session page is not needed either. We directly exercise the
// connect dialog by evaluating the app is not possible, so drive the UI:
// click "Ajouter un projet" is not needed — use keyboard shortcut for connect?
// Simplest robust path: open command palette is complex; instead navigate to
// home and click the project row menu if present.
await page.waitForTimeout(3000)
await page.screenshot({ path: "/tmp/sorycode/repro-loaded.png" })

console.log("ERRORS:", JSON.stringify(errors.slice(0, 5), null, 2))
await browser.close()
if (errors.length > 0) process.exit(1)
