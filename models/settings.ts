import { LLMProvider } from "@/ai/providers/llmProvider"
import config from "@/lib/config"
import { prisma } from "@/lib/db"
import { PROVIDERS } from "@/lib/llm-providers"
import { TenantScope } from "@/lib/tenant"
import { cache } from "react"

export type SettingsMap = Record<string, string>

/**
 * Helper to extract LLM provider settings from SettingsMap.
 */
export function getLLMSettings(settings: SettingsMap) {
  return {
    providers: [
      {
        provider: "google" as LLMProvider,
        apiKey: settings.google_api_key || config.ai.googleApiKey || "",
        model: settings.google_model_name || config.ai.googleModelName || PROVIDERS[0].defaultModelName,
      },
    ],
  }
}

export const getSettings = cache(async ({ tenantId }: TenantScope): Promise<SettingsMap> => {
  const settings = await prisma.setting.findMany({
    where: { tenantId },
  })

  return settings.reduce((acc, setting) => {
    acc[setting.code] = setting.value || ""
    return acc
  }, {} as SettingsMap)
})

export const updateSettings = cache(
  async ({ tenantId, userId }: TenantScope, code: string, value: string | undefined) => {
    return await prisma.setting.upsert({
      where: { tenantId_code: { code, tenantId } },
      update: { value },
      create: {
        code,
        value,
        name: code,
        tenantId,
        userId,
      },
    })
  }
)
