/**
 */
import { SITE_IDS } from "~constants"
import { htmlToMarkdown } from "~utils/exporter"
import { setSafeHTML } from "~utils/trusted-types"

import {
  SiteAdapter,
  type ConversationDeleteTarget,
  type ConversationInfo,
  type ConversationObserverConfig,
  type ExportConfig,
  type ModelSwitcherConfig,
  type NetworkMonitorConfig,
  type OutlineItem,
  type SiteDeleteConversationResult,
} from "./base"

const CLAUDE_DELETE_REASON = {
  UI_FAILED: "delete_ui_failed",
  BATCH_ABORTED_AFTER_UI_FAILURE: "delete_batch_aborted_after_ui_failure",
  API_ORG_MISSING: "delete_api_org_missing",
  API_REQUEST_FAILED: "delete_api_request_failed",
  API_NOT_FOUND_BUT_VISIBLE: "delete_api_not_found_but_visible",
} as const

const CLAUDE_DELETE_KEYWORDS = [
  "delete",
  "remove",
  "delete",
  "delete",
  "delete",
  "삭제",
  "supprimer",
  "eliminar",
  "elimina",
  "löschen",
  "excluir",
  "hapus",
  "हट",
  "मिट",
]

const CLAUDE_CANCEL_KEYWORDS = [
  "cancel",
  "cancel",
  "annuler",
  "abbrechen",
  "annulla",
  "キャンセル",
  "취소",
  "batal",
  "cancelar",
]

const ORG_ID_REGEX = /^[a-f0-9-]{36}$/i

export class ClaudeAdapter extends SiteAdapter {
  private activeOrganizationId: string | null = null
  private activeOrganizationIdExpiresAt = 0

  match(): boolean {
    return (
      window.location.hostname.includes("claude.ai") ||
      window.location.hostname.includes("claude.com")
    )
  }

  getSiteId(): string {
    return SITE_IDS.CLAUDE
  }

  getName(): string {
    return "Claude"
  }

  getThemeColors(): { primary: string; secondary: string } {
    return { primary: "#d97757", secondary: "#c66045" }
  }

  getNewTabUrl(): string {
    return "https://claude.ai/new"
  }

  isNewConversation(): boolean {
    return window.location.pathname === "/new" || window.location.pathname === "/"
  }

  isSharePage(): boolean {
    return window.location.pathname.startsWith("/public/")
  }

  getConversationList(): ConversationInfo[] {
    // Selector: a[data-dd-action-name="sidebar-chat-item"]
    const items = document.querySelectorAll('a[data-dd-action-name="sidebar-chat-item"]')

    return Array.from(items)
      .map((el) => {
        const href = el.getAttribute("href") || ""
        const idMatch = href.match(/\/chat\/([a-f0-9-]+)/)
        const id = idMatch ? idMatch[1] : ""

        const titleSpan = el.querySelector("span.truncate")
        const title = titleSpan?.textContent?.trim() || ""

        const isActive = window.location.href.includes(id)

        let isPinned = false
        const groupContainer = el.closest("div.flex.flex-col")
        if (groupContainer) {
          const h3 = groupContainer.querySelector("h3")
          const isNonCollapsible = h3 && !h3.hasAttribute("role")

          const ul = groupContainer.querySelector("ul")
          const hasStarredClass = ul?.classList.contains("-mx-1.5")

          isPinned = isNonCollapsible || hasStarredClass
        }

        return {
          id,
          title,
          url: href.startsWith("http") ? href : `https://claude.ai${href}`,
          isActive,
          isPinned,
        }
      })
      .filter((c) => c.id)
  }

  getSidebarScrollContainer(): Element | null {
    const nav = document.querySelector("nav")
    if (nav) {
      const scrollable = nav.querySelector("div.overflow-y-auto")
      return scrollable || nav
    }
    return null
  }

  async deleteConversationOnSite(
    target: ConversationDeleteTarget,
  ): Promise<SiteDeleteConversationResult> {
    return this.deleteConversationOnSiteInternal(target)
  }

