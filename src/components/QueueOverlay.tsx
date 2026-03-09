/**
 * Queue Overlay - Ghost Overlay UI
 *
 * 
 *  DOM  position: fixed 
 *  settings.features.prompts.promptQueue  true 
 */

import React, { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

import type { SiteAdapter } from "~adapters/base"
import { CleanupIcon, PromptIcon } from "~components/icons"
import type { QueueDispatcher } from "~core/queue-dispatcher"
import { useSettingsStore } from "~stores/settings-store"
import { useQueueItems, useQueueStore } from "~stores/queue-store"
import { t } from "~utils/i18n"

import "~styles/queue-overlay.css"

interface QueueOverlayProps {
  adapter: SiteAdapter
  dispatcher: QueueDispatcher
}

export const QueueOverlay: React.FC<QueueOverlayProps> = ({ adapter, dispatcher }) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [inputValue, setInputValue] = useState("")
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const [position, setPosition] = useState<{
    bottom: number
    right: number
    width: number
  } | null>(null)

  const items = useQueueItems()
  const store = useQueueStore()
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const pendingCount = items.filter((i) => i.status === "pending").length
  const activeCount = items.filter((i) => i.status === "pending" || i.status === "sending").length
  const displayCount = items.filter((i) => i.status === "pending" || i.status === "sending").length

  const submitShortcut = useSettingsStore(
    (state) => state.settings.features?.prompts?.submitShortcut ?? "enter",
  )

  const shortcuts = useSettingsStore((state) => state.settings?.shortcuts)
  const queueBinding = shortcuts?.keybindings?.togglePromptQueue

  const shortcutText = React.useMemo(() => {
    if (queueBinding === null) return ""
    if (queueBinding) {
      const isMac = navigator.userAgent.toLowerCase().includes("mac")
      const parts = []
      if (queueBinding.ctrl) parts.push(isMac ? "⌃" : "Ctrl")
      if (queueBinding.alt) parts.push(isMac ? "⌥" : "Alt")
      if (queueBinding.shift) parts.push(isMac ? "⇧" : "Shift")
      if (queueBinding.meta) parts.push(isMac ? "⌘" : "Win")

      const keyMap: Record<string, string> = {
        ArrowUp: "↑",
        ArrowDown: "↓",
        ArrowLeft: "←",
        ArrowRight: "→",
        Enter: "↵",
        Escape: "Esc",
      }

      const displayKey = keyMap[queueBinding.key] || queueBinding.key.toUpperCase()
      parts.push(displayKey)

      return isMac ? parts.join("") : parts.join("+")
    }
    const isMac = navigator.userAgent.toLowerCase().includes("mac")
    return isMac ? "⌥J" : "Alt+J"
  }, [queueBinding])

  // ====================  ====================

  const updatePosition = useCallback(() => {
    const inputEl = adapter.getTextareaElement()

    if (!inputEl) {
      setPosition(null)
      return
    }

    const rect = inputEl.getBoundingClientRect()

    // / 20px 
    //  document.body App 
    //  position: fixed  transform
    //  top/left 

    // 
    //  .ophel-container 

    //  Portal  Shadow DOM 
    //  CSS  overflow:hidden 
    //  Portal  .gh-root 
    //  .gh-root .gh-root  fixed  bottom/right  window 

    // 
    const bottomPos = window.innerHeight - rect.top + 12

    //  bug:  left / right 
    const overlayWidth = Math.min(420, window.innerWidth - 40)
    let leftPos = rect.right - 20 - overlayWidth

    //  left 
    if (leftPos < 20) leftPos = 20

    //  left  right 
    const finalRight = window.innerWidth - (leftPos + overlayWidth)

    setPosition({
      bottom: bottomPos,
      right: finalRight,
      width: overlayWidth,
    })
  }, [adapter])

  // ResizeObserver /
  useEffect(() => {
    updatePosition()

    let observer: ResizeObserver | null = null
    let targetEl: Element | null = null

    const initObserver = () => {
      targetEl = adapter.getTextareaElement()

      if (targetEl) {
        observer = new ResizeObserver(() => {
          updatePosition()
        })
        observer.observe(targetEl)
        if (targetEl.parentElement) {
          observer.observe(targetEl.parentElement) // 
        }
      }
    }

    // 
    initObserver()

    // 
    const intervalId = setInterval(() => {
      updatePosition()
      if (!observer && !targetEl) {
        initObserver()
      }
    }, 2000)

    window.addEventListener("resize", updatePosition)

    return () => {
      clearInterval(intervalId)
      window.removeEventListener("resize", updatePosition)
      if (observer) {
        observer.disconnect()
      }
    }
  }, [updatePosition, adapter])

  // ====================  ====================

  useEffect(() => {
    const intervalId = setInterval(() => {
      setIsGenerating(adapter.isGenerating())
    }, 1000)
    return () => clearInterval(intervalId)
  }, [adapter])

  // ====================  ====================

  useEffect(() => {
    const handleToggle = () => {
      setIsExpanded((prev) => !prev)
    }

    window.addEventListener("ophel:togglePromptQueue", handleToggle)
    return () => window.removeEventListener("ophel:togglePromptQueue", handleToggle)
  }, [])

  // 
  useEffect(() => {
    if (isExpanded && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isExpanded])

  // 
  useEffect(() => {
    if (!isExpanded) return

    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsExpanded(false)
      }
    }

    // 
    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside)
    }, 100)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isExpanded])

  // ====================  ====================

  const handleSubmit = useCallback(async () => {
    const content = inputValue.trim()
    if (!content) return

    setInputValue("")

    if (isGenerating) {
      // AI  -> 
      store.enqueue(content)
      // 
      if (!dispatcher.isRunning()) {
        dispatcher.start()
      }
    } else {
      // AI  -> 
      //  submitPrompt  false
      // 
      await dispatcher.sendImmediately(content, submitShortcut)
    }
  }, [inputValue, isGenerating, store, dispatcher, submitShortcut])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        e.stopPropagation()
        handleSubmit()
      }
      if (e.key === "Escape") {
        e.stopPropagation()
        setIsExpanded(false)
      }
    },
    [handleSubmit],
  )

  const handleRemoveItem = useCallback(
    (id: string) => {
      store.remove(id)
    },
    [store],
  )

  const handleForceSend = useCallback(
    async (id: string, content: string) => {
      // 
      store.remove(id)
      const success = await dispatcher.sendImmediately(content, submitShortcut)
      if (!success) {
        //  fallback
        store.enqueue(content)
        if (!dispatcher.isRunning()) {
          dispatcher.start()
        }
      }
    },
    [store, dispatcher, submitShortcut],
  )

  const handleClearAll = useCallback(() => {
    store.clear()
  }, [store])

  const handleEditClick = useCallback((id: string, content: string) => {
    setEditingItemId(id)
    setEditValue(content)
  }, [])

  const handleEditSave = useCallback(
    (id: string) => {
      if (editValue.trim()) {
        store.updateContent(id, editValue.trim())
      }
      setEditingItemId(null)
    },
    [editValue, store],
  )

  const handleEditCancel = useCallback(() => {
    setEditingItemId(null)
  }, [])

  // 
  const adjustTextareaHeight = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "0px" // Reset first to allow shrinking
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + "px"
    }
  }, [])

  useEffect(() => {
    adjustTextareaHeight()
  }, [inputValue, adjustTextareaHeight])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value)
  }, [])

  // ====================  ====================

  if (!position) return null

  // (top, left)
  //  translate(-100%, -100%) 
  //  CSS 
  // App  .gh-root 
  const targetContainer = document.querySelector(".gh-root") || document.body

  const capsuleStyle: React.CSSProperties = {
    bottom: position.bottom,
    right: position.right,
  }

  const panelStyle: React.CSSProperties = {
    bottom: position.bottom,
    right: position.right,
    width: position.width,
  }

  // 
  if (!isExpanded) {
    return createPortal(
      <div
        className="gh-queue-capsule"
        style={capsuleStyle}
        onClick={() => setIsExpanded(true)}
        title={shortcutText}>
        <span className="gh-queue-capsule-icon">
          <PromptIcon size={14} color="currentColor" />
        </span>
        <span>
          {activeCount > 0 ? t("queueInQueue", { count: String(activeCount) }) : t("queueQuickAsk")}
        </span>
        {activeCount > 0 && <span className="gh-queue-capsule-badge">{activeCount}</span>}
      </div>,
      targetContainer,
    )
  }

  // 
  return createPortal(
    <div className="gh-queue-panel" style={panelStyle} ref={panelRef}>
      {/*  */}
      <div className="gh-queue-header">
        <div className="gh-queue-header-title">
          <span>
            <PromptIcon size={16} color="currentColor" />
          </span>
          <span>{t("queueTitle")}</span>
          {pendingCount > 0 && <span className="gh-queue-capsule-badge">{pendingCount}</span>}
        </div>
        <div className="gh-queue-header-actions">
          {displayCount > 0 && (
            <button
              className="gh-queue-header-btn"
              onClick={handleClearAll}
              title={t("queueClearAll")}>
              <CleanupIcon size={16} color="currentColor" />
            </button>
          )}
          <button className="gh-queue-header-btn" onClick={() => setIsExpanded(false)} title="Esc">
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>

      {/*  */}
      <div className="gh-queue-list">
        {items.filter((i) => i.status === "pending" || i.status === "sending").length === 0 ? (
          <div className="gh-queue-empty">{t("queueEmpty")}</div>
        ) : (
          items
            .filter((i) => i.status === "pending" || i.status === "sending")
            .map((item, index) => (
              <div key={item.id} className="gh-queue-item" data-status={item.status}>
                <span className="gh-queue-item-index">{index + 1}</span>
                {editingItemId === item.id ? (
                  <div className="gh-queue-item-edit-area">
                    <textarea
                      className="gh-queue-item-edit-input"
                      value={editValue}
                      onChange={(e) => {
                        setEditValue(e.target.value)
                        const target = e.target as HTMLTextAreaElement
                        target.style.height = "0px"
                        target.style.height = Math.min(target.scrollHeight, 120) + "px"
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault()
                          handleEditSave(item.id)
                        }
                        if (e.key === "Escape") {
                          handleEditCancel()
                        }
                      }}
                      autoFocus
                    />
                    <div className="gh-queue-item-edit-actions-row">
                      <button
                        className="gh-queue-item-edit-btn-save"
                        onClick={() => handleEditSave(item.id)}
                        title={t("queueEditSave") || ""}>
                        <svg
                          viewBox="0 0 24 24"
                          width="14"
                          height="14"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      </button>
                      <button
                        className="gh-queue-item-edit-btn-cancel"
                        onClick={handleEditCancel}
                        title={t("queueEditCancel") || ""}>
                        <svg
                          viewBox="0 0 24 24"
                          width="14"
                          height="14"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <span className="gh-queue-item-content">{item.content}</span>
                    <div className="gh-queue-item-actions">
                      {item.status === "pending" && (
                        <button
                          className="gh-queue-item-edit"
                          onClick={() => handleEditClick(item.id, item.content)}
                          title={t("queueEdit") || ""}>
                          <svg
                            viewBox="0 0 24 24"
                            width="14"
                            height="14"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                          </svg>
                        </button>
                      )}
                      {item.status === "pending" && (
                        <button
                          className="gh-queue-item-force-send"
                          onClick={() => handleForceSend(item.id, item.content)}
                          title={t("queueForceSend") || "Force Send"}>
                          <svg
                            viewBox="0 0 24 24"
                            width="14"
                            height="14"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round">
                            <line x1="12" y1="19" x2="12" y2="5"></line>
                            <polyline points="5 12 12 5 19 12"></polyline>
                          </svg>
                        </button>
                      )}
                      <button
                        className="gh-queue-item-remove"
                        onClick={() => handleRemoveItem(item.id)}
                        title={t("queueRemove")}>
                        <svg
                          viewBox="0 0 24 24"
                          width="14"
                          height="14"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
        )}
      </div>

      {/*  */}
      <div className="gh-queue-input-area">
        <div className="gh-queue-input-wrapper">
          <textarea
            ref={inputRef}
            className="gh-queue-input"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={isGenerating ? t("queuePlaceholderBusy") : t("queuePlaceholderIdle")}
            rows={1}
          />
          <button
            className="gh-queue-send-btn"
            onClick={handleSubmit}
            disabled={!inputValue.trim()}
            title="Enter">
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5"></line>
              <polyline points="5 12 12 5 19 12"></polyline>
            </svg>
          </button>
        </div>
      </div>

      {/*  */}
      <div className="gh-queue-status">
        <span className="gh-queue-status-dot" data-generating={isGenerating ? "true" : "false"} />
        <span>{isGenerating ? t("queueStatusBusy") : t("queueStatusIdle")}</span>
        <span className="gh-queue-disable-hint" title={t("queueSettingDesc")}>
          ({t("queueDisableHint")})
        </span>
        {shortcutText && <span className="gh-queue-shortcut-hint">{shortcutText}</span>}
      </div>
    </div>,
    targetContainer,
  )
}
