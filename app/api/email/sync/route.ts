import { runEmailSync } from "@/lib/email-sync/ingest"
import { getCurrentUser } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"

export async function POST(_request: NextRequest) {
  try {
    // Verify user is authenticated
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 })
    }

    console.log(`🔄 Manual email sync triggered by user: ${user.email}`)

    // Run the email sync
    await runEmailSync({ tenantId: user.tenantId })

    return NextResponse.json({
      success: true,
      message: "Email sync completed successfully",
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("❌ Error in manual email sync:", error)

    return NextResponse.json(
      { error: "We couldn't check your mailboxes just now. Please try again in a moment." },
      { status: 500 }
    )
  }
}

export async function GET(_request: NextRequest) {
  try {
    // Verify user is authenticated
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 })
    }

    return NextResponse.json({
      message: "Email sync API is ready",
      endpoint: "/api/email/sync",
      methods: ["POST"],
      description: "Trigger manual email synchronization",
    })
  } catch (_error) {
    return NextResponse.json({ error: "We couldn't check the mail sync status. Please try again." }, { status: 500 })
  }
}
