"use server"

import { ActionState } from "@/lib/actions"
import { getCurrentUser, isSubscriptionExpired } from "@/lib/auth"
import { getDirectorySize, getTenantUploadsDirectory, isEnoughStorageToUploadFile } from "@/lib/files"
import { ingestUnsortedFile } from "@/lib/uploads"
import { recalculateTenantStorage } from "@/models/tenants"
import { revalidatePath } from "next/cache"

export async function uploadFilesAction(formData: FormData): Promise<ActionState<null>> {
  const user = await getCurrentUser()
  const files = formData.getAll("files") as File[]

  // Check limits
  const totalFileSize = files.reduce((acc, file) => acc + file.size, 0)
  if (!isEnoughStorageToUploadFile(user.tenant, totalFileSize)) {
    return { success: false, error: `Insufficient storage to upload these files` }
  }

  if (isSubscriptionExpired(user)) {
    return {
      success: false,
      error: "Your subscription has expired, please upgrade your account or buy new subscription plan",
    }
  }

  // Process each file
  await Promise.all(
    files.map(async (file) => {
      if (!(file instanceof File)) {
        return { success: false, error: "Invalid file" }
      }
      const arrayBuffer = await file.arrayBuffer()
      return await ingestUnsortedFile(user.tenant, user, {
        buffer: Buffer.from(arrayBuffer),
        filename: file.name,
        mimetype: file.type,
        metadata: { lastModified: file.lastModified },
      })
    })
  )

  await recalculateTenantStorage(user.tenant)

  revalidatePath("/unsorted")

  return { success: true, error: null }
}
