import React from "react"
import ReactDOM from "react-dom/client"

import { getAdapter } from "~adapters"
import { App } from "~components/App"

import { initNetworkMonitor } from "../../core/network-monitor"
import mainStyle from "../../style.css?inline"
import conversationsStyle from "../../styles/conversations.css?inline"
import settingsStyle from "../../styles/settings.css?inline"

declare function GM_getValue<T>(key: string, defaultValue?: T): T
declare function GM_setValue(key: string, value: unknown): void
declare function GM_deleteValue(key: string): void

type UserscriptWindow = Window & {
  chrome?: typeof chrome
  ophelUserscriptInitialized?: boolean
}

const userscriptWindow = window as UserscriptWindow

if (typeof chrome === "undefined" || !chrome.storage) {
  const KNOWN_STORAGE_KEYS = [
    "settings",
    "prompts",
    "folders",
    "tags",
    "readingHistory",
    "claudeSessionKeys",
    "conversations",
  ]

  userscriptWindow.chrome = {
    storage: {
      local: {
        get: (
          keys: string | string[] | null,
          callback: (items: Record<string, unknown>) => void,
        ) => {
          if (keys === null) {
            const result: Record<string, unknown> = {}
            for (const key of KNOWN_STORAGE_KEYS) {
              const value = GM_getValue(key)
              if (value !== undefined && value !== null) {
                result[key] = value
              }
            }
            callback(result)
          } else if (typeof keys === "string") {
            const value = GM_getValue(keys)
            callback({ [keys]: value })
          } else {
            const result: Record<string, unknown> = {}
            for (const key of keys) {
              result[key] = GM_getValue(key)
            }
            callback(result)
          }
        },
        set: (items: Record<string, unknown>, callback?: () => void) => {
          for (const [key, value] of Object.entries(items)) {
            GM_setValue(key, value)
          }
          callback?.()
        },
        remove: (keys: string | string[], callback?: () => void) => {
          const keyArray = typeof keys === "string" ? [keys] : keys
          for (const key of keyArray) {
            GM_deleteValue(key)
          }
          callback?.()
        },
        clear: (callback?: () => void) => {
          for (const key of KNOWN_STORAGE_KEYS) {
            GM_deleteValue(key)
          }
          callback?.()
        },
      },
      sync: {
        get: (
          keys: string | string[] | null,
          callback: (items: Record<string, unknown>) => void,
        ) => {
          if (keys === null) {
            const result: Record<string, unknown> = {}
            for (const key of KNOWN_STORAGE_KEYS) {
              const value = GM_getValue(key)
              if (value !== undefined && value !== null) {
                result[key] = value
              }
            }
            callback(result)
          } else if (typeof keys === "string") {
            const value = GM_getValue(keys)
            callback({ [keys]: value })
          } else {
            const result: Record<string, unknown> = {}
            for (const key of keys) {
              result[key] = GM_getValue(key)
            }
            callback(result)
          }
        },
        set: (items: Record<string, unknown>, callback?: () => void) => {
          for (const [key, value] of Object.entries(items)) {
            GM_setValue(key, value)
          }
          callback?.()
        },
        remove: (keys: string | string[], callback?: () => void) => {
          const keyArray = typeof keys === "string" ? [keys] : keys
          for (const key of keyArray) {
            GM_deleteValue(key)
          }
          callback?.()
        },
        clear: (callback?: () => void) => {
          for (const key of KNOWN_STORAGE_KEYS) {
            GM_deleteValue(key)
          }
          callback?.()
        },
      },
      onChanged: {
        addListener: () => {},
        removeListener: () => {},
      },
    },
    runtime: {
      getManifest: () => ({ version: "1.0.0" }),
      getURL: (path: string) => path,
      sendMessage: () => Promise.resolve({}),
    },
  } as unknown as typeof chrome
}

const chromeStorage = userscriptWindow.chrome?.storage
if (chromeStorage && !chromeStorage.onChanged) {
  chromeStorage.onChanged = {
    addListener: () => {},
    removeListener: () => {},
  } as unknown as typeof chrome.storage.onChanged
}

