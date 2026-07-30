"use server"

import { ActionState } from "@/lib/actions"
import { friendly } from "@/lib/errors"
import { getCurrentUser } from "@/lib/auth"
import { EXPORT_AND_IMPORT_FIELD_MAP } from "@/models/export_and_import"
import { createTransaction, findDuplicateTransaction } from "@/models/transactions"
import { Transaction } from "@/prisma/client"
import { parse } from "@fast-csv/parse"
import { revalidatePath } from "next/cache"

export async function parseCSVAction(
  _prevState: ActionState<string[][]> | null,
  formData: FormData
): Promise<ActionState<string[][]>> {
  const file = formData.get("file") as File
  if (!file) {
    return { success: false, error: "No file uploaded" }
  }

  if (!file.name.toLowerCase().endsWith(".csv")) {
    return { success: false, error: "Only CSV files are allowed" }
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const rows: string[][] = []

    const parser = parse()
      .on("data", (row) => rows.push(row))
      .on("error", (error) => {
        throw error
      })
    parser.write(buffer)
    parser.end()

    // Wait for parsing to complete
    await new Promise((resolve) => parser.on("end", resolve))

    return { success: true, data: rows }
  } catch (error) {
    console.error("Error parsing CSV:", error)
    return { success: false, error: "We couldn't read that CSV file. Check the format and try again." }
  }
}

export async function saveTransactionsAction(
  _prevState: ActionState<Transaction> | null,
  formData: FormData
): Promise<ActionState<Transaction>> {
  const user = await getCurrentUser()
  try {
    const rows = JSON.parse(formData.get("rows") as string) as Record<string, unknown>[]

    const forceSave = formData.get("forceSave") === "true"
    const startIndex = parseInt(formData.get("resumeIndex") as string) || 0
    const rowsToProcess = rows.slice(startIndex)
    let currentIndex = startIndex

    for (const row of rowsToProcess) {
      const transactionData: Record<string, unknown> = {}
      for (const [fieldCode, value] of Object.entries(row)) {
        const fieldDef = EXPORT_AND_IMPORT_FIELD_MAP[fieldCode]
        if (fieldDef?.import) {
          transactionData[fieldCode] = await fieldDef.import(user, value as string)
        } else {
          transactionData[fieldCode] = value as string
        }
      }

      const shouldForceSave = forceSave && currentIndex === startIndex

      // --- Deduplication Check ---
      if (!shouldForceSave) {
        const existingTransaction = await findDuplicateTransaction(user, transactionData)

        if (existingTransaction) {
          return {
            success: false,
            error: "DUPLICATE_FOUND",
            duplicateData: {
              existingTransaction: existingTransaction,
              newTransactionData: transactionData,
              resumeIndex: currentIndex,
            },
          }
        }
      }
      await createTransaction(user, transactionData)

      currentIndex++
    }

    revalidatePath("/import/csv")
    revalidatePath("/transactions")

    return { success: true }
  } catch (error) {
    console.error("Error saving transactions:", error)
    return { success: false, error: friendly("CSV import failed", error, "We couldn't import those rows. Check the file and try again.") }
  }
}
