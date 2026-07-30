import { SettingsPageHeader } from "@/components/settings/page-header"
import { SubscriptionPlan } from "@/components/settings/subscription-plan"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { WorkspaceSettingsForm } from "@/components/workspace/workspace-settings-form"
import { getCurrentUser } from "@/lib/auth"
import { getTenantMembers } from "@/models/tenants"
import { formatDate } from "date-fns"

export default async function WorkspaceSettingsPage() {
  const user = await getCurrentUser()
  const members = await getTenantMembers(user.tenantId)

  return (
    <div className="space-y-8">
      <SettingsPageHeader
        title="Workspace & Plan"
        description="Your workspace is the boundary for every record, file and AI credit in LedgerNest."
      />

      <div className="w-full max-w-4xl space-y-8">
        <SubscriptionPlan tenant={user.tenant} />

        <Separator />

        <WorkspaceSettingsForm
          name={user.tenant.name}
          slug={user.tenant.slug}
          canEdit={(user.role === "owner" || user.role === "admin") && !user.tenant.isDemo}
          isDemo={user.tenant.isDemo}
        />

        <Separator />

        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Members</h3>
            <p className="text-sm text-muted-foreground">
              Everyone listed here shares this workspace&apos;s transactions, files, categories and AI credits.
            </p>
          </div>

          <Card className="divide-y p-0">
            {members.map((member) => (
              <div key={member.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{member.name || member.email}</p>
                  <p className="truncate text-sm text-muted-foreground">{member.email}</p>
                </div>
                <Badge variant={member.role === "owner" ? "default" : "secondary"} className="capitalize">
                  {member.role}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Joined {formatDate(member.createdAt, "yyyy-MM-dd")}
                </span>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  )
}

export const dynamic = "force-dynamic"
