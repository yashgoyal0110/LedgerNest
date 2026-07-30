import { X } from "lucide-react"
import Link from "next/link"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col bg-gray-950">
      {/* Subtle brand wash so the marketing panel does not sit on flat black */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(59,130,246,0.18),transparent_45%),radial-gradient(circle_at_85%_10%,rgba(168,85,247,0.14),transparent_40%)]"
      />
      <Link
        href="/"
        aria-label="Close"
        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-gray-200 transition-colors hover:bg-white/20"
      >
        <X className="h-5 w-5" />
      </Link>
      <div className="relative flex flex-grow flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        {children}
      </div>
    </div>
  )
}

export const dynamic = "force-dynamic"
