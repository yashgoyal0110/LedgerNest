import { prisma } from "@/lib/db"
import { TenantScope } from "@/lib/tenant"
import { codeFromName } from "@/lib/utils"
import { Prisma } from "@/prisma/client"
import { cache } from "react"

export type FieldData = {
  [key: string]: unknown
}

export const getFields = cache(async ({ tenantId }: TenantScope) => {
  return await prisma.field.findMany({
    where: { tenantId },
    orderBy: {
      createdAt: "asc",
    },
  })
})

export const createField = async ({ tenantId, userId }: TenantScope, field: FieldData) => {
  if (!field.code) {
    field.code = codeFromName(field.name as string)
  }
  return await prisma.field.create({
    data: {
      ...field,
      tenantId,
      userId,
    } as unknown as Prisma.FieldUncheckedCreateInput,
  })
}

export const updateField = async ({ tenantId }: TenantScope, code: string, field: FieldData) => {
  return await prisma.field.update({
    where: { tenantId_code: { code, tenantId } },
    data: field,
  })
}

export const deleteField = async ({ tenantId }: TenantScope, code: string) => {
  return await prisma.field.delete({
    where: { tenantId_code: { code, tenantId } },
  })
}
