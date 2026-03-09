import { useCallback, useEffect, useRef } from "react"

interface UseDraggableOptions {
  edgeSnapHide?: boolean
  edgeSnapState?: "left" | "right" | null
  snapThreshold?: number
  onEdgeSnap?: (side: "left" | "right") => void
  onUnsnap?: () => void
}

export function useDraggable(options: UseDraggableOptions = {}) {
  const { edgeSnapHide = false, edgeSnapState, snapThreshold = 30, onEdgeSnap, onUnsnap } = options

  const panelRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)

  const isDraggingRef = useRef(false)
  const hasMovedRef = useRef(false)
  const offsetRef = useRef({ x: 0, y: 0 })

  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      if ((e.target as Element).closest(".gh-panel-controls")) return

      const panel = panelRef.current
      if (!panel) return

      e.preventDefault()

      if (edgeSnapState) {
        onUnsnap?.()
      }

      const rect = panel.getBoundingClientRect()

      offsetRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      }

      panel.style.left = rect.left + "px"
      panel.style.top = rect.top + "px"
      panel.style.right = "auto"
      panel.style.transform = "none"

      hasMovedRef.current = false
      isDraggingRef.current = true

      panel.classList.add("dragging")

      document.body.style.userSelect = "none"
    },
    [edgeSnapState, onUnsnap],
  )

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingRef.current) return

    const panel = panelRef.current
    if (!panel) return

    e.preventDefault()
    hasMovedRef.current = true

    panel.style.left = e.clientX - offsetRef.current.x + "px"
    panel.style.top = e.clientY - offsetRef.current.y + "px"
  }, [])

  const handleMouseUp = useCallback(() => {
    if (!isDraggingRef.current) return

    const panel = panelRef.current
    const hasMoved = hasMovedRef.current

    isDraggingRef.current = false

    document.body.style.userSelect = ""

    panel?.classList.remove("dragging")

    if (edgeSnapHide && hasMoved && panel) {
      const rect = panel.getBoundingClientRect()

      if (rect.left < snapThreshold) {
        onEdgeSnap?.("left")
      } else if (window.innerWidth - rect.right < snapThreshold) {
        onEdgeSnap?.("right")
      }
    }
  }, [edgeSnapHide, onEdgeSnap, snapThreshold])

  const clampToViewport = useCallback(() => {
    const panel = panelRef.current
    if (!panel) return

    if (edgeSnapState) return

    const rect = panel.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const margin = 10

    let newLeft = rect.left
    let newTop = rect.top

    if (rect.right > vw) newLeft = vw - rect.width - margin
    if (rect.bottom > vh) newTop = vh - rect.height - margin
    if (rect.left < 0) newLeft = margin
    if (rect.top < 0) newTop = margin

    if (newLeft !== rect.left || newTop !== rect.top) {
      panel.style.left = newLeft + "px"
      panel.style.top = newTop + "px"
      panel.style.right = "auto"
      panel.style.transform = "none"
    }
  }, [edgeSnapState])

  useEffect(() => {
    const header = headerRef.current
    if (!header) return

    header.addEventListener("mousedown", handleMouseDown)
    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)
    window.addEventListener("resize", clampToViewport)

    return () => {
      header.removeEventListener("mousedown", handleMouseDown)
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
      window.removeEventListener("resize", clampToViewport)
    }
  }, [handleMouseDown, handleMouseMove, handleMouseUp, clampToViewport])

  return {
    panelRef,
    headerRef,
  }
}
