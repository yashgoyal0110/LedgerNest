import { prisma } from "@/lib/db"
import { TenantScope } from "@/lib/tenant"
import { codeFromName } from "@/lib/utils"
import { Prisma } from "@/prisma/client"
import { cache } from "react"

export type ProjectData = {
  [key: string]: unknown
}

export const getProjects = cache(async ({ tenantId }: TenantScope) => {
  return await prisma.project.findMany({
    where: { tenantId },
    orderBy: {
      name: "asc",
    },
  })
})

export const getProjectByCode = cache(async ({ tenantId }: TenantScope, code: string) => {
  return await prisma.project.findUnique({
    where: { tenantId_code: { code, tenantId } },
  })
})

export const createProject = async ({ tenantId, userId }: TenantScope, project: ProjectData) => {
  if (!project.code) {
    project.code = codeFromName(project.name as string)
  }
  return await prisma.project.create({
    data: {
      ...project,
      tenantId,
      userId,
    } as unknown as Prisma.ProjectUncheckedCreateInput,
  })
}

export const updateProject = async ({ tenantId }: TenantScope, code: string, project: ProjectData) => {
  return await prisma.project.update({
    where: { tenantId_code: { code, tenantId } },
    data: project,
  })
}

export const deleteProject = async ({ tenantId }: TenantScope, code: string) => {
  await prisma.transaction.updateMany({
    where: {
      tenantId,
      projectCode: code,
    },
    data: {
      projectCode: null,
    },
  })

  return await prisma.project.delete({
    where: { tenantId_code: { code, tenantId } },
  })
}
