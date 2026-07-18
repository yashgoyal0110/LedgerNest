import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardTitle } from "@/components/ui/card"
import { getCurrentUser } from "@/lib/auth"
import { getSettings, updateSettings } from "@/models/settings"
import { ArrowRight, FileUp, FolderKanban, ScanText, Settings2, X } from "lucide-react"
import { revalidatePath } from "next/cache"
import Image from "next/image"
import Link from "next/link"

export async function WelcomeWidget() {
  const user = await getCurrentUser()
  const settings = await getSettings(user.id)
  const geminiReady = Boolean(settings.google_api_key || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)

  return (
    <Card className="relative overflow-hidden border-teal-200/60 bg-gradient-to-br from-teal-50 via-white to-indigo-50 p-8 dark:from-teal-950/30 dark:via-background dark:to-indigo-950/30">
      <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-teal-300/20 blur-3xl" />
      <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center">
        <Image src="/logo/logo.svg" alt="LedgerNest" width={112} height={112} className="h-28 w-28" />
        <div className="flex-1">
          <CardTitle className="flex items-start justify-between gap-4 text-3xl tracking-tight">
            <span>Welcome to LedgerNest</span>
            <Button variant="ghost" size="icon" onClick={async () => {
              "use server"
              await updateSettings(user.id, "is_welcome_message_hidden", "true")
              revalidatePath("/")
            }}><X className="h-4 w-4" /></Button>
          </CardTitle>
          <CardDescription className="mt-3 max-w-2xl text-base leading-7">
            Bring receipts, invoices, and statements into one private workspace. Gemini extracts the details; you stay
            in control of the final record.
          </CardDescription>
          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            <Link href="/unsorted" className="rounded-xl border bg-background/80 p-4 transition hover:-translate-y-0.5 hover:shadow-md">
              <FileUp className="mb-3 h-5 w-5 text-teal-600" /><span className="font-medium">Add documents</span>
            </Link>
            <Link href="/settings/fields" className="rounded-xl border bg-background/80 p-4 transition hover:-translate-y-0.5 hover:shadow-md">
              <ScanText className="mb-3 h-5 w-5 text-indigo-600" /><span className="font-medium">Shape extraction</span>
            </Link>
            <Link href="/settings/projects" className="rounded-xl border bg-background/80 p-4 transition hover:-translate-y-0.5 hover:shadow-md">
              <FolderKanban className="mb-3 h-5 w-5 text-violet-600" /><span className="font-medium">Organise projects</span>
            </Link>
          </div>
          {!geminiReady && (
            <Link href="/settings/llm" className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-teal-700 dark:text-teal-300">
              <Settings2 className="h-4 w-4" /> Connect your Gemini API key <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>
    </Card>
  )
}
