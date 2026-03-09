import { useCallback, useEffect, useMemo, useRef } from "react"

import type { SiteAdapter } from "~adapters/base"
import { SHORTCUT_ACTIONS, type ShortcutActionId } from "~constants/shortcuts"
import type { ConversationManager } from "~core/conversation-manager"
import type { OutlineManager } from "~core/outline-manager"
import { getShortcutManager } from "~core/shortcut-manager"
import { anchorStore } from "~stores/anchor-store"
import { loadHistoryUntil } from "~utils/history-loader"
import { t } from "~utils/i18n"
import {
  getScrollInfo,
  smartScrollTo,
  smartScrollToBottom,
  smartScrollToTop,
} from "~utils/scroll-helper"
import type { Settings } from "~utils/storage"
import { showToast } from "~utils/toast"

function navigateConversation(
  conversationManager: ConversationManager,
  adapter: SiteAdapter | null,
  direction: "prev" | "next",
) {
  if (!adapter) return

  const currentSessionId = adapter.getSessionId()
  const conversations = conversationManager.getConversations()

  if (conversations.length === 0) {
    showToast(t("noConversations") || "No conversations")
    return
  }

  const sorted = [...conversations].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))

  const currentIndex = sorted.findIndex((c) => c.id === currentSessionId)

  let targetIndex: number
  if (currentIndex === -1) {
    targetIndex = 0
  } else if (direction === "prev") {
    targetIndex = currentIndex > 0 ? currentIndex - 1 : sorted.length - 1
  } else {
    targetIndex = currentIndex < sorted.length - 1 ? currentIndex + 1 : 0
  }

  const target = sorted[targetIndex]
  if (target) {
    adapter.navigateToConversation(target.id, target.url)
    showToast(target.title || t("untitledConversation") || "Untitled conversation")
  }
}

interface UseShortcutsOptions {
  settings: Settings | undefined
  adapter: SiteAdapter | null
  outlineManager: OutlineManager | null
  conversationManager: ConversationManager | null
  onPanelToggle: () => void
  onThemeToggle: () => void
  onOpenSettings: () => void
  onOpenGlobalSearch?: () => void
  onShowShortcuts?: () => void
  isPanelVisible?: boolean
  isSnapped?: boolean
  onShowSnappedPanel?: () => void
  onToggleScrollLock?: () => void
}

type ShortcutWindowFlags = Window & {
  __ophelPendingLocateOutline?: boolean
  __ophelPendingSearchOutline?: boolean
  __ophelPendingLocateConversation?: boolean
}

