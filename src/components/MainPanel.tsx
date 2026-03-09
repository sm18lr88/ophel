import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"

import type { SiteAdapter } from "~adapters/base"
import {
  AnchorIcon,
  ConversationIcon,
  MinimizeIcon,
  NewTabIcon,
  OutlineIcon,
  PromptIcon,
  RefreshIcon,
  ScrollBottomIcon,
  ScrollTopIcon,
  SettingsIcon,
  ThemeDarkIcon,
  ThemeLightIcon,
} from "~components/icons"
import { SITE_IDS, TAB_IDS } from "~constants"
import type { ConversationManager } from "~core/conversation-manager"
import type { OutlineManager } from "~core/outline-manager"
import type { PromptManager } from "~core/prompt-manager"
import { useDraggable } from "~hooks/useDraggable"
import { useSettingsStore } from "~stores/settings-store"
import { loadHistoryUntil } from "~utils/history-loader"
import { t } from "~utils/i18n"
import { getScrollInfo, smartScrollTo, smartScrollToBottom } from "~utils/scroll-helper"
import { DEFAULT_SETTINGS, type Prompt } from "~utils/storage"
import { showToast } from "~utils/toast"
import { anchorStore } from "~stores/anchor-store"

import { ConversationsTab } from "./ConversationsTab"
import { LoadingOverlay } from "./LoadingOverlay"
import { OutlineTab } from "./OutlineTab"
import { PromptsTab } from "./PromptsTab"
import { Tooltip } from "~components/ui/Tooltip"

interface MainPanelProps {
  onClose: () => void
  isOpen: boolean
  promptManager: PromptManager
  conversationManager: ConversationManager
  outlineManager: OutlineManager
  adapter?: SiteAdapter | null
  onThemeToggle?: () => void
  themeMode?: "light" | "dark"
  selectedPromptId?: string | null
  onPromptSelect?: (prompt: Prompt | null) => void
  edgeSnapState?: "left" | "right" | null
  isEdgePeeking?: boolean
  onEdgeSnap?: (side: "left" | "right") => void
  onUnsnap?: () => void
  onInteractionStateChange?: (isActive: boolean) => void
  onOpenSettings?: () => void
  onMouseEnter?: React.MouseEventHandler<HTMLDivElement>
  onMouseLeave?: React.MouseEventHandler<HTMLDivElement>
}

