import { getCurrentUser } from "@/lib/auth"
import { getCategories } from "@/models/categories"
import { getCurrencies } from "@/models/currencies"
import { getProjects } from "@/models/projects"
import { getSettings } from "@/models/settings"
import { NewTransactionDialogClient } from "./new-dialog"

export async function NewTransactionDialog({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  const categories = await getCategories(user)
  const currencies = await getCurrencies(user)
  const settings = await getSettings(user)
  const projects = await getProjects(user)

  return (
    <NewTransactionDialogClient
      categories={categories}
      currencies={currencies}
      settings={settings}
      projects={projects}
    >
      {children}
    </NewTransactionDialogClient>
  )
}
