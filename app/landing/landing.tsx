import { ArrowRight, FileSearch, LockKeyhole, Server, Sparkles } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

const features = [
  {
    icon: FileSearch,
    title: "Documents become structured records",
    copy: "Drop in receipts, invoices, or PDFs. LedgerNest extracts the useful details and keeps the source attached.",
  },
  {
    icon: Sparkles,
    title: "Gemini-powered analysis",
    copy: "Use your own Gemini key for fast document understanding, categorisation, and custom field extraction.",
  },
  {
    icon: LockKeyhole,
    title: "Your records stay on your VM",
    copy: "Uploads and financial records live in your own PostgreSQL and persistent volumes—not somebody else's SaaS.",
  },
]

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#071a1c] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(45,212,191,.18),transparent_32%),radial-gradient(circle_at_85%_25%,rgba(99,102,241,.16),transparent_30%)]" />
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-7 lg:px-10">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/logo/logo.svg" alt="LedgerNest" width={42} height={42} />
          <span className="text-xl font-semibold tracking-tight">LedgerNest</span>
        </Link>
        <Link href="/enter" className="rounded-full border border-white/15 px-5 py-2.5 text-sm hover:bg-white/10">
          Open workspace
        </Link>
      </header>

      <section className="relative z-10 mx-auto grid max-w-7xl gap-16 px-6 pb-24 pt-20 lg:grid-cols-[1.15fr_.85fr] lg:px-10 lg:pt-28">
        <div>
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-teal-300/20 bg-teal-300/10 px-4 py-2 text-sm text-teal-100">
            <Server className="h-4 w-4" /> Private by design. Ready for your VM.
          </div>
          <h1 className="max-w-4xl text-5xl font-semibold leading-[1.05] tracking-[-0.04em] sm:text-7xl">
            A calmer home for every financial document.
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-300">
            LedgerNest turns scattered receipts and invoices into a searchable, organised ledger with Gemini doing the
            repetitive work.
          </p>
          <Link
            href="/self-hosted"
            className="mt-10 inline-flex items-center gap-2 rounded-full bg-teal-300 px-6 py-3.5 font-semibold text-[#071a1c] transition hover:bg-teal-200"
          >
            Set up LedgerNest <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-4 shadow-2xl shadow-black/30 backdrop-blur">
          <div className="rounded-[1.5rem] border border-white/10 bg-[#0d2427] p-7">
            <div className="mb-10 flex items-center justify-between">
              <span className="text-sm text-slate-400">Document intelligence</span>
              <span className="rounded-full bg-emerald-300/10 px-3 py-1 text-xs text-emerald-200">Gemini connected</span>
            </div>
            <div className="space-y-4">
              {features.map(({ icon: Icon, title, copy }) => (
                <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                  <Icon className="mb-4 h-6 w-6 text-teal-300" />
                  <h2 className="font-medium">{title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{copy}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
