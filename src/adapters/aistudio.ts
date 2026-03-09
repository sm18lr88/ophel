/**
 *
 *
 */
import { SITE_IDS } from "~constants"
import { useSettingsStore } from "~stores/settings-store"
import type { AIStudioSettings } from "~utils/storage"

import {
  SiteAdapter,
  type ConversationDeleteTarget,
  type ConversationInfo,
  type ConversationObserverConfig,
  type ExportConfig,
  type MarkdownFixerConfig,
  type OutlineItem,
  type SiteDeleteConversationResult,
} from "./base"

export interface AIStudioModel {
  id: string
  name: string
  category: string
}

export const AISTUDIO_MODELS: AIStudioModel[] = [
  { id: "models/gemini-3-pro-preview", name: "Gemini 3 Pro Preview", category: "Gemini 3" },
  {
    id: "models/gemini-3-pro-image-preview",
    name: "Gemini 3 Pro Image Preview",
    category: "Gemini 3",
  },
  { id: "models/gemini-3-flash-preview", name: "Gemini 3 Flash Preview", category: "Gemini 3" },

  { id: "models/gemini-2.5-pro", name: "Gemini 2.5 Pro", category: "Gemini 2.5" },
  { id: "models/gemini-2.5-flash", name: "Gemini 2.5 Flash", category: "Gemini 2.5" },
  { id: "models/gemini-2.5-flash-lite", name: "Gemini 2.5 Flash-Lite", category: "Gemini 2.5" },
  { id: "models/gemini-2.5-flash-image", name: "Gemini 2.5 Flash Image", category: "Gemini 2.5" },

  { id: "models/gemini-2.0-flash", name: "Gemini 2.0 Flash", category: "Gemini 2.0" },
  { id: "models/gemini-2.0-flash-lite", name: "Gemini 2.0 Flash-Lite", category: "Gemini 2.0" },

  { id: "models/gemini-flash-latest", name: "Gemini Flash Latest", category: "Latest" },
  { id: "models/gemini-flash-lite-latest", name: "Gemini Flash-Lite Latest", category: "Latest" },

  {
    id: "models/gemini-robotics-er-1.5-preview",
    name: "Gemini Robotics-ER 1.5",
    category: "Special",
  },
  {
    id: "models/gemini-2.5-flash-native-audio-preview-12-2025",
    name: "Gemini 2.5 Flash Native Audio",
    category: "Audio",
  },
  { id: "models/gemini-2.5-pro-preview-tts", name: "Gemini 2.5 Pro TTS", category: "TTS" },
  { id: "models/gemini-2.5-flash-preview-tts", name: "Gemini 2.5 Flash TTS", category: "TTS" },

  { id: "models/imagen-4.0-generate-001", name: "Imagen 4", category: "Imagen" },
  { id: "models/imagen-4.0-ultra-generate-001", name: "Imagen 4 Ultra", category: "Imagen" },
  { id: "models/imagen-4.0-fast-generate-001", name: "Imagen 4 Fast", category: "Imagen" },

  { id: "models/veo-3.1-generate-preview", name: "Veo 3.1", category: "Veo" },
  { id: "models/veo-3.1-fast-generate-preview", name: "Veo 3.1 Fast", category: "Veo" },
  { id: "models/veo-2.0-generate-001", name: "Veo 2", category: "Veo" },
]

const DEFAULT_TITLE = "Google AI Studio"

const AISTUDIO_DELETE_REASON = {
  UI_FAILED: "delete_ui_failed",
  BATCH_ABORTED_AFTER_UI_FAILURE: "delete_batch_aborted_after_ui_failure",
  API_DISABLED_UNSTABLE: "delete_api_disabled_unstable",
  API_AUTH_MISSING: "delete_api_auth_missing",
  API_KEY_MISSING: "delete_api_key_missing",
  API_REQUEST_FAILED: "delete_api_request_failed",
  API_NOT_FOUND_BUT_VISIBLE: "delete_api_not_found_but_visible",
} as const

const AISTUDIO_DELETE_MENU_KEYWORDS = [
  "delete",
  "remove",
  "delete",
  "delete",
  "delete",
  "삭제",
  "supprimer",
  "eliminar",
  "löschen",
  "excluir",
  "hapus",
  "удалить",
]

const AISTUDIO_CANCEL_KEYWORDS = [
  "cancel",
  "cancel",
  "キャンセル",
  "취소",
  "annuler",
  "abbrechen",
  "annulla",
  "batal",
  "cancelar",
  "отмена",
]

const AISTUDIO_RPC_SERVICE_PATH =
  "/$rpc/google.internal.alkali.applications.makersuite.v1.MakerSuiteService"
const AISTUDIO_DELETE_PROMPT_METHOD = "DeletePrompt"
const AISTUDIO_FALLBACK_RPC_ORIGIN = "https://alkalimakersuite-pa.clients6.google.com"

export class AIStudioAdapter extends SiteAdapter {
  private cachedLibraryConversations: ConversationInfo[] | null = null
  private cachedApiKey: string | null = null
  private cachedRpcOrigin: string | null = null

  match(): boolean {
    const hostname = window.location.hostname
    return hostname === "aistudio.google.com"
  }

  getSiteId(): string {
    return SITE_IDS.AISTUDIO
  }

  getName(): string {
    return "AI Studio"
  }

  getThemeColors(): { primary: string; secondary: string } {
    return { primary: "#4285f4", secondary: "#1a73e8" }
  }

  getNewTabUrl(): string {
    return "https://aistudio.google.com/prompts/new_chat"
  }

  isNewConversation(): boolean {
    return !this.getSessionId()
  }

