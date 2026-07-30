import config from "@/lib/config"
import { refillAiCreditsIfDue } from "@/models/tenants"
import { getUserByEmail, getUserById, UserWithTenant } from "@/models/users"
import { Tenant } from "@/prisma/client"
import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { APIError } from "better-auth/api"
import { nextCookies } from "better-auth/next-js"
import { emailOTP } from "better-auth/plugins/email-otp"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { prisma } from "./db"
import { resend, sendOTPCodeEmail } from "./email"
import { aiQuotaOf, AiQuota, TenantScope, tenantScope } from "./tenant"

/** The signed-in user together with the workspace every query is scoped to. */
export type AppUser = UserWithTenant & TenantScope

export type UserProfile = {
  id: string
  name: string
  email: string
  avatar?: string
  role: string
  tenant: {
    id: string
    name: string
    slug: string
    plan: string
    isDemo: boolean
    storageUsed: number
    storageLimit: number
  }
  ai: AiQuota
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  appName: config.app.title,
  baseURL: config.app.baseURL,
  secret: config.auth.secret,
  email: {
    provider: "resend",
    from: config.email.from,
    resend,
  },
  // Password sign-in exists so the shared demo workspace can be entered in one
  // click. Self-service password signup stays closed: real accounts are
  // provisioned through the email-code flow.
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    requireEmailVerification: false,
    minPasswordLength: 8,
  },
  session: {
    strategy: "jwt",
    expiresIn: 180 * 24 * 60 * 60, // 365 days
    updateAge: 24 * 60 * 60, // 24 hours
    cookieCache: {
      enabled: true,
      maxAge: 365 * 24 * 60 * 60, // 365 days
    },
  },
  advanced: {
    cookiePrefix: "ledgernest",
    database: {
      generateId: "uuid",
    },
  },
  plugins: [
    emailOTP({
      disableSignUp: config.auth.disableSignup,
      otpLength: 6,
      expiresIn: 10 * 60, // 10 minutes
      sendVerificationOTP: async ({ email, otp }) => {
        const user = await getUserByEmail(email)
        if (!user) {
          throw new APIError("NOT_FOUND", { message: "User with this email does not exist" })
        }
        await sendOTPCodeEmail({ email, otp })
      },
    }),
    nextCookies(), // make sure this is the last plugin in the array
  ],
})

export async function getSession() {
  return await auth.api.getSession({
    headers: await headers(),
  })
}

function withScope(user: UserWithTenant, tenant: Tenant): AppUser {
  return { ...user, tenant, ...tenantScope(user) }
}

export async function getCurrentUser(): Promise<AppUser> {
  const session = await getSession()
  if (session && session.user) {
    const user = await getUserById(session.user.id)
    if (user) {
      // Demo workspaces top their AI credits back up on the way in, so the
      // hourly reset happens whether or not the cron job is running.
      return withScope(user, await refillAiCreditsIfDue(user.tenant))
    }
  }

  redirect(config.auth.loginUrl)
}

export function toUserProfile(user: AppUser): UserProfile {
  return {
    id: user.id,
    name: user.name || "",
    email: user.email,
    avatar: user.avatar ? user.avatar + "?" + user.id : undefined,
    role: user.role,
    tenant: {
      id: user.tenant.id,
      name: user.tenant.name,
      slug: user.tenant.slug,
      plan: user.tenant.plan,
      isDemo: user.tenant.isDemo,
      storageUsed: user.tenant.storageUsed,
      storageLimit: user.tenant.storageLimit,
    },
    ai: aiQuotaOf(user.tenant),
  }
}

export function isSubscriptionExpired(user: AppUser) {
  return Boolean(user.tenant.membershipExpiresAt && user.tenant.membershipExpiresAt < new Date())
}

export function isAiBalanceExhausted(user: AppUser) {
  return aiQuotaOf(user.tenant).isExhausted
}
