import { prisma } from "@/lib/db"
import { TenantScope } from "@/lib/tenant"
import { codeFromName } from "@/lib/utils"
import { formatDate } from "date-fns"
import { createCategory, getCategoryByCode } from "./categories"
import { createProject, getProjectByCode } from "./projects"
import { TransactionFilters } from "./transactions"

export type ExportFilters = TransactionFilters

export type ExportFields = string[]

export type ExportImportFieldSettings = {
  code: string
  type: string
  export?: (scope: TenantScope, value: any) => Promise<any>
  import?: (scope: TenantScope, value: any) => Promise<any>
}

export const EXPORT_AND_IMPORT_FIELD_MAP: Record<string, ExportImportFieldSettings> = {
  name: {
    code: "name",
    type: "string",
  },
  description: {
    code: "description",
    type: "string",
  },
  merchant: {
    code: "merchant",
    type: "string",
  },
  total: {
    code: "total",
    type: "number",
    export: async function (scope: TenantScope, value: number) {
      return value / 100
    },
    import: async function (scope: TenantScope, value: string) {
      const num = parseFloat(value)
      return isNaN(num) ? 0.0 : num * 100
    },
  },
  currencyCode: {
    code: "currencyCode",
    type: "string",
  },
  convertedTotal: {
    code: "convertedTotal",
    type: "number",
    export: async function (scope: TenantScope, value: number | null) {
      if (!value) {
        return null
      }
      return value / 100
    },
    import: async function (scope: TenantScope, value: string) {
      const num = parseFloat(value)
      return isNaN(num) ? 0.0 : num * 100
    },
  },
  convertedCurrencyCode: {
    code: "convertedCurrencyCode",
    type: "string",
  },
  type: {
    code: "type",
    type: "string",
    export: async function (scope: TenantScope, value: string | null) {
      return value ? value.toLowerCase() : ""
    },
    import: async function (scope: TenantScope, value: string) {
      return value.toLowerCase()
    },
  },
  note: {
    code: "note",
    type: "string",
  },
  categoryCode: {
    code: "categoryCode",
    type: "string",
    export: async function (scope: TenantScope, value: string | null) {
      if (!value) {
        return null
      }
      const category = await getCategoryByCode(scope, value)
      return category?.name
    },
    import: async function (scope: TenantScope, value: string) {
      const category = await importCategory(scope, value)
      return category?.code
    },
  },
  projectCode: {
    code: "projectCode",
    type: "string",
    export: async function (scope: TenantScope, value: string | null) {
      if (!value) {
        return null
      }
      const project = await getProjectByCode(scope, value)
      return project?.name
    },
    import: async function (scope: TenantScope, value: string) {
      const project = await importProject(scope, value)
      return project?.code
    },
  },
  issuedAt: {
    code: "issuedAt",
    type: "date",
    export: async function (scope: TenantScope, value: Date | null) {
      if (!value || isNaN(value.getTime())) {
        return null
      }

      try {
        return formatDate(value, "yyyy-MM-dd")
      } catch (_error) {
        return null
      }
    },
    import: async function (scope: TenantScope, value: string) {
      try {
        return new Date(value)
      } catch (_error) {
        return null
      }
    },
  },
}

export const importProject = async (scope: TenantScope, name: string) => {
  const code = codeFromName(name)

  const existingProject = await prisma.project.findFirst({
    where: {
      tenantId: scope.tenantId,
      OR: [{ code }, { name }],
    },
  })

  if (existingProject) {
    return existingProject
  }

  return await createProject(scope, { code, name })
}

export const importCategory = async (scope: TenantScope, name: string) => {
  const code = codeFromName(name)

  const existingCategory = await prisma.category.findFirst({
    where: {
      tenantId: scope.tenantId,
      OR: [{ code }, { name }],
    },
  })

  if (existingCategory) {
    return existingCategory
  }

  return await createCategory(scope, { code, name })
}
