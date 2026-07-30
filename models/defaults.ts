import { prisma } from "@/lib/db"
import { TenantScope } from "@/lib/tenant"
import {
  DEFAULT_CATEGORIES,
  DEFAULT_CURRENCIES,
  DEFAULT_FIELDS,
  DEFAULT_PROJECTS,
  DEFAULT_SETTINGS,
} from "@/models/defaults-data"

export {
  DEFAULT_CATEGORIES,
  DEFAULT_CURRENCIES,
  DEFAULT_FIELDS,
  DEFAULT_PROMPT_ANALYSE_NEW_FILE,
  DEFAULT_PROJECTS,
  DEFAULT_SETTINGS,
} from "@/models/defaults-data"

export async function createUserDefaults({ tenantId, userId }: TenantScope) {
  // Default projects
  for (const project of DEFAULT_PROJECTS) {
    await prisma.project.upsert({
      where: { tenantId_code: { code: project.code, tenantId } },
      update: { name: project.name, color: project.color, llm_prompt: project.llm_prompt },
      create: { ...project, tenantId, userId },
    })
  }

  // Default categories
  for (const category of DEFAULT_CATEGORIES) {
    await prisma.category.upsert({
      where: { tenantId_code: { code: category.code, tenantId } },
      update: { name: category.name, color: category.color, llm_prompt: category.llm_prompt },
      create: { ...category, tenantId, userId },
    })
  }

  // Default currencies
  for (const currency of DEFAULT_CURRENCIES) {
    await prisma.currency.upsert({
      where: { tenantId_code: { code: currency.code, tenantId } },
      update: { name: currency.name },
      create: { ...currency, tenantId, userId },
    })
  }

  // Default fields
  for (const field of DEFAULT_FIELDS) {
    await prisma.field.upsert({
      where: { tenantId_code: { code: field.code, tenantId } },
      update: {
        name: field.name,
        type: field.type,
        llm_prompt: field.llm_prompt,
        isVisibleInList: field.isVisibleInList,
        isVisibleInAnalysis: field.isVisibleInAnalysis,
        isRequired: field.isRequired,
        isExtra: field.isExtra,
      },
      create: { ...field, tenantId, userId },
    })
  }

  // Default settings
  for (const setting of DEFAULT_SETTINGS) {
    await prisma.setting.upsert({
      where: { tenantId_code: { code: setting.code, tenantId } },
      update: { name: setting.name, description: setting.description, value: setting.value },
      create: { ...setting, tenantId, userId },
    })
  }
}

export async function isDatabaseEmpty({ tenantId }: TenantScope) {
  const fieldsCount = await prisma.field.count({ where: { tenantId } })
  return fieldsCount === 0
}
