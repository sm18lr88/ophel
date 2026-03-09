/**
 * Reading History Manager
 *
 */

import type { AnchorData, SiteAdapter } from "~adapters/base"
import {
  getReadingHistoryStore,
  useReadingHistoryStore,
  type ReadingPosition,
} from "~stores/reading-history-store"
import { loadHistoryUntil } from "~utils/history-loader"
import { t } from "~utils/i18n"
import { smartScrollTo } from "~utils/scroll-helper"
import type { Settings } from "~utils/storage"

export type { ReadingPosition }

export class ReadingHistoryManager {
  private adapter: SiteAdapter
  private settings: Settings["readingHistory"]

  private isRecording = false
  private isRestoring = false
  private currentSessionId: string | null = null
  private listeningContainer: Element | null = null
  private scrollHandler: ((e: Event) => void) | null = null
  private userInteractionHandler: ((e: Event) => void) | null = null
  private lastSaveTime = 0
  private ignoreScrollUntil = 0
  private positionKeeperRaF = 0
  private keepPositionEndTime = 0

  public restoredTop: number | undefined

  constructor(adapter: SiteAdapter, settings: Settings["readingHistory"]) {
    this.adapter = adapter
    this.settings = settings
  }

  /**
   */
  async waitForHydration() {
    if (!useReadingHistoryStore.getState()._hasHydrated) {
      await new Promise<void>((resolve) => {
        const unsubscribe = useReadingHistoryStore.subscribe((state) => {
          if (state._hasHydrated) {
            unsubscribe()
            resolve()
          }
        })
      })
    }
  }

  updateSettings(settings: Settings["readingHistory"]) {
    this.settings = settings
    if (!this.settings.persistence && this.isRecording) {
      this.stopRecording()
    } else if (this.settings.persistence && !this.isRecording) {
      this.startRecording()
    }
  }

  startRecording() {
    if (this.isRecording) return
    this.isRecording = true
    this.currentSessionId = this.adapter.getSessionId()

    this.scrollHandler = (e: Event) => this.handleScroll(e)

    const container = this.adapter.getScrollContainer()
    if (container) {
      container.addEventListener("scroll", this.scrollHandler, {
        passive: true,
      })
      this.listeningContainer = container
    }

    this.ignoreScrollUntil = Date.now() + 2000

    this.userInteractionHandler = (e: Event) => {
      if (e.type === "keydown") {
        const key = (e as KeyboardEvent).key
        const scrollKeys = ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "]
        if (!scrollKeys.includes(key)) return
      }

      if (this.ignoreScrollUntil > 0) {
        this.ignoreScrollUntil = 0
      }
      if (this.positionKeeperRaF) {
        this.stopPositionKeeper()
      }
    }
    window.addEventListener("wheel", this.userInteractionHandler, { passive: true })
    window.addEventListener("touchmove", this.userInteractionHandler, { passive: true })
    window.addEventListener("keydown", this.userInteractionHandler, { passive: true })

    window.addEventListener("scroll", this.scrollHandler, {
      capture: true,
      passive: true,
    })

    window.addEventListener("visibilitychange", this.scrollHandler)
    window.addEventListener("beforeunload", this.scrollHandler)
  }

  stopRecording() {
    if (!this.isRecording) return
    this.isRecording = false

    if (this.scrollHandler) {
      if (this.listeningContainer) {
        this.listeningContainer.removeEventListener("scroll", this.scrollHandler)
        this.listeningContainer = null
      }
      window.removeEventListener("scroll", this.scrollHandler, {
        capture: true,
      })
      window.removeEventListener("visibilitychange", this.scrollHandler)
      window.removeEventListener("beforeunload", this.scrollHandler)
      this.scrollHandler = null
    }

    if (this.userInteractionHandler) {
      window.removeEventListener("wheel", this.userInteractionHandler)
      window.removeEventListener("touchmove", this.userInteractionHandler)
      window.removeEventListener("keydown", this.userInteractionHandler)
      this.userInteractionHandler = null
    }

    this.stopPositionKeeper()
  }

  restartRecording() {
    this.stopRecording()
    this.startRecording()
  }

