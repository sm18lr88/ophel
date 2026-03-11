import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"

import { getAdapter } from "~adapters/index"
import { SITE_IDS } from "~constants/defaults"
import { ConversationManager } from "~core/conversation-manager"
import { InlineBookmarkManager } from "~core/inline-bookmark-manager"
import { OutlineManager, type OutlineNode } from "~core/outline-manager"
import { AI_STUDIO_SHORTCUT_SYNC_EVENT, PromptManager } from "~core/prompt-manager"
import { QueueDispatcher } from "~core/queue-dispatcher"
import { ThemeManager } from "~core/theme-manager"
import { useShortcuts } from "~hooks/useShortcuts"
import { useSettingsHydrated, useSettingsStore } from "~stores/settings-store"
import { DEFAULT_SETTINGS, type Prompt, type Settings } from "~utils/storage"
import { MSG_CLEAR_ALL_DATA } from "~utils/messaging"
import { showToast } from "~utils/toast"
import { setLanguage, t } from "~utils/i18n"
import { getHighlightStyles, renderMarkdown } from "~utils/markdown"
import { createSafeHTML } from "~utils/trusted-types"
import { initCopyButtons, showCopySuccess } from "~utils/icons"

import { ConfirmDialog, FolderSelectDialog, TagManagerDialog } from "./ConversationDialogs"
import { DisclaimerModal } from "./DisclaimerModal"
import { MainPanel } from "./MainPanel"
import { QueueOverlay } from "./QueueOverlay"
import { QuickButtons } from "./QuickButtons"
import { SelectedPromptBar } from "./SelectedPromptBar"
import { SettingsModal } from "./SettingsModal"
import { GlobalSearchContainer } from "./global-search/GlobalSearchContainer"
import { useTagsStore } from "~stores/tags-store"
import { TAB_IDS } from "~constants"

