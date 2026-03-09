import { type SiteAdapter } from "~adapters/base"
import { platform } from "~platform"
import { t } from "~utils/i18n"
import {
  EVENT_MONITOR_COMPLETE,
  EVENT_MONITOR_INIT,
  EVENT_MONITOR_START,
  EVENT_PRIVACY_TOGGLE,
} from "~utils/messaging"
import { type Settings } from "~utils/storage"
import { showToast } from "~utils/toast"

const NOTIFICATION_SOUND_PATH = "assets/streaming-complete-v2.mp3"

export class TabManager {
  private adapter: SiteAdapter
  private settings: Settings["tab"]
  private isRunning = false
  private intervalId: NodeJS.Timeout | null = null

  private aiState: "idle" | "generating" | "completed" = "idle"
  private lastAiState: "idle" | "generating" | "completed" = "idle"

  private userSawCompletion = false

  private lastSessionName: string | null = null

  private notificationAudio: HTMLAudioElement | null = null

  private boundHandleMessage: (event: MessageEvent) => void
  private boundVisibilityHandler: () => void
  private boundFocusHandler: () => void
  private boundBlurHandler: () => void

  constructor(adapter: SiteAdapter, settings: Settings["tab"]) {
    this.adapter = adapter
    this.settings = settings

    this.boundHandleMessage = this.handleMessage.bind(this)
    this.boundVisibilityHandler = this.onVisibilityChange.bind(this)
    this.boundFocusHandler = this.onWindowFocus.bind(this)
    this.boundBlurHandler = this.onWindowBlur.bind(this)

    // Listen to monitor messages from Main World
    window.addEventListener("message", this.boundHandleMessage)

    document.addEventListener("visibilitychange", this.boundVisibilityHandler)
    window.addEventListener("focus", this.boundFocusHandler)
    window.addEventListener("blur", this.boundBlurHandler)
  }

  updateSettings(settings: Settings["tab"]) {
    const oldInterval = this.settings.renameInterval
    this.settings = settings

    if (this.settings.autoRename && !this.isRunning) {
      this.start()
    } else if (!this.settings.autoRename && this.isRunning) {
      this.stop()
    }

    if (this.isRunning && oldInterval !== this.settings.renameInterval) {
      this.setInterval(this.settings.renameInterval || 5)
    }

    if (this.isRunning) {
      this.updateTabName(true)
    }
  }

  start() {
    if (!this.settings.autoRename) return
    if (this.isRunning) return

    if (this.adapter.supportsTabRename && !this.adapter.supportsTabRename()) {
      return
    }

    this.isRunning = true

    this.updateTabName()

    const intervalMs = (this.settings.renameInterval || 5) * 1000
    this.intervalId = setInterval(() => this.updateTabName(), intervalMs)

    // Init Monitor
    const config = this.adapter.getNetworkMonitorConfig
      ? this.adapter.getNetworkMonitorConfig()
      : null
    if (config) {
      window.postMessage(
        {
          type: EVENT_MONITOR_INIT,
          payload: {
            urlPatterns: config.urlPatterns,
            silenceThreshold: config.silenceThreshold,
          },
        },
        window.location.origin,
      )
    }
  }

