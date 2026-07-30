import config from "@/lib/config"
import { refillAllDueTenants } from "@/models/tenants"
import { NextRequest, NextResponse } from "next/server"

/**
 * Tops up every workspace whose refill window has elapsed — in practice, the
 * demo workspace's hourly AI credits.
 *
 * The same refill also happens lazily whenever someone loads a page, so this
 * endpoint is a belt-and-braces for deployments that keep a cron container
 * running. Protect it by setting CRON_SECRET and sending it as a bearer token.
 */
export async function GET(request: NextRequest) {
  if (config.cron.secret) {
    const authorization = request.headers.get("authorization")
    if (authorization !== `Bearer ${config.cron.secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  try {
    const { refilled } = await refillAllDueTenants()
    return NextResponse.json({ ok: true, refilled })
  } catch (error) {
    console.error("Failed to refill AI credits:", error)
    return NextResponse.json({ ok: false, error: "Refill failed" }, { status: 500 })
  }
}

export const dynamic = "force-dynamic"
