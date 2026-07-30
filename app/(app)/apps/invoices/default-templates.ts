import { SettingsMap } from "@/models/settings"
import { Tenant } from "@/prisma/client"
import { addDays, format } from "date-fns"
import { InvoiceFormData } from "./components/invoice-page"

export interface InvoiceTemplate {
  id?: string
  name: string
  formData: InvoiceFormData
}

export default function defaultTemplates(tenant: Tenant, settings: SettingsMap): InvoiceTemplate[] {
  const defaultTemplate: InvoiceFormData = {
    title: "INVOICE",
    businessLogo: tenant.businessLogo,
    invoiceNumber: "",
    date: format(new Date(), "yyyy-MM-dd"),
    dueDate: format(addDays(new Date(), 30), "yyyy-MM-dd"),
    currency: settings.default_currency || "EUR",
    companyDetails: `${tenant.businessName}\n${tenant.businessAddress || ""}`,
    companyDetailsLabel: "Bill From",
    billTo: "",
    billToLabel: "Bill To",
    items: [{ name: "", subtitle: "", showSubtitle: false, quantity: 1, unitPrice: 0, subtotal: 0 }],
    taxIncluded: true,
    additionalTaxes: [{ name: "VAT", rate: 0, amount: 0 }],
    additionalFees: [],
    notes: "",
    bankDetails: tenant.businessBankDetails || "",
    issueDateLabel: "Issue Date",
    dueDateLabel: "Due Date",
    itemLabel: "Item",
    quantityLabel: "Quantity",
    unitPriceLabel: "Unit Price",
    subtotalLabel: "Subtotal",
    summarySubtotalLabel: "Subtotal:",
    summaryTotalLabel: "Total:",
  }

  const germanTemplate: InvoiceFormData = {
    title: "RECHNUNG",
    businessLogo: tenant.businessLogo,
    invoiceNumber: "",
    date: format(new Date(), "yyyy-MM-dd"),
    dueDate: format(addDays(new Date(), 30), "yyyy-MM-dd"),
    currency: "EUR",
    companyDetails: `${tenant.businessName}\n${tenant.businessAddress || ""}`,
    companyDetailsLabel: "Rechnungssteller",
    billTo: "",
    billToLabel: "Rechnungsempfänger",
    items: [{ name: "", subtitle: "", showSubtitle: false, quantity: 1, unitPrice: 0, subtotal: 0 }],
    taxIncluded: true,
    additionalTaxes: [{ name: "MwSt", rate: 19, amount: 0 }],
    additionalFees: [],
    notes: "",
    bankDetails: tenant.businessBankDetails || "",
    issueDateLabel: "Rechnungsdatum",
    dueDateLabel: "Fälligkeitsdatum",
    itemLabel: "Position",
    quantityLabel: "Menge",
    unitPriceLabel: "Einzelpreis",
    subtotalLabel: "Zwischensumme",
    summarySubtotalLabel: "Zwischensumme:",
    summaryTotalLabel: "Gesamtbetrag:",
  }

  return [
    { name: "Default", formData: defaultTemplate },
    { name: "DE", formData: germanTemplate },
  ]
}
