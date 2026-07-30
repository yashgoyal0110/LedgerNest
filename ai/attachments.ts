import { fileExists, fullPathForFile } from "@/lib/files"
import { generateFilePreviews } from "@/lib/previews/generate"
import { File, Tenant } from "@/prisma/client"
import fs from "fs/promises"

const MAX_PAGES_TO_ANALYZE = 4

export type AnalyzeAttachment = {
  filename: string
  contentType: string
  base64: string
}

export const loadAttachmentsForAI = async (tenant: Tenant, file: File): Promise<AnalyzeAttachment[]> => {
  const fullFilePath = fullPathForFile(tenant, file)
  const isFileExists = await fileExists(fullFilePath)
  if (!isFileExists) {
    throw new Error("File not found on disk")
  }

  const { contentType, previews } = await generateFilePreviews(tenant, fullFilePath, file.mimetype)

  return Promise.all(
    previews.slice(0, MAX_PAGES_TO_ANALYZE).map(async (preview) => ({
      filename: file.filename,
      contentType: contentType,
      base64: await loadFileAsBase64(preview),
    }))
  )
}

export const loadFileAsBase64 = async (filePath: string): Promise<string> => {
  const buffer = await fs.readFile(filePath)
  return Buffer.from(buffer).toString("base64")
}
