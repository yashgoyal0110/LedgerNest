import { prisma } from "@/lib/db"
import { TenantScope } from "@/lib/tenant"

export const getAppData = async ({ tenantId }: TenantScope, app: string) => {
  const appData = await prisma.appData.findUnique({
    where: { tenantId_app: { tenantId, app } },
  })

  return appData?.data
}

export const setAppData = async ({ tenantId, userId }: TenantScope, app: string, data: any) => {
  await prisma.appData.upsert({
    where: { tenantId_app: { tenantId, app } },
    update: { data },
    create: { tenantId, userId, app, data },
  })
}
