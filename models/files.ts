"use server"

import { prisma } from "@/lib/db"
import { getTenantUploadsDirectory, safePathJoin } from "@/lib/files"
import { TenantScope } from "@/lib/tenant"
import { unlink } from "fs/promises"
import path from "path"
import { cache } from "react"
import { getTransactionById } from "./transactions"

export const getUnsortedFiles = cache(async ({ tenantId }: TenantScope) => {
  return await prisma.file.findMany({
    where: {
      isReviewed: false,
      tenantId,
    },
    orderBy: {
      createdAt: "desc",
    },
  })
})

export const getUnsortedFilesCount = cache(async ({ tenantId }: TenantScope) => {
  return await prisma.file.count({
    where: {
      isReviewed: false,
      tenantId,
    },
  })
})

export const getFileById = cache(async (id: string, { tenantId }: TenantScope) => {
  return await prisma.file.findFirst({
    where: { id, tenantId },
  })
})

export const getFilesByTransactionId = cache(async (id: string, scope: TenantScope) => {
  const transaction = await getTransactionById(id, scope)
  if (transaction && transaction.files) {
    return await prisma.file.findMany({
      where: {
        id: {
          in: transaction.files as string[],
        },
        tenantId: scope.tenantId,
      },
      orderBy: {
        createdAt: "asc",
      },
    })
  }
  return []
})

export const createFile = async ({ tenantId, userId }: TenantScope, data: any) => {
  return await prisma.file.create({
    data: {
      ...data,
      tenantId,
      userId,
    },
  })
}

export const updateFile = async (id: string, { tenantId }: TenantScope, data: any) => {
  await prisma.file.updateMany({
    where: { id, tenantId },
    data,
  })

  return await prisma.file.findUniqueOrThrow({ where: { id } })
}

export const deleteFile = async (id: string, scope: TenantScope) => {
  const file = await getFileById(id, scope)
  if (!file) {
    return
  }

  try {
    // Use safePathJoin to prevent path traversal attacks (issue #75).
    // file.path is relative to the workspace's uploads directory.
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: scope.tenantId } })
    const fullPath = safePathJoin(getTenantUploadsDirectory(tenant), file.path)
    await unlink(path.resolve(fullPath))
  } catch (error) {
    console.error("Error deleting file:", error)
  }

  return await prisma.file.delete({
    where: { id },
  })
}
