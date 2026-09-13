import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

export default {
  id: "20260905040000_project_environment",
  up(tx) {
    return Effect.gen(function* () {
      yield* tx.run(`ALTER TABLE \`project\` ADD \`environment\` text;`)
    })
  },
} satisfies DatabaseMigration.Migration
