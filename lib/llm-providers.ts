export interface ProviderMeta {
  key: string
  label: string
  apiKeyName: string
  modelName: string
  defaultModelName: string
  baseUrlName?: string
  defaultBaseUrl?: string
  apiDoc: string
  apiDocLabel: string
  placeholder: string
  help: { url: string; label: string }
  logo: string
}

export const PROVIDERS: ProviderMeta[] = [
  {
    key: "google",
    label: "Google Gemini",
    apiKeyName: "google_api_key",
    modelName: "google_model_name",
    defaultModelName: "gemini-2.5-flash",
    apiDoc: "https://aistudio.google.com/apikey",
    apiDocLabel: "Google AI Studio",
    placeholder: "Paste your Gemini API key",
    help: {
      url: "https://aistudio.google.com/apikey",
      label: "Google AI Studio",
    },
    logo: "/logo/google.svg",
  },
]