  private handleScroll(e: Event) {
    if (!this.settings.persistence) return

    if (e.type === "scroll") {
      const container = this.adapter.getScrollContainer()
      const target = e.target as HTMLElement | Document | Window
      if (container && target && target !== document && target !== window && target !== container) {
        return
      }
    }

    const now = Date.now()
    if (
      e.type === "beforeunload" ||
      e.type === "visibilitychange" ||
      now - this.lastSaveTime > 1000
    ) {
      this.saveProgress()
      this.lastSaveTime = now
    }
  }

  private getKey(): string {
    const sessionId = this.adapter.getSessionId() || "unknown"
    const siteId = this.adapter.getSiteId()
    return `${siteId}:${sessionId}`
  }

  private saveProgress() {
    if (!this.isRecording) return
    if (this.isRestoring) {
      return
    }
    if (this.currentSessionId && this.adapter.getSessionId() !== this.currentSessionId) {
      return
    }
    if (Date.now() < this.ignoreScrollUntil) {
      return
    }
    if (this.adapter.isNewConversation()) {
      return
    }

    const container = this.adapter.getScrollContainer()
    const scrollTop = container ? container.scrollTop : window.scrollY

    if (scrollTop < 0) {
      if (container) {
        const style = window.getComputedStyle(container)
        if (style.flexDirection !== "column-reverse") {
          return
        }
      } else {
        return
      }
    }

    const key = this.getKey()

    let anchorInfo = {}
    try {
      if (this.adapter.getVisibleAnchorElement) {
        anchorInfo = this.adapter.getVisibleAnchorElement() || {}
      }
    } catch {}

    const data: ReadingPosition = {
      top: scrollTop,
      ts: Date.now(),
      ...anchorInfo,
    }

    getReadingHistoryStore().savePosition(key, data)
  }

  async restoreProgress(onProgress?: (msg: string) => void): Promise<boolean> {
    if (!this.settings.autoRestore) {
      return false
    }

    if (this.adapter.isNewConversation()) {
      return false
    }

    await this.waitForHydration()

    const key = this.getKey()
    const data = getReadingHistoryStore().getPosition(key)

    if (!data) {
      return false
    }

    this.isRestoring = true

    let restoredSuccessfully = false

    try {
      if (data.type && this.adapter.restoreScroll) {
        try {
          const contentRestored = await this.adapter.restoreScroll(data as AnchorData)
          if (contentRestored) {
            const scrollContainer = this.adapter.getScrollContainer() || document.documentElement
            this.restoredTop = (scrollContainer as HTMLElement).scrollTop || window.scrollY
            restoredSuccessfully = true
          }
        } catch {}
      }

      if (!restoredSuccessfully) {
        if (data.top === undefined) {
          return false
        }

        try {
          const result = await loadHistoryUntil({
            adapter: this.adapter,
            loadAll: true,
            onProgress: (msg) => {
              onProgress?.(`${t("exportLoading")} ${msg}`)
            },
          })

          if (!result.success) {
            return false
          }

          const newScrollTop = data.top!

          await smartScrollTo(this.adapter, newScrollTop)
          this.restoredTop = newScrollTop
          restoredSuccessfully = true
        } catch {
          return false
        }
      }

      return restoredSuccessfully
    } finally {
      setTimeout(() => {
        this.isRestoring = false
        if (this.restoredTop !== undefined) {
          this.startPositionKeeper(this.restoredTop, 3000)
        }
      }, 1000)
    }
  }

  cleanup() {
    const days = this.settings.cleanupDays || 7
    getReadingHistoryStore().cleanup(days)
  }

  /**
   */
  private startPositionKeeper(targetTop: number, duration: number) {
    this.stopPositionKeeper()
    this.keepPositionEndTime = Date.now() + duration

    const keepOpen = () => {
      if (Date.now() > this.keepPositionEndTime) {
        this.stopPositionKeeper()
        return
      }

      const container = this.adapter.getScrollContainer()
      if (container) {
        if (Math.abs(container.scrollTop - targetTop) > 5) {
          container.scrollTop = targetTop
        }
      }

      this.positionKeeperRaF = requestAnimationFrame(keepOpen)
    }

    this.positionKeeperRaF = requestAnimationFrame(keepOpen)
  }

  private stopPositionKeeper() {
    if (this.positionKeeperRaF) {
      cancelAnimationFrame(this.positionKeeperRaF)
      this.positionKeeperRaF = 0
      this.keepPositionEndTime = 0
    }
  }
}
