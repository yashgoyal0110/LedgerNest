import { getCurrentUser } from "@/lib/auth"
import { stripeClient } from "@/lib/stripe"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 })
  }

  if (!stripeClient) {
    return NextResponse.json({ error: "Billing isn't available right now. Please contact support." }, { status: 500 })
  }

  try {
    if (!user.tenant.stripeCustomerId) {
      return NextResponse.json({ error: "This workspace doesn't have a subscription to manage yet." }, { status: 400 })
    }

    const portalSession = await stripeClient.billingPortal.sessions.create({
      customer: user.tenant.stripeCustomerId,
      return_url: `${request.nextUrl.origin}/settings/profile`,
    })

    return NextResponse.redirect(portalSession.url)
  } catch (error) {
    console.error("Stripe portal error:", error)
    return NextResponse.json({ error: "We couldn't open the billing portal. Please try again." }, { status: 500 })
  }
}
