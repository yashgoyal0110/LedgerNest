import config from "@/lib/config"
import { prisma } from "@/lib/db"
import { getDirectorySize, getTenantUploadsDirectory, safePathJoin, unsortedFilePath } from "@/lib/files"
import { DEMO_AI_REFILL_MINUTES, FREE_AI_CREDITS, tenantScope, TenantScope, UNLIMITED } from "@/lib/tenant"
import { Prisma, Tenant } from "@/prisma/client"
import { randomUUID } from "crypto"
import { mkdir, writeFile } from "fs/promises"
import path from "path"
import sharp from "sharp"
import { createUserDefaults } from "./defaults"
import {
  DEMO_BUSINESS,
  DEMO_FIELDS,
  DEMO_PROJECTS,
  DEMO_SETTINGS,
  DEMO_TRANSACTIONS,
  DEMO_UNSORTED_RECEIPTS,
} from "./demo-data"
import { createTenant } from "./tenants"
import { UserWithTenant } from "./users"

export const DEMO_TENANT_SLUG = "demo"

/**
 * The shared demo workspace: one tenant, one member, a full year of books, and
 * an AI allowance that refills every hour so the tour never dead-ends.
 */
export async function getOrCreateDemoUser(): Promise<UserWithTenant> {
  const existing = await prisma.user.findUnique({
    where: { email: config.demo.email },
    include: { tenant: true },
  })

  if (existing) {
    return existing
  }

  const tenant = await createTenant({
    name: DEMO_BUSINESS.name,
    slug: DEMO_TENANT_SLUG,
    plan: "demo",
    isDemo: true,
    aiCreditsLimit: FREE_AI_CREDITS,
    aiRefillMinutes: DEMO_AI_REFILL_MINUTES,
    storageLimit: UNLIMITED,
  })

  return await prisma.user.create({
    data: {
      email: config.demo.email,
      name: config.demo.name,
      emailVerified: true,
      role: "owner",
      tenantId: tenant.id,
    },
    include: { tenant: true },
  })
}

/** True once the workspace has transactions, i.e. the tour is ready. */
export async function isDemoSeeded(scope: TenantScope): Promise<boolean> {
  const count = await prisma.transaction.count({ where: { tenantId: scope.tenantId } })
  return count > 0
}

export async function ensureDemoWorkspaceSeeded(user: UserWithTenant): Promise<void> {
  const scope = tenantScope(user)
  if (await isDemoSeeded(scope)) {
    return
  }
  await seedDemoWorkspace(user)
}

/**
 * Fills the demo workspace with a year of realistic books plus receipts waiting
 * in the Unsorted inbox. Safe to re-run: rows are upserted by their natural key
 * and transactions are only created when the workspace is empty.
 */
export async function seedDemoWorkspace(user: UserWithTenant): Promise<void> {
  const scope = tenantScope(user)
  const { tenantId, userId } = scope

  await createUserDefaults(scope)

  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      businessName: DEMO_BUSINESS.name,
      businessAddress: DEMO_BUSINESS.address,
      businessBankDetails: DEMO_BUSINESS.bankDetails,
    },
  })

  for (const project of DEMO_PROJECTS) {
    await prisma.project.upsert({
      where: { tenantId_code: { tenantId, code: project.code } },
      update: { name: project.name, color: project.color, llm_prompt: project.llm_prompt },
      create: { ...project, tenantId, userId },
    })
  }

  for (const field of DEMO_FIELDS) {
    await prisma.field.upsert({
      where: { tenantId_code: { tenantId, code: field.code } },
      update: field,
      create: { ...field, tenantId, userId },
    })
  }

  for (const [code, value] of Object.entries(DEMO_SETTINGS)) {
    await prisma.setting.upsert({
      where: { tenantId_code: { tenantId, code } },
      update: { value },
      create: { code, name: code, value, tenantId, userId },
    })
  }

  await seedDemoTransactions(scope)
  await seedDemoUnsortedFiles(user)
  await seedDemoAppData(scope)
}

