import { prisma } from "@/lib/db"
import { TenantScope } from "@/lib/tenant"
import { codeFromName } from "@/lib/utils"
import { Prisma } from "@/prisma/client"
import { cache } from "react"

export type CategoryData = {
  [key: string]: unknown
}

export const getCategories = cache(async ({ tenantId }: TenantScope) => {
  return await prisma.category.findMany({
    where: { tenantId },
    orderBy: {
      name: "asc",
    },
  })
})

export const getCategoryByCode = cache(async ({ tenantId }: TenantScope, code: string) => {
  return await prisma.category.findUnique({
    where: { tenantId_code: { tenantId, code } },
  })
})

export const createCategory = async ({ tenantId, userId }: TenantScope, category: CategoryData) => {
  if (!category.code) {
    category.code = codeFromName(category.name as string)
  }
  return await prisma.category.create({
    data: {
      ...category,
      tenantId,
      userId,
    } as unknown as Prisma.CategoryUncheckedCreateInput,
  })
}

export const updateCategory = async ({ tenantId }: TenantScope, code: string, category: CategoryData) => {
  return await prisma.category.update({
    where: { tenantId_code: { tenantId, code } },
    data: category,
  })
}

export const deleteCategory = async ({ tenantId }: TenantScope, code: string) => {
  await prisma.transaction.updateMany({
    where: {
      tenantId,
      categoryCode: code,
    },
    data: {
      categoryCode: null,
    },
  })

  return await prisma.category.delete({
    where: { tenantId_code: { tenantId, code } },
  })
}