  stop() {
    if (!this.isRunning) return

    this.isRunning = false

    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  /**
   */
  destroy() {
    this.stop()
    window.removeEventListener("message", this.boundHandleMessage)
    document.removeEventListener("visibilitychange", this.boundVisibilityHandler)
    window.removeEventListener("focus", this.boundFocusHandler)
    window.removeEventListener("blur", this.boundBlurHandler)
  }

  /**
   */
  setInterval(intervalSeconds: number) {
    if (!this.isRunning) return

    const intervalMs = intervalSeconds * 1000
    if (this.intervalId) {
      clearInterval(this.intervalId)
    }
    this.intervalId = setInterval(() => this.updateTabName(), intervalMs)
  }

  /**
   */
  togglePrivacyMode(): boolean {
    this.settings.privacyMode = !this.settings.privacyMode
    this.updateTabName(true)
    return this.settings.privacyMode
  }

  /**
   */
  resetSessionCache() {
    this.lastSessionName = null
  }

  /**
   */
  updateTabName(force = false) {
    if (!this.isRunning && !force) return

    if (this.adapter.supportsTabRename && !this.adapter.supportsTabRename()) {
      return
    }

    if (this.settings.privacyMode) {
      const privacyTitle = this.settings.privacyTitle || "Google"
      if (document.title !== privacyTitle) {
        document.title = privacyTitle
      }
      return
    }

    const sessionName = this.getCleanSessionName()

    const isGenerating = this.isCurrentlyGenerating()

    if (
      this.lastAiState === "generating" &&
      !isGenerating &&
      this.isUserAway() &&
      this.aiState !== "completed"
    ) {
      this.sendCompletionNotification()
    }
    this.lastAiState = isGenerating ? "generating" : "idle"

    const statusPrefix = this.settings.showStatus !== false ? (isGenerating ? "⏳ " : "✅ ") : ""

    const siteName = this.adapter.getName()
    const format = this.settings.titleFormat || "{status}{title}"

    const modelName = format.includes("{model}") ? this.adapter.getModelName?.() || "" : ""

    let finalTitle = format
      .replace("{status}", statusPrefix)
      .replace("{title}", sessionName || siteName)
      .replace("{model}", modelName ? `[${modelName}] ` : "")
      .replace("{site}", siteName)
      .replace(/\s+/g, " ")
      .trim()

    if (finalTitle && (force || finalTitle !== document.title)) {
      document.title = finalTitle
    }
  }

  /**
   */
  private getCleanSessionName(): string | null {
    if (this.adapter.isNewConversation?.()) {
      this.lastSessionName = null
      return null
    }

    let sessionName = this.adapter.getConversationTitle?.() || this.adapter.getSessionName?.()

    const isPolluted = (name: string | null): boolean => {
      if (!name) return false
      if (/^[⏳✅]/.test(name)) return true
      if (/\[[\w\s.]+\]/.test(name)) return true
      if (name === (this.settings.privacyTitle || "Google")) return true
      return false
    }

    if (sessionName && !isPolluted(sessionName)) {
      this.lastSessionName = sessionName
      return sessionName
    }

    return this.lastSessionName
  }

  /**
   */
  private isCurrentlyGenerating(): boolean {
    if (this.aiState === "completed") return false
    return this.aiState === "generating" || (this.adapter.isGenerating?.() ?? false)
  }

  private handleMessage(event: MessageEvent) {
    if (event.origin !== window.location.origin) return
    if (event.source !== window && event.origin !== window.location.origin) return

    const data = event.data
    if (!data || typeof data !== "object") return

    const { type } = data

    if (type === EVENT_MONITOR_START) {
      this.lastAiState = this.aiState
      this.aiState = "generating"
      this.updateTabName()
    } else if (type === EVENT_MONITOR_COMPLETE) {
      this.onAiComplete()
    } else if (type === EVENT_PRIVACY_TOGGLE) {
      const isPrivacy = this.togglePrivacyMode()
      setTimeout(() => {
        showToast(isPrivacy ? "Privacy mode enabled" : "Privacy mode disabled", 2000)
      }, 0)
    }
  }

  /**
   */
  private isUserAway(): boolean {
    const hidden = document.hidden
    const hasFocus = document.hasFocus()
    const notVisible = document.visibilityState !== "visible"

    return hidden || !hasFocus || notVisible
  }

  /**
   */
  private onVisibilityChange() {
    const isAway = this.isUserAway()

    if (this.aiState === "generating" && !isAway) {
      if (this.adapter.isGenerating && !this.adapter.isGenerating()) {
        this.userSawCompletion = true
      }
    }
  }

  /**
   */
  private onWindowFocus() {
    if (this.aiState === "generating") {
      if (this.adapter.isGenerating && !this.adapter.isGenerating()) {
        this.userSawCompletion = true
      }
    }
  }

  /**
   */
  private onWindowBlur() {}

  /**
   */
  private onAiComplete() {
    const wasGenerating = this.aiState === "generating"
    this.lastAiState = this.aiState
    this.aiState = "completed"

    const notifyWhenFocused = this.settings.notifyWhenFocused
    const isAway = this.isUserAway()
    const shouldNotify = wasGenerating && !this.userSawCompletion && (isAway || notifyWhenFocused)

    if (shouldNotify) {
      this.sendCompletionNotification()
    }

    this.userSawCompletion = false

    this.updateTabName(true)
  }

  /**
   */
  private sendCompletionNotification() {
    if (this.settings.showNotification) {
      try {
        const siteName = this.adapter.getName()
        const title = t("notificationTitle").replace("{site}", siteName)
        const message =
          this.lastSessionName || this.adapter.getConversationTitle?.() || t("notificationBody")
        platform.notify({ title, message })
      } catch (e) {
        console.error("[TabManager] Notification dispatch failed:", e)
      }
    }

    if (this.settings.notificationSound) {
      this.playNotificationSound()
    }

    if (this.settings.autoFocus) {
      platform.focusWindow()
    }
  }

  /**
   */
  private playNotificationSound() {
    const audioUrl = chrome.runtime.getURL(NOTIFICATION_SOUND_PATH)
    this.playAudioFromUrl(audioUrl)
  }

  /**
   */
  private playAudioFromUrl(url: string) {
    try {
      if (!this.notificationAudio) {
        this.notificationAudio = new Audio()
      }
      const volume = this.settings.notificationVolume ?? 0.5
      this.notificationAudio.volume = Math.max(0.1, Math.min(1.0, volume))
      this.notificationAudio.src = url
      this.notificationAudio.currentTime = 0
      this.notificationAudio.play().catch(() => {})
    } catch (e) {
      console.error("[TabManager] Audio initialization failed:", e)
    }
  }

  /**
   */
  isActive(): boolean {
    return this.isRunning
  }
}