function issuedAtForMonthsAgo(monthsAgo: number, dayOfMonth: number): Date {
  const now = new Date()
  const date = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1, 12, 0, 0)
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  date.setDate(Math.min(dayOfMonth, lastDay))
  // Never date a document in the future.
  return date > now ? now : date
}

async function seedDemoTransactions({ tenantId, userId }: TenantScope): Promise<void> {
  const rows: Prisma.TransactionCreateManyInput[] = []

  DEMO_TRANSACTIONS.forEach((template, templateIndex) => {
    template.monthsAgo.forEach((monthsAgo) => {
      // Spread documents across the month deterministically rather than randomly,
      // so the demo looks the same for everyone who opens it.
      const dayOfMonth = 3 + ((templateIndex * 7 + monthsAgo * 3) % 25)
      const total = Math.round(template.amount * 100)

      rows.push({
        tenantId,
        userId,
        name: template.name,
        description: template.description,
        merchant: template.merchant,
        total,
        currencyCode: template.currencyCode,
        convertedTotal: template.currencyCode === "EUR" ? total : Math.round(total * 0.92),
        convertedCurrencyCode: "EUR",
        type: template.type,
        categoryCode: template.categoryCode,
        projectCode: template.projectCode,
        issuedAt: issuedAtForMonthsAgo(monthsAgo, dayOfMonth),
        items: [],
        files: [],
        extra: {
          vat_rate: template.vatRate,
          payment_method: template.paymentMethod,
          cost_center: template.costCenter,
        },
        text: `${template.merchant} — ${template.description}`,
      })
    })
  })

  await prisma.transaction.createMany({ data: rows })
}