  async deleteConversationsOnSite(
    targets: ConversationDeleteTarget[],
  ): Promise<SiteDeleteConversationResult[]> {
    const results: SiteDeleteConversationResult[] = []

    for (let index = 0; index < targets.length; index++) {
      const result = await this.deleteConversationOnSiteInternal(targets[index])
      results.push(result)

      if (!result.success && result.reason === CLAUDE_DELETE_REASON.UI_FAILED) {
        for (let i = index + 1; i < targets.length; i++) {
          results.push({
            id: targets[i].id,
            success: false,
            method: "none",
            reason: CLAUDE_DELETE_REASON.BATCH_ABORTED_AFTER_UI_FAILURE,
          })
        }
        break
      }
    }

    return results
  }

  private async deleteConversationOnSiteInternal(
    target: ConversationDeleteTarget,
  ): Promise<SiteDeleteConversationResult> {
    const apiResult = await this.tryDeleteViaNativeApi(target)
    if (apiResult.success) {
      return apiResult
    }

    const uiSuccess = await this.deleteConversationViaUi(target.id)
    return {
      id: target.id,
      success: uiSuccess,
      method: uiSuccess ? "ui" : "none",
      reason: uiSuccess ? undefined : apiResult.reason || CLAUDE_DELETE_REASON.UI_FAILED,
    }
  }

  private async tryDeleteViaNativeApi(
    target: ConversationDeleteTarget,
  ): Promise<SiteDeleteConversationResult> {
    const orgId = await this.getActiveOrganizationId()
    if (!orgId) {
      return {
        id: target.id,
        success: false,
        method: "none",
        reason: CLAUDE_DELETE_REASON.API_ORG_MISSING,
      }
    }

    const endpoint = `/api/organizations/${encodeURIComponent(orgId)}/chat_conversations/${encodeURIComponent(target.id)}`
    const bodies: Array<string | undefined> = [
      undefined,
      JSON.stringify({
        uuid: target.id,
        name: target.title || "",
      }),
    ]

    try {
      let lastStatus = 0

      for (const body of bodies) {
        const response = await fetch(endpoint, {
          method: "DELETE",
          headers: this.buildNativeDeleteHeaders(Boolean(body)),
          body,
          credentials: "include",
        })
        lastStatus = response.status

        if (response.ok) {
          this.syncSidebarAfterRemoteDelete(target.id)
          return { id: target.id, success: true, method: "api" }
        }

        if (response.status === 404) {
          if (!(await this.isConversationStillVisible(target.id))) {
            this.syncSidebarAfterRemoteDelete(target.id)
            return { id: target.id, success: true, method: "api" }
          }
          continue
        }

        if (response.status === 400 && !body) {
          continue
        }

        return {
          id: target.id,
          success: false,
          method: "api",
          reason: this.toDeleteApiHttpReason(response.status),
        }
      }

      return {
        id: target.id,
        success: false,
        method: "api",
        reason:
          lastStatus === 404
            ? CLAUDE_DELETE_REASON.API_NOT_FOUND_BUT_VISIBLE
            : this.toDeleteApiHttpReason(lastStatus || 0),
      }
    } catch {
      return {
        id: target.id,
        success: false,
        method: "api",
        reason: CLAUDE_DELETE_REASON.API_REQUEST_FAILED,
      }
    }
  }

