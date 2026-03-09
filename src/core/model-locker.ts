/**
 *
 */

import type { SiteAdapter } from "~adapters/base"

export interface ModelLockSiteConfig {
  enabled: boolean
  keyword: string
}

export class ModelLocker {
  private adapter: SiteAdapter
  private config: ModelLockSiteConfig
  private isLocked = false
  private verifyTimer: ReturnType<typeof setInterval> | null = null
  private configDebounceTimer: ReturnType<typeof setTimeout> | null = null

  constructor(adapter: SiteAdapter, config: ModelLockSiteConfig) {
    this.adapter = adapter
    this.config = config
  }

  updateConfig(config: ModelLockSiteConfig) {
    const wasEnabled = this.config.enabled
    const oldKeyword = this.config.keyword
    this.config = config

    const needsLock =
      (!wasEnabled && config.enabled) || (config.enabled && config.keyword !== oldKeyword)

    if (needsLock) {
      if (this.configDebounceTimer) {
        clearTimeout(this.configDebounceTimer)
      }
      this.configDebounceTimer = setTimeout(() => {
        this.configDebounceTimer = null
        this.isLocked = false
        this.start(50)
      }, 500)
    }
  }

  start(delay = 1500) {
    if (!this.config.enabled || !this.config.keyword) return
    if (this.isLocked) return

    setTimeout(() => {
      if (this.isLocked) return

      this.adapter.lockModel(this.config.keyword, () => {
        this.startVerification()
      })
    }, delay)
  }

  /**
   */
  relock(delay = 300) {
    if (!this.config.enabled || !this.config.keyword) return

    this.stop()
    this.isLocked = false
    this.start(delay)
  }

  /**
   */
  private startVerification() {
    if (this.verifyTimer) {
      clearInterval(this.verifyTimer)
    }

    let verifyAttempts = 0
    let consecutiveSuccess = 0
    const maxVerifyAttempts = 3
    const verifyInterval = 1500

    this.verifyTimer = setInterval(() => {
      verifyAttempts++

      const config = this.adapter.getModelSwitcherConfig(this.config.keyword)
      if (!config) {
        this.finishVerification()
        return
      }

      const selectorBtn = this.adapter.findElementBySelectors(config.selectorButtonSelectors)
      if (!selectorBtn) {
        this.finishVerification()
        return
      }

      const currentText = (selectorBtn.textContent || "").toLowerCase().trim()
      const target = config.targetModelKeyword.toLowerCase().trim()

      if (currentText.includes(target)) {
        consecutiveSuccess++
        if (consecutiveSuccess >= 2 || verifyAttempts >= maxVerifyAttempts) {
          this.finishVerification()
        }
      } else {
        consecutiveSuccess = 0
        if (verifyAttempts <= 2) {
          this.finishVerification()
          this.adapter.lockModel(this.config.keyword, () => {
            this.startVerification()
          })
        } else {
          this.finishVerification()
        }
      }
    }, verifyInterval)
  }

  private finishVerification() {
    this.isLocked = true
    if (this.verifyTimer) {
      clearInterval(this.verifyTimer)
      this.verifyTimer = null
    }
  }

  stop() {
    if (this.configDebounceTimer) {
      clearTimeout(this.configDebounceTimer)
      this.configDebounceTimer = null
    }
    if (this.verifyTimer) {
      clearInterval(this.verifyTimer)
      this.verifyTimer = null
    }
    this.isLocked = true
  }
}
