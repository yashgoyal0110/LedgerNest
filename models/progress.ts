import { prisma } from "@/lib/db"
import { TenantScope } from "@/lib/tenant"

export const getOrCreateProgress = async (
  { tenantId, userId }: TenantScope,
  id: string,
  type: string | null = null,
  data: any = null,
  total: number = 0
) => {
  return await prisma.progress.upsert({
    where: { id },
    create: {
      id,
      tenantId,
      userId,
      type: type || "unknown",
      data,
      total,
    },
    update: {
      // Don't update existing progress
    },
  })
}

export const getProgressById = async ({ tenantId }: TenantScope, id: string) => {
  return await prisma.progress.findFirst({
    where: { id, tenantId },
  })
}

export const updateProgress = async (
  { tenantId }: TenantScope,
  id: string,
  fields: { current?: number; total?: number; data?: any }
) => {
  return await prisma.progress.updateMany({
    where: { id, tenantId },
    data: fields,
  })
}

export const incrementProgress = async ({ tenantId }: TenantScope, id: string, amount: number = 1) => {
  return await prisma.progress.updateMany({
    where: { id, tenantId },
    data: {
      current: { increment: amount },
    },
  })
}

export const getAllProgress = async ({ tenantId }: TenantScope) => {
  return await prisma.progress.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
  })
}

export const deleteProgress = async ({ tenantId }: TenantScope, id: string) => {
  return await prisma.progress.deleteMany({
    where: { id, tenantId },
  })
}
