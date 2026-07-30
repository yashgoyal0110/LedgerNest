import { prisma } from "@/lib/db"
import { TenantScope } from "@/lib/tenant"
import { Field, Prisma, Transaction } from "@/prisma/client"
import { cache } from "react"
import { getFields } from "./fields"
import { deleteFile } from "./files"

export type TransactionData = {
  name?: string | null
  description?: string | null
  merchant?: string | null
  total?: number | null
  currencyCode?: string | null
  convertedTotal?: number | null
  convertedCurrencyCode?: string | null
  type?: string | null
  items?: TransactionData[] | undefined
  note?: string | null
  files?: string[] | undefined
  extra?: Record<string, unknown>
  categoryCode?: string | null
  projectCode?: string | null
  issuedAt?: Date | string | null
  text?: string | null
  [key: string]: unknown
}

export type TransactionFilters = {
  search?: string
  dateFrom?: string
  dateTo?: string
  ordering?: string
  categoryCode?: string
  projectCode?: string
  type?: string
  page?: number
}

export type TransactionPagination = {
  limit: number
  offset: number
}

export const getTransactions = cache(
  async (
    scope: TenantScope,
    filters?: TransactionFilters,
    pagination?: TransactionPagination
  ): Promise<{
    transactions: Transaction[]
    total: number
  }> => {
    const where: Prisma.TransactionWhereInput = { tenantId: scope.tenantId }
    let orderBy: Prisma.TransactionOrderByWithRelationInput = { issuedAt: "desc" }

    if (filters) {
      if (filters.search) {
        where.OR = [
          { name: { contains: filters.search, mode: "insensitive" } },
          { merchant: { contains: filters.search, mode: "insensitive" } },
          { description: { contains: filters.search, mode: "insensitive" } },
          { note: { contains: filters.search, mode: "insensitive" } },
          { text: { contains: filters.search, mode: "insensitive" } },
        ]
      }

      if (filters.dateFrom || filters.dateTo) {
        where.issuedAt = {
          gte: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
          lte: filters.dateTo ? new Date(filters.dateTo) : undefined,
        }
      }

      if (filters.categoryCode) {
        where.categoryCode = filters.categoryCode
      }

      if (filters.projectCode) {
        where.projectCode = filters.projectCode
      }

      if (filters.type) {
        where.type = filters.type
      }

      if (filters.ordering) {
        const isDesc = filters.ordering.startsWith("-")
        const field = isDesc ? filters.ordering.slice(1) : filters.ordering
        orderBy = { [field]: isDesc ? "desc" : "asc" }
      }
    }

    if (pagination) {
      const total = await prisma.transaction.count({ where })
      const transactions = await prisma.transaction.findMany({
        where,
        include: {
          category: true,
          project: true,
        },
        orderBy,
        take: pagination?.limit,
        skip: pagination?.offset,
      })
      return { transactions, total }
    } else {
      const transactions = await prisma.transaction.findMany({
        where,
        include: {
          category: true,
          project: true,
        },
        orderBy,
      })
      return { transactions, total: transactions.length }
    }
  }
)

export const getTransactionById = cache(async (id: string, scope: TenantScope): Promise<Transaction | null> => {
  return await prisma.transaction.findFirst({
    where: { id, tenantId: scope.tenantId },
    include: {
      category: true,
      project: true,
    },
  })
})

export const getTransactionsByFileId = cache(async (fileId: string, scope: TenantScope): Promise<Transaction[]> => {
  return await prisma.transaction.findMany({
    where: { files: { array_contains: [fileId] }, tenantId: scope.tenantId },
  })
})

// --- 1. New Dedicated Deduplication Function ---
export const findDuplicateTransaction = async (scope: TenantScope, data: TransactionData) => {
  const { standard } = await splitTransactionDataExtraFields(data, scope)
  const currencyCode = standard.currencyCode || "USD"

  if (standard.total && standard.merchant && standard.issuedAt) {
    const existingTransaction = await prisma.transaction.findFirst({
      where: {
        tenantId: scope.tenantId,
        total: standard.total,
        merchant: standard.merchant,
        issuedAt: standard.issuedAt,
        currencyCode: currencyCode,
      },
    })

    return existingTransaction
  }

  return null
}

export const createTransaction = async (scope: TenantScope, data: TransactionData): Promise<Transaction> => {
  const { standard, extra } = await splitTransactionDataExtraFields(data, scope)

  const newTransaction = await prisma.transaction.create({
    data: {
      ...standard,
      extra: extra,
      items: data.items as Prisma.InputJsonValue,
      tenantId: scope.tenantId,
      userId: scope.userId,
    },
  })

  return newTransaction
}

export const updateTransaction = async (
  id: string,
  scope: TenantScope,
  data: TransactionData
): Promise<Transaction> => {
  const { standard, extra } = await splitTransactionDataExtraFields(data, scope)

  const updated = await prisma.transaction.updateMany({
    where: { id, tenantId: scope.tenantId },
    data: {
      ...standard,
      extra: extra,
      items: data.items ? (data.items as Prisma.InputJsonValue) : [],
    },
  })

  if (updated.count === 0) {
    throw new Error("Transaction not found in this workspace")
  }

  return (await prisma.transaction.findUniqueOrThrow({ where: { id } })) as Transaction
}

export const updateTransactionFiles = async (
  id: string,
  scope: TenantScope,
  files: string[]
): Promise<Transaction> => {
  await prisma.transaction.updateMany({
    where: { id, tenantId: scope.tenantId },
    data: { files },
  })

  return await prisma.transaction.findUniqueOrThrow({ where: { id } })
}

export const deleteTransaction = async (id: string, scope: TenantScope): Promise<Transaction | undefined> => {
  const transaction = await getTransactionById(id, scope)

  if (transaction) {
    const files = Array.isArray(transaction.files) ? transaction.files : []

    for (const fileId of files as string[]) {
      if ((await getTransactionsByFileId(fileId, scope)).length <= 1) {
        await deleteFile(fileId, scope)
      }
    }

    return await prisma.transaction.delete({
      where: { id },
    })
  }
}

export const bulkDeleteTransactions = async (ids: string[], scope: TenantScope) => {
  return await prisma.transaction.deleteMany({
    where: { id: { in: ids }, tenantId: scope.tenantId },
  })
}

const splitTransactionDataExtraFields = async (
  data: TransactionData,
  scope: TenantScope
): Promise<{ standard: TransactionData; extra: Prisma.InputJsonValue }> => {
  const fields = await getFields(scope)
  const fieldMap = fields.reduce(
    (acc, field) => {
      acc[field.code] = field
      return acc
    },
    {} as Record<string, Field>
  )

  const standard: TransactionData = {}
  const extra: Record<string, unknown> = {}

  Object.entries(data).forEach(([key, value]) => {
    const fieldDef = fieldMap[key]
    if (fieldDef) {
      if (fieldDef.isExtra) {
        extra[key] = value
      } else {
        standard[key] = value
      }
    }
  })

  return { standard, extra: extra as Prisma.InputJsonValue }
}
