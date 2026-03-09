/**
 *
 *
 */

import type { SiteAdapter } from "~adapters/base"
import type { Settings } from "~utils/storage"

export class ScrollLockManager {
  private adapter: SiteAdapter
  private settings: Settings
  private enabled = false

  constructor(adapter: SiteAdapter, settings: Settings) {
    this.adapter = adapter
    this.settings = settings
    this.init()
  }

  updateSettings(settings: Settings) {
    const wasEnabled = this.settings.panel?.preventAutoScroll
    this.settings = settings

    if (!wasEnabled && settings.panel?.preventAutoScroll) {
      this.enable()
    } else if (wasEnabled && !settings.panel?.preventAutoScroll) {
      this.disable()
    }
  }

  private init() {
    if (!this.settings.panel?.preventAutoScroll) {
      return
    }

    this.enable()
  }

  private enable() {
    if (this.enabled) return
    this.enabled = true

    this.toggleMainWorldHijack(true)
  }

  private disable() {
    if (!this.enabled) return
    this.enabled = false

    this.toggleMainWorldHijack(false)
  }

  stop() {
    this.disable()
  }

  /**
   */
  private toggleMainWorldHijack(enabled: boolean) {
    window.postMessage({ type: "OPHEL_SCROLL_LOCK_TOGGLE", enabled }, window.location.origin)
  }
}
