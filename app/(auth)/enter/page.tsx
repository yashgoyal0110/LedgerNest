import { LoginForm } from "@/components/auth/login-form"
import { Card, CardContent } from "@/components/ui/card"
import config from "@/lib/config"
import { BarChart3, FileStack, Building2, ShieldCheck, Sparkles } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { redirect } from "next/navigation"

const HIGHLIGHTS = [
  {
    icon: Building2,
    title: "Workspaces, not silos",
    body: "Every record, file and credit belongs to a workspace your whole team shares.",
  },
  {
    icon: Sparkles,
    title: "AI document intake",
    body: "Drop in receipts and invoices; fields, categories and totals come back filled in.",
  },
  {
    icon: BarChart3,
    title: "Reporting that ships",
    body: "Multi-currency P&L, project breakdowns and CSV exports your accountant will accept.",
  },
  {
    icon: FileStack,
    title: "Your documents stay yours",
    body: "Self-host it or run it in our cloud — the archive is always exportable.",
  },
]

export default async function LoginPage() {
  if (config.selfHosted.isEnabled) {
    redirect(config.selfHosted.redirectUrl)
  }

  return (
    <div className="grid w-full max-w-6xl gap-10 lg:grid-cols-[1.05fr_minmax(380px,440px)] lg:items-center">
      <section className="hidden flex-col gap-8 text-white lg:flex">
        <div className="flex items-center gap-3">
          <Image src="/logo/logo.svg" alt="" width={48} height={48} className="h-12 w-12 rounded-xl" />
          <span className="text-2xl font-semibold tracking-tight">{config.app.title}</span>
        </div>

        <div className="space-y-4">
          <h1 className="max-w-xl text-4xl font-bold leading-tight tracking-tight">
            The books your business actually keeps.
          </h1>
          <p className="max-w-xl text-lg text-gray-300">
            Receipts in, structured records out. LedgerNest turns the pile of invoices, statements and receipts into a
            searchable, exportable ledger — one workspace per business.
          </p>
        </div>

        <ul className="grid gap-5 sm:grid-cols-2">
          {HIGHLIGHTS.map((highlight) => (
            <li key={highlight.title} className="flex gap-3">
              <highlight.icon className="mt-0.5 h-5 w-5 shrink-0 text-gray-300" />
              <div className="space-y-1">
                <p className="font-medium">{highlight.title}</p>
                <p className="text-sm text-gray-400">{highlight.body}</p>
              </div>
            </li>
          ))}
        </ul>

        <p className="flex items-center gap-2 text-sm text-gray-400">
          <ShieldCheck className="h-4 w-4" />
          Workspace-isolated data · encrypted credentials · exportable at any time
        </p>
      </section>

      <Card className="w-full p-8">
        <div className="space-y-1.5 text-center lg:text-left">
          <h2 className="text-2xl font-semibold tracking-tight">Sign in to your workspace</h2>
          <p className="text-sm text-muted-foreground">
            Use a one-time email code, or your password if you have one.
          </p>
        </div>
        <CardContent className="w-full p-0 pt-6">
          <LoginForm isDemoEnabled={config.demo.isEnabled} />
        </CardContent>
        <p className="pt-6 text-center text-xs text-muted-foreground">
          By continuing you agree to our{" "}
          <Link href="/docs/terms" className="underline hover:text-foreground">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/docs/privacy_policy" className="underline hover:text-foreground">
            Privacy Policy
          </Link>
          .
        </p>
      </Card>
    </div>
  )
}

export const dynamic = "force-dynamic"
