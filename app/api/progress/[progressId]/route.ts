import { getCurrentUser } from "@/lib/auth"
import { getOrCreateProgress, getProgressById } from "@/models/progress"
import { NextRequest } from "next/server"

const POLL_INTERVAL_MS = 2000 // 2 seconds

export async function GET(req: NextRequest, { params }: { params: Promise<{ progressId: string }> }) {
  const user = await getCurrentUser()
  const { progressId } = await params
  const url = new URL(req.url)
  const type = url.searchParams.get("type") || "unknown"

  await getOrCreateProgress(user, progressId, type)

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      let lastSent: unknown = null
      let stopped = false

      req.signal.addEventListener("abort", () => {
        stopped = true
        controller.close()
      })

      while (!stopped) {
        const progress = await getProgressById(user, progressId)
        if (!progress) {
          controller.enqueue(encoder.encode(`event: error\ndata: {"error":"Not found"}\n\n`))
          controller.close()
          break
        }

        // Only send if progress has changed
        if (JSON.stringify(progress) !== JSON.stringify(lastSent)) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(progress)}\n\n`))
          lastSent = progress

          // If progress is complete, close the connection
          if (progress.current === progress.total && progress.total > 0) {
            controller.close()
            break
          }
        }

        await new Promise((res) => setTimeout(res, POLL_INTERVAL_MS))
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    },
  })
}
