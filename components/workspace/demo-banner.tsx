"use client"

import { Badge } from "@/components/ui/badge"
import { AiQuota } from "@/lib/tenant"
import { FlaskConical, RefreshCw, Sparkles } from "lucide-react"
import { useEffect, useState } from "react"

function countdown(target: Date | null): string {
  if (!target) return ""
  const ms = target.getTime() - Date.now()
  if (ms <= 0) return "any moment"
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`
}

/**
 * Shown at the top of every page inside the shared demo workspace so nobody
 * mistakes sample data for their own books.
 */
export function DemoBanner({ ai }: { ai: AiQuota }) {
  const refillsAt = ai.refillsAt ? new Date(ai.refillsAt) : null
  const [remaining, setRemaining] = useState(() => countdown(refillsAt))

  useEffect(() => {
    if (!refillsAt) return
    const timer = setInterval(() => setRemaining(countdown(refillsAt)), 1000)
    return () => clearInterval(timer)
  }, [refillsAt?.getTime()]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="border-b bg-muted/40 px-5 py-2.5">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
        <span className="flex items-center gap-2 font-medium">
          <FlaskConical className="h-4 w-4" />
          Demo workspace
        </span>
        <span className="text-muted-foreground">
          Explore freely — this data is shared, resets periodically, and is not your own.
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5 font-normal">
            <Sparkles className="h-3 w-3" />
            {ai.balance} of {ai.limit} AI analyses left
          </Badge>
          {refillsAt && (
            <Badge variant="outline" className="gap-1.5 font-normal">
              <RefreshCw className="h-3 w-3" />
              Refills in {remaining}
            </Badge>
          )}
        </div>
      </div>
    </div>
  )
}
