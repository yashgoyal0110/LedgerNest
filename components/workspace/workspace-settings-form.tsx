"use client"

import { saveWorkspaceAction } from "@/app/(app)/settings/actions"
import { FormError } from "@/components/forms/error"
import { FormInput } from "@/components/forms/simple"
import { Button } from "@/components/ui/button"
import { CircleCheckBig } from "lucide-react"
import { useActionState } from "react"

export function WorkspaceSettingsForm({
  name,
  slug,
  canEdit,
  isDemo,
}: {
  name: string
  slug: string
  canEdit: boolean
  isDemo: boolean
}) {
  const [saveState, saveAction, pending] = useActionState(saveWorkspaceAction, null)

  return (
    <form action={saveAction} className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">Workspace</h3>
        <p className="text-sm text-muted-foreground">
          {isDemo
            ? "This is the shared demo workspace. Its settings are locked so every visitor sees the same tour."
            : "The name your team sees in the sidebar and on exported documents."}
        </p>
      </div>

      <FormInput title="Workspace name" name="name" defaultValue={name} disabled={!canEdit} required />
      <FormInput title="Workspace ID" name="slug" defaultValue={slug} disabled />

      {canEdit && (
        <div className="flex flex-row items-center gap-4">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : "Save"}
          </Button>
          {saveState?.success && (
            <p className="flex flex-row items-center gap-2 text-green-500">
              <CircleCheckBig />
              Saved!
            </p>
          )}
        </div>
      )}

      {saveState?.error && <FormError>{saveState.error}</FormError>}
    </form>
  )
}
