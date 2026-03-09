/**
 *
 */

import type { PlasmoCSConfig } from "plasmo"

import { WATERMARK_BLOCKER_CODE } from "~constants/scripts"

interface AIStudioSettings {
  removeWatermark?: boolean
  collapseNavbar?: boolean
  collapseTools?: boolean
  collapseAdvanced?: boolean
  enableSearch?: boolean
  defaultModel?: string
  collapseRunSettings?: boolean
}

interface ModelLockSiteSettings {
  enabled?: boolean
}

interface ParsedSettings {
  state?: {
    settings?: {
      aistudio?: AIStudioSettings
      modelLock?: Record<string, ModelLockSiteSettings>
    }
  }
  aistudio?: AIStudioSettings
  modelLock?: Record<string, ModelLockSiteSettings>
}

export const config: PlasmoCSConfig = {
  matches: ["https://aistudio.google.com/*"],
  run_at: "document_start",
}
;(async () => {
  try {
    const result = await chrome.storage.local.get("settings")
    const allData = result as Record<string, unknown>

    let settingsObj: unknown = allData.settings
    if (typeof settingsObj === "string") {
      try {
        settingsObj = JSON.parse(settingsObj)
      } catch (e) {
        console.error("[Ophel] Failed to parse settings:", e)
        return
      }
    }

    const parsedSettings =
      settingsObj && typeof settingsObj === "object" ? (settingsObj as ParsedSettings) : null
    const aistudioSettings = parsedSettings?.state?.settings?.aistudio || parsedSettings?.aistudio

    if (!aistudioSettings) {
      return
    }

    if (aistudioSettings.removeWatermark) {
      const script = document.createElement("script")
      script.textContent = WATERMARK_BLOCKER_CODE
      try {
        ;(document.head || document.documentElement).appendChild(script)
        script.remove()
        console.warn("[Ophel] Watermark blocker injected")
      } catch (e) {
        console.error("[Ophel] Failed to inject watermark blocker:", e)
      }
    }

    const prefStr = localStorage.getItem("aiStudioUserPreference") || "{}"
    const pref = JSON.parse(prefStr)

    let hasChanges = false

    if (aistudioSettings.collapseNavbar !== undefined) {
      const shouldExpand = !aistudioSettings.collapseNavbar
      if (pref.isNavbarExpanded !== shouldExpand) {
        pref.isNavbarExpanded = shouldExpand
        hasChanges = true
      }
    }

    if (aistudioSettings.collapseTools !== undefined) {
      const shouldOpen = !aistudioSettings.collapseTools
      if (pref.areToolsOpen !== shouldOpen) {
        pref.areToolsOpen = shouldOpen
        hasChanges = true
      }
    }

    if (aistudioSettings.collapseAdvanced !== undefined) {
      const shouldOpen = !aistudioSettings.collapseAdvanced
      if (pref.isAdvancedOpen !== shouldOpen) {
        pref.isAdvancedOpen = shouldOpen
        hasChanges = true
      }
    }

    if (aistudioSettings.enableSearch !== undefined) {
      if (pref.enableSearchAsATool !== aistudioSettings.enableSearch) {
        pref.enableSearchAsATool = aistudioSettings.enableSearch
        hasChanges = true
      }
    }

    if (aistudioSettings.defaultModel && aistudioSettings.defaultModel.trim() !== "") {
      const modelId = aistudioSettings.defaultModel.trim()
      if (pref.promptModel !== modelId) {
        pref.promptModel = modelId
        pref._promptModelOverride = modelId
        hasChanges = true
      }
    }

    if (hasChanges) {
      localStorage.setItem("aiStudioUserPreference", JSON.stringify(pref))
    }

    const modelLockSettings =
      parsedSettings?.state?.settings?.modelLock || parsedSettings?.modelLock
    const isModelLockEnabled =
      modelLockSettings && modelLockSettings["ai-studio"] && modelLockSettings["ai-studio"].enabled

    if (aistudioSettings.collapseRunSettings && !isModelLockEnabled) {
      waitForButtonAndClick('button[aria-label="Close run settings panel"]')
    }
  } catch (error) {
    console.error("[Ophel] AI Studio preload error:", error)
  }
})()

/**
 */
function waitForButtonAndClick(selector: string) {
  const CLICK_DELAY = 600
  let hasClicked = false
  let observer: MutationObserver | null = null
  let timeoutId: number | null = null

  function tryClick() {
    if (hasClicked) return

    const button = document.querySelector<HTMLButtonElement>(selector)
    if (
      button &&
      document.body.contains(button) &&
      button.offsetParent !== null &&
      !button.disabled
    ) {
      if (timeoutId) clearTimeout(timeoutId)
      timeoutId = window.setTimeout(() => {
        if (
          button &&
          document.body.contains(button) &&
          button.offsetParent !== null &&
          !button.disabled
        ) {
          try {
            const event = new MouseEvent("click", { bubbles: true, cancelable: true })
            button.dispatchEvent(event)
            hasClicked = true
            console.warn("[Ophel] Run settings panel closed")
            cleanup()
          } catch (e) {
            console.error("[Ophel] Failed to click button:", e)
          }
        }
      }, CLICK_DELAY)
    }
  }

  function cleanup() {
    if (observer) {
      observer.disconnect()
      observer = null
    }
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
  }

  function initialize() {
    if (!document.body) {
      requestAnimationFrame(initialize)
      return
    }

    tryClick()

    observer = new MutationObserver(() => {
      if (!hasClicked) tryClick()
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["disabled", "class", "style"],
    })

    setTimeout(() => {
      if (!hasClicked) {
        cleanup()
      }
    }, 30000)
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize)
  } else {
    initialize()
  }

  window.addEventListener("unload", cleanup)
}