  private buildNativeDeleteHeaders(withBody: boolean): Record<string, string> {
    const headers: Record<string, string> = {
      accept: "*/*",
      "anthropic-client-platform": "web_claude_ai",
      "anthropic-client-version": "1.0.0",
    }

    if (withBody) {
      headers["content-type"] = "application/json"
    }

    const anonymousId = this.readAnthropicAnonymousId()
    if (anonymousId) {
      headers["anthropic-anonymous-id"] = anonymousId
    }

    const deviceId = this.readAnthropicDeviceId()
    if (deviceId) {
      headers["anthropic-device-id"] = deviceId
    }

    const clientSha = this.readAnthropicClientSha()
    if (clientSha) {
      headers["anthropic-client-sha"] = clientSha
    }

    return headers
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

  private async getActiveOrganizationId(forceRefresh = false): Promise<string | null> {
    const now = Date.now()
    if (
      !forceRefresh &&
      this.activeOrganizationId &&
      this.activeOrganizationIdExpiresAt > now + 5 * 1000
    ) {
      return this.activeOrganizationId
    }

    if (this.isUserscriptRuntime()) {
      const fromApi = await this.fetchOrganizationIdFromApi()
      if (fromApi) {
        this.activeOrganizationId = fromApi
        this.activeOrganizationIdExpiresAt = now + 10 * 60 * 1000
        return fromApi
      }

      const fromStorage = this.getOrganizationIdFromStorage()
      if (fromStorage) {
        this.activeOrganizationId = fromStorage
        this.activeOrganizationIdExpiresAt = now + 10 * 60 * 1000
        return fromStorage
      }

      const fromCookie = this.getCookieValue("lastActiveOrg")
      if (this.isValidOrganizationId(fromCookie)) {
        this.activeOrganizationId = fromCookie
        this.activeOrganizationIdExpiresAt = now + 10 * 60 * 1000
        return fromCookie
      }

      return null
    }

    const fromCookie = this.getCookieValue("lastActiveOrg")
    if (this.isValidOrganizationId(fromCookie)) {
      this.activeOrganizationId = fromCookie
      this.activeOrganizationIdExpiresAt = now + 10 * 60 * 1000
      return fromCookie
    }

    const fromStorage = this.getOrganizationIdFromStorage()
    if (fromStorage) {
      this.activeOrganizationId = fromStorage
      this.activeOrganizationIdExpiresAt = now + 10 * 60 * 1000
      return fromStorage
    }

    const fromApi = await this.fetchOrganizationIdFromApi()
    if (fromApi) {
      this.activeOrganizationId = fromApi
      this.activeOrganizationIdExpiresAt = now + 10 * 60 * 1000
      return fromApi
    }

    return null
  }

  private isUserscriptRuntime(): boolean {
    return typeof __PLATFORM__ !== "undefined" && __PLATFORM__ === "userscript"
  }

  private async fetchOrganizationIdFromApi(): Promise<string | null> {
    try {
      const response = await fetch("/api/organizations", {
        method: "GET",
        headers: { accept: "application/json, text/plain, */*" },
        credentials: "include",
      })
      if (!response.ok) return null

      const payload = (await response.json()) as unknown
      return this.extractOrganizationId(payload)
    } catch {
      return null
    }
  }

  private getOrganizationIdFromStorage(): string | null {
    const directKeys = [
      "lastActiveOrg",
      "activeOrg",
      "organizationId",
      "lastActiveOrganization",
      "LSS-lastActiveOrg",
    ]

    for (const key of directKeys) {
      const raw = localStorage.getItem(key)
      const orgId = this.extractOrganizationId(raw)
      if (orgId) return orgId
    }

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key || !key.toLowerCase().includes("org")) continue
      const raw = localStorage.getItem(key)
      const orgId = this.extractOrganizationId(raw)
      if (orgId) return orgId
    }

