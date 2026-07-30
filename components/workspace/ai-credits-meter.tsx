import { AiQuota } from "@/lib/tenant"
import { cn } from "@/lib/utils"
import { Infinity as InfinityIcon, Sparkles } from "lucide-react"

/**
 * Compact usage bar for the workspace's AI allowance. Used in the sidebar and
 * on the plan page so the number is never a surprise mid-upload.
 */
export function AiCreditsMeter({ ai, className }: { ai: AiQuota; className?: string }) {
  if (ai.isUnlimited) {
    return (
      <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
        <InfinityIcon className="h-3.5 w-3.5" />
        Unlimited AI analyses
      </div>
    )
  }

  const percentLeft = ai.limit > 0 ? Math.min(100, Math.max(0, (ai.balance / ai.limit) * 100)) : 0
  const tone = ai.balance === 0 ? "bg-destructive" : percentLeft <= 34 ? "bg-amber-500" : "bg-primary"

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 font-medium">
          <Sparkles className="h-3.5 w-3.5" />
          AI analyses
        </span>
        <span className="tabular-nums text-muted-foreground">
          {ai.balance} / {ai.limit}
        </span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={ai.limit}
        aria-valuenow={ai.balance}
        aria-label="Remaining AI analyses"
      >
        <div className={cn("h-full rounded-full transition-all", tone)} style={{ width: `${percentLeft}%` }} />
      </div>
      {ai.refillMinutes && (
        <p className="text-[11px] text-muted-foreground">
          Refills to {ai.limit} every {ai.refillMinutes >= 60 ? `${ai.refillMinutes / 60}h` : `${ai.refillMinutes}m`}
        </p>
      )}
    </div>
  )
}
