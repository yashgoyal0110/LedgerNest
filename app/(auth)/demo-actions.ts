"use server"

import { auth } from "@/lib/auth"
import config from "@/lib/config"
import { prisma } from "@/lib/db"
import { ensureDemoWorkspaceSeeded, getOrCreateDemoUser } from "@/models/demo"
import { headers } from "next/headers"

export type DemoCredentials = { email: string; password: string }

/**
 * Makes sure the demo account exists, is seeded, and can sign in with the
 * shared password. Returns the credentials so the login form can fill itself in
 * — visibly, rather than signing the visitor in behind their back.
 */
export async function prepareDemoAccountAction(): Promise<
  { success: true; credentials: DemoCredentials } | { success: false; error: string }
> {
  if (!config.demo.isEnabled) {
    return { success: false, error: "The demo workspace is not enabled on this deployment" }
  }

  try {
    const user = await getOrCreateDemoUser()
    await ensureDemoWorkspaceSeeded(user)
    await ensureDemoPassword(user.id)

    return {
      success: true,
      credentials: { email: config.demo.email, password: config.demo.password },
    }
  } catch (error) {
    console.error("Failed to prepare the demo account:", error)
    return { success: false, error: "Could not prepare the demo workspace. Please try again." }
  }
}

/** Prepares the demo workspace and signs in, for the one-click path. */
export async function signInToDemoAction(): Promise<{ success: boolean; error?: string }> {
  const prepared = await prepareDemoAccountAction()
  if (!prepared.success) {
    return prepared
  }

  try {
    // `nextCookies()` in the auth config writes the session cookie for us.
    await auth.api.signInEmail({
      body: prepared.credentials,
      headers: await headers(),
    })
    return { success: true }
  } catch (error) {
    console.error("Demo sign-in failed:", error)
    return { success: false, error: "Could not sign in to the demo workspace. Please try again." }
  }
}

/**
 * better-auth stores credentials in its own `account` table, so the demo
 * password is (re)written there with the library's own hasher.
 */
async function ensureDemoPassword(userId: string): Promise<void> {
  const ctx = await auth.$context
  const hash = await ctx.password.hash(config.demo.password)

  const existing = await prisma.account.findFirst({
    where: { userId, providerId: "credential" },
  })

  if (existing) {
    await prisma.account.update({ where: { id: existing.id }, data: { password: hash } })
    return
  }

  await prisma.account.create({
    data: {
      id: crypto.randomUUID(),
      accountId: userId,
      providerId: "credential",
      userId,
      password: hash,
    },
  })
}
