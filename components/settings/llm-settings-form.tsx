"use client"

import { fieldsToJsonSchema } from "@/ai/schema"
import { saveSettingsAction } from "@/app/(app)/settings/actions"
import { FormError } from "@/components/forms/error"
import { FormTextarea } from "@/components/forms/simple"
import { Button } from "@/components/ui/button"
import { Card, CardTitle } from "@/components/ui/card"
import { Field } from "@/prisma/client"
import { CircleCheckBig, Edit } from "lucide-react"
import Link from "next/link"
import { useActionState } from "react"

export default function LLMSettingsForm({
  settings,
  fields,
}: {
  settings: Record<string, string>
  fields: Field[]
}) {
  const [saveState, saveAction, pending] = useActionState(saveSettingsAction, null)

  return (
    <>
      <form action={saveAction} className="space-y-4">
        <FormTextarea
          title="Instructions used when analysing a document"
          name="prompt_analyse_new_file"
          defaultValue={settings.prompt_analyse_new_file}
          className="h-96"
        />

        <div className="flex flex-row items-center gap-4">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : "Save settings"}
          </Button>
          {saveState?.success && (
            <p className="flex flex-row items-center gap-2 text-green-500">
              <CircleCheckBig />
              Saved!
            </p>
          )}
        </div>

        {saveState?.error && <FormError>{saveState.error}</FormError>}
      </form>

      <Card className="mt-20 flex flex-col gap-4 bg-accent p-4">
        <CardTitle className="flex flex-row items-center justify-between gap-2">
          <span className="text-md font-medium">Details the AI is asked to pull out of each document</span>
          <Link
            href="/settings/fields"
            className="inline-flex flex-row items-center gap-1 text-xs text-muted-foreground underline"
          >
            <Edit className="h-4 w-4" /> Edit fields
          </Link>
        </CardTitle>
        <pre className="overflow-hidden text-ellipsis text-xs">
          {JSON.stringify(fieldsToJsonSchema(fields), null, 2)}
        </pre>
      </Card>
    </>
  )
}
