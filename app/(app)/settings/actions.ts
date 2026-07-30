"use server"

import { LLMConfig, LLMProvider, testLLMProvider } from "@/ai/providers/llmProvider"
import {
  categoryFormSchema,
  currencyFormSchema,
  fieldFormSchema,
  projectFormSchema,
  settingsFormSchema,
} from "@/forms/settings"
import { userFormSchema } from "@/forms/users"
import { ActionState } from "@/lib/actions"
import { getCurrentUser } from "@/lib/auth"
import { uploadStaticImage } from "@/lib/uploads"
import { codeFromName, randomHexColor } from "@/lib/utils"
import { createCategory, deleteCategory, updateCategory } from "@/models/categories"
import { createCurrency, deleteCurrency, updateCurrency } from "@/models/currencies"
import { createField, deleteField, updateField } from "@/models/fields"
import { createProject, deleteProject, updateProject } from "@/models/projects"
import { SettingsMap, updateSettings } from "@/models/settings"
import { updateTenant } from "@/models/tenants"
import { updateUser } from "@/models/users"
import { Prisma, User } from "@/prisma/client"
import { revalidatePath } from "next/cache"
import path from "path"

export async function saveSettingsAction(
  _prevState: ActionState<SettingsMap> | null,
  formData: FormData
): Promise<ActionState<SettingsMap>> {
  const user = await getCurrentUser()
  const validatedForm = settingsFormSchema.safeParse(Object.fromEntries(formData))

  if (!validatedForm.success) {
    return { success: false, error: validatedForm.error.message }
  }

  for (const key in validatedForm.data) {
    const value = validatedForm.data[key as keyof typeof validatedForm.data]
    if (value !== undefined) {
      await updateSettings(user, key, value)
    }
  }

  revalidatePath("/settings/currencies")
  revalidatePath("/settings/categories")
  return { success: true }
}

export async function testLLMProviderAction(
  provider: string,
  apiKey: string,
  model: string,
  baseUrl?: string
): Promise<{ success: boolean; supportsVision: boolean; message: string }> {
  const config: LLMConfig = {
    provider: provider as LLMProvider,
    apiKey: apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "",
    model,
    baseUrl,
  }
  return testLLMProvider(config)
}

export async function saveProfileAction(
  _prevState: ActionState<User> | null,
  formData: FormData
): Promise<ActionState<User>> {
  const user = await getCurrentUser()
  const validatedForm = userFormSchema.safeParse(Object.fromEntries(formData))

  if (!validatedForm.success) {
    return { success: false, error: validatedForm.error.message }
  }

  // Upload avatar
  let avatarUrl = user.avatar
  const avatarFile = formData.get("avatar") as File | null
  if (avatarFile instanceof File && avatarFile.size > 0) {
    try {
      const uploadedAvatarPath = await uploadStaticImage(user.tenant, avatarFile, "avatar.webp", 500, 500)
      avatarUrl = `/files/static/${path.basename(uploadedAvatarPath)}`
    } catch (error) {
      return { success: false, error: "Failed to upload avatar: " + error }
    }
  }

  // Upload business logo
  let businessLogoUrl = user.tenant.businessLogo
  const businessLogoFile = formData.get("businessLogo") as File | null
  if (businessLogoFile instanceof File && businessLogoFile.size > 0) {
    try {
      const uploadedBusinessLogoPath = await uploadStaticImage(
        user.tenant,
        businessLogoFile,
        "businessLogo.png",
        500,
        500
      )
      businessLogoUrl = `/files/static/${path.basename(uploadedBusinessLogoPath)}`
    } catch (error) {
      return { success: false, error: "Failed to upload business logo: " + error }
    }
  }

  // The person's own profile...
  await updateUser(user.id, {
    name: validatedForm.data.name !== undefined ? validatedForm.data.name : user.name,
    avatar: avatarUrl,
  })

  // ...and the business identity, which belongs to the workspace and is shared
  // by everyone in it.
  await updateTenant(user.tenantId, {
    businessName:
      validatedForm.data.businessName !== undefined ? validatedForm.data.businessName : user.tenant.businessName,
    businessAddress:
      validatedForm.data.businessAddress !== undefined
        ? validatedForm.data.businessAddress
        : user.tenant.businessAddress,
    businessBankDetails:
      validatedForm.data.businessBankDetails !== undefined
        ? validatedForm.data.businessBankDetails
        : user.tenant.businessBankDetails,
    businessLogo: businessLogoUrl,
  })

  revalidatePath("/settings/profile")
  revalidatePath("/settings/workspace")
  return { success: true }
}

export async function saveWorkspaceAction(
  _prevState: ActionState<null> | null,
  formData: FormData
): Promise<ActionState<null>> {
  const user = await getCurrentUser()

  if (user.role !== "owner" && user.role !== "admin") {
    return { success: false, error: "Only workspace owners and admins can rename the workspace" }
  }

  if (user.tenant.isDemo) {
    return { success: false, error: "The demo workspace cannot be modified" }
  }

  const name = (formData.get("name") as string | null)?.trim()
  if (!name) {
    return { success: false, error: "Workspace name is required" }
  }

  await updateTenant(user.tenantId, { name })

  revalidatePath("/settings/workspace")
  return { success: true }
}

export async function addProjectAction(data: Prisma.ProjectCreateInput) {
  const scope = await getCurrentUser()
  const validatedForm = projectFormSchema.safeParse(data)

  if (!validatedForm.success) {
    return { success: false, error: validatedForm.error.message }
  }

  const project = await createProject(scope, {
    code: codeFromName(validatedForm.data.name),
    name: validatedForm.data.name,
    llm_prompt: validatedForm.data.llm_prompt || null,
    color: validatedForm.data.color || randomHexColor(),
  })
  revalidatePath("/settings/projects")

  return { success: true, project }
}