export const App = () => {
  const { settings, setSettings, updateDeepSetting } = useSettingsStore()
  const isSettingsHydrated = useSettingsHydrated()
  const promptSubmitShortcut = settings?.features?.prompts?.submitShortcut ?? "enter"

  const _syncVersion = useSettingsStore((s) => s._syncVersion)

  const adapter = useMemo(() => getAdapter(), [])

  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false)

  const hasEverInteracted = useRef(false)
  if (isPanelOpen || isGlobalSearchOpen || isSettingsOpen) {
    hasEverInteracted.current = true
  }
  const managersActive = hasEverInteracted.current && !!adapter

  const promptManager = useMemo(() => {
    return managersActive ? new PromptManager(adapter!) : null
  }, [managersActive, adapter])

  const queueDispatcher = useMemo(() => {
    return managersActive && promptManager ? new QueueDispatcher(adapter!, promptManager) : null
  }, [managersActive, adapter, promptManager])
  useEffect(() => {
    if (!queueDispatcher) return
    const isQueueEnabled = settings?.features?.prompts?.promptQueue ?? false
    if (isQueueEnabled) {
      queueDispatcher.start()
    } else {
      queueDispatcher.stop()
    }
    return () => queueDispatcher.stop()
  }, [queueDispatcher, settings?.features?.prompts?.promptQueue])

  const conversationManager = useMemo(() => {
    return managersActive ? new ConversationManager(adapter!) : null
  }, [managersActive, adapter])

  const outlineManager = useMemo(() => {
    if (!managersActive) return null

    const handleExpandLevelChange = (level: number) => {
      updateDeepSetting("features", "outline", "expandLevel", level)
    }

    const handleShowUserQueriesChange = (show: boolean) => {
      updateDeepSetting("features", "outline", "showUserQueries", show)
    }

    return new OutlineManager(
      adapter!,
      settings?.features?.outline ?? DEFAULT_SETTINGS.features.outline,
      handleExpandLevelChange,
      handleShowUserQueriesChange,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [managersActive, adapter, updateDeepSetting])

  const settingsRef = useRef(settings)
  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  useEffect(() => {
    if (isSettingsHydrated && settings && !isInitializedRef.current) {
      isInitializedRef.current = true
      const {
        edgeSnap,
        defaultEdgeDistance = 25,
        edgeSnapThreshold = 18,
        defaultPosition = "right",
      } = settings.panel ?? {}
      if (edgeSnap && defaultEdgeDistance <= edgeSnapThreshold) {
        setEdgeSnapState(defaultPosition ?? "right")
      }
    }
  }, [isSettingsHydrated, settings])

  useEffect(() => {
    if (!isSettingsHydrated || !settings) return

    let needsUpdate = false
    const nextSettings: Partial<Settings> = {}
    const buttons = settings.collapsedButtons || []
    let nextButtons = buttons

    if (!nextButtons.some((btn) => btn.id === "floatingToolbar")) {
      nextButtons = [...nextButtons]
      const panelIndex = nextButtons.findIndex((btn) => btn.id === "panel")
      const insertIndex = panelIndex >= 0 ? panelIndex + 1 : nextButtons.length
      nextButtons.splice(insertIndex, 0, { id: "floatingToolbar", enabled: true })
      needsUpdate = true
    }

    if (!nextButtons.some((btn) => btn.id === "globalSearch")) {
      if (nextButtons === buttons) {
        nextButtons = [...nextButtons]
      }
      const toolboxIndex = nextButtons.findIndex((btn) => btn.id === "floatingToolbar")
      const insertIndex = toolboxIndex >= 0 ? toolboxIndex + 1 : nextButtons.length
      nextButtons.splice(insertIndex, 0, { id: "globalSearch", enabled: true })
      needsUpdate = true
    }

    if (nextButtons !== buttons) {
      nextSettings.collapsedButtons = nextButtons
    }

    if (!settings.floatingToolbar) {
      nextSettings.floatingToolbar = { open: true }
      needsUpdate = true
    }

    if (needsUpdate) {
      setSettings(nextSettings)
    }
  }, [isSettingsHydrated, settings, setSettings])

  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null)

  const [floatingToolbarMoveState, setFloatingToolbarMoveState] = useState<{
    convId: string
    activeFolderId?: string
  } | null>(null)
  const [isFloatingToolbarClearOpen, setIsFloatingToolbarClearOpen] = useState(false)

  const [edgeSnapState, setEdgeSnapState] = useState<"left" | "right" | null>(null)
  const [isEdgePeeking, setIsEdgePeeking] = useState(false)
  const isInteractionActiveRef = useRef(false)
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null)
  const shortcutPeekTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isSettingsOpenRef = useRef(false)
  const isInputFocusedRef = useRef(false)
  const isInitializedRef = useRef(false)

  const closeSettingsModal = useCallback(() => {
    isSettingsOpenRef.current = false
    setIsSettingsOpen(false)

    const currentSettings = settingsRef.current
    if (!currentSettings?.panel?.edgeSnap) return

    let panel: HTMLElement | null = null
    const shadowHost = document.querySelector("plasmo-csui, #ophel-userscript-root")
    if (shadowHost?.shadowRoot) {
      panel = shadowHost.shadowRoot.querySelector(".gh-main-panel") as HTMLElement
    }
    if (!panel) {
      panel = document.querySelector(".gh-main-panel") as HTMLElement
    }

    if (!panel) return

    const isAlreadySnapped =
      panel.classList.contains("edge-snapped-left") ||
      panel.classList.contains("edge-snapped-right")

    if (isAlreadySnapped) return

    const rect = panel.getBoundingClientRect()
    const snapThreshold = currentSettings?.panel?.edgeSnapThreshold ?? 30

    if (rect.left < snapThreshold) {
      setEdgeSnapState("left")
    } else if (window.innerWidth - rect.right < snapThreshold) {
      setEdgeSnapState("right")
    }
  }, [])

  const openSettingsModal = useCallback(() => {
    setIsGlobalSearchOpen(false)
    isSettingsOpenRef.current = true

    if (edgeSnapState && settingsRef.current?.panel?.edgeSnap) {
      setIsEdgePeeking(true)
    }

    setIsSettingsOpen(true)
  }, [edgeSnapState])

  const openGlobalSearchByShortcut = useCallback(() => {
    setIsGlobalSearchOpen(true)
  }, [])

  useEffect(() => {
    const handleNavigateSettings = (
      _e: CustomEvent<{ page?: string; subTab?: string; settingId?: string }>,
    ) => {
      setIsGlobalSearchOpen(false)

      if (!isSettingsOpenRef.current) {
        isSettingsOpenRef.current = true

        if (edgeSnapState && settingsRef.current?.panel?.edgeSnap) {
          setIsEdgePeeking(true)
        }

        setIsSettingsOpen(true)
      }
    }

    window.addEventListener("ophel:navigateSettingsPage", handleNavigateSettings as EventListener)

    return () =>
      window.removeEventListener(
        "ophel:navigateSettingsPage",
        handleNavigateSettings as EventListener,
      )
  }, [edgeSnapState])

  const cancelShortcutPeekTimer = useCallback(() => {
    if (shortcutPeekTimerRef.current) {
      clearTimeout(shortcutPeekTimerRef.current)
      shortcutPeekTimerRef.current = null
    }
  }, [])

  const handleInteractionChange = useCallback((isActive: boolean) => {
    isInteractionActiveRef.current = isActive
  }, [])

  //  i18n
  useEffect(() => {
    if (isSettingsHydrated && settings?.language) {
      setLanguage(settings.language)
    }
  }, [settings?.language, isSettingsHydrated])

  //
  const handlePromptSelect = useCallback((prompt: Prompt | null) => {
    setSelectedPrompt(prompt)
  }, [])

  //
  const handleClearSelectedPrompt = useCallback(() => {
    setSelectedPrompt(null)
    //
    if (adapter) {
      adapter.clearTextarea()
    }
  }, [adapter])

  //  useEffect  settings  manager
  useEffect(() => {
    if (outlineManager && settings) {
      outlineManager.updateSettings(settings.features?.outline)
    }
  }, [outlineManager, settings])

  //  ConversationManager
  useEffect(() => {
    if (conversationManager && settings) {
      conversationManager.updateSettings({
        syncUnpin: settings.features?.conversations?.syncUnpin ?? false,
      })
    }
  }, [conversationManager, settings])

  //  window  main.ts  ThemeManager
  //  ThemeManager
  const themeManager = useMemo(() => {
    const globalTM = window.__ophelThemeManager
    if (globalTM) {
      return globalTM
    }
    //  main.ts
    console.warn("[App] Global ThemeManager not found, creating fallback instance")
    //
    const currentAdapter = getAdapter()
    const siteId = currentAdapter?.getSiteId() || "_default"
    const fallbackTheme =
      settings?.theme?.sites?.[siteId as keyof typeof settings.theme.sites] ||
      settings?.theme?.sites?._default
    return new ThemeManager(
      fallbackTheme?.mode || "light", //  settings  mode
      undefined,
      adapter,
      fallbackTheme?.lightStyleId || "google-gradient",
      fallbackTheme?.darkStyleId || "classic-dark",
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps --
  }, [])

  //  useSyncExternalStore  ThemeManager
  //  ThemeManager
  const themeMode = useSyncExternalStore(themeManager.subscribe, themeManager.getSnapshot)

  //  settings
  // themeMode  useSyncExternalStore  setThemeMode
  useEffect(() => {
    const handleThemeModeChange = (
      mode: "light" | "dark",
      preference?: "light" | "dark" | "system",
    ) => {
      const nextPreference = preference || mode
      //  ref  settings
      const currentSettings = settingsRef.current
      const sites = currentSettings?.theme?.sites || {}

      //  ID
      const currentAdapter = getAdapter()
      const siteId = currentAdapter?.getSiteId() || "_default"

      //
      const existingSite = sites[siteId as keyof typeof sites] || sites._default
      const siteConfig = {
        lightStyleId: "google-gradient",
        darkStyleId: "classic-dark",
        mode: "light" as const,
        ...existingSite, //
      }

      //  mode
      setSettings({
        theme: {
          ...currentSettings?.theme,
          sites: {
            ...sites,
            [siteId]: {
              ...siteConfig,
              mode: nextPreference, //  mode
            },
          },
        },
      })
    }
    themeManager.setOnModeChange(handleThemeModeChange)

    //
    return () => {
      themeManager.setOnModeChange(undefined)
    }
  }, [themeManager, setSettings]) //  settings?.theme  ref

  const themeSites = settings?.theme?.sites
  const syncUnpin = settings?.features?.conversations?.syncUnpin
  const syncDelete = settings?.features?.conversations?.syncDelete
  const inlineBookmarkMode = settings?.features?.outline?.inlineBookmarkMode
  const hasSettings = Boolean(settings)
  const collapsedButtons = settings?.collapsedButtons || DEFAULT_SETTINGS.collapsedButtons
  const floatingToolbarEnabled =
    collapsedButtons.find((btn) => btn.id === "floatingToolbar")?.enabled ?? true
  const floatingToolbarOpen = settings?.floatingToolbar?.open ?? true
  const isScrollLockActive = settings?.panel?.preventAutoScroll ?? false
  const ghostBookmarkCount = outlineManager?.getGhostBookmarkIds().length ?? 0

  useEffect(() => {
    if (!floatingToolbarEnabled || !floatingToolbarOpen) {
      setFloatingToolbarMoveState(null)
      setIsFloatingToolbarClearOpen(false)
    }
  }, [floatingToolbarEnabled, floatingToolbarOpen])

  //  ThemeManager
  // Zustand  Plasmo useStorage
  useEffect(() => {
    if (!isSettingsHydrated) return //  hydration

    //  _default
    const currentAdapter = getAdapter()
    const siteId = currentAdapter?.getSiteId() || "_default"
    const siteTheme = themeSites?.[siteId as keyof typeof themeSites] || themeSites?._default
    const lightId = siteTheme?.lightStyleId
    const darkId = siteTheme?.darkStyleId

    if (lightId && darkId) {
      themeManager.setPresets(lightId, darkId)
    }
  }, [themeSites, themeManager, isSettingsHydrated])

  //  ThemeManager
  useEffect(() => {
    if (!isSettingsHydrated) return
    themeManager.setCustomStyles(settings?.theme?.customStyles || [])
  }, [settings?.theme?.customStyles, themeManager, isSettingsHydrated])

  //  View Transitions API
  //  React  ThemeManager  onModeChange
  const handleThemeToggle = useCallback(
    async (event?: MouseEvent) => {
      await themeManager.toggle(event)
      //  onModeChange
      //  React
    },
    [themeManager],
  )

  //
  useEffect(() => {
    //  updateMode main.ts
    //
    themeManager.monitorTheme()

    return () => {
      //
      themeManager.stopMonitoring()
    }
  }, [themeManager])

  //
  useEffect(() => {
    if (promptManager) {
      promptManager.init()
    }
    if (conversationManager) {
      conversationManager.init()
    }
    if (outlineManager) {
      outlineManager.refresh()
      const refreshInterval = setInterval(() => {
        outlineManager.refresh()
      }, 2000)
      return () => {
        clearInterval(refreshInterval)
        conversationManager?.destroy()
      }
    }
  }, [promptManager, conversationManager, outlineManager])

  useEffect(() => {
    if (!conversationManager || typeof chrome === "undefined") return

    const isClearAllDataMessage = (
      value: unknown,
    ): value is {
      type: typeof MSG_CLEAR_ALL_DATA
    } => {
      return typeof value === "object" && value !== null && "type" in value
    }

    const handler: Parameters<typeof chrome.runtime.onMessage.addListener>[0] = (
      message,
      _sender,
      sendResponse,
    ) => {
      if (isClearAllDataMessage(message) && message.type === MSG_CLEAR_ALL_DATA) {
        conversationManager.destroy()
        sendResponse({ success: true })
        return true
      }
      return false
    }

    chrome.runtime.onMessage.addListener(handler)
    return () => {
      chrome.runtime.onMessage.removeListener(handler)
    }
  }, [conversationManager])

  useEffect(() => {
    if (!conversationManager) return
    conversationManager.updateSettings({
      syncUnpin: syncUnpin ?? false,
      syncDelete: syncDelete ?? true,
    })
  }, [conversationManager, syncUnpin, syncDelete])

  //
  useEffect(() => {
    if (!outlineManager || !adapter || !hasSettings) return

    const mode = inlineBookmarkMode || "always"
    const inlineBookmarkManager = new InlineBookmarkManager(outlineManager, adapter, mode)

    return () => {
      inlineBookmarkManager.cleanup()
    }
  }, [outlineManager, adapter, inlineBookmarkMode, hasSettings])

  //
  const handleToggleScrollLock = useCallback(() => {
    const current = settingsRef.current
    if (!current) return
    const newState = !current.panel?.preventAutoScroll

    setSettings({
      panel: {
        ...current.panel,
        preventAutoScroll: newState,
      },
    })

    //  useShortcuts
    //
    showToast(newState ? t("preventAutoScrollEnabled") : t("preventAutoScrollDisabled"))
  }, [setSettings])

  const handleFloatingToolbarExport = useCallback(async () => {
    if (!conversationManager || !adapter) return
    const sessionId = adapter.getSessionId()
    if (!sessionId) {
      showToast(t("exportNeedOpenFirst") || "")
      return
    }
    showToast(t("exportStarted") || "...")
    const success = await conversationManager.exportConversation(sessionId, "markdown")
    if (!success) {
      showToast(t("exportFailed") || "")
    }
  }, [conversationManager, adapter])

  const handleFloatingToolbarMoveToFolder = useCallback(() => {
    if (!conversationManager || !adapter) return
    const sessionId = adapter.getSessionId()
    if (!sessionId) {
      showToast(t("noConversationToLocate") || "")
      return
    }
    const conv = conversationManager.getConversation(sessionId)
    setFloatingToolbarMoveState({
      convId: sessionId,
      activeFolderId: conv?.folderId,
    })
  }, [conversationManager, adapter])

  const handleFloatingToolbarClearGhost = useCallback(() => {
    if (!outlineManager) return
    const cleared = outlineManager.clearGhostBookmarks()
    if (cleared === 0) {
      showToast(t("floatingToolbarClearGhostEmpty") || "")
      return
    }
    showToast(`${t("cleared") || ""} (${cleared})`)
  }, [outlineManager])

  //  Markdown
  const handleCopyMarkdown = useCallback(async () => {
    if (!conversationManager || !adapter) return
    const sessionId = adapter.getSessionId()
    if (!sessionId) {
      showToast(t("exportNeedOpenFirst") || "")
      return
    }
    showToast(t("exportLoading") || "...")
    const success = await conversationManager.exportConversation(sessionId, "clipboard")
    if (!success) {
      showToast(t("exportFailed") || "")
    }
  }, [conversationManager, adapter])

  //  ()
  const handleModelLockToggle = useCallback(() => {
    if (!adapter) return
    const siteId = adapter.getSiteId()
    const current = settingsRef.current
    if (!current) return

    const modelLockConfig = current.modelLock?.[siteId] || { enabled: false, keyword: "" }

    //
    if (!modelLockConfig.keyword) {
      if (modelLockConfig.enabled) {
        //  →
        setSettings({
          modelLock: {
            ...current.modelLock,
            [siteId]: {
              ...modelLockConfig,
              enabled: false,
            },
          },
        })
        showToast(t("modelLockDisabled") || "")
      } else {
        //  →  +
        showToast(t("modelLockNoKeyword") || "")
        setSettings({
          modelLock: {
            ...current.modelLock,
            [siteId]: {
              ...modelLockConfig,
              enabled: true,
            },
          },
        })
        openSettingsModal()
        setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("ophel:navigateSettingsPage", {
              detail: { page: "siteSettings", subTab: "modelLock" },
            }),
          )
        }, 100)
      }
      return
    }

    const newEnabled = !modelLockConfig.enabled

    setSettings({
      modelLock: {
        ...current.modelLock,
        [siteId]: {
          ...modelLockConfig,
          enabled: newEnabled,
        },
      },
    })

    showToast(newEnabled ? t("modelLockEnabled") || "" : t("modelLockDisabled") || "")
  }, [adapter, openSettingsModal, setSettings])

  //
  const isModelLocked = useMemo(() => {
    if (!adapter || !settings) return false
    const siteId = adapter.getSiteId()
    return settings.modelLock?.[siteId]?.enabled || false
  }, [adapter, settings])

  //
  useShortcuts({
    settings,
    adapter,
    outlineManager,
    conversationManager,
    onPanelToggle: () => setIsPanelOpen((prev) => !prev),
    onThemeToggle: handleThemeToggle,
    onOpenSettings: openSettingsModal,
    onOpenGlobalSearch: openGlobalSearchByShortcut,
    isPanelVisible: isPanelOpen,
    isSnapped: !!edgeSnapState && !isEdgePeeking, //
    onShowSnappedPanel: () => {
      //
      setIsEdgePeeking(true)
      //  3
      cancelShortcutPeekTimer()
      shortcutPeekTimerRef.current = setTimeout(() => {
        setIsEdgePeeking(false)
        shortcutPeekTimerRef.current = null
      }, 3000)
    },
    onToggleScrollLock: handleToggleScrollLock,
  })

  //
  //  SettingsModal onClose
  useEffect(() => {
    if (edgeSnapState && !settings?.panel?.edgeSnap) {
      setEdgeSnapState(null)
      setIsEdgePeeking(false)
    }
  }, [settings?.panel?.edgeSnap, edgeSnapState])

  //
  //
  const prevDefaultPosition = useRef(settings?.panel?.defaultPosition)
  useEffect(() => {
    const currentPos = settings?.panel?.defaultPosition
    //  ref
    if (prevDefaultPosition.current === undefined && currentPos) {
      prevDefaultPosition.current = currentPos
      return
    }

    if (currentPos && prevDefaultPosition.current !== currentPos) {
      prevDefaultPosition.current = currentPos
      //
      if (edgeSnapState) {
        //
        setEdgeSnapState(currentPos)
        setIsEdgePeeking(false)
      }
    }
  }, [settings?.panel?.defaultPosition, edgeSnapState])

  //  MutationObserver  Portal //
  //  Portal  isEdgePeeking  true CSS :hover
  useEffect(() => {
    if (!edgeSnapState || !settings?.panel?.edgeSnap) return

    const portalSelector =
      ".conversations-dialog-overlay, .conversations-folder-menu, .conversations-tag-filter-menu, .prompt-modal, .gh-dialog-overlay, .settings-modal-overlay"

    //  Portal
    const checkPortalExists = () => {
      const portals = document.body.querySelectorAll(portalSelector)
      const searchOverlays = document.body.querySelectorAll(".settings-search-overlay")
      return portals.length > 0 || searchOverlays.length > 0
    }

    //  Portal  Portal
    let prevHasPortal = checkPortalExists()

    //  MutationObserver  document.body
    const observer = new MutationObserver(() => {
      const hasPortal = checkPortalExists()

      if (hasPortal && !prevHasPortal) {
        // Portal
        //  Portal  CSS :hover
        setIsEdgePeeking(true)

        //
        if (hideTimerRef.current) {
          clearTimeout(hideTimerRef.current)
          hideTimerRef.current = null
        }
      } else if (!hasPortal && prevHasPortal) {
        // Portal
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
        hideTimerRef.current = setTimeout(() => {
          // 500ms  Portal
          if (!checkPortalExists() && !isInteractionActiveRef.current) {
            setIsEdgePeeking(false)
          }
        }, 500)
      }

      prevHasPortal = hasPortal
    })

    //  document.body
    observer.observe(document.body, {
      childList: true,
      subtree: false,
    })

    //
    if (checkPortalExists()) {
      setIsEdgePeeking(true)
    }

    return () => {
      observer.disconnect()
    }
  }, [edgeSnapState, settings?.panel?.edgeSnap])

  //
  // IME  CSS :hover
  //  isEdgePeeking = true CSS :hover
  useEffect(() => {
    if (!edgeSnapState || !settings?.panel?.edgeSnap) return

    //  Shadow DOM
    const shadowHost = document.querySelector("plasmo-csui, #ophel-userscript-root")
    const shadowRoot = shadowHost?.shadowRoot
    if (!shadowRoot) return

    const handleFocusIn = (e: Event) => {
      const target = e.target as HTMLElement
      // inputtextarea
      const isInputElement =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.getAttribute("contenteditable") === "true"

      if (isInputElement) {
        //
        // isSettingsOpenRef
        if (target.closest(".settings-modal-overlay, .settings-modal")) {
          return
        }

        isInputFocusedRef.current = true
        //
        setIsEdgePeeking(true)
        //
        if (hideTimerRef.current) {
          clearTimeout(hideTimerRef.current)
          hideTimerRef.current = null
        }
      }
    }

    const handleFocusOut = (e: Event) => {
      const target = e.target as HTMLElement
      const isInputElement =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.getAttribute("contenteditable") === "true"

      if (isInputElement) {
        //
        if (target.closest(".settings-modal-overlay, .settings-modal")) {
          return
        }

        isInputFocusedRef.current = false
        //
        //
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
        hideTimerRef.current = setTimeout(() => {
          //
          if (
            !isInputFocusedRef.current &&
            !isSettingsOpenRef.current &&
            !isInteractionActiveRef.current
          ) {
            const portalElements = document.body.querySelectorAll(
              ".conversations-dialog-overlay, .conversations-folder-menu, .conversations-tag-filter-menu, .prompt-modal, .gh-dialog-overlay, .settings-modal-overlay",
            )
            const searchOverlays = document.body.querySelectorAll(".settings-search-overlay")
            if (portalElements.length === 0 && searchOverlays.length === 0) {
              setIsEdgePeeking(false)
            }
          }
        }, 300)
      }
    }

    //  Shadow DOM
    shadowRoot.addEventListener("focusin", handleFocusIn, true)
    shadowRoot.addEventListener("focusout", handleFocusOut, true)

    return () => {
      shadowRoot.removeEventListener("focusin", handleFocusIn, true)
      shadowRoot.removeEventListener("focusout", handleFocusOut, true)
    }
  }, [edgeSnapState, settings?.panel?.edgeSnap])

  useEffect(() => {
    //
    //
    const shouldHandle = settings?.panel?.autoHide
    if (!shouldHandle || !isPanelOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      //  composedPath()  Shadow DOM
      const path = e.composedPath()

      //  Portal /
      const isInsidePanelOrPortal = path.some((el) => {
        if (!(el instanceof Element)) return false
        //
        if (el.closest?.(".gh-main-panel")) return true
        //
        if (el.closest?.(".gh-quick-buttons")) return true
        //  Portal
        if (el.closest?.(".conversations-dialog-overlay")) return true
        if (el.closest?.(".conversations-folder-menu")) return true
        if (el.closest?.(".conversations-tag-filter-menu")) return true
        if (el.closest?.(".prompt-modal")) return true
        if (el.closest?.(".gh-dialog-overlay")) return true
        if (el.closest?.(".settings-modal-overlay")) return true
        if (el.closest?.(".settings-search-overlay")) return true
        return false
      })

      if (!isInsidePanelOrPortal) {
        //
        if (settings?.panel?.edgeSnap) {
          if (!edgeSnapState) {
            setEdgeSnapState(settings.panel.defaultPosition || "right")
            setIsEdgePeeking(false)
          }
          //
        } else {
          //
          setIsPanelOpen(false)
        }
      }
    }

    //
    const timer = setTimeout(() => {
      document.addEventListener("click", handleClickOutside, true)
    }, 100)

    return () => {
      clearTimeout(timer)
      document.removeEventListener("click", handleClickOutside, true)
    }
  }, [
    settings?.panel?.autoHide,
    settings?.panel?.edgeSnap,
    isPanelOpen,
    edgeSnapState,
    settings?.panel?.defaultPosition,
  ])

  const showAiStudioSubmitShortcutSyncToast = useCallback(
    (submitShortcut: "enter" | "ctrlEnter") => {
      if (!adapter || adapter.getSiteId() !== SITE_IDS.AISTUDIO) return

      const markerKey = "ophel:aistudio-submit-shortcut-sync-toast"
      const markerValue = `synced:${submitShortcut}`
      let shouldShow = true

      try {
        if (sessionStorage.getItem(markerKey) === markerValue) {
          shouldShow = false
        } else {
          sessionStorage.setItem(markerKey, markerValue)
        }
      } catch {
        // ignore sessionStorage errors
      }

      if (!shouldShow) return

      const shortcutLabel = submitShortcut === "ctrlEnter" ? "Ctrl + Enter" : "Enter"
      showToast(`AI Studio ${t("promptSubmitShortcutLabel")}: ${shortcutLabel}`)
    },
    [adapter],
  )

  // Submit shortcut behaviors
  useEffect(() => {
    if (!adapter || adapter.getSiteId() !== SITE_IDS.AISTUDIO) return

    const handleShortcutSync = (event: Event) => {
      const detail = (event as CustomEvent<{ submitShortcut?: "enter" | "ctrlEnter" }>).detail
      const submitShortcut = detail?.submitShortcut
      if (submitShortcut === "enter" || submitShortcut === "ctrlEnter") {
        showAiStudioSubmitShortcutSyncToast(submitShortcut)
      }
    }

    window.addEventListener(AI_STUDIO_SHORTCUT_SYNC_EVENT, handleShortcutSync as EventListener)
    return () => {
      window.removeEventListener(AI_STUDIO_SHORTCUT_SYNC_EVENT, handleShortcutSync as EventListener)
    }
  }, [adapter, showAiStudioSubmitShortcutSyncToast])

  // Keep AI Studio local submit-key behavior in sync with extension setting
  useEffect(() => {
    if (!adapter || !promptManager || adapter.getSiteId() !== SITE_IDS.AISTUDIO) return
    promptManager.syncAiStudioSubmitShortcut(promptSubmitShortcut)
  }, [adapter, promptManager, promptSubmitShortcut])

  // Manual send: trigger only when focused element is the chat input
  useEffect(() => {
    if (!adapter || !promptManager) return

    const insertNewLine = (editor: HTMLElement) => {
      if (editor instanceof HTMLTextAreaElement) {
        const start = editor.selectionStart ?? editor.value.length
        const end = editor.selectionEnd ?? editor.value.length
        editor.setRangeText("\n", start, end, "end")
        editor.dispatchEvent(new Event("input", { bubbles: true }))
        return
      }

      if (editor.getAttribute("contenteditable") !== "true") return

      editor.focus()

      const shiftEnterEvent: KeyboardEventInit = {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true,
        composed: true,
        shiftKey: true,
      }

      const beforeHTML = editor.innerHTML
      editor.dispatchEvent(new KeyboardEvent("keydown", shiftEnterEvent))
      editor.dispatchEvent(new KeyboardEvent("keypress", shiftEnterEvent))
      editor.dispatchEvent(new KeyboardEvent("keyup", shiftEnterEvent))

      // Fallback for editors that ignore synthetic keyboard events.
      if (editor.innerHTML === beforeHTML) {
        if (!document.execCommand("insertLineBreak")) {
          document.execCommand("insertParagraph")
        }
        editor.dispatchEvent(new Event("input", { bubbles: true }))
      }
    }

    const handleKeydown = (e: KeyboardEvent) => {
      if (!e.isTrusted) return
      if (e.key !== "Enter") return
      if (e.isComposing || e.keyCode === 229) return

      //  overlay
      const path = e.composedPath()
      const isFromQueue = path.some(
        (el) =>
          el instanceof HTMLElement &&
          (el.classList?.contains("gh-queue-panel") ||
            el.classList?.contains("gh-queue-input") ||
            el.classList?.contains("gh-queue-item-edit-input")),
      )
      if (isFromQueue) return

      const editor = path.find(
        (element) => element instanceof HTMLElement && adapter.isValidTextarea(element),
      ) as HTMLElement | undefined

      if (!editor) return

      const hasPrimaryModifier = e.ctrlKey || e.metaKey
      const hasAnyModifier = hasPrimaryModifier || e.altKey
      const isSubmitKey =
        promptSubmitShortcut === "ctrlEnter"
          ? hasPrimaryModifier && !e.altKey && !e.shiftKey
          : !hasAnyModifier && !e.shiftKey
      const shouldInsertNewlineInCtrlEnterMode =
        promptSubmitShortcut === "ctrlEnter" && !hasAnyModifier && !e.shiftKey

      if (isSubmitKey) {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()

        void (async () => {
          promptManager.syncAiStudioSubmitShortcut(promptSubmitShortcut)
          const success = await promptManager.submitPrompt(promptSubmitShortcut)
          if (success) {
            setSelectedPrompt(null)
          }
        })()
        return
      }

      // In Ctrl+Enter mode, block plain Enter to avoid accidental native submit
      if (shouldInsertNewlineInCtrlEnterMode) {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        insertNewLine(editor)
      }
    }

    // Claude  Enter
    // document  Ctrl+Enter  Enter
    //  Claude  window
    //  return  document
    if (adapter.getSiteId() === SITE_IDS.CLAUDE) {
      window.addEventListener("keydown", handleKeydown, true)
      return () => {
        window.removeEventListener("keydown", handleKeydown, true)
      }
    }

    //  document
    document.addEventListener("keydown", handleKeydown, true)
    return () => {
      document.removeEventListener("keydown", handleKeydown, true)
    }
  }, [adapter, promptManager, promptSubmitShortcut])

  // Clear selected prompt tag after clicking native send button
  useEffect(() => {
    if (!adapter || !selectedPrompt) return

    const handleSend = () => {
      setSelectedPrompt(null)
    }

    const handleClick = (e: MouseEvent) => {
      const selectors = adapter.getSubmitButtonSelectors()
      if (selectors.length === 0) return

      const path = e.composedPath()
      for (const target of path) {
        if (target === document || target === window) break
        for (const selector of selectors) {
          try {
            if ((target as Element).matches?.(selector)) {
              setTimeout(handleSend, 100)
              return
            }
          } catch {
            // ignore invalid selectors
          }
        }
      }
    }

    document.addEventListener("click", handleClick, true)

    return () => {
      document.removeEventListener("click", handleClick, true)
    }
  }, [adapter, selectedPrompt])

  //
  useEffect(() => {
    if (!selectedPrompt || !adapter) return

    //  URL
    let currentUrl = window.location.href

    //
    const clearPromptAndTextarea = () => {
      setSelectedPrompt(null)
      // adapter.clearTextarea
      adapter.clearTextarea()
    }

    //  popstate /
    const handlePopState = () => {
      if (window.location.href !== currentUrl) {
        clearPromptAndTextarea()
      }
    }

    //  URL SPA
    //  pushState/replaceState  popstate
    const checkUrlChange = () => {
      if (window.location.href !== currentUrl) {
        currentUrl = window.location.href
        clearPromptAndTextarea()
      }
    }

    //  500ms  URL
    const intervalId = setInterval(checkUrlChange, 500)
    window.addEventListener("popstate", handlePopState)

    return () => {
      clearInterval(intervalId)
      window.removeEventListener("popstate", handlePopState)
    }
  }, [selectedPrompt, adapter])

  //
  const [floatingToolbarTagState, setFloatingToolbarTagState] = useState<{
    convId: string
  } | null>(null)

  const handleFloatingToolbarSetTag = useCallback(() => {
    if (!conversationManager || !adapter) return
    const sessionId = adapter.getSessionId()
    if (!sessionId) {
      showToast(t("noConversationToLocate") || "")
      return
    }
    setFloatingToolbarTagState({
      convId: sessionId,
    })
  }, [conversationManager, adapter])

  const { tags, addTag, updateTag, deleteTag } = useTagsStore()

  if (!adapter) {
    return null
  }

  return (
    <div className="gh-root">
      <MainPanel
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        promptManager={promptManager}
        conversationManager={conversationManager}
        outlineManager={outlineManager}
        adapter={adapter}
        onThemeToggle={handleThemeToggle}
        themeMode={themeMode}
        selectedPromptId={selectedPrompt?.id}
        onPromptSelect={handlePromptSelect}
        edgeSnapState={edgeSnapState}
        isEdgePeeking={isEdgePeeking}
        onEdgeSnap={(side) => setEdgeSnapState(side)}
        onUnsnap={() => {
          setEdgeSnapState(null)
          setIsEdgePeeking(false)
        }}
        onInteractionStateChange={handleInteractionChange}
        onOpenSettings={() => {
          openSettingsModal()
        }}
        onMouseEnter={() => {
          if (hideTimerRef.current) {
            clearTimeout(hideTimerRef.current)
            hideTimerRef.current = null
          }
          //
          cancelShortcutPeekTimer()
          //  isEdgePeeking = true
          //  onMouseLeave
          if (edgeSnapState && settings?.panel?.edgeSnap && !isEdgePeeking) {
            setIsEdgePeeking(true)
          }
        }}
        onMouseLeave={() => {
          //  peek
          //  200ms Portal
          if (hideTimerRef.current) clearTimeout(hideTimerRef.current)

          hideTimerRef.current = setTimeout(() => {
            //  ref
            if (isSettingsOpenRef.current) return

            //  IME
            if (isInputFocusedRef.current) return

            // //
            const interactionActive = isInteractionActiveRef.current
            const portalElements = document.body.querySelectorAll(
              ".conversations-dialog-overlay, .conversations-folder-menu, .conversations-tag-filter-menu, .prompt-modal, .gh-dialog-overlay, .settings-modal-overlay",
            )
            const searchOverlays = document.body.querySelectorAll(".settings-search-overlay")
            const hasPortal = portalElements.length > 0 || searchOverlays.length > 0

            //  Portal
            if (interactionActive || hasPortal) return

            //
            if (edgeSnapState && settings?.panel?.edgeSnap && isEdgePeeking) {
              setIsEdgePeeking(false)
            }
          }, 200)
        }}
      />

      <QuickButtons
        isPanelOpen={isPanelOpen}
        onPanelToggle={() => {
          if (!isPanelOpen) {
            //  peek
            if (edgeSnapState && settings?.panel?.edgeSnap) {
              setIsEdgePeeking(true)
            }
          } else {
            //  peek
            setIsEdgePeeking(false)
          }
          setIsPanelOpen(!isPanelOpen)
        }}
        onThemeToggle={handleThemeToggle}
        themeMode={themeMode}
        onExport={handleFloatingToolbarExport}
        onMove={handleFloatingToolbarMoveToFolder}
        onSetTag={handleFloatingToolbarSetTag}
        onScrollLock={() => handleToggleScrollLock()}
        onSettings={() => {
          //  SettingsModal  Tab
          openSettingsModal()
          //  Modal
          setTimeout(() => {
            window.dispatchEvent(
              new CustomEvent("ophel:navigateSettingsPage", {
                detail: { page: "general", subTab: "toolsMenu" },
              }),
            )
          }, 50)
        }}
        scrollLocked={isScrollLockActive}
        onCleanup={() => {
          if (ghostBookmarkCount === 0) {
            showToast(t("floatingToolbarClearGhostEmpty") || "")
            return
          }
          setIsFloatingToolbarClearOpen(true)
        }}
        onGlobalSearch={() => setIsGlobalSearchOpen(true)}
        onCopyMarkdown={handleCopyMarkdown}
        onModelLockToggle={handleModelLockToggle}
        isModelLocked={isModelLocked}
      />
      {/*  */}
      {selectedPrompt && (
        <SelectedPromptBar
          title={selectedPrompt.title}
          onClear={handleClearSelectedPrompt}
          adapter={adapter}
        />
      )}
      {isSettingsOpen && (
        <SettingsModal isOpen onClose={closeSettingsModal} siteId={adapter.getSiteId()} />
      )}
      <GlobalSearchContainer
        isOpen={isGlobalSearchOpen}
        onClose={() => setIsGlobalSearchOpen(false)}
        onOpenSettings={openSettingsModal}
        onPanelOpen={() => setIsPanelOpen(true)}
        adapter={adapter}
        outlineManager={outlineManager}
        conversationManager={conversationManager}
        promptManager={promptManager}
        edgeSnapState={edgeSnapState}
        onEdgePeek={setIsEdgePeeking}
        settings={settings}
      />
      {floatingToolbarMoveState && (
        <FolderSelectDialog
          folders={conversationManager.getFolders()}
          excludeFolderId={
            conversationManager.getConversation(floatingToolbarMoveState.convId)?.folderId
          }
          activeFolderId={floatingToolbarMoveState.activeFolderId}
          onSelect={async (folderId) => {
            await conversationManager.moveConversation(floatingToolbarMoveState.convId, folderId)
            setFloatingToolbarMoveState(null)
          }}
          onCancel={() => setFloatingToolbarMoveState(null)}
        />
      )}
      {floatingToolbarTagState && (
        <TagManagerDialog
          tags={tags}
          conv={conversationManager.getConversation(floatingToolbarTagState.convId)}
          onCancel={() => setFloatingToolbarTagState(null)}
          onCreateTag={async (name, color) => {
            return addTag(name, color)
          }}
          onUpdateTag={async (tagId, name, color) => {
            return updateTag(tagId, name, color)
          }}
          onDeleteTag={async (tagId) => {
            deleteTag(tagId)
          }}
          onSetConversationTags={async (convId, tagIds) => {
            await conversationManager.updateConversation(convId, { tagIds })
          }}
          onRefresh={() => {
            //  ? conversationManager  onChange
          }}
        />
      )}
      {isFloatingToolbarClearOpen && (
        <ConfirmDialog
          title={t("floatingToolbarClearGhost") || ""}
          message={(t("floatingToolbarClearGhostConfirm") || " {count} ").replace(
            "{count}",
            String(ghostBookmarkCount),
          )}
          danger
          onConfirm={() => {
            setIsFloatingToolbarClearOpen(false)
            handleFloatingToolbarClearGhost()
          }}
          onCancel={() => setIsFloatingToolbarClearOpen(false)}
        />
      )}
      {adapter && queueDispatcher && (settings?.features?.prompts?.promptQueue ?? false) && (
        <QueueOverlay adapter={adapter} dispatcher={queueDispatcher} />
      )}
      <DisclaimerModal />
    </div>
  )
}
