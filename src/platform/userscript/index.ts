import { t } from "~utils/i18n"
import { sanitizeErrorMessage, validateLlmProviderUrl } from "~utils/network-security"
import type { ClaudeSessionKey, ClaudeSessionKeysState } from "~utils/storage"

import type {
  FetchOptions,
  FetchResponse,
  NotifyOptions,
  Platform,
  PlatformCapability,
  PlatformStorage,
} from "../types"

declare function GM_getValue<T>(key: string, defaultValue?: T): T
declare function GM_setValue(key: string, value: unknown): void
declare function GM_deleteValue(key: string): void
declare function GM_addValueChangeListener(
  key: string,
  callback: (name: string, oldValue: unknown, newValue: unknown, remote: boolean) => void,
): number
declare function GM_removeValueChangeListener(listenerId: number): void
declare function GM_xmlhttpRequest(details: {
  url: string
  method?: string
  headers?: Record<string, string>
  data?: string
  responseType?: string
  onload?: (response: {
    status: number
    statusText: string
    responseText: string
    response: unknown
  }) => void
  onerror?: (error: unknown) => void
}): void
declare function GM_notification(details: {
  title: string
  text: string
  timeout?: number
  silent?: boolean
  onclick?: () => void
}): void

const userscriptStorage: PlatformStorage = {
  async get<T>(key: string): Promise<T | undefined> {
    const value = GM_getValue(key)
    if (value === undefined || value === null) {
      return undefined
    }
    return value as T
  },

  async set<T>(key: string, value: T): Promise<void> {
    GM_setValue(key, value)
  },

  async remove(key: string): Promise<void> {
    GM_deleteValue(key)
  },

  watch<T>(
    key: string,
    callback: (newValue: T | undefined, oldValue: T | undefined) => void,
  ): () => void {
    const listenerId = GM_addValueChangeListener(key, (_name, oldValue, newValue, _remote) => {
      callback(newValue as T | undefined, oldValue as T | undefined)
    })
    return () => GM_removeValueChangeListener(listenerId)
  },
}

interface ClaudeSessionKeysPersistedData {
  state?: ClaudeSessionKeysState
  version?: number
}

