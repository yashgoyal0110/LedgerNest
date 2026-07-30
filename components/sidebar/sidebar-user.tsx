import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarMenuButton } from "@/components/ui/sidebar"
import { Badge } from "@/components/ui/badge"
import { AiCreditsMeter } from "@/components/workspace/ai-credits-meter"
import { UserProfile } from "@/lib/auth"
import { authClient } from "@/lib/auth-client"
import { PLANS } from "@/lib/stripe"
import { formatBytes } from "@/lib/utils"
import { Building2, CreditCard, LogOut, MoreVertical, Sparkles, User } from "lucide-react"
import Link from "next/link"
import { redirect } from "next/navigation"

export default function SidebarUser({ profile }: { profile: UserProfile }) {
  const subtitle = profile.email
  const planName = PLANS[profile.tenant.plan as keyof typeof PLANS]?.name ?? profile.tenant.plan

  const signOut = async () => {
    await authClient.signOut({})
    redirect("/")
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          size="lg"
          className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
        >
          <Avatar className="h-6 w-6 rounded-full bg-sidebar-accent">
            <AvatarImage src={profile.avatar} alt={profile.name || ""} />
            <AvatarFallback className="rounded-full bg-sidebar-accent text-sidebar-accent-foreground">
              <User className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-medium">{profile.name || profile.email}</span>
            <span className="truncate text-xs">{subtitle}</span>
          </div>
          <MoreVertical className="ml-auto size-4" />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
        side="top"
        align="center"
        sideOffset={4}
      >
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
            <Avatar className="h-8 w-8 rounded-lg">
              <AvatarImage src={profile.avatar} alt={profile.name || ""} />
              <AvatarFallback className="rounded-lg">
                <User className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold">{profile.name || profile.email}</span>
              <span className="truncate text-xs">{subtitle}</span>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="px-2 py-2">
          <div className="flex items-center justify-between gap-2 pb-2">
            <span className="flex items-center gap-1.5 truncate text-xs font-medium">
              <Building2 className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{profile.tenant.name}</span>
            </span>
            <Badge variant="secondary" className="shrink-0 text-[10px] uppercase">
              {planName}
            </Badge>
          </div>
          <AiCreditsMeter ai={profile.ai} />
          <p className="pt-2 text-[11px] text-muted-foreground">
            {formatBytes(profile.tenant.storageUsed)} storage used
          </p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="/settings/workspace" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Workspace &amp; plan
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="/api/stripe/portal" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Billing
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <span onClick={signOut} className="flex items-center gap-2 text-red-600 cursor-pointer">
            <LogOut className="h-4 w-4" />
            Log out
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