  getSessionId(): string {
    const path = window.location.pathname
    const match = path.match(/\/prompts\/([^/?#]+)/)

    if (match && match[1]) {
      const id = match[1]
      if (id !== "new_chat") {
        return id
      }
    }

    return ""
  }

  /**
   */
  private getTextFromScrollbar(turnId: string): string | null {
    // Selector: ms-prompt-scrollbar button[aria-controls="turn-ID"]
    const selector = `ms-prompt-scrollbar button[aria-controls="${turnId}"]`
    const btn = document.querySelector(selector)

    if (btn) {
      const label = btn.getAttribute("aria-label")
      if (label) {
        return label.trim()
      }
    }
    return null
  }

  getSessionName(): string | null {
    const title = document.title
    if (title && !title.includes(DEFAULT_TITLE)) {
      return title.replace(` | ${DEFAULT_TITLE}`, "").trim()
    }
    return super.getSessionName()
  }

  getConversationTitle(): string | null {
    const title = document.title
    if (title && !title.includes(DEFAULT_TITLE)) {
      return title.replace(` | ${DEFAULT_TITLE}`, "").trim()
    }
    return null
  }

  getTextareaSelectors(): string[] {
    return [
      "textarea.textarea",
      "textarea.cdk-textarea-autosize",
      'textarea[placeholder*="prompt"]',
      'textarea[placeholder*="Start typing"]',
    ]
  }

  getSubmitButtonSelectors(): string[] {
    // Use the submit button inside ms-run-button to avoid matching unrelated primary buttons
    return [
      'ms-run-button button[type="submit"]',
      'ms-run-button.supports-add-instead-of-run button[type="submit"]',
      'button[ms-button][type="submit"]',
      'button.ms-button-primary[type="submit"]',
    ]
  }

  /**
   */
  getSubmitKeyConfig(): { key: "Enter" | "Ctrl+Enter" } {
    try {
      const prefStr = localStorage.getItem("aiStudioUserPreference")
      if (!prefStr) return { key: "Enter" }

      const pref = JSON.parse(prefStr)
      if (pref.enterKeyBehavior === 2) {
        return { key: "Ctrl+Enter" }
      }
      return { key: "Enter" }
    } catch {
      return { key: "Enter" }
    }
  }

  isValidTextarea(element: HTMLElement): boolean {
    if (element.offsetParent === null) return false
    if (element.closest(".gh-main-panel")) return false
    return element.tagName.toLowerCase() === "textarea"
  }

  insertPrompt(content: string): boolean {
    const textarea = this.textarea as HTMLTextAreaElement
    if (!textarea) return false

    if (!textarea.isConnected) {
      this.textarea = null
      return false
    }

    textarea.focus()

    if (textarea.tagName.toLowerCase() === "textarea") {
      textarea.value = content

      textarea.dispatchEvent(new Event("input", { bubbles: true }))
      textarea.dispatchEvent(new Event("change", { bubbles: true }))

      textarea.selectionStart = textarea.selectionEnd = content.length

      return true
    }

    return false
  }

  clearTextarea(): void {
    const textarea = this.textarea as HTMLTextAreaElement
    if (!textarea) return
    if (!textarea.isConnected) {
      this.textarea = null
      return
    }

    textarea.focus()
    if (textarea.tagName.toLowerCase() === "textarea") {
      textarea.value = ""
      textarea.dispatchEvent(new Event("input", { bubbles: true }))
      textarea.dispatchEvent(new Event("change", { bubbles: true }))
    }
  }

  getScrollContainer(): HTMLElement | null {
    const candidates = [
      ".chat-container",
      ".virtual-scroll-container",
      '[class*="scroll"]',
      'main [style*="overflow"]',
    ]

    for (const selector of candidates) {
      const container = document.querySelector(selector) as HTMLElement
      if (container && container.scrollHeight > container.clientHeight) {
        return container
      }
    }

    const main = document.querySelector("main")
    if (main) {
      const scrollable = main.querySelector('[class*="overflow"]') as HTMLElement
      if (scrollable && scrollable.scrollHeight > scrollable.clientHeight) {
        return scrollable
      }
    }

    return null
  }

  getResponseContainerSelector(): string {
    return ".chat-container, main"
  }

  getChatContentSelectors(): string[] {
    return [".chat-turn-container", '[class*="message"]', '[class*="response"]']
  }

  getWidthSelectors() {
    return [
      { selector: ".chat-session-content", property: "max-width" },
      { selector: ".chat-turn-container", property: "max-width" },
    ]
  }

  getZenModeSelectors() {
    return [{ selector: "ms-hallucinations-disclaimer", action: "hide" as const }]
  }

  getMarkdownFixerConfig(): MarkdownFixerConfig {
    return {
      selector: "ms-cmark-node span.ng-star-inserted",
      fixSpanContent: true,
    }
  }

  /**
   */
  /**
   */
  lockModel(keyword: string, onSuccess?: () => void): void {
    if (!keyword) return

    const maxAttempts = 10
    const checkInterval = 1000
    let attempts = 0

    const waitForButton = setInterval(async () => {
      attempts++
      const selectorBtn = document.querySelector("button.model-selector-card") as HTMLElement

      if (selectorBtn) {
        clearInterval(waitForButton)

        selectorBtn.click()

        const sidebar = await this.waitForModelSidebar()
        if (!sidebar) {
          console.warn("[AIStudioAdapter] Model sidebar load timeout")
          this.closeModelSidebar()
          return
        }

        const targetId = `model-carousel-row-models/${keyword}`
        const targetBtn = document.getElementById(targetId)

        if (targetBtn) {
          const nameEl = targetBtn.querySelector("div > div > div > span:first-child")
          const displayName = nameEl?.textContent?.trim() || keyword
          const sessionId = this.getSessionId()
          if (sessionId) {
            localStorage.setItem(`ophel:aistudio:model:${sessionId}`, displayName)
          }

          targetBtn.click()
          if (onSuccess) onSuccess()

          try {
            const settings = useSettingsStore.getState().settings
            if (settings.aistudio?.collapseRunSettings) {
              setTimeout(() => {
                const closeRunSettingsBtn = document.querySelector(
                  'button[aria-label="Close run settings panel"]',
                ) as HTMLElement
                if (closeRunSettingsBtn) {
                  closeRunSettingsBtn.click()
                }
              }, 500)
            }
          } catch (e) {
            console.error("[AIStudioAdapter] Auto-collapse run settings failed:", e)
          }
        } else {
          console.warn(`[AIStudioAdapter] Target model not found: ${keyword}`)
          this.closeModelSidebar()
        }
      } else {
        const toggleBtn = document.querySelector(
          'button[aria-label="Toggle run settings panel"]',
        ) as HTMLElement
        if (toggleBtn) {
          toggleBtn.click()
          attempts = Math.max(0, attempts - 2)
        } else if (attempts >= maxAttempts) {
          clearInterval(waitForButton)
          console.warn("[AIStudioAdapter] Model selector button not found")
        }
      }
    }, checkInterval)
  }

  async getModelList(): Promise<{ id: string; name: string }[]> {
    let wasCollapsed = false
    let modelSelectorBtn = document.querySelector("button.model-selector-card") as HTMLElement

    if (!modelSelectorBtn) {
      const toggleBtn = document.querySelector(
        'button[aria-label="Toggle run settings panel"]',
      ) as HTMLElement
      if (toggleBtn) {
        wasCollapsed = true
        toggleBtn.click()

        for (let i = 0; i < 20; i++) {
          await new Promise((r) => setTimeout(r, 200))
          modelSelectorBtn = document.querySelector("button.model-selector-card") as HTMLElement
          if (modelSelectorBtn) break
        }
      }
    }

    if (!modelSelectorBtn) {
      console.warn("[AIStudioAdapter] Model selector button not found")
      return []
    }

    modelSelectorBtn.click()

    const sidebar = await this.waitForModelSidebar()
    if (!sidebar) {
      console.warn("[AIStudioAdapter] Model sidebar load timeout")
      if (wasCollapsed) {
        const closeRunSettingsBtn = document.querySelector(
          'button[aria-label="Close run settings panel"]',
        ) as HTMLElement
        if (closeRunSettingsBtn) closeRunSettingsBtn.click()
      }
      return []
    }

    const models = this.extractModelsFromSidebar(sidebar)

    this.closeModelSidebar()

    if (wasCollapsed) {
      setTimeout(() => {
        const closeRunSettingsBtn = document.querySelector(
          'button[aria-label="Close run settings panel"]',
        ) as HTMLElement
        if (closeRunSettingsBtn) {
          closeRunSettingsBtn.click()
        }
      }, 500)
    }

    return models
  }

  /**
   */
  private async waitForModelSidebar(): Promise<HTMLElement | null> {
    const maxWait = 5000
    const interval = 100
    const start = Date.now()

    while (Date.now() - start < maxWait) {
      const sidebar = document.querySelector(
        ".ms-sliding-right-panel-dialog, mat-dialog-container.mat-mdc-dialog-container",
      ) as HTMLElement

      if (sidebar) {
        await new Promise((r) => setTimeout(r, 300))
        return sidebar
      }

      await new Promise((r) => setTimeout(r, interval))
    }

    return null
  }

  /**
   */
  private extractModelsFromSidebar(sidebar: HTMLElement): { id: string; name: string }[] {
    const models: { id: string; name: string }[] = []

    const modelCards = sidebar.querySelectorAll(".model-options-container button.content-button")

    modelCards.forEach((card) => {
      const btnId = card.id || ""
      const modelId = btnId.replace("model-carousel-row-", "").replace("models/", "")

      const nameEl = card.querySelector("div > div > div > span:first-child")
      const displayName = nameEl?.textContent?.trim() || modelId

      if (modelId && displayName) {
        models.push({ id: modelId, name: displayName })
      }
    })

    return models
  }

  /**
   */
  private closeModelSidebar(): void {
    const closeBtn = document.querySelector("button[data-test-close-button]") as HTMLElement
    if (closeBtn) {
      closeBtn.click()
      return
    }

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
  }

  /**
   */
  async loadAllConversations(): Promise<void> {
    const currentPath = window.location.pathname
    const isOnLibrary = currentPath === "/library"

    if (!isOnLibrary) {
      const viewAllBtn = document.querySelector(
        'a.view-all-history-link[href="/library"]',
      ) as HTMLAnchorElement
      if (viewAllBtn) {
        viewAllBtn.click()
        await this.waitForLibraryTable()
      } else {
        window.location.href = "/library"
        return
      }
    }

    const conversations = this.extractLibraryConversations()
    if (conversations.length > 0) {
      this.cachedLibraryConversations = conversations
    }

    if (!isOnLibrary) {
      window.history.back()
    }

    setTimeout(() => {
      this.cachedLibraryConversations = null
    }, 10000)
  }

  /**
   */
  private async waitForLibraryTable(): Promise<boolean> {
    for (let i = 0; i < 50; i++) {
      await new Promise((resolve) => setTimeout(resolve, 100))
      const table = document.querySelector("ms-library-table table tbody tr")
      if (table) {
        await new Promise((resolve) => setTimeout(resolve, 200))
        return true
      }
    }
    return false
  }

  /**
   */
  private extractLibraryConversations(): ConversationInfo[] {
    const conversations: ConversationInfo[] = []
    const rows = document.querySelectorAll("ms-library-table table tbody tr")

    rows.forEach((row) => {
      const link = row.querySelector('a[href*="/prompts/"]') as HTMLAnchorElement
      if (!link) return

      const href = link.getAttribute("href") || ""
      const match = href.match(/\/prompts\/([^/]+)/)
      if (!match) return

      const id = match[1]
      const title = link.textContent?.trim() || "Untitled"

      conversations.push({
        id,
        title,
        url: href,
        isActive: window.location.pathname.includes(id),
        isPinned: false,
      })
    })

    return conversations
  }

  /**
   */
  private extractSidebarConversations(): ConversationInfo[] {
    const conversationMap = new Map<string, ConversationInfo>()

    const historyLinks = document.querySelectorAll('a[href*="/prompts/"]')

    historyLinks.forEach((link) => {
      const href = link.getAttribute("href")
      if (!href || href.includes("new_chat")) return

      const match = href.match(/\/prompts\/([^/]+)/)
      if (!match) return

      const id = match[1]
      if (conversationMap.has(id)) return

      const title = link.textContent?.trim() || "Untitled"

      const isActive = window.location.pathname.includes(id)

      conversationMap.set(id, {
        id,
        title,
        url: href,
        isActive,
        isPinned: false,
      })
    })

    return Array.from(conversationMap.values())
  }

  getConversationList(): ConversationInfo[] {
    if (window.location.pathname === "/library") {
      return this.extractLibraryConversations()
    }

    if (this.cachedLibraryConversations && this.cachedLibraryConversations.length > 0) {
      return this.cachedLibraryConversations
    }

    return this.extractSidebarConversations()
  }

  getSidebarScrollContainer(): Element | null {
    const aside = document.querySelector("aside")
    if (aside) return aside
    return null
  }

  getConversationObserverConfig(): ConversationObserverConfig | null {
    return {
      selector: 'a.prompt-link[href*="/prompts/"]:not([href*="new_chat"])',
      shadow: true,
      extractInfo: (el: Element) => {
        const href = el.getAttribute("href")
        if (!href) return null

        const match = href.match(/\/prompts\/([^/]+)/)
        if (!match) return null

        const id = match[1]
        const title = el.textContent?.trim() || "Untitled"

        return { id, title, url: href, isPinned: false }
      },
      getTitleElement: (el: Element) => {
        return el
      },
    }
  }

  navigateToConversation(id: string, url?: string): boolean {
    const link = document.querySelector(
      `a.prompt-link[href*="/prompts/${id}"], a.name-btn[href*="/prompts/${id}"]`,
    ) as HTMLAnchorElement
    if (link) {
      link.click()
      return true
    }
    window.location.href = url || `/prompts/${id}`
    return true
  }

  async deleteConversationOnSite(
    target: ConversationDeleteTarget,
  ): Promise<SiteDeleteConversationResult> {
    const results = await this.deleteConversationsOnSite([target])
    return (
      results[0] || {
        id: target.id,
        success: false,
        method: "none",
        reason: AISTUDIO_DELETE_REASON.UI_FAILED,
      }
    )
  }

  async deleteConversationsOnSite(
    targets: ConversationDeleteTarget[],
  ): Promise<SiteDeleteConversationResult[]> {
    const libraryContext = await this.enterLibraryPageForDelete()
    const results: SiteDeleteConversationResult[] = []
    const deletedIds: string[] = []
    let restored = false

    try {
      for (let index = 0; index < targets.length; index++) {
        const result = await this.deleteConversationOnSiteInternal(targets[index])
        results.push(result)
        if (result.success) {
          deletedIds.push(targets[index].id)
        }

        if (!result.success && result.reason === AISTUDIO_DELETE_REASON.UI_FAILED) {
          for (let i = index + 1; i < targets.length; i++) {
            results.push({
              id: targets[i].id,
              success: false,
              method: "none",
              reason: AISTUDIO_DELETE_REASON.BATCH_ABORTED_AFTER_UI_FAILURE,
            })
          }
          break
        }
      }

      if (libraryContext.enteredLibrary) {
        await this.restoreFromLibraryPage(libraryContext.originalPath)
        restored = true
      }

      if (deletedIds.length > 0) {
        this.scheduleFullReloadAfterDelete(deletedIds)
      }

      return results
    } finally {
      if (libraryContext.enteredLibrary && !restored) {
        await this.restoreFromLibraryPage(libraryContext.originalPath)
      }
    }
  }

  private async deleteConversationOnSiteInternal(
    target: ConversationDeleteTarget,
  ): Promise<SiteDeleteConversationResult> {
    const apiResult = this.shouldUseNativeDeleteApi()
      ? await this.tryDeleteViaGrpcApi(target.id)
      : {
          id: target.id,
          success: false,
          method: "none" as const,
          reason: AISTUDIO_DELETE_REASON.API_DISABLED_UNSTABLE,
        }
    if (apiResult.success) {
      return apiResult
    }

    const uiSuccess = await this.deleteConversationViaUi(target.id)
    return {
      id: target.id,
      success: uiSuccess,
      method: uiSuccess ? "ui" : "none",
      reason: uiSuccess ? undefined : apiResult.reason || AISTUDIO_DELETE_REASON.UI_FAILED,
    }
  }

  private shouldUseNativeDeleteApi(): boolean {
    // AI Studio's RPC headers/tokens are highly dynamic and currently unstable across sessions.
    // Keep API delete disabled to avoid false failures and rely on stable UI automation.
    return false
  }

  private async tryDeleteViaGrpcApi(id: string): Promise<SiteDeleteConversationResult> {
    const authorization = await this.buildGoogleAuthorizationHeader(window.location.origin)
    if (!authorization) {
      return {
        id,
        success: false,
        method: "none",
        reason: AISTUDIO_DELETE_REASON.API_AUTH_MISSING,
      }
    }

    const apiKey = this.resolveGoogleApiKey()
    if (!apiKey) {
      return {
        id,
        success: false,
        method: "none",
        reason: AISTUDIO_DELETE_REASON.API_KEY_MISSING,
      }
    }

    const promptName = this.normalizePromptName(id)
    const endpoints = this.getDeletePromptEndpoints()
    let lastStatus = 0

    try {
      for (const endpoint of endpoints) {
        const response = await fetch(endpoint, {
          method: "POST",
          credentials: "include",
          headers: {
            accept: "*/*",
            authorization,
            "content-type": "application/json+protobuf",
            "x-goog-api-key": apiKey,
            "x-goog-authuser": this.resolveGoogAuthUser(),
            "x-user-agent": "grpc-web-javascript/0.1",
          },
          body: JSON.stringify([promptName]),
        })

        lastStatus = response.status
        if (response.ok) {
          this.cachedRpcOrigin = this.normalizeRpcOriginFromEndpoint(endpoint)
          this.syncConversationListAfterDelete(id)
          return { id, success: true, method: "api" }
        }

        if (response.status === 404) {
          if (!this.isConversationVisible(id)) {
            this.cachedRpcOrigin = this.normalizeRpcOriginFromEndpoint(endpoint)
            this.syncConversationListAfterDelete(id)
            return { id, success: true, method: "api" }
          }
          continue
        }

        if (response.status === 400 || response.status >= 500) {
          continue
        }

        return {
          id,
          success: false,
          method: "api",
          reason: this.toDeleteApiHttpReason(response.status),
        }
      }

      if (lastStatus === 404) {
        return {
          id,
          success: false,
          method: "api",
          reason: AISTUDIO_DELETE_REASON.API_NOT_FOUND_BUT_VISIBLE,
        }
      }

      return {
        id,
        success: false,
        method: "api",
        reason: this.toDeleteApiHttpReason(lastStatus || 0),
      }
    } catch {
      return {
        id,
        success: false,
        method: "api",
        reason: AISTUDIO_DELETE_REASON.API_REQUEST_FAILED,
      }
    }
  }

  private toDeleteApiHttpReason(status: number): string {
    switch (status) {
      case 401:
      case 403:
        return "delete_api_unauthorized"
      case 429:
        return "delete_api_rate_limited"
      default:
        return `delete_api_http_${status}`
    }
  }

  private normalizePromptName(id: string): string {
    if (!id) return ""
    return id.startsWith("prompts/") ? id : `prompts/${id}`
  }

  private getDeletePromptEndpoints(): string[] {
    const origins: string[] = []

    if (this.cachedRpcOrigin) {
      origins.push(this.cachedRpcOrigin)
    }

    origins.push(...this.resolveRpcOriginsFromPerformance())
    origins.push(AISTUDIO_FALLBACK_RPC_ORIGIN)

    const uniqueOrigins = Array.from(new Set(origins.filter(Boolean)))
    return uniqueOrigins.map(
      (origin) => `${origin}${AISTUDIO_RPC_SERVICE_PATH}/${AISTUDIO_DELETE_PROMPT_METHOD}`,
    )
  }

  private resolveRpcOriginsFromPerformance(): string[] {
    const entries = performance.getEntriesByType("resource") as PerformanceResourceTiming[]
    if (!entries || entries.length === 0) return []

    const origins: string[] = []
    for (let index = entries.length - 1; index >= 0; index--) {
      const name = entries[index]?.name
      if (!name || !name.includes(AISTUDIO_RPC_SERVICE_PATH)) continue

      const origin = this.normalizeRpcOriginFromEndpoint(name)
      if (origin) origins.push(origin)
    }

    return Array.from(new Set(origins))
  }

  private normalizeRpcOriginFromEndpoint(endpoint: string): string | null {
    try {
      const url = new URL(endpoint)
      if (!this.isLikelyRpcHost(url.hostname)) return null
      return `${url.protocol}//${url.host}`
    } catch {
      return null
    }
  }

  private isLikelyRpcHost(hostname: string): boolean {
    return /(?:^|\.)alkalimakersuite-[a-z0-9-]+\.clients\d+\.google\.com$/i.test(hostname)
  }

  private async buildGoogleAuthorizationHeader(origin: string): Promise<string | null> {
    const timestamp = Math.floor(Date.now() / 1000)
    const sapisid = this.getCookieValue("SAPISID")
    const oneP = this.getCookieValue("__Secure-1PAPISID")
    const threeP = this.getCookieValue("__Secure-3PAPISID")

    const parts: string[] = []

    const primary = sapisid || oneP || threeP
    if (primary) {
      const token = await this.buildSapisidHashToken(primary, origin, timestamp)
      if (token) parts.push(`SAPISIDHASH ${token}`)
    }

    if (oneP) {
      const token = await this.buildSapisidHashToken(oneP, origin, timestamp)
      if (token) parts.push(`SAPISID1PHASH ${token}`)
    }

    if (threeP) {
      const token = await this.buildSapisidHashToken(threeP, origin, timestamp)
      if (token) parts.push(`SAPISID3PHASH ${token}`)
    }

    if (parts.length === 0) return null
    return parts.join(" ")
  }

  private async buildSapisidHashToken(
    value: string,
    origin: string,
    timestamp: number,
  ): Promise<string | null> {
    try {
      const source = `${timestamp} ${value} ${origin}`
      const hashBuffer = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(source))
      const hash = Array.from(new Uint8Array(hashBuffer))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("")
      return `${timestamp}_${hash}`
    } catch {
      return null
    }
  }

  private resolveGoogleApiKey(): string | null {
    if (this.cachedApiKey && this.isValidGoogleApiKey(this.cachedApiKey)) {
      return this.cachedApiKey
    }

    const fromWiz = (window as unknown as Record<string, unknown>).WIZ_global_data as
      | Record<string, unknown>
      | undefined
    const wizKey = fromWiz?.SNlM0e
    if (this.isValidGoogleApiKey(wizKey)) {
      this.cachedApiKey = wizKey
      return wizKey
    }

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key) continue
      const value = localStorage.getItem(key)
      if (!value) continue
      const match = value.match(/AIza[0-9A-Za-z_-]{20,}/)
      if (match) {
        this.cachedApiKey = match[0]
        return match[0]
      }
    }

    const scripts = Array.from(document.querySelectorAll("script"))
    for (const script of scripts) {
      const text = script.textContent
      if (!text) continue
      const match = text.match(/AIza[0-9A-Za-z_-]{20,}/)
      if (match) {
        this.cachedApiKey = match[0]
        return match[0]
      }
    }

    return null
  }

