import { prisma } from "@/lib/db"
import { TenantScope } from "@/lib/tenant"
import { Prisma } from "@/prisma/client"
import { cache } from "react"

export const getCurrencies = cache(async ({ tenantId }: TenantScope) => {
  return await prisma.currency.findMany({
    where: { tenantId },
    orderBy: {
      code: "asc",
    },
  })
})

export const createCurrency = async (
  { tenantId, userId }: TenantScope,
  currency: Pick<Prisma.CurrencyCreateInput, "code" | "name">
) => {
  return await prisma.currency.create({
    data: {
      ...currency,
      tenantId,
      userId,
    },
  })
}

export const updateCurrency = async (
  { tenantId }: TenantScope,
  code: string,
  currency: Prisma.CurrencyUpdateInput
) => {
  return await prisma.currency.update({
    where: { tenantId_code: { code, tenantId } },
    data: currency,
  })
}

export const deleteCurrency = async ({ tenantId }: TenantScope, code: string) => {
  return await prisma.currency.delete({
    where: { tenantId_code: { code, tenantId } },
  })
}