    return null
  }

  private extractOrganizationId(payload: unknown): string | null {
    if (!payload) return null

    if (typeof payload === "string") {
      const trimmed = payload.trim().replace(/^"(.*)"$/, "$1")
      if (this.isValidOrganizationId(trimmed)) return trimmed

      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
          return this.extractOrganizationId(JSON.parse(trimmed))
        } catch {
          return null
        }
      }

      const match = trimmed.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i)
      return match ? match[0] : null
    }

    if (Array.isArray(payload)) {
      for (const item of payload) {
        const id = this.extractOrganizationId(item)
        if (id) return id
      }
      return null
    }

    if (typeof payload === "object") {
      const record = payload as Record<string, unknown>
      const candidateKeys = [
        "uuid",
        "id",
        "organization_uuid",
        "organization_id",
        "organizationId",
        "org_uuid",
      ]

      for (const key of candidateKeys) {
        const value = record[key]
        if (typeof value === "string" && this.isValidOrganizationId(value)) {
          return value
        }
      }

      for (const nestedKey of [
        "organizations",
        "organization",
        "activeOrganization",
        "currentOrganization",
      ]) {
        const nested = record[nestedKey]
        const id = this.extractOrganizationId(nested)
        if (id) return id
      }
    }

    return null
  }

  private isValidOrganizationId(value: string | null | undefined): boolean {
    return typeof value === "string" && ORG_ID_REGEX.test(value)
  }

  private readAnthropicDeviceId(): string | null {
    return this.getCookieValue("anthropic-device-id")
  }

  private readAnthropicAnonymousId(): string | null {
    return (
      this.getCookieValue("anthropic-anonymous-id") ||
      localStorage.getItem("anthropic-anonymous-id") ||
      localStorage.getItem("anthropicAnonymousId")
    )
  }

  private readAnthropicClientSha(): string | null {
    const fromMeta = document
      .querySelector('meta[name="sentry-release"], meta[name="anthropic-client-sha"]')
      ?.getAttribute("content")
    if (fromMeta) return fromMeta

    const fromGlobal = (window as unknown as Record<string, unknown>).__SENTRY_RELEASE__
    if (typeof fromGlobal === "string" && fromGlobal.length > 0) {
      return fromGlobal
    }

    return null
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

  private syncSidebarAfterRemoteDelete(id: string): void {
    const row = this.findConversationRow(id)
    if (!row) return

    const container = (row.closest("li") || row) as HTMLElement
    container.remove()
  }

  private async deleteConversationViaUi(id: string): Promise<boolean> {
    const row = await this.findConversationRowWithRetry(id)
    if (!row) return false

    const menuButton = await this.findConversationMenuButton(row, id)
    if (!menuButton) return false

    this.simulateClick(menuButton)

    const deleteMenuItem = await this.waitForDeleteMenuItem(menuButton)
    if (!deleteMenuItem) return false
    this.simulateClick(deleteMenuItem)

    if (await this.waitForConversationRemoved(id, 1000)) {
      return true
    }

    const confirmButton = await this.waitForDeleteConfirmButton()
    if (confirmButton) {
      this.simulateClick(confirmButton)
    }

    return this.waitForConversationRemoved(id, 5000)
  }

  private async isConversationStillVisible(id: string): Promise<boolean> {
    const row = await this.findConversationRowWithRetry(id)
    return !!row
  }

  private async findConversationRowWithRetry(id: string): Promise<HTMLElement | null> {
    const first = this.findConversationRow(id)
    if (first) return first

    await this.loadAllConversations()
    await this.sleep(200)
    return this.findConversationRow(id)
  }

  private findConversationRow(id: string): HTMLElement | null {
    return document.querySelector(
      `a[data-dd-action-name="sidebar-chat-item"][href="/chat/${id}"], a[data-dd-action-name="sidebar-chat-item"][href$="/chat/${id}"], a[data-dd-action-name="sidebar-chat-item"][href*="/chat/${id}?"]`,
    ) as HTMLElement | null
  }

  private async findConversationMenuButton(
    row: HTMLElement,
    _id: string,
  ): Promise<HTMLElement | null> {
    const owner = (row.closest("li") || row.parentElement || row) as HTMLElement
    const menuSelector = [
      'button[aria-haspopup="menu"]',
      'button[data-testid*="menu"]',
      'button[aria-label*="more"]',
      'button[aria-label*="More"]',
      'button[aria-label*="options"]',
      'button[aria-label*="Options"]',
      'button[aria-label*="More"]',
      'button[aria-label*="Options"]',
      'button[aria-label*="Options"]',
    ].join(", ")

    for (let attempt = 0; attempt < 10; attempt++) {
      owner.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }))
      owner.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }))
      row.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }))
      row.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }))

      const candidates = Array.from(owner.querySelectorAll(menuSelector)) as HTMLElement[]
      const visibleCandidates = candidates.filter((item) => this.isVisible(item))
      if (visibleCandidates.length > 0) {
        const rightMost = this.pickRightMostElement(visibleCandidates)
        if (rightMost) return rightMost
      }

      const allButtons = Array.from(owner.querySelectorAll("button")) as HTMLElement[]
      const iconButtons = allButtons.filter((item) => this.isVisible(item))
      if (iconButtons.length > 0) {
        const rightMost = this.pickRightMostElement(iconButtons)
        if (rightMost) return rightMost
      }

      await this.sleep(80)
    }

    return null
  }

  private getMenuScopeFromTrigger(trigger: HTMLElement): HTMLElement | null {
    const controlledId = trigger.getAttribute("aria-controls") || trigger.getAttribute("aria-owns")
    if (controlledId) {
      const controlled = document.getElementById(controlledId)
      if (controlled) return controlled
    }

    const menus = Array.from(
      document.querySelectorAll('[role="menu"], [data-radix-menu-content], [data-state="open"]'),
    ) as HTMLElement[]
    const visibleMenus = menus.filter((menu) => this.isVisible(menu))
    if (visibleMenus.length === 0) return null
    return this.pickNearestElement(trigger, visibleMenus)
  }

  private async waitForDeleteMenuItem(
    menuTrigger: HTMLElement,
    timeout = 2500,
  ): Promise<HTMLElement | null> {
    const start = Date.now()
    while (Date.now() - start < timeout) {
      const menuScope = this.getMenuScopeFromTrigger(menuTrigger)
      const rawItems = menuScope
        ? (Array.from(menuScope.querySelectorAll('[role="menuitem"], button')) as HTMLElement[])
        : (Array.from(
            document.querySelectorAll('[role="menuitem"], [role="menu"] button'),
          ) as HTMLElement[])

      for (const item of rawItems) {
        if (!this.isVisible(item)) continue
        const text = this.getSignalText(item)
        if (!this.hasKeyword(text, CLAUDE_DELETE_KEYWORDS)) continue
        if (this.hasKeyword(text, CLAUDE_CANCEL_KEYWORDS)) continue
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
        if (!this.hasKeyword(text, CLAUDE_DELETE_KEYWORDS)) continue
        if (this.hasKeyword(text, CLAUDE_CANCEL_KEYWORDS)) continue
        return button
      }

      await this.sleep(80)
    }
    return null
  }

  private findVisibleDialog(): HTMLElement | null {
    const dialogs = Array.from(
      document.querySelectorAll('[role="dialog"], [aria-modal="true"], [data-state="open"]'),
    ) as HTMLElement[]
    return dialogs.find((dialog) => this.isVisible(dialog)) || null
  }

  private async waitForConversationRemoved(id: string, timeout = 3500): Promise<boolean> {
    const start = Date.now()
    while (Date.now() - start < timeout) {
      if (!this.findConversationRow(id)) return true
      await this.sleep(80)
    }
    return false
  }

  private pickRightMostElement(elements: HTMLElement[]): HTMLElement | null {
    if (elements.length === 0) return null
    return [...elements].sort(
      (a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right,
    )[0]
  }

  private pickNearestElement(anchor: HTMLElement, elements: HTMLElement[]): HTMLElement | null {
    if (elements.length === 0) return null

    const anchorRect = anchor.getBoundingClientRect()
    const anchorX = anchorRect.left + anchorRect.width / 2
    const anchorY = anchorRect.top + anchorRect.height / 2

    let nearest: HTMLElement | null = null
    let nearestDistance = Number.POSITIVE_INFINITY

    for (const element of elements) {
      const rect = element.getBoundingClientRect()
      const x = rect.left + rect.width / 2
      const y = rect.top + rect.height / 2
      const distance = Math.hypot(x - anchorX, y - anchorY)
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearest = element
      }
    }

    return nearest
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

  getTextareaSelectors(): string[] {
    return ['[contenteditable="true"]', ".ProseMirror", 'div[role="textbox"]']
  }

  getSubmitButtonSelectors(): string[] {
    return [
      'button[aria-label="Send Message"]',
      'button[data-testid="send-button"]',
      'button[aria-label="Send"]',
    ]
  }

  isValidTextarea(element: HTMLElement): boolean {
    if (element.offsetParent === null) return false
    if (element.closest(".gh-main-panel")) return false

    const isContentEditable = element.getAttribute("contenteditable") === "true"
    const isProseMirror = element.classList.contains("ProseMirror")
    const isTextbox = element.getAttribute("role") === "textbox"

    return isContentEditable || isProseMirror || isTextbox
  }

  insertPrompt(content: string): boolean {
    const editor = this.getTextareaElement()
    if (!editor) return false

    editor.focus()

    try {
      document.execCommand("selectAll", false, undefined)
      if (!document.execCommand("insertText", false, content)) {
        throw new Error("execCommand failed")
      }
    } catch {
      editor.textContent = content
      editor.dispatchEvent(new Event("input", { bubbles: true }))
    }
    return true
  }

  clearTextarea(): void {
    const editor = this.getTextareaElement()
    if (!editor) return

    editor.focus()
    try {
      document.execCommand("selectAll", false, undefined)
      document.execCommand("delete", false, undefined)
    } catch {
      editor.textContent = ""
    }
    editor.dispatchEvent(new Event("input", { bubbles: true }))
  }

  getConversationTitle(): string | null {
    // Selector: a[data-dd-action-name="sidebar-chat-item"] active??
    const currentId = this.getSessionId()
    if (currentId && currentId !== "default") {
      const activeItem = document.querySelector(`a[href*="${currentId}"]`)
      if (activeItem) {
        return activeItem.querySelector("span.truncate")?.textContent?.trim() || null
      }
    }
    return null
  }

  getScrollContainer(): HTMLElement | null {
    const mainContent = document.getElementById("main-content")
    if (mainContent) {
      const scrollable = mainContent.querySelector(".overflow-y-scroll")
      if (scrollable) return scrollable as HTMLElement
    }
    return super.getScrollContainer()
  }

  getChatContentSelectors(): string[] {
    return ['div[data-testid="user-message"]', "div.font-claude-response"]
  }

  getModelName(): string | null {
    const selectorBtn = document.querySelector('button[data-testid="model-selector-dropdown"]')
    if (selectorBtn && selectorBtn.textContent) {
      return selectorBtn.textContent.trim()
    }
    return null
  }

  getModelSwitcherConfig(keyword: string): ModelSwitcherConfig {
    return {
      targetModelKeyword: keyword,
      selectorButtonSelectors: ['button[data-testid="model-selector-dropdown"]'],
      menuItemSelector: 'div[role="menuitem"]',
      checkInterval: 1000,
      maxAttempts: 20,
      subMenuSelector: '[aria-haspopup="menu"]',
      subMenuTriggers: ["more models", "more models"],
    }
  }

  /**
   */
  protected simulateClick(element: HTMLElement): void {
    const eventTypes = ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]
    for (const type of eventTypes) {
      element.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          view: window,
          pointerId: 1,
        }),
      )
    }
  }

  getNewChatButtonSelectors(): string[] {
    return ['a[data-dd-action-name="sidebar-new-item"]', 'a[href="/new"]']
  }

  getDefaultLockSettings(): { enabled: boolean; keyword: string } {
    return { enabled: false, keyword: "sonnet" }
  }

  extractOutline(maxLevel = 6, includeUserQueries = false, showWordCount = false): OutlineItem[] {
    const outline: OutlineItem[] = []
    const scrollContainer = this.getScrollContainer()
    if (!scrollContainer) return outline

    const removeThinkingContent = (text: string): string => {
      return text.replace(/<thinking>[\s\S]*?<\/thinking>/gi, "").trim()
    }

    const userQuerySelector = this.getUserQuerySelector()
    const calculateUserQueryWordCount = (startEl: Element): number => {
      const allUserQueries = Array.from(scrollContainer?.querySelectorAll(userQuerySelector) ?? [])
      const allResponses = Array.from(
        scrollContainer?.querySelectorAll(".font-claude-response") ?? [],
      )

      const startIndex = allUserQueries.indexOf(startEl)
      if (startIndex === -1) return 0

      const nextUserQuery = allUserQueries[startIndex + 1]

      let totalLength = 0
      for (const response of allResponses) {
        const pos = startEl.compareDocumentPosition(response)
        if (!(pos & Node.DOCUMENT_POSITION_FOLLOWING)) continue

        if (nextUserQuery) {
          const posToNext = nextUserQuery.compareDocumentPosition(response)
          if (posToNext & Node.DOCUMENT_POSITION_FOLLOWING) continue
        }

        const markdownContent = response.querySelector(".standard-markdown, .progressive-markdown")
        if (markdownContent) {
          const rawText = markdownContent.textContent?.trim() || ""
          const textWithoutThinking = removeThinkingContent(rawText)
          totalLength += textWithoutThinking.length
        }
      }

      return totalLength
    }

    const headings = Array.from(scrollContainer.querySelectorAll("h1, h2, h3, h4, h5, h6"))

    headings.forEach((h, index) => {
      const level = parseInt(h.tagName[1])
      if (level > maxLevel) return

      if (h.classList.contains("pointer-events-none")) return

      const text = h.textContent?.trim() || ""
      if (!text) return

      const item: OutlineItem = {
        level,
        text: text.length > 200 ? text.slice(0, 200) : text,
        element: h,
        isUserQuery: false,
        isTruncated: text.length > 80,
      }

      if (showWordCount) {
        let nextBoundaryEl: Element | null = null
        for (let i = index + 1; i < headings.length; i++) {
          const candidate = headings[i]
          const candidateLevel = parseInt(candidate.tagName[1])
          if (candidateLevel <= level) {
            nextBoundaryEl = candidate
            break
          }
        }

        const responseContainer = h.closest(".font-claude-response")
        if (responseContainer) {
          const rawCount = this.calculateRangeWordCount(h, nextBoundaryEl, responseContainer)
          item.wordCount = rawCount
        }
      }

      outline.push(item)
    })

    if (includeUserQueries) {
      const userQueries = scrollContainer.querySelectorAll('[data-testid="user-message"]')
      userQueries.forEach((el) => {
        const text = el.textContent?.trim() || ""
        if (!text) return

        const item: OutlineItem = {
          level: 0,
          text: text.length > 200 ? text.slice(0, 200) : text,
          element: el,
          isUserQuery: true,
          isTruncated: text.length > 60,
        }

        if (showWordCount) {
          item.wordCount = calculateUserQueryWordCount(el)
        }

        outline.push(item)
      })

      outline.sort((a, b) => {
        if (!a.element || !b.element) return 0
        const pos = a.element.compareDocumentPosition(b.element)
        return pos & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
      })
    }

    return outline
  }

  isGenerating(): boolean {
    const stopBtn = document.querySelector('button[aria-label="Stop response"]')
    if (stopBtn) return true

    const streaming = document.querySelector('[class*="streaming"], [class*="typing"]')
    if (streaming) return true

    return false
  }

  getNetworkMonitorConfig(): NetworkMonitorConfig {
    return {
      urlPatterns: ["/api/", "/completion"],
      silenceThreshold: 500,
    }
  }

  getExportConfig(): ExportConfig {
    return {
      userQuerySelector: '[data-testid="user-message"]',
      assistantResponseSelector: ".font-claude-response",
      turnSelector: null,
      useShadowDOM: false,
    }
  }

  getLatestReplyText(): string | null {
    const responses = document.querySelectorAll(".font-claude-response")
    if (responses.length === 0) return null

    const lastResponse = responses[responses.length - 1]

    const markdownContent = lastResponse.querySelector(".standard-markdown, .progressive-markdown")
    if (markdownContent) {
      return markdownContent.textContent?.trim() || null
    }

    return lastResponse.textContent?.trim() || null
  }

  getResponseContainerSelector(): string {
    return ".font-claude-response"
  }

  getUserQuerySelector(): string {
    return '[data-testid="user-message"]'
  }

  extractUserQueryText(element: Element): string {
    return element.textContent?.trim() || ""
  }

  extractUserQueryMarkdown(element: Element): string {
    const textParagraphs = element.querySelectorAll("p.whitespace-pre-wrap")
    if (textParagraphs.length === 0) {
      return ""
    }

    const paragraphsToRender: string[] = []
    textParagraphs.forEach((p) => {
      const text = p.textContent || ""
      const hasUnrendered =
        /^#{1,6}\s/m.test(text) || /\*\*[^*]+\*\*/.test(text) || /\*[^*]+\*/.test(text)

      if (hasUnrendered) {
        paragraphsToRender.push(text)
      }
    })

    if (paragraphsToRender.length === 0) {
      return ""
    }

    return "# CLAUDE_INCREMENTAL\nplaceholder"
  }

  replaceUserQueryContent(element: Element, _html: string): boolean {
    if (element.querySelector(".gh-claude-enhanced")) {
      return false
    }

    const textParagraphs = element.querySelectorAll("p.whitespace-pre-wrap")
    if (textParagraphs.length === 0) return false

    let hasChanges = false

    textParagraphs.forEach((p) => {
      const text = p.textContent || ""

      const hasHeaders = /^#{1,6}\s/m.test(text)
      const hasBold = /\*\*[^*]+\*\*/.test(text)
      const hasItalic = /(?<!\*)\*(?!\*)[^*]+\*(?!\*)/.test(text)

      if (!hasHeaders && !hasBold && !hasItalic) {
        return
      }

      let html = text

      html = html.replace(/^(#{1,6})\s+(.+)$/gm, (_, hashes, content) => {
        const level = hashes.length
        const sizeClass =
          level === 1 ? "text-[1.375rem]" : level === 2 ? "text-[1.125rem]" : "text-base"
        return `<h${level} class="text-text-100 mt-2 -mb-1 ${sizeClass} font-bold">${content}</h${level}>`
      })

      html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")

      html = html.replace(/(?<!\*)\*(?!\*)([^*]+)\*(?!\*)/g, "<em>$1</em>")

      html = html
        .split("\n")
        .map((line) => {
          if (line.startsWith("<h") || line.trim() === "") return line
          return line
        })
        .join("<br>")

      const rendered = document.createElement("div")
      rendered.className = "gh-claude-enhanced whitespace-pre-wrap break-words"
      setSafeHTML(rendered, html)

      p.replaceWith(rendered)
      hasChanges = true
    })

    return hasChanges
  }

  /**
   */
  extractAssistantResponseText(element: Element): string {
    let result = ""

    const artifacts = element.querySelectorAll(".artifact-block-cell")
    if (artifacts.length > 0) {
      artifacts.forEach((artifact) => {
        const titleElem = artifact.querySelector(".line-clamp-1")
        const title = titleElem?.textContent?.trim() || "Untitled"

        const versionElem = artifact.querySelector(".text-text-400")
        const version = versionElem?.textContent?.trim()

        const downloadLink = element.querySelector('a[download][href^="blob:"]')
        const link = downloadLink?.getAttribute("href")

        if (link) {
          result += `\n[Artifact: ${title}${version ? ` - ${version}` : ""} | Download: ${link}]\n\n`
        } else {
          result += `\n[Artifact: ${title}${version ? ` - ${version}` : ""}]\n\n`
        }
      })
    }

    const markdownContent = element.querySelector(".standard-markdown, .progressive-markdown")
    if (markdownContent) {
      const markdown = htmlToMarkdown(markdownContent)
      result += markdown || markdownContent.textContent?.trim() || ""
    }

    return result.trim()
  }

  getConversationObserverConfig(): ConversationObserverConfig {
    return {
      selector: 'a[data-dd-action-name="sidebar-chat-item"]',
      shadow: false,
      extractInfo: (el: Element): ConversationInfo | null => {
        const href = el.getAttribute("href") || ""
        const idMatch = href.match(/\/chat\/([a-f0-9-]+)/)
        const id = idMatch ? idMatch[1] : ""
        if (!id) return null

        const titleSpan = el.querySelector("span.truncate")
        const title = titleSpan?.textContent?.trim() || ""

        let isPinned = false
        const groupContainer = el.closest("div.flex.flex-col")
        if (groupContainer) {
          const h3 = groupContainer.querySelector("h3")
          const isNonCollapsible = h3 && !h3.hasAttribute("role")
          const ul = groupContainer.querySelector("ul")
          const hasStarredClass = ul?.classList.contains("-mx-1.5")
          isPinned = isNonCollapsible || hasStarredClass
        }

        return {
          id,
          title,
          url: `https://claude.ai${href}`,
          isActive: window.location.href.includes(id),
          isPinned,
        }
      },
      getTitleElement: (el: Element): Element | null => {
        return el.querySelector("span.truncate")
      },
    }
  }

  navigateToConversation(id: string, url?: string): boolean {
    const targetUrl = url || `https://claude.ai/chat/${id}`
    const link = document.querySelector(`a[href*="${id}"]`) as HTMLAnchorElement
    if (link) {
      link.click()
      return true
    }
    window.location.href = targetUrl
    return true
  }

  getSessionName(): string | null {
    return this.getConversationTitle()
  }

  getWidthSelectors() {
    return [
      { selector: "#main-content .max-w-3xl", property: "max-width" },
      { selector: "#main-content .max-w-4xl", property: "max-width" },
    ]
  }

  getZenModeSelectors() {
    return [{ selector: '[data-disclaimer="true"]', action: "hide" as const }]
  }

  getUserQueryWidthSelectors() {
    return [{ selector: '[data-testid="user-message"]', property: "max-width" }]
  }

  async toggleTheme(targetMode: "light" | "dark"): Promise<boolean> {
    try {
      const themeData = {
        value: targetMode,
        tabId: crypto.randomUUID(),
        timestamp: Date.now(),
      }
      localStorage.setItem("LSS-userThemeMode", JSON.stringify(themeData))

      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "LSS-userThemeMode",
          newValue: JSON.stringify(themeData),
        }),
      )

      await new Promise((r) => setTimeout(r, 300))
      return true
    } catch (error) {
      console.error("[ClaudeAdapter] toggleTheme error:", error)
      return false
    }
  }
}
