import config from "@/lib/config"
import { PLANS, stripeClient } from "@/lib/stripe"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")

  if (!code) {
    return NextResponse.json({ error: "Choose a plan to continue." }, { status: 400 })
  }

  if (!stripeClient) {
    return NextResponse.json({ error: "Payments aren't available right now. Please contact support." }, { status: 500 })
  }

  const plan = PLANS[code]
  if (!plan || !plan.isAvailable) {
    return NextResponse.json({ error: "That plan isn't available. Please choose another one." }, { status: 400 })
  }

  try {
    const session = await stripeClient.checkout.sessions.create({
      billing_address_collection: "auto",
      line_items: [
        {
          price: plan.stripePriceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      automatic_tax: {
        enabled: true,
      },
      allow_promotion_codes: true,
      success_url: config.stripe.paymentSuccessUrl,
      cancel_url: config.stripe.paymentCancelUrl,
    })

    if (!session.url) {
      console.log(session)
      return NextResponse.json({ error: "We couldn't open the checkout page. Please try again." }, { status: 500 })
    }

    return NextResponse.json({ session })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "We couldn't open the checkout page. Please try again." }, { status: 500 })
  }
}