export function useShortcuts({
  settings,
  adapter,
  outlineManager,
  conversationManager,
  onPanelToggle,
  onThemeToggle,
  onOpenSettings,
  onOpenGlobalSearch,
  onShowShortcuts,
  isPanelVisible,
  isSnapped,
  onShowSnappedPanel,
  onToggleScrollLock,
}: UseShortcutsOptions) {
  const shortcutManager = useMemo(() => getShortcutManager(), [])

  const scrollToTop = useCallback(async () => {
    if (!adapter) return

    const scrollInfo = await getScrollInfo(adapter)
    anchorStore.set(scrollInfo.scrollTop)

    await loadHistoryUntil({
      adapter,
      loadAll: true,
      allowShortCircuit: true,
    })
    await smartScrollToTop(adapter)

    showToast(t("scrolledToTop") || "Scrolled to top")
  }, [adapter])

  const scrollToBottom = useCallback(async () => {
    if (!adapter) return

    const scrollInfo = await getScrollInfo(adapter)
    anchorStore.set(scrollInfo.scrollTop)

    await smartScrollToBottom(adapter)

    showToast(t("scrolledToBottom") || "Scrolled to bottom")
  }, [adapter])

  const goToAnchor = useCallback(async () => {
    if (!adapter) return
    const savedAnchor = anchorStore.get()
    if (savedAnchor === null) {
      showToast(t("noAnchor") || "No anchor available")
      return
    }

    const scrollInfo = await getScrollInfo(adapter)
    const currentPos = scrollInfo.scrollTop

    await smartScrollTo(adapter, savedAnchor)

    anchorStore.set(currentPos)
  }, [adapter])

  const refreshOutline = useCallback(() => {
    if (!outlineManager) return
    outlineManager.refresh()
    showToast(t("outlineRefreshed") || "Outline refreshed")
  }, [outlineManager])

  const toggleOutlineExpand = useCallback(() => {
    if (!outlineManager) return
    const state = outlineManager.getState()
    if (state.isAllExpanded) {
      outlineManager.collapseAll()
    } else {
      outlineManager.expandAll()
    }
  }, [outlineManager])

  const expandToLevel = useCallback(
    (level: number) => {
      outlineManager?.setLevel(level)
    },
    [outlineManager],
  )

  const toggleUserQueries = useCallback(() => {
    outlineManager?.toggleGroupMode()
  }, [outlineManager])

  const toggleBookmarks = useCallback(() => {
    outlineManager?.toggleBookmarkMode()
  }, [outlineManager])

  const onlyUserQueries = useCallback(() => {
    outlineManager?.setShowUserQueries(true)
    outlineManager?.setLevel(0)
  }, [outlineManager])

  const lastNavigatedIndexRef = useRef<number | null>(null)
  const navigateHeading = useCallback(
    (direction: "prev" | "next") => {
      if (!outlineManager) return

      const state = outlineManager.getState()
      const tree = state.tree
      if (!tree || tree.length === 0) return

      const flattenTree = (nodes: typeof tree): typeof tree => {
        const result: typeof tree = []
        for (const node of nodes) {
          result.push(node)
          if (node.children && node.children.length > 0 && !node.collapsed) {
            result.push(...flattenTree(node.children))
          }
        }
        return result
      }
      const flatItems = flattenTree(tree)
      if (flatItems.length === 0) return

      let currentFlatIndex = -1

      if (lastNavigatedIndexRef.current !== null) {
        const idx = flatItems.findIndex((item) => item.index === lastNavigatedIndexRef.current)
        if (idx !== -1) {
          const targetItem = flatItems[idx]
          let element = targetItem.element
          if (!element || !element.isConnected) {
            if (targetItem.isUserQuery && targetItem.level === 0) {
              element = outlineManager.findUserQueryElement(
                targetItem.queryIndex!,
                targetItem.text,
              ) as HTMLElement
            } else {
              element = outlineManager.findElementByHeading(
                targetItem.level,
                targetItem.text,
              ) as HTMLElement
            }
          }
          if (element && element.isConnected) {
            const rect = element.getBoundingClientRect()
            const viewportHeight = window.innerHeight
            if (Math.abs(rect.top - viewportHeight / 2) < viewportHeight * 2) {
              currentFlatIndex = idx
            }
          }
        }
      }

      if (currentFlatIndex === -1) {
        const scrollContainer = outlineManager.getScrollContainer()
        if (scrollContainer) {
          const visibleItemIndex = outlineManager.findVisibleItemIndex(
            scrollContainer.scrollTop,
            scrollContainer.clientHeight,
          )
          if (visibleItemIndex !== null) {
            currentFlatIndex = flatItems.findIndex((item) => item.index === visibleItemIndex)
          }
        }
      }

      let targetFlatIndex: number
      if (currentFlatIndex === -1) {
        targetFlatIndex = direction === "prev" ? flatItems.length - 1 : 0
      } else {
        if (direction === "prev") {
          targetFlatIndex = Math.max(0, currentFlatIndex - 1)
        } else {
          targetFlatIndex = Math.min(flatItems.length - 1, currentFlatIndex + 1)
        }
      }

      const targetItem = flatItems[targetFlatIndex]
      if (targetItem) {
        lastNavigatedIndexRef.current = targetItem.index

        outlineManager.revealNode(targetItem.index)

        let element = targetItem.element
        if (!element || !element.isConnected) {
          if (targetItem.isUserQuery && targetItem.level === 0) {
            element = outlineManager.findUserQueryElement(
              targetItem.queryIndex!,
              targetItem.text,
            ) as HTMLElement
          } else {
            element = outlineManager.findElementByHeading(
              targetItem.level,
              targetItem.text,
            ) as HTMLElement
          }
          if (element) {
            targetItem.element = element
          }
        }

        if (element && element.isConnected) {
          element.scrollIntoView({ behavior: "smooth", block: "start" })
          const toastText =
            targetItem.text?.replace(/\s+/g, " ").trim() ||
            t("locatingOutline") ||
            "Locating outline..."
          showToast(toastText, 1000, { className: "gh-toast--outline-nav", maxWidth: 360 })
        }
      }
    },
    [outlineManager],
  )

  const prevHeading = useCallback(() => navigateHeading("prev"), [navigateHeading])
  const nextHeading = useCallback(() => navigateHeading("next"), [navigateHeading])

  const refreshConversations = useCallback(() => {
    showToast(t("syncingConversations") || "Syncing conversations...")
    window.dispatchEvent(new CustomEvent("ophel:refreshConversations"))
  }, [])

  const openSettings = useCallback(() => {
    onOpenSettings()
  }, [onOpenSettings])

  const openGlobalSearch = useCallback(() => {
    onOpenGlobalSearch?.()
  }, [onOpenGlobalSearch])

  const switchTab = useCallback(
    (index: 0 | 1 | 2) => {
      if (!isPanelVisible) {
        onPanelToggle()
      } else if (isSnapped && onShowSnappedPanel) {
        onShowSnappedPanel()
      }

      window.dispatchEvent(
        new CustomEvent("ophel:switchTab", {
          detail: { index },
        }),
      )
    },
    [isPanelVisible, onPanelToggle, isSnapped, onShowSnappedPanel],
  )

  const switchTab1 = useCallback(() => switchTab(0), [switchTab])
  const switchTab2 = useCallback(() => switchTab(1), [switchTab])
  const switchTab3 = useCallback(() => switchTab(2), [switchTab])

  const locateOutline = useCallback(() => {
    const shortcutWindow = window as ShortcutWindowFlags

    if (!settings?.features?.outline?.enabled) {
      showToast(t("outlineDisabled") || "Outline feature is disabled")
      return
    }

    const needOpenPanel = !isPanelVisible
    if (needOpenPanel) {
      onPanelToggle()
    } else if (isSnapped && onShowSnappedPanel) {
      onShowSnappedPanel()
    }

    shortcutWindow.__ophelPendingLocateOutline = true
    window.dispatchEvent(new CustomEvent("ophel:locateOutline"))

    showToast(t("locatingOutline") || "Locating outline...")
  }, [settings, isPanelVisible, isSnapped, onPanelToggle, onShowSnappedPanel])

  const searchOutline = useCallback(() => {
    const shortcutWindow = window as ShortcutWindowFlags

    if (!settings?.features?.outline?.enabled) {
      showToast(t("outlineDisabled") || "Outline feature is disabled")
      return
    }

    const needOpenPanel = !isPanelVisible
    if (needOpenPanel) {
      onPanelToggle()
    } else if (isSnapped && onShowSnappedPanel) {
      onShowSnappedPanel()
    }

    shortcutWindow.__ophelPendingSearchOutline = true

    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("ophel:searchOutline"))
    }, 50)
  }, [settings, isPanelVisible, isSnapped, onPanelToggle, onShowSnappedPanel])

  const locateConversation = useCallback(() => {
    const shortcutWindow = window as ShortcutWindowFlags

    if (!settings?.features?.conversations?.enabled) {
      showToast(t("conversationsDisabled") || "Conversations feature is disabled")
      return
    }

    if (adapter?.isSharePage() || adapter?.isNewConversation()) {
      showToast(t("noConversationToLocate") || "No conversation to locate")
      return
    }

    const needOpenPanel = !isPanelVisible
    if (needOpenPanel) {
      onPanelToggle()
    } else if (isSnapped && onShowSnappedPanel) {
      onShowSnappedPanel()
    }

    shortcutWindow.__ophelPendingLocateConversation = true
    window.dispatchEvent(new CustomEvent("ophel:locateConversation"))

    showToast(t("locatingConversation") || "Locating current conversation...")
  }, [adapter, settings, isPanelVisible, isSnapped, onPanelToggle, onShowSnappedPanel])

  const newConversation = useCallback(() => {
    const event = new KeyboardEvent("keydown", {
      key: "o",
      code: "KeyO",
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
    })
    document.dispatchEvent(event)
  }, [])

  const exportConversation = useCallback(async () => {
    if (!conversationManager || !adapter) return

    const sessionId = adapter.getSessionId()
    if (!sessionId) {
      showToast(t("exportNeedOpenFirst") || "Open a conversation before exporting")
      return
    }

    showToast(t("exportStarted") || "Export started...")
    try {
      await conversationManager.exportConversation(sessionId, "markdown")
      showToast(t("exportSuccess") || "Export successful")
    } catch (error) {
      console.error("Export failed:", error)
      showToast(t("exportFailed") || "Export failed")
    }
  }, [conversationManager, adapter])

  const copyLatestReply = useCallback(async () => {
    if (!adapter) return

    const text = adapter.getLatestReplyText()
    if (!text) {
      showToast(t("noReplyToCopy") || "Nothing to copy")
      return
    }

    try {
      await navigator.clipboard.writeText(text)
      showToast(t("replyCopied") || "Latest reply copied")
    } catch {
      showToast(t("copyFailed") || "Copy failed")
    }
  }, [adapter])

  const toggleScrollLock = useCallback(() => {
    if (onToggleScrollLock) {
      onToggleScrollLock()
    } else {
      showToast(t("scrollLockToggled") || "Scroll lock toggled")
    }
  }, [onToggleScrollLock])

  const focusInput = useCallback(() => {
    if (!adapter) return
    const textarea = adapter.findTextarea()
    if (textarea) {
      textarea.focus()
      showToast(t("inputFocused") || "Input focused")
    } else {
      showToast(t("noTextarea") || "Input box not found")
    }
  }, [adapter])

  const stopGeneration = useCallback(() => {
    if (!adapter) return
    const stopSelectors = [
      '[data-testid="stop-button"]',
      'button[aria-label*="Stop"]',
      'button[aria-label*="Stop"]',
      ".stop-button",
      'md-icon-button[aria-label*="Stop"]',
    ]
    for (const selector of stopSelectors) {
      const btn = document.querySelector(selector) as HTMLElement
      if (btn && btn.offsetParent !== null) {
        btn.click()
        showToast(t("generationStopped") || "Generation stopped")
        return
      }
    }
    showToast(t("notGenerating") || "Not generating")
  }, [adapter])

  const prevConversation = useCallback(() => {
    if (!conversationManager) return
    navigateConversation(conversationManager, adapter, "prev")
  }, [conversationManager, adapter])

  const nextConversation = useCallback(() => {
    if (!conversationManager) return
    navigateConversation(conversationManager, adapter, "next")
  }, [conversationManager, adapter])

  const copyLastCodeBlock = useCallback(async () => {
    const codeBlocks = document.querySelectorAll("pre code, pre.code-block, .code-block code")
    if (codeBlocks.length === 0) {
      showToast(t("noCodeBlock") || "No code block found")
      return
    }
    const lastCodeBlock = codeBlocks[codeBlocks.length - 1]
    const code = lastCodeBlock.textContent || ""
    if (!code.trim()) {
      showToast(t("noCodeBlock") || "No code block found")
      return
    }
    try {
      await navigator.clipboard.writeText(code)
      showToast(t("codeBlockCopied") || "Code block copied")
    } catch {
      showToast(t("copyFailed") || "Copy failed")
    }
  }, [])

  const showShortcuts = useCallback(() => {
    if (onShowShortcuts) {
      onShowShortcuts()
    } else {
      openSettings()
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent("ophel:navigateSettingsPage", { detail: { page: "shortcuts" } }),
        )
      }, 100)
    }
  }, [onShowShortcuts, openSettings])

  const showModelSelector = useCallback(() => {
    if (!adapter) return
    const success = adapter.clickModelSelector()
    if (!success) {
      showToast(t("modelSelectorNotFound") || "Model selector not found")
    }
  }, [adapter])

  const togglePromptQueue = useCallback(() => {
    window.dispatchEvent(new CustomEvent("ophel:togglePromptQueue"))
  }, [])

  const navigateToSettings = useCallback(
    (page: string, subTab?: string) => {
      openSettings()

      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent("ophel:navigateSettingsPage", {
            detail: { page, subTab },
          }),
        )
      }, 100)
    },
    [openSettings],
  )

  const openClaudeSettings = useCallback(
    () => navigateToSettings("siteSettings", "claude"),
    [navigateToSettings],
  )
  const openGeminiSettings = useCallback(
    () => navigateToSettings("siteSettings", "gemini"),
    [navigateToSettings],
  )
  const openThemeSettings = useCallback(
    () => navigateToSettings("appearance"),
    [navigateToSettings],
  )
  const openModelLockSettings = useCallback(
    () => navigateToSettings("siteSettings", "modelLock"),
    [navigateToSettings],
  )

  const switchClaudeKey = useCallback(async () => {
    if (!location.hostname.includes("claude.ai") && !location.hostname.includes("claude.com")) {
      showToast(t("claudeShortcutOnlyOnSite") || "Shortcut only works on Claude", 2000)
      return
    }

    try {
      const { platform } = await import("~platform")

      const result = await platform.switchNextClaudeKey()

      if (result.success) {
        showToast((t("claudeKeySwitched") || "Session Key switched") + `: ${result.keyName}`, 2000)
      } else {
        if (result.error === "claudeOnlyOneKey") {
          showToast(t("claudeOnlyOneKeyTip") || "Only one available key is currently active", 2000)
        } else if (result.error === "noClaudeKeys") {
          showToast(t("noClaudeKeys") || "No Session Keys configured", 2000)
        } else {
          const errorKey = result.error || "operationFailed"
          const translatedError = t(errorKey)
          showToast(translatedError !== errorKey ? translatedError : errorKey, 2000)
        }
      }
    } catch (error) {
      showToast("Switch failed: " + (error as Error).message, 2000)
    }
  }, [])

  useEffect(() => {
    const ensurePageFocus = () => {
      if (document.visibilityState !== "visible") return
      if (document.hasFocus()) return

      try {
        window.focus()
      } catch {
        // ignore
      }
    }

    const timerId = window.setTimeout(ensurePageFocus, 150)
    window.addEventListener("pageshow", ensurePageFocus)

    return () => {
      window.clearTimeout(timerId)
      window.removeEventListener("pageshow", ensurePageFocus)
    }
  }, [])

  useEffect(() => {
    shortcutManager.updateSettings(settings?.shortcuts)
  }, [shortcutManager, settings?.shortcuts])

  useEffect(() => {
    const handlers: Partial<Record<ShortcutActionId, () => void>> = {
      [SHORTCUT_ACTIONS.SCROLL_TOP]: scrollToTop,
      [SHORTCUT_ACTIONS.SCROLL_BOTTOM]: scrollToBottom,
      [SHORTCUT_ACTIONS.GO_TO_ANCHOR]: goToAnchor,
      [SHORTCUT_ACTIONS.TOGGLE_PANEL]: onPanelToggle,
      [SHORTCUT_ACTIONS.TOGGLE_THEME]: onThemeToggle,
      [SHORTCUT_ACTIONS.OPEN_SETTINGS]: openSettings,
      [SHORTCUT_ACTIONS.SWITCH_TAB_1]: switchTab1,
      [SHORTCUT_ACTIONS.SWITCH_TAB_2]: switchTab2,
      [SHORTCUT_ACTIONS.SWITCH_TAB_3]: switchTab3,
      [SHORTCUT_ACTIONS.REFRESH_OUTLINE]: refreshOutline,
      [SHORTCUT_ACTIONS.TOGGLE_OUTLINE_EXPAND]: toggleOutlineExpand,
      [SHORTCUT_ACTIONS.EXPAND_LEVEL_1]: () => expandToLevel(1),
      [SHORTCUT_ACTIONS.EXPAND_LEVEL_2]: () => expandToLevel(2),
      [SHORTCUT_ACTIONS.EXPAND_LEVEL_3]: () => expandToLevel(3),
      [SHORTCUT_ACTIONS.EXPAND_LEVEL_4]: () => expandToLevel(4),
      [SHORTCUT_ACTIONS.EXPAND_LEVEL_5]: () => expandToLevel(5),
      [SHORTCUT_ACTIONS.EXPAND_LEVEL_6]: () => expandToLevel(6),
      [SHORTCUT_ACTIONS.TOGGLE_USER_QUERIES]: toggleUserQueries,
      [SHORTCUT_ACTIONS.TOGGLE_BOOKMARKS]: toggleBookmarks,
      [SHORTCUT_ACTIONS.ONLY_USER_QUERIES]: onlyUserQueries,
      [SHORTCUT_ACTIONS.PREV_HEADING]: prevHeading,
      [SHORTCUT_ACTIONS.NEXT_HEADING]: nextHeading,
      [SHORTCUT_ACTIONS.LOCATE_OUTLINE]: locateOutline,
      [SHORTCUT_ACTIONS.SEARCH_OUTLINE]: searchOutline,
      [SHORTCUT_ACTIONS.NEW_CONVERSATION]: newConversation,
      [SHORTCUT_ACTIONS.REFRESH_CONVERSATIONS]: refreshConversations,
      [SHORTCUT_ACTIONS.LOCATE_CONVERSATION]: locateConversation,
      [SHORTCUT_ACTIONS.PREV_CONVERSATION]: prevConversation,
      [SHORTCUT_ACTIONS.NEXT_CONVERSATION]: nextConversation,
      [SHORTCUT_ACTIONS.EXPORT_CONVERSATION]: exportConversation,
      [SHORTCUT_ACTIONS.COPY_LATEST_REPLY]: copyLatestReply,
      [SHORTCUT_ACTIONS.COPY_LAST_CODE_BLOCK]: copyLastCodeBlock,
      [SHORTCUT_ACTIONS.TOGGLE_SCROLL_LOCK]: toggleScrollLock,
      [SHORTCUT_ACTIONS.FOCUS_INPUT]: focusInput,
      [SHORTCUT_ACTIONS.OPEN_GLOBAL_SEARCH]: openGlobalSearch,
      [SHORTCUT_ACTIONS.STOP_GENERATION]: stopGeneration,
      [SHORTCUT_ACTIONS.SHOW_SHORTCUTS]: showShortcuts,
      [SHORTCUT_ACTIONS.SHOW_MODEL_SELECTOR]: showModelSelector,

      [SHORTCUT_ACTIONS.OPEN_CLAUDE_SETTINGS]: openClaudeSettings,
      [SHORTCUT_ACTIONS.SWITCH_CLAUDE_KEY]: switchClaudeKey,
      [SHORTCUT_ACTIONS.OPEN_GEMINI_SETTINGS]: openGeminiSettings,
      [SHORTCUT_ACTIONS.OPEN_THEME_SETTINGS]: openThemeSettings,
      [SHORTCUT_ACTIONS.OPEN_MODEL_LOCK_SETTINGS]: openModelLockSettings,
      [SHORTCUT_ACTIONS.TOGGLE_PROMPT_QUEUE]: togglePromptQueue,
    }

    shortcutManager.registerAll(handlers)
    shortcutManager.startListening()

    return () => {
      shortcutManager.stopListening()
      shortcutManager.clearAll()
    }
  }, [
    shortcutManager,
    scrollToTop,
    scrollToBottom,
    goToAnchor,
    onPanelToggle,
    onThemeToggle,
    openSettings,
    switchTab1,
    switchTab2,
    switchTab3,
    refreshOutline,
    toggleOutlineExpand,
    expandToLevel,
    toggleUserQueries,
    toggleBookmarks,
    onlyUserQueries,
    prevHeading,
    nextHeading,
    locateOutline,
    searchOutline,
    newConversation,
    refreshConversations,
    locateConversation,
    prevConversation,
    nextConversation,
    exportConversation,
    copyLatestReply,
    copyLastCodeBlock,
    toggleScrollLock,
    focusInput,
    openGlobalSearch,
    stopGeneration,
    showShortcuts,
    openClaudeSettings,
    showModelSelector,
    switchClaudeKey,
    openGeminiSettings,
    openThemeSettings,
    openModelLockSettings,
    togglePromptQueue,
  ])

  return shortcutManager
}
