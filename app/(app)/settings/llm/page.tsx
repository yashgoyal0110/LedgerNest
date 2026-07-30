import LLMSettingsForm from "@/components/settings/llm-settings-form"
import { SettingsPageHeader } from "@/components/settings/page-header"
import { getCurrentUser } from "@/lib/auth"
import { getFields } from "@/models/fields"
import { getSettings } from "@/models/settings"

export default async function LlmSettingsPage() {
  const user = await getCurrentUser()
  const settings = await getSettings(user)
  const fields = await getFields(user)

  return (
    <div className="space-y-6">
      <SettingsPageHeader
        title="AI analysis"
        description="Tune the instructions the AI follows when it reads your documents."
      />
      <div className="w-full max-w-2xl">
        <LLMSettingsForm settings={settings} fields={fields} />
      </div>
    </div>
  )
}
