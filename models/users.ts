import { prisma } from "@/lib/db"
import { tenantScope } from "@/lib/tenant"
import { Prisma, Tenant, User } from "@/prisma/client"
import { cache } from "react"
import { createUserDefaults, isDatabaseEmpty } from "./defaults"
import { createTenant, uniqueTenantSlug } from "./tenants"

export type UserWithTenant = User & { tenant: Tenant }

export type TenantSubscription = {
  stripeCustomerId?: string
  plan?: string
  membershipExpiresAt?: Date
  storageLimit?: number
  aiCredits?: number
}

function subscriptionToTenantData(subscription: TenantSubscription): Prisma.TenantUpdateInput {
  return {
    ...(subscription.stripeCustomerId ? { stripeCustomerId: subscription.stripeCustomerId } : {}),
    ...(subscription.plan ? { plan: subscription.plan } : {}),
    ...(subscription.membershipExpiresAt ? { membershipExpiresAt: subscription.membershipExpiresAt } : {}),
    ...(subscription.storageLimit !== undefined ? { storageLimit: subscription.storageLimit } : {}),
    ...(subscription.aiCredits !== undefined
      ? { aiBalance: subscription.aiCredits, aiCreditsLimit: subscription.aiCredits }
      : {}),
  }
}

/**
 * Signs a user in for the first time by giving them their own workspace.
 * Existing users keep the workspace they already belong to.
 */
export async function getOrCreateCloudUser(
  email: string,
  data: Omit<Prisma.UserCreateInput, "tenant">,
  subscription: TenantSubscription = {}
): Promise<UserWithTenant> {
  const normalizedEmail = email.toLowerCase()
  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: { tenant: true },
  })

  if (existing) {
    await prisma.tenant.update({
      where: { id: existing.tenantId },
      data: subscriptionToTenantData(subscription),
    })
    const user = await prisma.user.update({
      where: { id: existing.id },
      data: { name: data.name, avatar: data.avatar },
      include: { tenant: true },
    })
    await ensureWorkspaceIsSetUp(user)
    return user
  }

  const workspaceName = data.name || normalizedEmail.split("@")[0]
  const tenant = await createTenant({
    name: workspaceName,
    slug: await uniqueTenantSlug(normalizedEmail.split("@")[0]),
    plan: subscription.plan,
    aiCreditsLimit: subscription.aiCredits,
    storageLimit: subscription.storageLimit,
    membershipExpiresAt: subscription.membershipExpiresAt ?? null,
  })

  if (subscription.stripeCustomerId) {
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { stripeCustomerId: subscription.stripeCustomerId },
    })
  }

  const user = await prisma.user.create({
    data: { ...data, email: normalizedEmail, tenantId: tenant.id, role: "owner" },
    include: { tenant: true },
  })

  await createUserDefaults(tenantScope(user))

  return user
}

export async function ensureWorkspaceIsSetUp(user: UserWithTenant | User) {
  const scope = tenantScope(user)
  if (await isDatabaseEmpty(scope)) {
    await createUserDefaults(scope)
  }
}

export const getUserById = cache(async (id: string): Promise<UserWithTenant | null> => {
  return await prisma.user.findUnique({
    where: { id },
    include: { tenant: true },
  })
})

export const getUserByEmail = cache(async (email: string): Promise<UserWithTenant | null> => {
  return await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: { tenant: true },
  })
})

export const getTenantByStripeCustomerId = cache(async (customerId: string) => {
  return await prisma.tenant.findFirst({
    where: { stripeCustomerId: customerId },
  })
})

export function updateUser(userId: string, data: Prisma.UserUpdateInput) {
  return prisma.user.update({
    where: { id: userId },
    data,
  })
}