  private isValidGoogleApiKey(value: unknown): value is string {
    return typeof value === "string" && /^AIza[0-9A-Za-z_-]{20,}$/.test(value)
  }

  private resolveGoogAuthUser(): string {
    const fromQuery = new URLSearchParams(window.location.search).get("authuser")
    if (fromQuery && /^\d+$/.test(fromQuery)) {
      return fromQuery
    }
    return "0"
  }

  private getCookieValue(name: string): string | null {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`))
    if (!match) return null
    try {
      return decodeURIComponent(match[1])
    } catch {
      return match[1]
    }
  }

  private syncConversationListAfterDelete(id: string): void {
    if (this.cachedLibraryConversations) {
      this.cachedLibraryConversations = this.cachedLibraryConversations.filter(
        (item) => item.id !== id,
      )
    }

    const selectors = [
      `a.prompt-link[href*="/prompts/${id}"]`,
      `a.name-btn[href*="/prompts/${id}"]`,
      `a[href*="/prompts/${id}"]`,
    ]
    selectors.forEach((selector) => {
      const anchors = Array.from(document.querySelectorAll(selector)) as HTMLElement[]
      anchors.forEach((anchor) => {
        const container =
          (anchor.closest("tr") as HTMLElement | null) ||
          (anchor.closest("li") as HTMLElement | null) ||
          (anchor.closest("mat-row") as HTMLElement | null) ||
          anchor
        container.remove()
      })
    })
  }

  private isConversationVisible(id: string): boolean {
    return Boolean(
      document.querySelector(
        `a.prompt-link[href*="/prompts/${id}"], a.name-btn[href*="/prompts/${id}"], a[href*="/prompts/${id}"]`,
      ),
    )
  }

  private scheduleFullReloadAfterDelete(deletedIds: string[]): void {
    if (deletedIds.length === 0) return

    const currentId = this.getSessionId()
    if (currentId && deletedIds.includes(currentId)) {
      try {
        window.history.replaceState(window.history.state, "", "/prompts/new_chat")
      } catch {
        // ignore SPA route replacement failure
      }
    }
  }

  private async deleteConversationViaUi(id: string): Promise<boolean> {
    const row = await this.findLibraryRowByPromptId(id, 1500)
    if (!row) return false

    const menuButton = this.findLibraryRowMenuButton(row)
    if (!menuButton) return false

    this.simulateClick(menuButton)

    const deleteItem = await this.waitForDeleteMenuItem(2500)
    if (!deleteItem) return false
    this.simulateClick(deleteItem)

    const confirmButton = await this.waitForDeleteConfirmButton(2500)
    if (!confirmButton) return false
    this.simulateClick(confirmButton)

    const removed = await this.waitForConversationRemoved(id, 5000)
    if (removed) {
      this.syncConversationListAfterDelete(id)
    }
    return removed
  }

  private async enterLibraryPageForDelete(): Promise<{
    enteredLibrary: boolean
    originalPath: string
  }> {
    const originalPath = `${window.location.pathname}${window.location.search}${window.location.hash}`
    if (window.location.pathname === "/library") {
      return { enteredLibrary: false, originalPath }
    }

    const viewAllBtn = document.querySelector(
      'a.view-all-history-link[href="/library"]',
    ) as HTMLAnchorElement | null
    if (!viewAllBtn) {
      return { enteredLibrary: false, originalPath }
    }

    viewAllBtn.click()
    const loaded = await this.waitForLibraryTable()
    if (!loaded || window.location.pathname !== "/library") {
      return { enteredLibrary: false, originalPath }
    }

    return { enteredLibrary: true, originalPath }
  }

  private async restoreFromLibraryPage(originalPath: string): Promise<void> {
    if (!originalPath || window.location.pathname !== "/library") return

    window.history.back()
    const start = Date.now()
    while (Date.now() - start < 3000) {
      if (window.location.pathname !== "/library") return
      await this.sleep(80)
    }
  }

  private async findLibraryRowByPromptId(id: string, timeout = 1200): Promise<HTMLElement | null> {
    const start = Date.now()
    while (Date.now() - start < timeout) {
      const anchor = document.querySelector(
        `ms-library-table a[href*="/prompts/${id}"], a.name-btn[href*="/prompts/${id}"]`,
      ) as HTMLElement | null
      if (anchor) {
        const row = (anchor.closest("tr") || anchor.closest("mat-row") || anchor) as HTMLElement
        if (row && this.isVisible(row)) return row
      }
      await this.sleep(80)
    }
    return null
  }

  private findLibraryRowMenuButton(row: HTMLElement): HTMLElement | null {
    const selector = [
      'button[aria-haspopup="menu"]',
      'button[aria-label*="More"]',
      'button[aria-label*="more"]',
      'button[aria-label*="More"]',
      'button[aria-label*="More options"]',
      'button[aria-label*="Options"]',
      'button[title*="More"]',
      'button[title*="more"]',
    ].join(", ")

    const candidates = Array.from(row.querySelectorAll(selector)) as HTMLElement[]
    const visible = candidates.filter((item) => this.isVisible(item))
    if (visible.length > 0) {
      return visible.sort(
        (a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right,
      )[0]
    }

    const fallbackButtons = Array.from(row.querySelectorAll("button")) as HTMLElement[]
    const visibleFallback = fallbackButtons.filter((item) => this.isVisible(item))
    if (visibleFallback.length === 0) return null
    return visibleFallback.sort(
      (a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right,
    )[0]
  }

  private async waitForDeleteMenuItem(timeout = 2500): Promise<HTMLElement | null> {
    const start = Date.now()
    while (Date.now() - start < timeout) {
      const menuItems = Array.from(
        document.querySelectorAll(
          '[role="menuitem"], [role="menu"] button, .mat-mdc-menu-panel button',
        ),
      ) as HTMLElement[]

      for (const item of menuItems) {
        if (!this.isVisible(item)) continue
        const text = this.getSignalText(item)
        if (!this.hasKeyword(text, AISTUDIO_DELETE_MENU_KEYWORDS)) continue
        if (this.hasKeyword(text, AISTUDIO_CANCEL_KEYWORDS)) continue
        return item
      }

      await this.sleep(80)
    }
    return null
  }

  private async waitForDeleteConfirmButton(timeout = 2500): Promise<HTMLElement | null> {
    const start = Date.now()
    while (Date.now() - start < timeout) {
      const dialog = this.findVisibleDialog()
      const buttons = dialog
        ? (Array.from(dialog.querySelectorAll("button")) as HTMLElement[])
        : (Array.from(document.querySelectorAll("button")) as HTMLElement[])

      for (const button of buttons) {
        if (!this.isVisible(button)) continue
        const text = this.getSignalText(button)
        if (!this.hasKeyword(text, AISTUDIO_DELETE_MENU_KEYWORDS)) continue
        if (this.hasKeyword(text, AISTUDIO_CANCEL_KEYWORDS)) continue
        return button
      }
      await this.sleep(80)
    }
    return null
  }

  private findVisibleDialog(): HTMLElement | null {
    const dialogs = Array.from(
      document.querySelectorAll('[role="dialog"], mat-dialog-container, .mat-mdc-dialog-container'),
    ) as HTMLElement[]
    return dialogs.find((dialog) => this.isVisible(dialog)) || null
  }

  private async waitForConversationRemoved(id: string, timeout = 3500): Promise<boolean> {
    const start = Date.now()
    while (Date.now() - start < timeout) {
      if (!this.isConversationVisible(id)) return true
      await this.sleep(80)
    }
    return false
  }

  private getSignalText(element: HTMLElement): string {
    return [
      element.textContent || "",
      element.getAttribute("aria-label") || "",
      element.getAttribute("title") || "",
      element.className || "",
    ]
      .join(" ")
      .toLowerCase()
  }

  private hasKeyword(text: string, keywords: string[]): boolean {
    const normalized = text.toLowerCase()
    return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()))
  }

  private isVisible(element: Element | null): element is HTMLElement {
    if (!(element instanceof HTMLElement)) return false
    if (!element.isConnected) return false

    const style = window.getComputedStyle(element)
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) {
      return false
    }

    const rect = element.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms))
  }

  getUserQuerySelector(): string {
    return ".chat-turn-container.user"
  }

  private textCache = new Map<string, string>()
  private wordCountCache = new Map<string, number>()
  private lastSessionIdForCache: string | null = null

  extractUserQueryText(element: Element): string {
    const currentSessionId = this.getSessionId()
    if (this.lastSessionIdForCache !== currentSessionId) {
      this.textCache.clear()
      this.wordCountCache.clear()
      this.lastSessionIdForCache = currentSessionId
    }

    const turnId = element.closest("ms-chat-turn")?.id
    let extractedText = ""

    // .chat-turn-container.user
    //   > .user-prompt-container > .turn-content
    //
    const contentChunk = element.querySelector("ms-prompt-chunk.text-chunk, ms-prompt-chunk")
    if (contentChunk) {
      extractedText = contentChunk.textContent?.trim() || ""
    } else {
      const turnContent = element.querySelector(".turn-content")
      if (turnContent) {
        const authorLabel = turnContent.querySelector(".author-label")
        if (authorLabel) {
          const clone = turnContent.cloneNode(true) as Element
          const labelInClone = clone.querySelector(".author-label")
          labelInClone?.remove()
          extractedText = clone.textContent?.trim() || ""
        } else {
          extractedText = turnContent.textContent?.trim() || ""
        }
      } else {
        extractedText = this.extractTextWithLineBreaks(element)
      }
    }

    // --- Side-Channel Hydration (Using Scrollbar) ---
    if (!extractedText && turnId) {
      const scrollbarText = this.getTextFromScrollbar(turnId)
      if (scrollbarText) {
        extractedText = scrollbarText
      }
    }

    if (extractedText) {
      if (turnId) {
        this.textCache.set(turnId, extractedText)
      }
      return extractedText
    } else {
      if (turnId && this.textCache.has(turnId)) {
        return this.textCache.get(turnId)!
      }
    }

    return ""
  }

  getExportConfig(): ExportConfig | null {
    return {
      userQuerySelector: this.getUserQuerySelector(),
      assistantResponseSelector: ".chat-turn-container.model",
      turnSelector: ".chat-turn-container",
      useShadowDOM: false,
    }
  }

  extractOutline(maxLevel = 6, includeUserQueries = false, showWordCount = false): OutlineItem[] {
    const outline: OutlineItem[] = []

    const container = document.querySelector(".chat-container") || document.querySelector("main")
    if (!container) return outline

    const getTurnId = (el: Element): string | null => {
      const turn = el.closest("ms-chat-turn")
      if (turn && turn.id) {
        return turn.id.replace(/^turn-/, "")
      }
      return null
    }

    const turnHeaderCounts: Record<string, Record<string, number>> = {}
    const generateHeaderId = (turnId: string, tagName: string, text: string): string => {
      if (!turnHeaderCounts[turnId]) {
        turnHeaderCounts[turnId] = {}
      }

      const key = `${tagName}-${text}`
      const count = turnHeaderCounts[turnId][key] || 0
      turnHeaderCounts[turnId][key] = count + 1

      return `${turnId}::${key}::${count}`
    }

    const userQuerySelector = this.getUserQuerySelector()
    const calculateUserQueryWordCount = (startEl: Element): number => {
      const currentTurn = startEl.closest("ms-chat-turn")
      if (!currentTurn) return 0

      const turnId = currentTurn.id

      let current = currentTurn.nextElementSibling
      let totalLength = 0
      let foundContent = false

      while (current) {
        const userQueryInThis = current.querySelector(userQuerySelector)
        if (userQueryInThis) {
          break
        }

        const modelContainer = current.querySelector(
          ".chat-turn-container.model, .chat-turn-container:not(.user)",
        )
        if (modelContainer) {
          const allMarkdownNodes = modelContainer.querySelectorAll("ms-cmark-node")
          for (const node of Array.from(allMarkdownNodes)) {
            if (node.closest("ms-thought-chunk")) continue

            const textLength = node.textContent?.trim().length || 0
            if (textLength > 0) {
              foundContent = true
              totalLength += textLength
            }
          }
        }

        current = current.nextElementSibling
      }

      if (foundContent && turnId) {
        this.wordCountCache.set(turnId, totalLength)
      }

      if (totalLength === 0 && turnId && this.wordCountCache.has(turnId)) {
        return this.wordCountCache.get(turnId)!
      }

      return totalLength
    }

    if (!includeUserQueries) {
      const headingSelectors: string[] = []
      for (let i = 1; i <= maxLevel; i++) {
        headingSelectors.push(`h${i}`)
      }

      const headings = Array.from(container.querySelectorAll(headingSelectors.join(", ")))
      headings.forEach((heading, index) => {
        if (heading.closest("textarea") || heading.closest(".user-prompt-container")) return
        if (this.isInRenderedMarkdownContainer(heading)) return

        const level = parseInt(heading.tagName.charAt(1), 10)
        if (level <= maxLevel) {
          const item: OutlineItem = {
            level,
            text: heading.textContent?.trim() || "",
            element: heading,
          }

          const turnId = getTurnId(heading)
          if (turnId) {
            const tagName = heading.tagName.toLowerCase()
            item.id = generateHeaderId(turnId, tagName, item.text)
          }

          if (showWordCount) {
            let nextBoundaryEl: Element | null = null
            for (let i = index + 1; i < headings.length; i++) {
              const candidate = headings[i]
              const candidateLevel = parseInt(candidate.tagName.charAt(1), 10)
              if (candidateLevel <= level) {
                nextBoundaryEl = candidate
                break
              }
            }
            const turnContainer = heading.closest("ms-chat-turn")
            item.wordCount = this.calculateRangeWordCount(
              heading,
              nextBoundaryEl,
              turnContainer || container,
            )
          }

          outline.push(item)
        }
      })
      return outline
    }

    const headingSelectors: string[] = []
    for (let i = 1; i <= maxLevel; i++) {
      headingSelectors.push(`h${i}`)
    }

    const combinedSelector = `${userQuerySelector}, ${headingSelectors.join(", ")}`
    const allElements = Array.from(container.querySelectorAll(combinedSelector))

    allElements.forEach((element, index) => {
      const tagName = element.tagName.toLowerCase()
      const isUserQuery =
        element.classList.contains("user") && element.classList.contains("chat-turn-container")

      if (isUserQuery) {
        let queryText = this.extractUserQueryText(element)
        let isTruncated = false
        if (queryText.length > 200) {
          queryText = queryText.substring(0, 200)
          isTruncated = true
        }

        const item: OutlineItem = {
          level: 0,
          text: queryText,
          element,
          isUserQuery: true,
          isTruncated,
        }

        const currentTurn = element.closest("ms-chat-turn")
        const nextTurn = currentTurn?.nextElementSibling
        if (nextTurn && nextTurn.tagName.toLowerCase() === "ms-chat-turn") {
          const responseText = this.extractTextWithLineBreaks(nextTurn).trim().substring(0, 50)
          if (responseText) {
            item.context = responseText
          }
        }

        if (showWordCount) {
          item.wordCount = calculateUserQueryWordCount(element)
        }

        outline.push(item)
      } else if (/^h[1-6]$/.test(tagName)) {
        if (element.closest(".user-prompt-container") || element.closest("textarea")) return
        if (this.isInRenderedMarkdownContainer(element)) return

        const level = parseInt(tagName.charAt(1), 10)
        if (level <= maxLevel) {
          const item: OutlineItem = {
            level,
            text: element.textContent?.trim() || "",
            element,
          }

          if (showWordCount) {
            let nextBoundaryEl: Element | null = null
            for (let i = index + 1; i < allElements.length; i++) {
              const candidate = allElements[i]
              const candidateTagName = candidate.tagName.toLowerCase()

              if (
                candidate.classList.contains("user") &&
                candidate.classList.contains("chat-turn-container")
              ) {
                nextBoundaryEl = candidate
                break
              }

              if (/^h[1-6]$/.test(candidateTagName)) {
                const candidateLevel = parseInt(candidateTagName.charAt(1), 10)
                if (candidateLevel <= item.level) {
                  nextBoundaryEl = candidate
                  break
                }
              }
            }

            const turnContainer = element.closest("ms-chat-turn")
            item.wordCount = this.calculateRangeWordCount(
              element,
              nextBoundaryEl,
              turnContainer || container,
            )
          }

          outline.push(item)
        }
      }
    })

    return outline
  }

  isGenerating(): boolean {
    const runButton = document.querySelector("ms-run-button")
    if (runButton) {
      if ((runButton as HTMLElement).offsetParent !== null) {
        return false
      }
    }

    const stopIndicators = [
      "ms-stop-button",
      'button mat-icon[fonticon="stop"]',
      'button .material-symbols-outlined:not([class*="keyboard"])',
      ".mat-progress-spinner",
      ".mat-progress-bar",
    ]

    for (const selector of stopIndicators) {
      const el = document.querySelector(selector)
      if (el && (el as HTMLElement).offsetParent !== null) {
        if (selector.includes("material-symbols-outlined")) {
          const text = el.textContent?.trim()
          if (text === "stop" || text === "stop_circle") {
            return true
          }
        } else {
          return true
        }
      }
    }

    return false
  }

  getModelName(): string | null {
    const selectorBtn = document.querySelector("button.model-selector-card")
    if (selectorBtn) {
      const titleSpan = selectorBtn.querySelector("span.title") || selectorBtn.querySelector("span")
      const name = titleSpan?.textContent?.trim()
      if (name) {
        const sessionId = this.getSessionId()
        if (sessionId) {
          localStorage.setItem(`ophel:aistudio:model:${sessionId}`, name)
        }
        return name
      }
    }

    const sessionId = this.getSessionId()
    if (sessionId) {
      const cached = localStorage.getItem(`ophel:aistudio:model:${sessionId}`)
      if (cached) return cached
    }

    try {
      const prefStr = localStorage.getItem("aiStudioUserPreference")
      if (prefStr) {
        const pref = JSON.parse(prefStr)
        const modelPath = pref._promptModelOverride || pref.promptModel
        if (modelPath) {
          return modelPath.replace(/^models\//, "")
        }
      }
    } catch {
      // ignore
    }

    const urlParams = new URLSearchParams(window.location.search)
    const modelParam = urlParams.get("model")
    if (modelParam) {
      return modelParam
    }

    return "Gemini 1.5 Flash"
  }

  getLatestReplyText(): string | null {
    const aiMessages = document.querySelectorAll(
      ".chat-turn-container.model, .model-prompt-container",
    )
    if (aiMessages.length === 0) return null

    const lastMessage = aiMessages[aiMessages.length - 1]
    return this.extractTextWithLineBreaks(lastMessage)
  }

  getNewChatButtonSelectors(): string[] {
    return [
      'button[iconname="add"]',
      'button[data-test-clear="outside"]',
      'button .material-symbols-outlined[aria-hidden="true"]',
    ]
  }

  /**
   */
  async toggleTheme(targetMode: "light" | "dark"): Promise<boolean> {
    try {
      const prefStr = localStorage.getItem("aiStudioUserPreference") || "{}"
      const pref = JSON.parse(prefStr)

      pref.theme = targetMode

      localStorage.setItem("aiStudioUserPreference", JSON.stringify(pref))

      const body = document.body
      if (targetMode === "dark") {
        body.classList.add("dark-theme")
        body.classList.remove("light-theme")
      } else {
        body.classList.remove("dark-theme")
        body.classList.add("light-theme")
      }

      body.style.colorScheme = targetMode

      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "aiStudioUserPreference",
          newValue: JSON.stringify(pref),
          storageArea: localStorage,
        }),
      )

      const appRoot = document.querySelector("app-root, ms-app, body")
      if (appRoot) {
        appRoot.dispatchEvent(new CustomEvent("themechange", { detail: { theme: targetMode } }))
      }

      return true
    } catch (error) {
      console.error("[AIStudioAdapter] toggleTheme error:", error)
      return false
    }
  }

  /**
   */
  applySettings(settings: AIStudioSettings): void {
    try {
      const prefStr = localStorage.getItem("aiStudioUserPreference") || "{}"
      const pref = JSON.parse(prefStr)

      let hasChanges = false

      if (settings.collapseNavbar !== undefined) {
        const shouldExpand = !settings.collapseNavbar
        if (pref.isNavbarExpanded !== shouldExpand) {
          pref.isNavbarExpanded = shouldExpand
          hasChanges = true
        }
      }

      if (settings.collapseTools !== undefined) {
        const shouldOpen = !settings.collapseTools
        if (pref.areToolsOpen !== shouldOpen) {
          pref.areToolsOpen = shouldOpen
          hasChanges = true
        }
      }

      if (settings.collapseAdvanced !== undefined) {
        const shouldOpen = !settings.collapseAdvanced
        if (pref.isAdvancedOpen !== shouldOpen) {
          pref.isAdvancedOpen = shouldOpen
          hasChanges = true
        }
      }

      if (settings.enableSearch !== undefined) {
        if (pref.enableSearchAsATool !== settings.enableSearch) {
          pref.enableSearchAsATool = settings.enableSearch
          hasChanges = true
        }
      }

      if (settings.defaultModel && settings.defaultModel.trim() !== "") {
        const modelId = settings.defaultModel.trim()
        if (pref.promptModel !== modelId) {
          pref.promptModel = modelId
          pref._promptModelOverride = modelId
          hasChanges = true
        }
      }

      if (hasChanges) {
        localStorage.setItem("aiStudioUserPreference", JSON.stringify(pref))

        window.dispatchEvent(
          new StorageEvent("storage", {
            key: "aiStudioUserPreference",
            newValue: JSON.stringify(pref),
            storageArea: localStorage,
          }),
        )
      }
    } catch (error) {
      console.error("[AIStudioAdapter] applySettings error:", error)
    }
  }
}