export const platform: Platform = {
  type: "userscript",

  storage: userscriptStorage,

  async fetch(url: string, options?: FetchOptions): Promise<FetchResponse> {
    const targetUrl = validateLlmProviderUrl(url, window.location.href).toString()
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        url: targetUrl,
        method: options?.method || "GET",
        headers: options?.headers,
        data: options?.body,
        responseType: "text",
        onload(response) {
          const ok = response.status >= 200 && response.status < 300
          resolve({
            ok,
            status: response.status,
            statusText: response.statusText,
            async text() {
              return response.responseText
            },
            async json<T>() {
              return JSON.parse(response.responseText) as T
            },
            async blob() {
              return new Promise((res, rej) => {
                GM_xmlhttpRequest({
                  url: targetUrl,
                  method: options?.method || "GET",
                  headers: options?.headers,
                  responseType: "blob",
                  onload(blobResponse) {
                    res(blobResponse.response as Blob)
                  },
                  onerror: rej,
                })
              })
            },
          })
        },
        onerror(error) {
          reject(new Error(sanitizeErrorMessage(error, "Request failed")))
        },
      })
    })
  },

  notify(options: NotifyOptions): void {
    GM_notification({
      title: options.title,
      text: options.message,
      timeout: options.timeout ?? 5000,
      silent: options.silent ?? true,
      onclick: () => {
        window.focus()
      },
    })
  },

  focusWindow(): void {
    window.focus()
  },

  openTab(url: string): void {
    try {
      const safeUrl = validateLlmProviderUrl(url).toString()
      window.open(safeUrl, "_blank")
    } catch {
      // Block non-LLM-provider URLs
    }
  },

  hasCapability(cap: PlatformCapability): boolean {
    const unsupported: PlatformCapability[] = [
      "cookies",
      "permissions",
      "tabs",
      "declarativeNetRequest",
      "commands",
    ]
    return !unsupported.includes(cap)
  },

  async getClaudeSessionKey() {
    if (!location.hostname.endsWith("claude.ai")) {
      return { success: false, error: t("claudeNotOnSiteHint") }
    }

    const match = document.cookie.match(/sessionKey=([^;]+)/)
    if (match && match[1]) {
      return { success: true, sessionKey: decodeURIComponent(match[1]) }
    }

    return { success: false, error: t("claudeNoCookieFound") }
  },

  async testClaudeSessionKey(sessionKey: string) {
    return new Promise((resolve) => {
      GM_xmlhttpRequest({
        url: "https://claude.ai/api/organizations",
        method: "GET",
        headers: {
          Accept: "application/json",
          Cookie: `sessionKey=${sessionKey}`,
        },
        onload(response) {
          try {
            if (response.status !== 200) {
              resolve({ success: true, isValid: false, error: `HTTP ${response.status}` })
              return
            }

            const text = response.responseText
            if (text.toLowerCase().includes("unauthorized")) {
              resolve({ success: true, isValid: false, error: "Unauthorized" })
              return
            }

            const orgs = JSON.parse(text)
            if (!Array.isArray(orgs) || orgs.length === 0) {
              resolve({ success: true, isValid: false, error: "No organizations" })
              return
            }

            const org = orgs[0]
            const tier = org?.rate_limit_tier
            const capabilities = org?.capabilities || []
            const apiDisabledReason = org?.api_disabled_reason

            let accountType = "Unknown"
            if (tier === "default_claude_max_5x") {
              accountType = "Max(5x)"
            } else if (tier === "default_claude_max_20x") {
              accountType = "Max(20x)"
            } else if (tier === "default_claude_ai") {
              accountType = "Free"
            } else if (tier === "auto_api_evaluation") {
              accountType = apiDisabledReason === "out_of_credits" ? "API(No credits)" : "API"
            } else if (capabilities.includes("claude_max")) {
              accountType = "Max"
            } else if (capabilities.includes("api")) {
              accountType = "API"
            } else if (capabilities.includes("chat")) {
              accountType = "Free"
            }

            resolve({ success: true, isValid: true, accountType })
          } catch {
            resolve({ success: true, isValid: false, error: "Parse error" })
          }
        },
        onerror() {
          resolve({ success: false, isValid: false, error: "Request failed" })
        },
      })
    })
  },

  async setClaudeSessionKey(sessionKey: string) {
    if (!location.hostname.endsWith("claude.ai")) {
      return { success: false, error: t("claudeNotOnSiteHint") }
    }

    const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString()
    document.cookie = `sessionKey=${encodeURIComponent(sessionKey)}; domain=.claude.ai; path=/; expires=${expires}; secure; samesite=lax`

    location.href = "https://claude.ai/"

    return { success: true }
  },

  async switchNextClaudeKey() {
    if (!location.hostname.endsWith("claude.ai")) {
      return { success: false, error: t("claudeNotOnSiteHint") }
    }

    try {
      const storageData = GM_getValue<ClaudeSessionKeysPersistedData | undefined>(
        "claudeSessionKeys",
      )
      const rawKeys: ClaudeSessionKey[] = storageData?.state?.keys || []

      if (rawKeys.length === 0) {
        return { success: false, error: "noClaudeKeys" }
      }

      const currentId = storageData?.state?.currentKeyId

      let availableKeys = rawKeys.filter((k) => k.isValid !== false)

      if (availableKeys.length === 0) {
        availableKeys = [...rawKeys]
      }

      availableKeys.sort((a, b) => {
        const isAPro = a.accountType?.toLowerCase()?.includes("pro")
        const isBPro = b.accountType?.toLowerCase()?.includes("pro")
        if (isAPro && !isBPro) return -1
        if (!isAPro && isBPro) return 1
        return a.name.localeCompare(b.name)
      })

      const currentIndex = availableKeys.findIndex((k) => k.id === currentId)

      if (availableKeys.length === 1 && currentIndex !== -1) {
        return { success: false, error: "claudeOnlyOneKey" }
      }

      let nextIndex = 0
      if (currentIndex !== -1) {
        nextIndex = (currentIndex + 1) % availableKeys.length
      }

      const nextKey = availableKeys[nextIndex]
      if (!nextKey) {
        return { success: false, error: "nextKeyNotFound" }
      }

      if (nextKey.key) {
        const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString()
        document.cookie = `sessionKey=${encodeURIComponent(nextKey.key)}; domain=.claude.ai; path=/; expires=${expires}; secure; samesite=lax`
      }

      if (storageData?.state) {
        storageData.state.currentKeyId = nextKey.id
        GM_setValue("claudeSessionKeys", storageData)
      }

      location.href = "https://claude.ai/"

      return { success: true, keyName: nextKey.name }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  },
}
