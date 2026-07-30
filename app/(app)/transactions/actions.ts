"use server"

import { transactionFormSchema } from "@/forms/transactions"
import { ActionState } from "@/lib/actions"
import { describeFormError, friendly, MESSAGES } from "@/lib/errors"
import { getCurrentUser, isSubscriptionExpired } from "@/lib/auth"
import {
  getTransactionFileUploadPath,
  getTenantUploadsDirectory,
  isEnoughStorageToUploadFile,
  safePathJoin,
} from "@/lib/files"
import { updateField } from "@/models/fields"
import { createFile, deleteFile } from "@/models/files"
import {
  bulkDeleteTransactions,
  createTransaction,
  deleteTransaction,
  getTransactionById,
  updateTransaction,
  updateTransactionFiles,
  findDuplicateTransaction,
} from "@/models/transactions"
import { recalculateTenantStorage } from "@/models/tenants"
import { Transaction } from "@/prisma/client"
import { randomUUID } from "crypto"
import { mkdir, writeFile } from "fs/promises"
import { revalidatePath } from "next/cache"
import path from "path"

export async function createTransactionAction(
  _prevState: ActionState<Transaction> | null,
  formData: FormData
): Promise<ActionState<Transaction>> {
  try {
    const user = await getCurrentUser()
    const validatedForm = transactionFormSchema.safeParse(Object.fromEntries(formData.entries()))

    if (!validatedForm.success) {
      return { success: false, error: describeFormError(validatedForm.error) }
    }

    const forceSave = formData.get("forceSave") === "true"
    const transactionData = validatedForm.data

    // --- Perform the deduplication check FIRST ---
    if (!forceSave) {
      const existingTransaction = await findDuplicateTransaction(user, transactionData)

      if (existingTransaction) {
        return {
          success: false,
          error: "DUPLICATE_FOUND",
          duplicateData: {
            existingTransaction: existingTransaction,
            newTransactionData: transactionData,
            resumeIndex: 0,
          },
        }
      }
    }

    const newTransaction = await createTransaction(user, transactionData)

    revalidatePath("/transactions")
    return { success: true, data: newTransaction }
  } catch (error) {
    console.error("Failed to create transaction:", error)
    return { success: false, error: "We couldn't create that transaction. Please try again." }
  }
}

export async function saveTransactionAction(
  _prevState: ActionState<Transaction> | null,
  formData: FormData
): Promise<ActionState<Transaction>> {
  try {
    const user = await getCurrentUser()
    const transactionId = formData.get("transactionId") as string
    const validatedForm = transactionFormSchema.safeParse(Object.fromEntries(formData.entries()))

    if (!validatedForm.success) {
      return { success: false, error: describeFormError(validatedForm.error) }
    }

    const transaction = await updateTransaction(transactionId, user, validatedForm.data)

    revalidatePath("/transactions")
    return { success: true, data: transaction }
  } catch (error) {
    console.error("Failed to update transaction:", error)
    return { success: false, error: "We couldn't save your changes. Please try again." }
  }
}

export async function deleteTransactionAction(
  _prevState: ActionState<Transaction> | null,
  transactionId: string
): Promise<ActionState<Transaction>> {
  try {
    const user = await getCurrentUser()
    const transaction = await getTransactionById(transactionId, user)
    if (!transaction) throw new Error("Transaction not found")

    await deleteTransaction(transaction.id, user)

    revalidatePath("/transactions")

    return { success: true, data: transaction }
  } catch (error) {
    console.error("Failed to delete transaction:", error)
    return { success: false, error: "We couldn't delete that transaction. Please try again." }
  }
}

export async function deleteTransactionFileAction(
  transactionId: string,
  fileId: string
): Promise<ActionState<Transaction>> {
  if (!fileId || !transactionId) {
    return { success: false, error: "File ID and transaction ID are required" }
  }

  const user = await getCurrentUser()
  const transaction = await getTransactionById(transactionId, user)
  if (!transaction) {
    return { success: false, error: "We couldn't find that transaction. It may have been deleted." }
  }

  await updateTransactionFiles(
    transactionId, user,
    transaction.files ? (transaction.files as string[]).filter((id) => id !== fileId) : []
  )

  await deleteFile(fileId, user)

  // Update user storage used
  await recalculateTenantStorage(user.tenant)

  revalidatePath(`/transactions/${transactionId}`)
  return { success: true, data: transaction }
}

export async function uploadTransactionFilesAction(formData: FormData): Promise<ActionState<Transaction>> {
  try {
    const transactionId = formData.get("transactionId") as string
    const files = formData.getAll("files") as File[]

    if (!files || !transactionId) {
      return { success: false, error: "No files or transaction ID provided" }
    }

    const user = await getCurrentUser()
    const transaction = await getTransactionById(transactionId, user)
    if (!transaction) {
      return { success: false, error: "We couldn't find that transaction. It may have been deleted." }
    }

    const userUploadsDirectory = getTenantUploadsDirectory(user.tenant)

    // Check limits
    const totalFileSize = files.reduce((acc, file) => acc + file.size, 0)
    if (!isEnoughStorageToUploadFile(user.tenant, totalFileSize)) {
      return { success: false, error: `Insufficient storage to upload new files` }
    }

    if (isSubscriptionExpired(user)) {
      return {
        success: false,
        error: "Your subscription has expired, please upgrade your account or buy new subscription plan",
      }
    }

    const fileRecords = await Promise.all(
      files.map(async (file) => {
        const fileUuid = randomUUID()
        const relativeFilePath = getTransactionFileUploadPath(fileUuid, file.name, transaction)
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        const fullFilePath = safePathJoin(userUploadsDirectory, relativeFilePath)
        await mkdir(path.dirname(fullFilePath), { recursive: true })

        await writeFile(fullFilePath, buffer)

        // Create file record in database
        const fileRecord = await createFile(user, {
          id: fileUuid,
          filename: file.name,
          path: relativeFilePath,
          mimetype: file.type,
          isReviewed: true,
          metadata: {
            size: file.size,
            lastModified: file.lastModified,
          },
        })

        return fileRecord
      })
    )

    // Update invoice with the new file ID
    await updateTransactionFiles(
      transactionId, user,
      transaction.files
        ? [...(transaction.files as string[]), ...fileRecords.map((file) => file.id)]
        : fileRecords.map((file) => file.id)
    )

    // Update user storage used
    await recalculateTenantStorage(user.tenant)

    revalidatePath(`/transactions/${transactionId}`)
    return { success: true }
  } catch (error) {
    console.error("Upload error:", error)
    return { success: false, error: friendly("Attaching files to a transaction failed", error, MESSAGES.upload) }
  }
}

export async function bulkDeleteTransactionsAction(transactionIds: string[]) {
  try {
    const user = await getCurrentUser()
    await bulkDeleteTransactions(transactionIds, user)
    revalidatePath("/transactions")
    return { success: true }
  } catch (error) {
    console.error("Failed to delete transactions:", error)
    return { success: false, error: "We couldn't delete those transactions. Please try again." }
  }
}

export async function updateFieldVisibilityAction(fieldCode: string, isVisible: boolean) {
  try {
    const user = await getCurrentUser()
    await updateField(user, fieldCode, {
      isVisibleInList: isVisible,
    })
    return { success: true }
  } catch (error) {
    console.error("Failed to update field visibility:", error)
    return { success: false, error: "We couldn't update which columns are shown. Please try again." }
  }
}
