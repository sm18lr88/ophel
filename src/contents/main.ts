/**
 *
 */

import type { PlasmoCSConfig } from "plasmo"

import { getAdapter } from "~adapters"
import { DEFAULT_FOLDERS, SITE_IDS, getDefaultPrompts } from "~constants"
import {
  initCoreModules,
  initUrlChangeObserver,
  handleClearAllData,
  subscribeModuleUpdates,
  type ModulesContext,
} from "~core/modules-init"
import { useConversationsStore } from "~stores/conversations-store"
import { useFoldersStore } from "~stores/folders-store"
import { usePromptsStore } from "~stores/prompts-store"
import { useReadingHistoryStore } from "~stores/reading-history-store"
import { getSettingsState, useSettingsStore } from "~stores/settings-store"
import { useTagsStore } from "~stores/tags-store"
import { MSG_CLEAR_ALL_DATA, MSG_RESTORE_DATA } from "~utils/messaging"

type AIStudioModelAdapter = {
  getModelList: () => Promise<unknown>
}

function hasAIStudioModelList(adapter: unknown): adapter is AIStudioModelAdapter {
  return (
    typeof adapter === "object" &&
    adapter !== null &&
    "getModelList" in adapter &&
    typeof (adapter as Record<string, unknown>).getModelList === "function"
  )
}

const resetAllStores = () => {
  useSettingsStore.getState().resetSettings()
  usePromptsStore.getState().setPrompts(getDefaultPrompts())
  useFoldersStore.setState({ folders: DEFAULT_FOLDERS })
  useTagsStore.setState({ tags: [] })
  useConversationsStore.setState({ conversations: {}, lastUsedFolderId: "inbox" })
  useReadingHistoryStore.setState({ history: {}, lastCleanupRun: 0 })
}

export const config: PlasmoCSConfig = {
  matches: [
    "https://gemini.google.com/*",
    "https://business.gemini.google/*",
    "https://aistudio.google.com/*",
    "https://grok.com/*",
    "https://chat.openai.com/*",
    "https://chatgpt.com/*",
    "https://claude.ai/*",
  ],
  run_at: "document_idle",
}

if (!window.ophelInitialized) {
  window.ophelInitialized = true

  const adapter = getAdapter()

  if (adapter) {
    console.warn(`[Ophel] Loaded ${adapter.getName()} adapter on:`, window.location.hostname)

    adapter.afterPropertiesSet({})
    ;(async () => {
      await new Promise<void>((resolve) => {
        if (useSettingsStore.getState()._hasHydrated) {
          resolve()
          return
        }
        const unsub = useSettingsStore.subscribe((state) => {
          if (state._hasHydrated) {
            unsub()
            resolve()
          }
        })
      })

      const settings = getSettingsState()
      const siteId = adapter.getSiteId()

      const ctx: ModulesContext = { adapter, settings, siteId }

      await initCoreModules(ctx)

      subscribeModuleUpdates(ctx)

      initUrlChangeObserver(ctx)

      chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        if (message.type === MSG_CLEAR_ALL_DATA) {
          handleClearAllData()
          resetAllStores()
          sendResponse({ success: true })
          return true
        }

        if (message.type === MSG_RESTORE_DATA) {
          window.location.reload()
          sendResponse({ success: true })
          return true
        }

        if (message.type === "CHECK_IS_GENERATING") {
          const isGenerating = adapter.isGenerating?.() ?? false
          sendResponse({ isGenerating })
          return true
        }

        if (message.type === "GET_MODEL_LIST") {
          if (siteId === SITE_IDS.AISTUDIO && hasAIStudioModelList(adapter)) {
            ;(async () => {
              try {
                const models = await adapter.getModelList()
                sendResponse({ success: true, models })
              } catch (err) {
                console.error("[Ophel] getModelList failed:", err)
                sendResponse({ success: false, error: (err as Error).message })
              }
            })()
            return true
          } else {
            sendResponse({ success: false, error: "NOT_AISTUDIO" })
            return true
          }
        }

        return false
      })
    })()
  } else {
    console.warn("[Ophel] No adapter found for:", window.location.hostname)
  }
}
