/**
 *
 */

import type { SiteAdapter } from "~adapters/base"
import type { PromptManager } from "~core/prompt-manager"
import { useSettingsStore } from "~stores/settings-store"
import { useQueueStore } from "~stores/queue-store"

export class QueueDispatcher {
  private adapter: SiteAdapter
  private promptManager: PromptManager
  private intervalId: ReturnType<typeof setInterval> | null = null
  private idleCount = 0
  private readonly IDLE_THRESHOLD = 2
  private readonly POLL_INTERVAL = 1000

  constructor(adapter: SiteAdapter, promptManager: PromptManager) {
    this.adapter = adapter
    this.promptManager = promptManager
  }

  /**
   */
  start(): void {
    if (this.intervalId) return
    this.idleCount = 0
    this.intervalId = setInterval(() => this.tick(), this.POLL_INTERVAL)
  }

  /**
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.idleCount = 0
  }

  /**
   */
  isRunning(): boolean {
    return this.intervalId !== null
  }

  /**
   */
  private async tick(): Promise<void> {
    const state = useQueueStore.getState()

    const pendingItems = state.items.filter((i) => i.status === "pending")
    if (pendingItems.length === 0 || state.isPaused) {
      this.idleCount = 0
      return
    }

    const sendingItems = state.items.filter((i) => i.status === "sending")
    if (sendingItems.length > 0) {
      this.idleCount = 0
      return
    }

    const isGenerating = this.adapter.isGenerating()

    if (isGenerating) {
      this.idleCount = 0
      return
    }

    this.idleCount++

    if (this.idleCount >= this.IDLE_THRESHOLD) {
      this.idleCount = 0
      await this.dispatchNext()
    }
  }

  /**
   */
  private async dispatchNext(): Promise<void> {
    const store = useQueueStore.getState()
    const item = store.dequeue()
    if (!item) return

    try {
      const insertOk = await this.promptManager.insertPrompt(item.content)
      if (!insertOk) {
        store.updateStatus(item.id, "failed")
        return
      }

      const submitShortcut =
        useSettingsStore.getState().settings.features?.prompts?.submitShortcut ?? "enter"

      const submitOk = await this.promptManager.submitPrompt(submitShortcut)
      if (!submitOk) {
        store.updateStatus(item.id, "failed")
        return
      }

      store.updateStatus(item.id, "sent")
    } catch (error) {
      console.error("[QueueDispatcher] Send failed:", error)
      store.updateStatus(item.id, "failed")
    }
  }

  /**
   */
  async sendImmediately(content: string, submitShortcut?: "enter" | "ctrlEnter"): Promise<boolean> {
    try {
      const insertOk = await this.promptManager.insertPrompt(content)
      if (!insertOk) return false

      const submitOk = await this.promptManager.submitPrompt(submitShortcut)
      return submitOk
    } catch (error) {
      console.error("[QueueDispatcher] Immediate send failed:", error)
      return false
    }
  }
}
