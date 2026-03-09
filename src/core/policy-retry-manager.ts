import { type SiteAdapter } from "~adapters/base"
import { type GeminiEnterpriseAdapter } from "~adapters/gemini-enterprise"
import { SITE_IDS } from "~constants/defaults"
import { DOMToolkit } from "~utils/dom-toolkit"
import { t } from "~utils/i18n"
import { EVENT_MONITOR_COMPLETE, EVENT_MONITOR_INIT } from "~utils/messaging"
import { type Settings } from "~utils/storage"
import { showToast } from "~utils/toast"

export class PolicyRetryManager {
  private adapter: GeminiEnterpriseAdapter
  private settings: NonNullable<Settings["geminiEnterprise"]>["policyRetry"]
  private retryCounts = new Map<string, number>() // promptHash -> count
  private lastPromptValues = new WeakMap<Element, string>()
  private monitorInitialized = false
  private boundHandleMessage: (event: MessageEvent) => void

  constructor(
    adapter: SiteAdapter,
    settings: NonNullable<Settings["geminiEnterprise"]>["policyRetry"],
  ) {
    this.adapter = adapter as GeminiEnterpriseAdapter
    this.settings = settings
    this.boundHandleMessage = this.handleMessage.bind(this)
    window.addEventListener("message", this.boundHandleMessage)

    if (this.settings.enabled) {
      this.initNetworkMonitor()
    }
  }

  updateSettings(settings: NonNullable<Settings["geminiEnterprise"]>["policyRetry"]) {
    const wasEnabled = this.settings.enabled
    this.settings = settings

    if (!wasEnabled && settings.enabled) {
      this.initNetworkMonitor()
    }
  }

  /**
   */
  private initNetworkMonitor(): void {
    if (this.monitorInitialized) return

    const config = this.adapter.getNetworkMonitorConfig?.()
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
      this.monitorInitialized = true
    }
  }

  private handleMessage(event: MessageEvent) {
    if (event.origin !== window.location.origin) return
    if (event.source !== window && event.origin !== window.location.origin) return

    if (this.adapter.getSiteId() !== SITE_IDS.GEMINI_ENTERPRISE) {
      return
    }

    const message = event.data
    if (
      !message ||
      typeof message !== "object" ||
      message.type !== EVENT_MONITOR_COMPLETE ||
      !this.settings.enabled
    ) {
      return
    }
    this.checkAndRetry()
  }

  private async checkAndRetry() {
    await new Promise((resolve) => setTimeout(resolve, 500))

    const ucsConv = DOMToolkit.query("ucs-conversation", { shadow: true }) as Element | null
    if (!ucsConv || !ucsConv.shadowRoot) {
      return
    }

    const root = ucsConv.shadowRoot
    const lastTurn = root.querySelector(".turn.last") || root.querySelector(".turn:last-child")

    if (!lastTurn) {
      return
    }

    const ucsSummary = lastTurn.querySelector("ucs-summary")
    if (!ucsSummary) {
      return
    }

    const banned = this.findBannedAnswer(ucsSummary)
    if (!banned) {
      return
    }

    const questionBlock = lastTurn.querySelector(".question-block")
    if (!questionBlock) {
      console.warn("[PolicyRetry] User question block not found")
      return
    }

    const questionText = this.adapter.extractUserQueryText(questionBlock)
    if (!questionText) {
      console.warn("[PolicyRetry] Empty user question")
      return
    }

    const hash = await this.sha256(questionText)
    const count = this.retryCounts.get(hash) || 0

    if (count < this.settings.maxRetries) {
      this.retryCounts.set(hash, count + 1)

      const msg = t("policyRetryActive")
        .replace("{current}", (count + 1).toString())
        .replace("{max}", this.settings.maxRetries.toString())
      showToast(msg, 3000)

      await this.performRetry(questionText)
    } else {
      showToast(t("policyRetryLimitReached"), 3000)
    }
  }

  private findBannedAnswer(root: Element): Element | null {

    if (root.tagName.toLowerCase() === "ucs-banned-answer") return root

    const shadowRoot = root.shadowRoot
    if (shadowRoot) {
      const found = this.findBannedAnswerInNode(shadowRoot)
      if (found) return found
    }

    return null
  }

  private findBannedAnswerInNode(node: Node): Element | null {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element
      if (el.tagName.toLowerCase() === "ucs-banned-answer") return el
      if (el.shadowRoot) {
        const found = this.findBannedAnswerInNode(el.shadowRoot)
        if (found) return found
      }
    }

    const children = node.childNodes
    for (let i = 0; i < children.length; i++) {
      const found = this.findBannedAnswerInNode(children[i])
      if (found) return found
    }
    return null
  }

  private async performRetry(text: string) {
    this.adapter.clearTextarea()
    await new Promise((r) => setTimeout(r, 100))

    const inserted = this.adapter.insertPrompt(text)
    if (!inserted) {
      console.error("[PolicyRetry] Failed to insert prompt")
      return
    }

    await new Promise((r) => setTimeout(r, 300))

    const btnSelectors = this.adapter.getSubmitButtonSelectors()
    const submitBtn = DOMToolkit.query(btnSelectors, { shadow: true }) as HTMLElement

    if (submitBtn) {
      submitBtn.click()
    } else {
      const editor = this.adapter.findTextarea()
      if (editor) {
        editor.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, bubbles: true }),
        )
        editor.dispatchEvent(
          new KeyboardEvent("keypress", {
            key: "Enter",
            code: "Enter",
            keyCode: 13,
            bubbles: true,
          }),
        )
        editor.dispatchEvent(
          new KeyboardEvent("keyup", { key: "Enter", code: "Enter", keyCode: 13, bubbles: true }),
        )
      } else {
        console.error("[PolicyRetry] Submit button and editor not found")
      }
    }
  }

  private async sha256(message: string): Promise<string> {
    const msgBuffer = new TextEncoder().encode(message)
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
  }
}
