"use server"

import { createUserDefaults, isDatabaseEmpty } from "@/models/defaults"
import { updateSettings } from "@/models/settings"
import { tenantScope } from "@/lib/tenant"
import { getOrCreateSelfHostedUser } from "@/models/users"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function selfHostedGetStartedAction(formData: FormData) {
  const user = await getOrCreateSelfHostedUser()

  if (await isDatabaseEmpty(tenantScope(user))) {
    await createUserDefaults(tenantScope(user))
  }

  const apiKeys = [
    "google_api_key",
  ]

  for (const key of apiKeys) {
    const value = formData.get(key)
    if (value) {
      await updateSettings(tenantScope(user), key, value as string)
    }
  }


  const defaultCurrency = formData.get("default_currency")
  if (defaultCurrency) {
    await updateSettings(tenantScope(user), "default_currency", defaultCurrency as string)
  }

  revalidatePath("/dashboard")
  redirect("/dashboard")
}
