import { PricingCard } from "@/components/auth/pricing-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { AiCreditsMeter } from "@/components/workspace/ai-credits-meter"
import config from "@/lib/config"
import { PLANS } from "@/lib/stripe"
import { aiQuotaOf } from "@/lib/tenant"
import { formatBytes } from "@/lib/utils"
import { Tenant } from "@/prisma/client"
import { formatDate } from "date-fns"
import { CalendarSync, HardDrive } from "lucide-react"
import Link from "next/link"

/** Plan and usage for the workspace — the quota is shared by everyone in it. */
export function SubscriptionPlan({ tenant }: { tenant: Tenant }) {
  const plan = PLANS[tenant.plan as keyof typeof PLANS] || PLANS.unlimited
  const ai = aiQuotaOf(tenant)

  return (
    <div className="flex flex-wrap gap-5">
      <div className="flex max-w-[300px] flex-1 flex-col items-center justify-center gap-2">
        <PricingCard plan={plan} hideButton={true} />
        <Badge variant="outline">Current plan · {tenant.name}</Badge>
      </div>
      <div className="flex-1">
        <Card className="w-full p-4">
          <div className="space-y-3">
            <strong className="text-lg">Workspace usage</strong>

            <AiCreditsMeter ai={ai} />

            <div className="flex items-center gap-2">
              <HardDrive className="h-4 w-4" />
              <span>
                <strong className="font-semibold">Storage:</strong> {formatBytes(tenant.storageUsed)} /{" "}
                {tenant.storageLimit > 0 ? formatBytes(tenant.storageLimit) : "Unlimited"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <CalendarSync className="h-4 w-4" />
              <span>
                <strong className="font-semibold">Renews / expires:</strong>{" "}
                {tenant.membershipExpiresAt ? formatDate(tenant.membershipExpiresAt, "yyyy-MM-dd") : "Never"}
              </span>
            </div>
          </div>

          <div className="mt-6 space-y-4 text-center">
            {tenant.isDemo ? (
              <p className="text-sm text-muted-foreground">
                Demo workspaces cannot be upgraded. AI credits refill automatically every hour.
              </p>
            ) : tenant.stripeCustomerId ? (
              <Button asChild className="w-full">
                <Link href="/api/stripe/portal">Manage subscription</Link>
              </Button>
            ) : (
              <Button asChild className="w-full">
                <Link href="/cloud">Upgrade workspace</Link>
              </Button>
            )}

            <Link href={`mailto:${config.app.supportEmail}`} className="block text-sm text-muted-foreground">
              Contact us
            </Link>
          </div>
        </Card>
      </div>
    </div>
  )
}