const chromeRuntime = userscriptWindow.chrome?.runtime
if (chromeRuntime && !chromeRuntime.onMessage) {
  chromeRuntime.onMessage = {
    addListener: () => {},
    removeListener: () => {},
  } as unknown as typeof chrome.runtime.onMessage
}

if (window.top !== window.self) {
  throw new Error("Ophel: Running in iframe, skipping initialization")
}

if (userscriptWindow.ophelUserscriptInitialized) {
  throw new Error("Ophel: Already initialized")
}
userscriptWindow.ophelUserscriptInitialized = true

async function init() {
  const adapter = getAdapter()

  if (!adapter) {
    console.warn("[Ophel Userscript] No adapter found for:", window.location.hostname)
    return
  }

  adapter.afterPropertiesSet({})

  const { useSettingsStore, getSettingsState } = await import("~stores/settings-store")
  const { useConversationsStore } = await import("~stores/conversations-store")
  const { useFoldersStore } = await import("~stores/folders-store")
  const { useTagsStore } = await import("~stores/tags-store")
  const { usePromptsStore } = await import("~stores/prompts-store")
  const { useClaudeSessionKeysStore } = await import("~stores/claude-sessionkeys-store")

  const waitForHydration = (store: {
    getState: () => { _hasHydrated: boolean }
    subscribe: (fn: (state: { _hasHydrated: boolean }) => void) => () => void
  }) => {
    return new Promise<void>((resolve) => {
      if (store.getState()._hasHydrated) {
        resolve()
        return
      }
      const unsub = store.subscribe((state) => {
        if (state._hasHydrated) {
          unsub()
          resolve()
        }
      })
    })
  }

  await Promise.all([
    waitForHydration(useSettingsStore),
    waitForHydration(useConversationsStore),
    waitForHydration(useFoldersStore),
    waitForHydration(useTagsStore),
    waitForHydration(usePromptsStore),
    waitForHydration(useClaudeSessionKeysStore),
  ])

  const settings = getSettingsState()
  const siteId = adapter.getSiteId()

  const { initCoreModules, subscribeModuleUpdates, initUrlChangeObserver } = await import(
    "~core/modules-init"
  )

  const ctx = { adapter, settings, siteId }

  await initCoreModules(ctx)

  initNetworkMonitor()

  subscribeModuleUpdates(ctx)

  initUrlChangeObserver(ctx)

  const shadowHost = document.createElement("div")
  shadowHost.id = "ophel-userscript-root"
  shadowHost.style.cssText = "all: initial; position: fixed; z-index: 2147483647;"

  const doMount = () => {
    if (!shadowHost.parentElement) {
      document.body.appendChild(shadowHost)
    }
  }

  const hostname = window.location.hostname
  const needsDelayedMount =
    hostname.includes("chatgpt.com") ||
    hostname.includes("chat.openai.com") ||
    hostname.includes("grok.com") ||
    hostname.includes("claude.ai")

  if (needsDelayedMount) {
    const delays = [500, 1000, 2000, 3000]
    delays.forEach((delay) => setTimeout(doMount, delay))

    const observer = new MutationObserver(() => {
      if (!shadowHost.parentElement) {
        doMount()
      }
    })
    observer.observe(document.body, { childList: true, subtree: false })
  } else {
    doMount()
  }

  const shadowRoot = shadowHost.attachShadow({ mode: "open" })

  const styleEl = document.createElement("style")
  styleEl.textContent = [mainStyle, conversationsStyle, settingsStyle].join("\n")
  shadowRoot.appendChild(styleEl)

  const container = document.createElement("div")
  container.id = "ophel-app-container"
  shadowRoot.appendChild(container)

  const root = ReactDOM.createRoot(container)
  root.render(React.createElement(App))
}

init().catch((error) => {
  console.error("[Ophel Userscript] Initialization failed:", error)
})
