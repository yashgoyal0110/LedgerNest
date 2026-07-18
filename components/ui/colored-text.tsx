import { cn } from "@/lib/utils"

export function ColoredText({
  children,
  className,
}: { children: React.ReactNode } & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cn("bg-gradient-to-r from-teal-500 via-cyan-500 to-indigo-500 bg-clip-text text-transparent", className)}>
      {children}
    </span>
  )
}
