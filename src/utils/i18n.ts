import { resources } from "~locales/resources"

const getBrowserLang = () => "en"

let currentLang: string = getBrowserLang()

export function setLanguage(lang: string) {
  currentLang = lang === "en" ? "en" : getBrowserLang()
}

export function getEffectiveLanguage(settingLang: string): string {
  return settingLang === "en" ? "en" : getBrowserLang()
}

export function t(key: string, params?: Record<string, string>): string {
  const langResources = resources[currentLang as keyof typeof resources] || resources["en"]
  let text = (langResources[key as keyof typeof langResources] as string) || key

  if (params) {
    Object.keys(params).forEach((paramKey) => {
      text = text.replace(new RegExp(`{${paramKey}}`, "g"), params[paramKey])
    })
  }

  return text
}

export function getCurrentLang(): string {
  return currentLang
}
