import { getSession } from "@/lib/auth"
import config from "@/lib/config"
import { redirect } from "next/navigation"

export default async function Home() {
  const session = await getSession()

  // Nothing lives at the root: signed-in people go to their workspace,
  // everyone else goes straight to the sign-in page.
  redirect(session ? "/dashboard" : config.auth.loginUrl)
}

export const dynamic = "force-dynamic"
