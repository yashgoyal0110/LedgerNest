import config from "@/lib/config"
import { createUserDefaults, isDatabaseEmpty } from "@/models/defaults"
import { getOrCreateSelfHostedUser, getSelfHostedUser } from "@/models/users"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function GET() {
  if (!config.selfHosted.isEnabled) {
    redirect(config.auth.loginUrl)
  }

  let user = await getSelfHostedUser()
  if (!user && config.ai.googleApiKey) {
    user = await getOrCreateSelfHostedUser()
  }

  if (!user) {
    redirect(config.selfHosted.welcomeUrl)
  }

  if (await isDatabaseEmpty(user.id)) {
    await createUserDefaults(user.id)
  }

  revalidatePath("/dashboard")
  redirect("/dashboard")
}
