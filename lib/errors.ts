import { ZodError } from "zod"

/**
 * Everything a person sees when something goes wrong should read like a
 * sentence, not like a stack trace. Technical detail belongs in the server
 * logs — so these helpers log the real cause and return plain language.
 */

export const MESSAGES = {
  generic: "Something went wrong on our side. Please try again.",
  network: "We couldn't reach the server. Check your connection and try again.",
  save: "We couldn't save your changes. Please try again.",
  delete: "We couldn't delete that. Please try again.",
  upload: "We couldn't upload that file. Please try again.",
  fileMissing: "We couldn't open that document. It may have been moved or removed.",
  analyze: "The AI couldn't read this document. Please try again in a moment.",
  form: "Please check the highlighted fields and try again.",
} as const

/** Logs the real error and returns wording that is safe to show anyone. */
export function friendly(context: string, error: unknown, message: string = MESSAGES.generic): string {
  console.error(`${context}:`, error)
  return message
}

/**
 * Turns a Zod failure into something readable: names the fields that need
 * attention instead of dumping the validation JSON on the page.
 */
export function describeFormError(error: ZodError): string {
  const fields = Array.from(
    new Set(
      error.issues
        .map((issue) => issue.path.filter((part) => typeof part === "string").join(" "))
        .filter((name) => name.length > 0)
        .map(humanizeFieldName)
    )
  )

  if (fields.length === 0) {
    return MESSAGES.form
  }

  if (fields.length === 1) {
    return `Please check the ${fields[0]} field and try again.`
  }

  const last = fields[fields.length - 1]
  return `Please check these fields and try again: ${fields.slice(0, -1).join(", ")} and ${last}.`
}

function humanizeFieldName(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .toLowerCase()
}