/** Renders a receipt as a real PNG so previews and AI analysis both work. */
function receiptSvg(receipt: (typeof DEMO_UNSORTED_RECEIPTS)[number], issuedAt: Date): string {
  const lineRows = receipt.lines
    .map(
      ([label, amount], index) => `
      <text x="60" y="${330 + index * 46}" class="item">${escapeXml(label)}</text>
      <text x="740" y="${330 + index * 46}" class="item" text-anchor="end">${amount}</text>`
    )
    .join("")

  const totalY = 330 + receipt.lines.length * 46 + 40

  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="${totalY + 190}" viewBox="0 0 800 ${totalY + 190}">
    <style>
      .merchant { font: 700 40px 'Helvetica', sans-serif; fill: #111827; }
      .meta { font: 400 22px 'Helvetica', sans-serif; fill: #6b7280; }
      .item { font: 400 24px 'Helvetica', sans-serif; fill: #1f2937; }
      .total { font: 700 32px 'Helvetica', sans-serif; fill: #111827; }
      .footer { font: 400 20px 'Helvetica', sans-serif; fill: #9ca3af; }
    </style>
    <rect width="800" height="${totalY + 190}" fill="#ffffff"/>
    <rect x="0" y="0" width="800" height="8" fill="#111827"/>
    <text x="60" y="120" class="merchant">${escapeXml(receipt.merchant)}</text>
    <text x="60" y="164" class="meta">Receipt · ${issuedAt.toISOString().slice(0, 10)}</text>
    <text x="60" y="200" class="meta">VAT ${receipt.vat} · Card payment</text>
    <line x1="60" y1="250" x2="740" y2="250" stroke="#e5e7eb" stroke-width="2"/>
    <text x="60" y="292" class="meta">Description</text>
    <text x="740" y="292" class="meta" text-anchor="end">Amount</text>
    ${lineRows}
    <line x1="60" y1="${totalY - 20}" x2="740" y2="${totalY - 20}" stroke="#e5e7eb" stroke-width="2"/>
    <text x="60" y="${totalY + 30}" class="total">Total</text>
    <text x="740" y="${totalY + 30}" class="total" text-anchor="end">${receipt.total} ${receipt.currency}</text>
    <text x="60" y="${totalY + 110}" class="footer">Sample document — LedgerNest demo workspace</text>
  </svg>`
}

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (char) => {
    switch (char) {
      case "<":
        return "&lt;"
      case ">":
        return "&gt;"
      case "&":
        return "&amp;"
      case "'":
        return "&apos;"
      default:
        return "&quot;"
    }
  })
}

async function seedDemoUnsortedFiles(user: UserWithTenant): Promise<void> {
  const scope = tenantScope(user)
  const uploadsDirectory = getTenantUploadsDirectory(user.tenant)

  for (const receipt of DEMO_UNSORTED_RECEIPTS) {
    const issuedAt = new Date(Date.now() - receipt.daysAgo * 24 * 60 * 60 * 1000)
    const fileUuid = randomUUID()
    const filename = `${receipt.merchant.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-receipt.png`
    const relativeFilePath = unsortedFilePath(fileUuid, filename)
    const fullFilePath = safePathJoin(uploadsDirectory, relativeFilePath)

    const png = await sharp(Buffer.from(receiptSvg(receipt, issuedAt))).png().toBuffer()

    await mkdir(path.dirname(fullFilePath), { recursive: true })
    await writeFile(fullFilePath, png)

    await prisma.file.create({
      data: {
        id: fileUuid,
        tenantId: scope.tenantId,
        userId: scope.userId,
        filename,
        path: relativeFilePath,
        mimetype: "image/png",
        isReviewed: false,
        createdAt: issuedAt,
        metadata: { size: png.length, source: "demo" },
      },
    })
  }

  await prisma.tenant.update({
    where: { id: scope.tenantId },
    data: { storageUsed: await directorySizeSafe(uploadsDirectory) },
  })
}

async function directorySizeSafe(directory: string): Promise<number> {
  try {
    return await getDirectorySize(directory)
  } catch {
    return 0
  }
}

/** Seeds the per-app state so the Apps section is not an empty shell either. */
async function seedDemoAppData({ tenantId, userId }: TenantScope): Promise<void> {
  await prisma.appData.upsert({
    where: { tenantId_app: { tenantId, app: "invoices" } },
    update: {},
    create: {
      tenantId,
      userId,
      app: "invoices",
      data: {
        templates: [
          {
            id: "demo-retainer",
            name: "Monthly retainer",
            formData: {
              title: "INVOICE",
              businessLogo: null,
              invoiceNumber: "NW-2041",
              date: new Date().toISOString().slice(0, 10),
              dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
              currency: "EUR",
              companyDetails: `${DEMO_BUSINESS.name}\n${DEMO_BUSINESS.address}`,
              companyDetailsLabel: "Bill From",
              billTo: "Halden & Co\nRosenthaler Str. 40\n10178 Berlin",
              billToLabel: "Bill To",
              items: [
                {
                  name: "Design retainer",
                  subtitle: "40 hours of product design",
                  showSubtitle: true,
                  quantity: 1,
                  unitPrice: 6400,
                  subtotal: 6400,
                },
              ],
              taxIncluded: false,
              additionalTaxes: [{ name: "VAT", rate: 19, amount: 1216 }],
              additionalFees: [],
              notes: "Payable within 30 days. Thank you for working with us.",
              bankDetails: DEMO_BUSINESS.bankDetails,
              issueDateLabel: "Issue Date",
              dueDateLabel: "Due Date",
              itemLabel: "Item",
              quantityLabel: "Quantity",
              unitPriceLabel: "Unit Price",
              subtotalLabel: "Subtotal",
              summarySubtotalLabel: "Subtotal:",
              summaryTotalLabel: "Total:",
            },
          },
        ],
      },
    },
  })
}

export function isDemoTenant(tenant: Tenant): boolean {
  return tenant.isDemo
}
