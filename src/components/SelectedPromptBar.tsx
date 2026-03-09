import React, { useCallback, useEffect, useRef, useState } from "react"

import type { SiteAdapter } from "~adapters/base"
import { ClearIcon } from "~components/icons"
import { Tooltip } from "~components/ui/Tooltip"
import { t } from "~utils/i18n"

interface SelectedPromptBarProps {
  title: string
  onClear: () => void
  adapter?: SiteAdapter | null
}

export const SelectedPromptBar: React.FC<SelectedPromptBarProps> = ({
  title,
  onClear,
  adapter,
}) => {
  const [bottomPosition, setBottomPosition] = useState(120)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const observedElementRef = useRef<Element | null>(null)

  // 
  const findInputContainer = useCallback((textarea: HTMLElement): Element => {
    let inputContainer: Element = textarea
    let parent = textarea.parentElement
    for (let i = 0; i < 10 && parent && parent !== document.body; i++) {
      const style = window.getComputedStyle(parent)
      if (style.borderRadius && parseFloat(style.borderRadius) > 0) {
        inputContainer = parent
        break
      }
      parent = parent.parentElement
    }
    return inputContainer
  }, [])

  // 
  const updatePosition = useCallback(() => {
    const textarea = adapter?.getTextareaElement()

    //  DOM 
    if (!textarea || !textarea.isConnected) {
      setBottomPosition(120)
      return
    }

    const inputContainer = findInputContainer(textarea)
    const containerRect = inputContainer.getBoundingClientRect()
    const viewportHeight = window.innerHeight

    //  20px 
    const desiredBottom = viewportHeight - containerRect.top + 20

    //  50px 
    const clampedBottom = Math.max(50, Math.min(desiredBottom, viewportHeight - 50))
    setBottomPosition(clampedBottom)

    //  ResizeObserver 
    if (inputContainer !== observedElementRef.current && resizeObserverRef.current) {
      if (observedElementRef.current) {
        resizeObserverRef.current.unobserve(observedElementRef.current)
      }
      resizeObserverRef.current.observe(inputContainer)
      observedElementRef.current = inputContainer
    }
  }, [adapter, findInputContainer])

  useEffect(() => {
    if (!title) return

    const textarea = adapter?.getTextareaElement()

    //  ResizeObserver 
    resizeObserverRef.current = new ResizeObserver(() => {
      updatePosition()
    })

    // 
    if (textarea) {
      const inputContainer = findInputContainer(textarea)
      resizeObserverRef.current.observe(inputContainer)
      observedElementRef.current = inputContainer
    }

    // 
    updatePosition()

    // 
    const delays = [50, 200, 400]
    const timeoutIds = delays.map((delay) => setTimeout(updatePosition, delay))

    // 
    window.addEventListener("resize", updatePosition)

    return () => {
      window.removeEventListener("resize", updatePosition)
      timeoutIds.forEach((id) => clearTimeout(id))
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect()
        resizeObserverRef.current = null
      }
      observedElementRef.current = null
    }
  }, [title, adapter, findInputContainer, updatePosition])

  if (!title) return null

  return (
    <div
      className="selected-prompt-bar gh-interactive"
      style={{
        position: "fixed",
        bottom: `${bottomPosition}px`,
        left: "50%",
        transform: "translateX(-50%)",
        // 
        background: "var(--gh-brand-gradient)",
        color: "var(--gh-text-on-primary, white)",
        padding: "8px 16px",
        borderRadius: "20px",
        boxShadow: "var(--gh-shadow-brand)",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        zIndex: 999998,
        maxWidth: "80%",
        animation: "slideInUp 0.3s ease",
        userSelect: "none",
        transition: "bottom 0.2s ease",
      }}>
      <style>{`
        @keyframes slideInUp {
          from {
            transform: translate(-50%, 20px);
            opacity: 0;
          }
          to {
            transform: translate(-50%, 0);
            opacity: 1;
          }
        }
      `}</style>
      <span
        style={{
          fontSize: "12px",
          color: "var(--gh-text-on-primary, rgba(255,255,255,0.8))",
          whiteSpace: "nowrap",
          userSelect: "none",
        }}>
        {t("currentPrompt") || ""}
      </span>
      <Tooltip content={title}>
        <span
          className="selected-prompt-text"
          style={{
            fontSize: "13px",
            fontWeight: 500,
            color: "var(--gh-text-on-primary, white)",
            maxWidth: "300px",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            userSelect: "none",
          }}>
          {title}
        </span>
      </Tooltip>
      <Tooltip content={t("clear") || ""}>
        <button
          className="clear-prompt-btn"
          onClick={onClear}
          style={{
            background: "var(--gh-glass-bg, rgba(255,255,255,0.2))",
            border: "none",
            color: "var(--gh-text-on-primary, white)",
            width: "20px",
            height: "20px",
            borderRadius: "50%",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "14px",
            lineHeight: "1",
            padding: 0,
            marginLeft: "4px",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--gh-glass-bg-hover, rgba(255,255,255,0.3))"
            e.currentTarget.style.transform = "scale(1.1)"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "var(--gh-glass-bg, rgba(255,255,255,0.2))"
            e.currentTarget.style.transform = "scale(1)"
          }}>
          <ClearIcon size={14} />
        </button>
      </Tooltip>
    </div>
  )
}
