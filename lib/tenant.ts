import { Tenant } from "@/prisma/client"

/**
 * Branded tenant id. Data-access functions only accept a `TenantScope`, so a
 * plain `user.id` can never be passed where a tenant is expected: the compiler
 * rejects it. This is what keeps workspace isolation from silently regressing.
 */
export type TenantId = string & { readonly __brand: "TenantId" }

export type TenantScope = {
  tenantId: TenantId
  /** The acting user. Stored on rows for auditing ("created by"), never for isolation. */
  userId: string
}

export const asTenantId = (id: string) => id as TenantId

export function tenantScope(user: { id: string; tenantId: string }): TenantScope {
  return { tenantId: asTenantId(user.tenantId), userId: user.id }
}

/** Every new workspace starts with this many AI analyses. */
export const FREE_AI_CREDITS = 5

/** The demo workspace tops itself back up on this cadence. */
export const DEMO_AI_REFILL_MINUTES = 60

export const UNLIMITED = -1

export type AiQuota = {
  balance: number
  limit: number
  used: number
  isUnlimited: boolean
  isExhausted: boolean
  /** When the balance refills again (demo workspaces only). */
  refillsAt: Date | null
  refillMinutes: number | null
}

export function aiQuotaOf(tenant: Tenant): AiQuota {
  const isUnlimited = tenant.aiCreditsLimit === UNLIMITED || tenant.plan === "unlimited"
  const balance = isUnlimited ? UNLIMITED : Math.max(tenant.aiBalance, 0)

  return {
    balance,
    limit: tenant.aiCreditsLimit,
    used: isUnlimited ? 0 : Math.max(tenant.aiCreditsLimit - tenant.aiBalance, 0),
    isUnlimited,
    isExhausted: !isUnlimited && tenant.aiBalance <= 0,
    refillsAt: nextRefillAt(tenant),
    refillMinutes: tenant.aiRefillMinutes,
  }
}

export function nextRefillAt(tenant: Tenant): Date | null {
  if (!tenant.aiRefillMinutes) {
    return null
  }
  const last = tenant.aiRefilledAt ?? tenant.createdAt
  return new Date(last.getTime() + tenant.aiRefillMinutes * 60 * 1000)
}

export function isRefillDue(tenant: Tenant, now: Date = new Date()): boolean {
  const refillsAt = nextRefillAt(tenant)
  return refillsAt !== null && refillsAt <= now
}

export function aiQuotaExhaustedMessage(tenant: Tenant): string {
  const quota = aiQuotaOf(tenant)

  if (tenant.isDemo && quota.refillsAt) {
    return `The demo workspace includes ${tenant.aiCreditsLimit} AI analyses per hour. Your credits refill at ${quota.refillsAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`
  }

  return `This workspace has used all ${tenant.aiCreditsLimit} of its included AI analyses. Upgrade the plan to add more.`
}

export function isSubscriptionExpiredForTenant(tenant: Tenant): boolean {
  return Boolean(tenant.membershipExpiresAt && tenant.membershipExpiresAt < new Date())
}

export function isEnoughStorage(tenant: Tenant, fileSize: number): boolean {
  if (tenant.storageLimit < 0) {
    return true
  }
  return tenant.storageUsed + fileSize <= tenant.storageLimit
}

/** URL- and filesystem-safe workspace identifier. */
export function slugifyTenantName(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
  return base || "workspace"
}