export async function editProjectAction(code: string, data: Prisma.ProjectUpdateInput) {
  const scope = await getCurrentUser()
  const validatedForm = projectFormSchema.safeParse(data)

  if (!validatedForm.success) {
    return { success: false, error: validatedForm.error.message }
  }

  const project = await updateProject(scope, code, {
    name: validatedForm.data.name,
    llm_prompt: validatedForm.data.llm_prompt,
    color: validatedForm.data.color || "",
  })
  revalidatePath("/settings/projects")

  return { success: true, project }
}

export async function deleteProjectAction(code: string) {
  const scope = await getCurrentUser()
  try {
    await deleteProject(scope, code)
  } catch (error) {
    return { success: false, error: "Failed to delete project" + error }
  }
  revalidatePath("/settings/projects")
  return { success: true }
}

export async function addCurrencyAction(data: Prisma.CurrencyCreateInput) {
  const scope = await getCurrentUser()
  const validatedForm = currencyFormSchema.safeParse(data)

  if (!validatedForm.success) {
    return { success: false, error: validatedForm.error.message }
  }

  const currency = await createCurrency(scope, {
    code: validatedForm.data.code,
    name: validatedForm.data.name,
  })
  revalidatePath("/settings/currencies")

  return { success: true, currency }
}

export async function editCurrencyAction(code: string, data: Prisma.CurrencyUpdateInput) {
  const scope = await getCurrentUser()
  const validatedForm = currencyFormSchema.safeParse(data)

  if (!validatedForm.success) {
    return { success: false, error: validatedForm.error.message }
  }

  const currency = await updateCurrency(scope, code, { name: validatedForm.data.name })
  revalidatePath("/settings/currencies")
  return { success: true, currency }
}

export async function deleteCurrencyAction(code: string) {
  const scope = await getCurrentUser()
  try {
    await deleteCurrency(scope, code)
  } catch (error) {
    return { success: false, error: "Failed to delete currency" + error }
  }
  revalidatePath("/settings/currencies")
  return { success: true }
}

export async function addCategoryAction(data: Prisma.CategoryCreateInput) {
  const scope = await getCurrentUser()
  const validatedForm = categoryFormSchema.safeParse(data)

  if (!validatedForm.success) {
    return { success: false, error: validatedForm.error.message }
  }

  const code = codeFromName(validatedForm.data.name)
  try {
    const category = await createCategory(scope, {
      code,
      name: validatedForm.data.name,
      llm_prompt: validatedForm.data.llm_prompt,
      color: validatedForm.data.color || "",
    })
    revalidatePath("/settings/categories")

    return { success: true, category }
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        success: false,
        error: `Category with the code "${code}" already exists. Try a different name.`,
      }
    }
    return { success: false, error: "Failed to create category" }
  }
}

export async function editCategoryAction(code: string, data: Prisma.CategoryUpdateInput) {
  const scope = await getCurrentUser()
  const validatedForm = categoryFormSchema.safeParse(data)

  if (!validatedForm.success) {
    return { success: false, error: validatedForm.error.message }
  }

  const category = await updateCategory(scope, code, {
    name: validatedForm.data.name,
    llm_prompt: validatedForm.data.llm_prompt,
    color: validatedForm.data.color || "",
  })
  revalidatePath("/settings/categories")

  return { success: true, category }
}

export async function deleteCategoryAction(code: string) {
  const scope = await getCurrentUser()
  try {
    await deleteCategory(scope, code)
  } catch (error) {
    return { success: false, error: "Failed to delete category" + error }
  }
  revalidatePath("/settings/categories")
  return { success: true }
}

export async function addFieldAction(data: Prisma.FieldCreateInput) {
  const scope = await getCurrentUser()
  const validatedForm = fieldFormSchema.safeParse(data)

  if (!validatedForm.success) {
    return { success: false, error: validatedForm.error.message }
  }

  const field = await createField(scope, {
    code: codeFromName(validatedForm.data.name),
    name: validatedForm.data.name,
    type: validatedForm.data.type,
    llm_prompt: validatedForm.data.llm_prompt,
    isVisibleInList: validatedForm.data.isVisibleInList,
    isVisibleInAnalysis: validatedForm.data.isVisibleInAnalysis,
    isRequired: validatedForm.data.isRequired,
    isExtra: true,
  })
  revalidatePath("/settings/fields")

  return { success: true, field }
}

export async function editFieldAction(code: string, data: Prisma.FieldUpdateInput) {
  const scope = await getCurrentUser()
  const validatedForm = fieldFormSchema.safeParse(data)

  if (!validatedForm.success) {
    return { success: false, error: validatedForm.error.message }
  }

  const field = await updateField(scope, code, {
    name: validatedForm.data.name,
    type: validatedForm.data.type,
    llm_prompt: validatedForm.data.llm_prompt,
    isVisibleInList: validatedForm.data.isVisibleInList,
    isVisibleInAnalysis: validatedForm.data.isVisibleInAnalysis,
    isRequired: validatedForm.data.isRequired,
  })
  revalidatePath("/settings/fields")

  return { success: true, field }
}

export async function deleteFieldAction(code: string) {
  const scope = await getCurrentUser()
  try {
    await deleteField(scope, code)
  } catch (error) {
    return { success: false, error: "Failed to delete field" + error }
  }
  revalidatePath("/settings/fields")
  return { success: true }
}