export const MainPanel: React.FC<MainPanelProps> = ({
  onClose,
  isOpen,
  promptManager,
  conversationManager,
  outlineManager,
  adapter,
  onThemeToggle,
  themeMode,
  selectedPromptId,
  onPromptSelect,
  edgeSnapState,
  isEdgePeeking = false,
  onEdgeSnap,
  onUnsnap,
  onInteractionStateChange,
  onOpenSettings,
  onMouseEnter,
  onMouseLeave,
}) => {
  const { settings } = useSettingsStore()
  const currentSettings = settings || DEFAULT_SETTINGS
  const tabOrder = currentSettings.features?.order || DEFAULT_SETTINGS.features.order

  //  DOM  React 
  const { panelRef, headerRef } = useDraggable({
    edgeSnapHide: currentSettings.panel?.edgeSnap,
    edgeSnapState, // 
    snapThreshold: currentSettings.panel?.edgeSnapThreshold ?? 30,
    onEdgeSnap,
    onUnsnap,
  })

  // 
  const defaultPosition = currentSettings.panel?.defaultPosition ?? "right"
  const defaultEdgeDistance = currentSettings.panel?.defaultEdgeDistance ?? 40

  //  tab
  // tabOrder  string[]
  const getFirstTab = (order: string[]): string => {
    if (order && order.length > 0) {
      return order[0]
    }
    return TAB_IDS.PROMPTS
  }

  //  activeTab settings 
  const [activeTab, setActiveTab] = useState<string>(TAB_IDS.PROMPTS)
  const [isInitialized, setIsInitialized] = useState(false)

  // settings  tab
  useEffect(() => {
    if (settings && !isInitialized) {
      setActiveTab(getFirstTab(settings.features?.order))
      setIsInitialized(true)
    }
  }, [settings, isInitialized])

  //  tabOrder  activeTab  tab
  useEffect(() => {
    if (isInitialized && tabOrder && tabOrder.length > 0) {
      if (!tabOrder.includes(activeTab)) {
        setActiveTab(getFirstTab(tabOrder))
      }
    }
  }, [tabOrder, isInitialized, activeTab])

  //  tab 
  useEffect(() => {
    const handleSwitchToOutline = () => {
      setActiveTab(TAB_IDS.OUTLINE)
    }
    const handleSwitchToConversations = () => {
      setActiveTab(TAB_IDS.CONVERSATIONS)
    }

    const handleSwitchTab = (e: CustomEvent<{ index: number }>) => {
      const idx = e.detail?.index
      if (typeof idx === "number" && tabOrder[idx]) {
        setActiveTab(tabOrder[idx])
      }
    }

    window.addEventListener("ophel:locateOutline", handleSwitchToOutline)
    window.addEventListener("ophel:searchOutline", handleSwitchToOutline)
    window.addEventListener("ophel:locateConversation", handleSwitchToConversations)
    window.addEventListener("ophel:switchTab", handleSwitchTab as EventListener)

    return () => {
      window.removeEventListener("ophel:locateOutline", handleSwitchToOutline)
      window.removeEventListener("ophel:searchOutline", handleSwitchToOutline)
      window.removeEventListener("ophel:locateConversation", handleSwitchToConversations)
      window.removeEventListener("ophel:switchTab", handleSwitchTab as EventListener)
    }
  }, [tabOrder])

  //  Grok  Claude  keydown 
  //  Grok  Claude 
  useEffect(() => {
    const siteId = adapter?.getSiteId()

    if (isOpen && (siteId === SITE_IDS.GROK || siteId === SITE_IDS.CLAUDE)) {
      const panel = panelRef.current
      if (!panel) {
        return
      }

      const handleKeyDown = (e: KeyboardEvent) => {
        const target = e.target as HTMLElement

        const isInputElement =
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.getAttribute("contenteditable") === "true"

        if (!isInputElement) return

        //  Grok 
        e.stopPropagation()
        e.stopImmediatePropagation()
      }

      //  document
      //  Shadow DOM 
      panel.addEventListener("keydown", handleKeyDown, true)
      panel.addEventListener("keypress", handleKeyDown, true)

      return () => {
        panel.removeEventListener("keydown", handleKeyDown, true)
        panel.removeEventListener("keypress", handleKeyDown, true)
      }
    }
  }, [isOpen, adapter, panelRef])

  // ===  ===
  const anchorPosition = useSyncExternalStore(anchorStore.subscribe, anchorStore.getSnapshot)
  const hasAnchor = anchorPosition !== null

  // ===  ===
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [loadingText, setLoadingText] = useState("")
  const abortLoadingRef = useRef(false)

  //  HistoryLoader 
  const scrollToTop = useCallback(async () => {
    // 
    const OVERLAY_DELAY_MS = 1600
    abortLoadingRef.current = false

    //  AbortController 
    const abortController = new AbortController()
    const checkAbort = () => {
      if (abortLoadingRef.current) {
        abortController.abort()
      }
    }
    const abortCheckInterval = setInterval(checkAbort, 100)

    // 
    let overlayTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      if (!abortLoadingRef.current) {
        setIsLoadingHistory(true)
        setLoadingText(t("loadingHistory"))
      }
    }, OVERLAY_DELAY_MS)

    try {
      const result = await loadHistoryUntil({
        adapter: adapter || null,
        loadAll: true,
        signal: abortController.signal,
        allowShortCircuit: true, // 
        onProgress: (msg) => {
          setLoadingText(`${t("loadingHistory")} ${msg}`)
        },
      })
      anchorStore.set(result.previousScrollTop)

      // 
      if (overlayTimer) {
        clearTimeout(overlayTimer)
        overlayTimer = null
      }
      setIsLoadingHistory(false)
      setLoadingText("")

      // 
      if (result.success && !result.silent) {
        showToast(t("historyLoaded"), 2000)
      }
    } finally {
      clearInterval(abortCheckInterval)
      if (overlayTimer) {
        clearTimeout(overlayTimer)
      }
    }
  }, [adapter])

  // 
  const stopLoading = useCallback(() => {
    abortLoadingRef.current = true
  }, [])

  // 
  const scrollToBottom = useCallback(async () => {
    const { previousScrollTop } = await smartScrollToBottom(adapter || null)
    anchorStore.set(previousScrollTop)
  }, [adapter])

  // 
  const goToAnchor = useCallback(async () => {
    const savedAnchor = anchorStore.get()
    if (savedAnchor === null) return

    // 
    const scrollInfo = await getScrollInfo(adapter || null)
    const currentPos = scrollInfo.scrollTop

    // 
    await smartScrollTo(adapter || null, savedAnchor)

    // 
    anchorStore.set(currentPos)
  }, [adapter])

  // 
  const saveAnchor = useCallback(async () => {
    const scrollInfo = await getScrollInfo(adapter || null)
    anchorStore.set(scrollInfo.scrollTop)
  }, [adapter])

  if (!isOpen) return null

  //  Tab header  tab 
  const visibleTabs = tabOrder.filter((tabId) => {
    if (tabId === TAB_IDS.SETTINGS) return false //  header 
    //  Tab  enabled 
    if (tabId === TAB_IDS.PROMPTS && currentSettings.features?.prompts?.enabled === false)
      return false
    if (
      tabId === TAB_IDS.CONVERSATIONS &&
      currentSettings.features?.conversations?.enabled === false
    )
      return false
    if (tabId === TAB_IDS.OUTLINE && currentSettings.features?.outline?.enabled === false)
      return false
    return true
  })

  // 
  const getThemeIcon = () => {
    if (themeMode === "dark") {
      // 
      return <ThemeLightIcon size={14} />
    }
    // 
    return <ThemeDarkIcon size={14} />
  }

  return (
    <>
      {/*  */}
      <LoadingOverlay isVisible={isLoadingHistory} text={loadingText} onStop={stopLoading} />
      <div
        ref={panelRef}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className={`gh-main-panel gh-interactive ${edgeSnapState ? `edge-snapped-${edgeSnapState}` : ""} ${isEdgePeeking ? "edge-peek" : ""}`}
        style={{
          position: "fixed",
          top: "50%",
          //  left  right
          ...(defaultPosition === "left"
            ? { left: `${defaultEdgeDistance}px`, right: "auto" }
            : { right: `${defaultEdgeDistance}px`, left: "auto" }),
          transform: "translateY(-50%)",
          width: `${currentSettings.panel?.width ?? 320}px`,
          height: `${currentSettings.panel?.height ?? 85}vh`,
          // @ts-expect-error -  CSS 
          "--panel-width": `${currentSettings.panel?.width ?? 320}px`,
          minHeight: "500px",
          backgroundColor: "var(--gh-bg, #ffffff)",
          backgroundImage: "var(--gh-bg-image, none)",
          backgroundBlendMode: "overlay",
          animation: "var(--gh-bg-animation, none)",
          borderRadius: "12px",
          boxShadow: "var(--gh-shadow, 0 10px 40px rgba(0,0,0,0.15))",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          border: "1px solid var(--gh-border, #e5e7eb)",
          zIndex: 9999,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          //  useDraggable  DOM  React state
        }}>
        {/*  CSS  ID  */}
        {(() => {
          const siteId = adapter?.getSiteId() || "_default"
          const siteTheme =
            settings.theme?.sites?.[siteId as keyof typeof settings.theme.sites] ||
            settings.theme?.sites?._default
          const resolvedMode = themeMode || (siteTheme?.mode === "dark" ? "dark" : "light")
          const styleId =
            resolvedMode === "light" ? siteTheme?.lightStyleId : siteTheme?.darkStyleId

          //  customStyles 
          const customStyles = settings.theme?.customStyles
          if (Array.isArray(customStyles)) {
            const customStyle = customStyles.find((s) => s.id === styleId)
            if (customStyle) {
              return <style>{customStyle.css}</style>
            }
          }
          return null
        })()}

        {/* Header -  */}
        <div
          ref={headerRef}
          className="gh-panel-header"
          style={{
            padding: "12px 14px",
            borderRadius: "12px 12px 0 0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            // cursor  CSS (.gh-panel-header)  pointer
            userSelect: "none",
          }}>
          {/*  +  */}
          <Tooltip content={t("aboutPageDesc")}>
            <div
              style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}
              onDoubleClick={() => {
                //  TabManager
                window.postMessage({ type: "GH_PRIVACY_TOGGLE" }, window.location.origin)
              }}>
              <span style={{ fontSize: "16px" }}>✨</span>
              <span style={{ fontSize: "15px", fontWeight: 600 }}>{t("panelTitle")}</span>
            </div>
          </Tooltip>

          {/*  -  gh-panel-controls  */}
          <div
            className="gh-panel-controls"
            style={{ display: "flex", gap: "4px", alignItems: "center" }}>
            {/*  */}
            {onThemeToggle && (
              <Tooltip content={t("toggleTheme")}>
                <button
                  onClick={onThemeToggle}
                  style={{
                    background: "var(--gh-glass-bg, rgba(255,255,255,0.2))",
                    border: "none",
                    color: "var(--gh-glass-text, white)",
                    width: "24px",
                    height: "24px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "14px",
                    transition: "all 0.2s",
                  }}>
                  {getThemeIcon()}
                </button>
              </Tooltip>
            )}

            {/*  */}
            <Tooltip content={t("newTabTooltip") || ""}>
              <button
                onClick={() => window.open(window.location.origin, "_blank")}
                style={{
                  background: "var(--gh-glass-bg, rgba(255,255,255,0.2))",
                  border: "none",
                  color: "var(--gh-glass-text, white)",
                  width: "24px",
                  height: "24px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "16px",
                  transition: "all 0.2s",
                }}>
                <NewTabIcon size={14} />
              </button>
            </Tooltip>

            {/*  -  */}
            <Tooltip content={t("tabSettings")}>
              <button
                onClick={() => {
                  onOpenSettings?.()
                }}
                style={{
                  background: "var(--gh-glass-bg, rgba(255,255,255,0.2))",
                  border: "none",
                  color: "var(--gh-glass-text, white)",
                  width: "24px",
                  height: "24px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "14px",
                  transition: "all 0.2s",
                }}>
                <SettingsIcon size={14} />
              </button>
            </Tooltip>

            {/*  -  Tab  */}
            <Tooltip
              content={
                activeTab === TAB_IDS.OUTLINE
                  ? t("refreshOutline")
                  : activeTab === TAB_IDS.PROMPTS
                    ? t("refreshPrompts")
                    : activeTab === TAB_IDS.CONVERSATIONS
                      ? t("refreshConversations")
                      : t("refresh")
              }>
              <button
                onClick={() => {
                  //  Tab 
                  if (activeTab === TAB_IDS.OUTLINE) {
                    outlineManager?.refresh()
                  } else if (activeTab === TAB_IDS.PROMPTS) {
                    //  Zustand store 
                    //  UI 
                    promptManager?.init()
                  } else if (activeTab === TAB_IDS.CONVERSATIONS) {
                    //  UI
                    conversationManager?.notifyDataChange()
                  }
                  // settings 
                }}
                style={{
                  background: "var(--gh-glass-bg, rgba(255,255,255,0.2))",
                  border: "none",
                  color: "var(--gh-glass-text, white)",
                  width: "24px",
                  height: "24px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "14px",
                  transition: "all 0.2s",
                }}>
                <RefreshIcon size={14} />
              </button>
            </Tooltip>

            {/*  */}
            <Tooltip content={t("collapse")}>
              <button
                onClick={onClose}
                style={{
                  background: "var(--gh-glass-bg, rgba(255,255,255,0.2))",
                  border: "none",
                  color: "var(--gh-glass-text, white)",
                  width: "24px",
                  height: "24px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "18px",
                  fontWeight: 600,
                  transition: "all 0.2s",
                }}>
                <MinimizeIcon size={14} />
              </button>
            </Tooltip>
          </div>
        </div>

        {/* Tabs -  */}
        <div
          className="gh-panel-tabs"
          style={{
            display: "flex",
            borderBottom: "1px solid var(--gh-border, #e5e7eb)",
            padding: "0",
            background: "var(--gh-bg-secondary, #f9fafb)",
          }}>
          {visibleTabs.map((tab) => {
            let IconComp: React.FC<{ size?: number }> | null = null
            if (tab === TAB_IDS.OUTLINE) IconComp = OutlineIcon
            else if (tab === TAB_IDS.PROMPTS) IconComp = PromptIcon
            else if (tab === TAB_IDS.CONVERSATIONS) IconComp = ConversationIcon

            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1,
                  padding: "10px 8px",
                  border: "none",
                  background: "transparent",
                  borderBottom:
                    activeTab === tab
                      ? "3px solid var(--gh-primary, #4285f4)"
                      : "3px solid transparent",
                  color:
                    activeTab === tab
                      ? "var(--gh-primary, #4285f4)"
                      : "var(--gh-text-secondary, #6b7280)",
                  fontWeight: activeTab === tab ? 600 : 400,
                  cursor: "pointer",
                  fontSize: "13px",
                  whiteSpace: "nowrap",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "4px",
                  transition: "all 0.2s",
                }}>
                <span style={{ display: "flex", alignItems: "center" }}>
                  {IconComp && <IconComp size={16} />}
                </span>
                <span>{t(`tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`)}</span>
              </button>
            )
          })}
        </div>

        {/* Content -  */}
        <div
          className="gh-panel-content"
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "0",
            scrollbarWidth: "none", // Firefox
            msOverflowStyle: "none", // IE/Edge
          }}>
          {activeTab === TAB_IDS.PROMPTS && (
            <PromptsTab
              manager={promptManager}
              selectedPromptId={selectedPromptId}
              onPromptSelect={onPromptSelect}
            />
          )}
          {activeTab === TAB_IDS.CONVERSATIONS && (
            <ConversationsTab
              manager={conversationManager}
              onInteractionStateChange={onInteractionStateChange}
            />
          )}
          {activeTab === TAB_IDS.OUTLINE && (
            <OutlineTab manager={outlineManager} onJumpBefore={saveAnchor} />
          )}
        </div>

        {/* Footer -  */}
        <div
          className="gh-panel-footer"
          style={{
            display: "flex",
            justifyContent: "space-around",
            alignItems: "center",
            padding: "10px 16px",
            borderTop: "1px solid var(--gh-border, #e5e7eb)",
            background: "var(--gh-bg-secondary, #f9fafb)",
          }}>
          {/*  */}
          <Tooltip content={t("scrollTop")} triggerStyle={{ flex: 1, maxWidth: "120px" }}>
            <button
              className="gh-interactive scroll-nav-btn"
              onClick={scrollToTop}
              style={{
                width: "100%",
                height: "32px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "4px",
                background: "var(--gh-header-bg)",
                color: "var(--gh-footer-text, var(--gh-text-on-primary, white))",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "14px",
                transition: "transform 0.2s, box-shadow 0.2s",
                boxShadow: "var(--gh-btn-shadow)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-1px)"
                e.currentTarget.style.boxShadow = "var(--gh-btn-shadow-hover)"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)"
                e.currentTarget.style.boxShadow = "var(--gh-btn-shadow)"
              }}>
              <ScrollTopIcon size={14} />
              <span>{t("scrollTop")}</span>
            </button>
          </Tooltip>

          {/*  */}
          <Tooltip
            content={hasAnchor ? t("jumpToAnchor") : ""}
            triggerStyle={{ flex: "0 0 32px" }}>
            <button
              className="gh-interactive scroll-nav-btn anchor-btn"
              onClick={goToAnchor}
              disabled={!hasAnchor}
              style={{
                width: "32px",
                height: "32px",
                background: "var(--gh-header-bg)",
                color: "var(--gh-footer-text, var(--gh-text-on-primary, white))",
                border: "none",
                borderRadius: "50%",
                padding: 0,
                cursor: hasAnchor ? "pointer" : "default",
                fontSize: "14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "transform 0.2s, box-shadow 0.2s",
                boxShadow: "var(--gh-btn-shadow)",
                opacity: hasAnchor ? 1 : 0.4,
              }}
              onMouseEnter={(e) => {
                if (hasAnchor) {
                  e.currentTarget.style.transform = "scale(1.1)"
                  e.currentTarget.style.boxShadow = "var(--gh-btn-shadow-hover)"
                  // 
                  const div = e.currentTarget.querySelector("div")
                  if (div) div.style.transform = "rotate(360deg)"
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)"
                e.currentTarget.style.boxShadow = hasAnchor ? "var(--gh-btn-shadow)" : "none"
                // 
                const div = e.currentTarget.querySelector("div")
                if (div) div.style.transform = "rotate(0deg)"
              }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
                }}>
                <AnchorIcon size={14} />
              </div>
            </button>
          </Tooltip>

          {/*  */}
          <Tooltip content={t("scrollBottom")} triggerStyle={{ flex: 1, maxWidth: "120px" }}>
            <button
              className="gh-interactive scroll-nav-btn"
              onClick={scrollToBottom}
              style={{
                width: "100%",
                height: "32px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "4px",
                background: "var(--gh-header-bg)",
                color: "var(--gh-footer-text, var(--gh-text-on-primary, white))",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "14px",
                transition: "transform 0.2s, box-shadow 0.2s",
                boxShadow: "var(--gh-btn-shadow)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-1px)"
                e.currentTarget.style.boxShadow = "var(--gh-btn-shadow-hover)"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)"
                e.currentTarget.style.boxShadow = "var(--gh-btn-shadow)"
              }}>
              <ScrollBottomIcon size={14} />
              <span>{t("scrollBottom")}</span>
            </button>
          </Tooltip>
        </div>
      </div>
    </>
  )
}
