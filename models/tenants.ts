import { prisma } from "@/lib/db"
import { getDirectorySize, getTenantUploadsDirectory } from "@/lib/files"
import {
  DEMO_AI_REFILL_MINUTES,
  FREE_AI_CREDITS,
  isRefillDue,
  slugifyTenantName,
  TenantId,
  TenantScope,
  UNLIMITED,
} from "@/lib/tenant"
import { Prisma, Tenant } from "@/prisma/client"
import { randomUUID } from "crypto"
import { cache } from "react"

export const getTenantById = cache(async (id: string) => {
  return await prisma.tenant.findUnique({ where: { id } })
})

export const getTenantBySlug = cache(async (slug: string) => {
  return await prisma.tenant.findUnique({ where: { slug } })
})

export const getTenantMembers = cache(async (tenantId: TenantId) => {
  return await prisma.user.findMany({
    where: { tenantId },
    orderBy: { createdAt: "asc" },
  })
})

export async function updateTenant(tenantId: TenantId, data: Prisma.TenantUpdateInput) {
  return await prisma.tenant.update({ where: { id: tenantId }, data })
}

/** Picks a free slug, appending a short suffix when the preferred one is taken. */
export async function uniqueTenantSlug(preferred: string): Promise<string> {
  const base = slugifyTenantName(preferred)

  if (!(await prisma.tenant.findUnique({ where: { slug: base }, select: { id: true } }))) {
    return base
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `${base}-${randomUUID().slice(0, 6)}`
    if (!(await prisma.tenant.findUnique({ where: { slug: candidate }, select: { id: true } }))) {
      return candidate
    }
  }

  return `${base}-${Date.now().toString(36)}`
}

export type NewTenantOptions = {
  name: string
  slug?: string
  plan?: string
  isDemo?: boolean
  aiCreditsLimit?: number
  aiRefillMinutes?: number | null
  storageLimit?: number
  membershipExpiresAt?: Date | null
}

export async function createTenant(options: NewTenantOptions): Promise<Tenant> {
  const aiCreditsLimit = options.aiCreditsLimit ?? FREE_AI_CREDITS
  const slug = options.slug ?? (await uniqueTenantSlug(options.name))

  return await prisma.tenant.create({
    data: {
      name: options.name,
      slug,
      storagePrefix: slug,
      plan: options.plan ?? "free",
      isDemo: options.isDemo ?? false,
      aiCreditsLimit,
      // Every workspace starts with a full allowance of free AI analyses.
      aiBalance: aiCreditsLimit === UNLIMITED ? 0 : aiCreditsLimit,
      aiRefillMinutes: options.aiRefillMinutes ?? null,
      aiRefilledAt: options.aiRefillMinutes ? new Date() : null,
      storageLimit: options.storageLimit ?? UNLIMITED,
      membershipExpiresAt: options.membershipExpiresAt ?? null,
    },
  })
}

/**
 * Tops a workspace back up to its full allowance when its refill window has
 * elapsed. Demo workspaces refill hourly; everyone else has no refill window
 * and is left untouched. Called on every read of the current tenant, so the
 * reset happens without depending on a background job.
 */
export async function refillAiCreditsIfDue(tenant: Tenant): Promise<Tenant> {
  if (!tenant.aiRefillMinutes || !isRefillDue(tenant)) {
    return tenant
  }

  const now = new Date()
  const updated = await prisma.tenant.updateMany({
    where: {
      id: tenant.id,
      // Guard against two concurrent requests both refilling.
      OR: [{ aiRefilledAt: tenant.aiRefilledAt }, { aiRefilledAt: null }],
    },
    data: { aiBalance: tenant.aiCreditsLimit, aiRefilledAt: now },
  })

  if (updated.count === 0) {
    return (await getTenantById(tenant.id)) ?? tenant
  }

  return { ...tenant, aiBalance: tenant.aiCreditsLimit, aiRefilledAt: now }
}

/** Refills every workspace whose window elapsed. Used by the cron endpoint. */
export async function refillAllDueTenants(): Promise<{ refilled: number }> {
  const tenants = await prisma.tenant.findMany({ where: { aiRefillMinutes: { not: null } } })
  const due = tenants.filter((tenant) => isRefillDue(tenant))

  for (const tenant of due) {
    await refillAiCreditsIfDue(tenant)
  }

  return { refilled: due.length }
}

/**
 * Spends one AI analysis. Returns false when the workspace is out of credits.
 * The conditional update makes the check-and-decrement atomic, so parallel
 * analyses can't push the balance below zero.
 */
export async function consumeAiCredit(scope: TenantScope): Promise<boolean> {
  const tenant = await prisma.tenant.findUnique({ where: { id: scope.tenantId } })
  if (!tenant) {
    return false
  }

  if (tenant.aiCreditsLimit === UNLIMITED || tenant.plan === "unlimited") {
    return true
  }

  const updated = await prisma.tenant.updateMany({
    where: { id: scope.tenantId, aiBalance: { gt: 0 } },
    data: { aiBalance: { decrement: 1 } },
  })

  return updated.count > 0
}

/** Recomputes how much disk a workspace occupies after files were added or removed. */
export async function recalculateTenantStorage(tenant: Tenant): Promise<void> {
  try {
    const storageUsed = await getDirectorySize(getTenantUploadsDirectory(tenant))
    await prisma.tenant.update({ where: { id: tenant.id }, data: { storageUsed } })
  } catch (error) {
    console.error("Failed to recalculate workspace storage:", error)
  }
}

/** Hands a reserved credit back when the analysis never happened. */
export async function refundAiCredit(scope: TenantScope): Promise<void> {
  const tenant = await prisma.tenant.findUnique({ where: { id: scope.tenantId } })
  if (!tenant || tenant.aiCreditsLimit === UNLIMITED || tenant.plan === "unlimited") {
    return
  }

  await prisma.tenant.updateMany({
    where: { id: scope.tenantId, aiBalance: { lt: tenant.aiCreditsLimit } },
    data: { aiBalance: { increment: 1 } },
  })
}

export async function addAiCredits(tenantId: TenantId, credits: number, creditsLimit?: number) {
  return await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      aiBalance: credits,
      ...(creditsLimit !== undefined ? { aiCreditsLimit: creditsLimit } : {}),
    },
  })
}

export const DEMO_TENANT_DEFAULTS = {
  plan: "demo",
  isDemo: true,
  aiCreditsLimit: FREE_AI_CREDITS,
  aiRefillMinutes: DEMO_AI_REFILL_MINUTES,
} as const
