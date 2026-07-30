#!/usr/bin/env npx tsx
import { prisma } from "@/lib/db"
import { runEmailSync } from "@/lib/email-sync/ingest"

async function main() {
  console.log(`🚀 Starting email sync at ${new Date().toISOString()}`)
  // Cron run: honor each server's syncInterval (manual "Sync Now" bypasses it).
  const results = await runEmailSync({ respectInterval: true })
  const total = results.reduce((acc, r) => acc + r.processed, 0)
  const errored = results.filter((r) => r.status === "error")
  console.log(`✅ Email sync complete. Servers: ${results.length}, attachments: ${total}, errors: ${errored.length}`)
  for (const e of errored) console.error(`   ❌ ${e.serverId}: ${e.errorMessage}`)
}

// Only sync when this file is run as a script. Importing it (the build does,
// while collecting routes) must not kick off a sync against the database.
const isRunAsScript = process.argv[1]?.includes("fetch-emails") ?? false

if (isRunAsScript) {
  main()
    .catch((error) => {
      console.error("💥 Fatal error during email sync:", error)
      process.exitCode = 1
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}

export { runEmailSync as fetchEmails }
