/**
 *
 *
 */
import { SITE_IDS } from "~constants"
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

const DEFAULT_TITLE = "Grok"

const DELETE_REASON = {
  UI_FAILED: "delete_ui_failed",
  BATCH_ABORTED_AFTER_UI_FAILURE: "delete_batch_aborted_after_ui_failure",
  API_REQUEST_FAILED: "delete_api_request_failed",
  API_NOT_FOUND_BUT_VISIBLE: "delete_api_not_found_but_visible",
} as const

const DELETE_KEYWORDS = [
  "delete",
  "remove",
  "delete",
  "delete",
  "supprimer",
  "eliminar",
  "löschen",
  "delete",
  "삭제",
  "удал",
  "excluir",
]

const CONFIRM_KEYWORDS = [
  "confirm",
  "ok",
  "yes",
  "confirm",
  "confirm",
  "confirm",
  "confirm",
  "check",
]

export class GrokAdapter extends SiteAdapter {
  match(): boolean {
    const hostname = window.location.hostname
    return hostname === "grok.com" || hostname.endsWith(".grok.com")
  }

  getSiteId(): string {
    return SITE_IDS.GROK
  }

  getName(): string {
    return "Grok"
  }

  getThemeColors(): { primary: string; secondary: string } {
    return { primary: "#f39c12", secondary: "#1e1f22" }
  }

  getNewTabUrl(): string {
    return "https://grok.com/"
  }

  isNewConversation(): boolean {
    const path = window.location.pathname
    return path === "/" || path === ""
  }

  private cachedDialogConversations: Map<string, ConversationInfo> | null = null

  private reloadScheduled = false

  async loadAllConversations(): Promise<void> {
    const sidebar = document.querySelector('[data-sidebar="content"]')
    if (!sidebar) return

    const viewAllBtn = sidebar.querySelector(
      "button.w-full.justify-start.text-xs.text-secondary.font-semibold",
    )

    if (viewAllBtn) {
      const { showToast } = await import("~utils/toast")
      const { t } = await import("~utils/i18n")
      showToast(t("grokSyncingConversations") || "Syncing conversations, please wait...")
      ;(viewAllBtn as HTMLElement).click()

      let cmdkList: Element | null = null
      for (let i = 0; i < 30; i++) {
        await new Promise((resolve) => setTimeout(resolve, 100))
        cmdkList = document.querySelector('[cmdk-list-sizer=""], [cmdk-list]')
        if (cmdkList) break
      }

      if (cmdkList) {
        let prevHeight = 0
        let stableCount = 0
        const maxAttempts = 15

        for (let i = 0; i < maxAttempts; i++) {
          cmdkList.scrollTop = cmdkList.scrollHeight
          await new Promise((resolve) => setTimeout(resolve, 400))

          const currentHeight = cmdkList.scrollHeight
          if (currentHeight === prevHeight) {
            stableCount++
            if (stableCount >= 3) break
          } else {
            stableCount = 0
            prevHeight = currentHeight
          }
        }
      }

      this.cacheDialogConversations()

      this.dispatchEscapeKey()

      setTimeout(() => {
        this.cachedDialogConversations = null
      }, 5000)

      return
    }
  }

  private cacheDialogConversations(): void {
    const cache = new Map<string, ConversationInfo>()

    const allLinks = document.querySelectorAll('a[href^="/c/"]')
    allLinks.forEach((link) => {
      const href = link.getAttribute("href")
      if (!href) return

      const id = this.extractConversationIdFromHref(href)
      if (!id) return
      if (cache.has(id)) return

      let title = "New Chat"
      let isActive = false
      const isPinned = false

      const cmdkItem = link.closest("[cmdk-item]")
      if (cmdkItem) {
        const titleSpan = cmdkItem.querySelector("span.truncate")
        title = titleSpan?.textContent?.trim() || title
        isActive = cmdkItem.querySelector('[class*="border-border-l2"]') !== null
      } else {
        title = link.textContent?.trim() || title
      }

      cache.set(id, {
        id,
        title,
        url: href,
        isPinned,
        isActive,
      })
    })

    this.cachedDialogConversations = cache
  }

  getConversationList(): ConversationInfo[] {
    const conversationMap = new Map<string, ConversationInfo>()

    const sidebar = document.querySelector('[data-sidebar="content"]')
    if (sidebar) {
      const groups = sidebar.querySelectorAll('[data-sidebar="group"]')
      groups.forEach((group) => {
        const links = group.querySelectorAll('a[href^="/c/"]')
        if (links.length === 0) return

        const hasStickyDateHeader = group.querySelector(".sticky") !== null
        const isPinnedGroup = !hasStickyDateHeader

        links.forEach((link) => {
          const href = link.getAttribute("href")
          if (!href) return

          const id = this.extractConversationIdFromHref(href)
          if (!id) return
          const titleSpan = link.querySelector("span.flex-1, span.truncate, span")
          const title = titleSpan?.textContent?.trim() || link.textContent?.trim() || "New Chat"
          const isActive = link.classList.contains("bg-button-ghost-hover")

          conversationMap.set(id, {
            id,
            title,
            url: href,
            isPinned: isPinnedGroup,
            isActive,
          })
        })
      })
    }

    const allLinks = document.querySelectorAll('a[href^="/c/"]')
    allLinks.forEach((link) => {
      const href = link.getAttribute("href")
      if (!href) return

      const id = this.extractConversationIdFromHref(href)
      if (!id) return
      if (conversationMap.has(id)) return

      let title = "New Chat"
      let isActive = false
      const isPinned = false

      const cmdkItem = link.closest("[cmdk-item]")
      if (cmdkItem) {
        const titleSpan = cmdkItem.querySelector("span.truncate")
        title = titleSpan?.textContent?.trim() || title
        isActive = cmdkItem.querySelector('[class*="border-border-l2"]') !== null
      } else {
        title = link.textContent?.trim() || title
      }

      conversationMap.set(id, {
        id,
        title,
        url: href,
        isPinned,
        isActive,
      })
    })

    if (this.cachedDialogConversations) {
      this.cachedDialogConversations.forEach((conv, id) => {
        if (!conversationMap.has(id)) {
          conversationMap.set(id, conv)
        }
      })
    }

    return Array.from(conversationMap.values())
  }

  getSidebarScrollContainer(): Element | null {
    return document.querySelector('[data-sidebar="content"]')
  }

  getConversationObserverConfig(): ConversationObserverConfig | null {
    return {
      selector:
        '[data-sidebar="content"] a[href^="/c/"], [cmdk-item][data-value^="conversation:"] a[href^="/c/"]',
      shadow: false,
      extractInfo: (el: Element) => {
        const href = el.getAttribute("href")
        if (!href) return null
        const id = this.extractConversationIdFromHref(href)
        if (!id) return null

        const isFromSidebar = !!el.closest('[data-sidebar="content"]')
        const isFromCmdk = !!el.closest("[cmdk-item]")

        let title = ""
        let isPinned = false

        if (isFromSidebar) {
          const titleSpan = el.querySelector("span.flex-1, span.truncate, span")
          title = titleSpan?.textContent?.trim() || el.textContent?.trim() || ""
          const group = el.closest('[data-sidebar="group"]')
          const hasStickyDateHeader = group?.querySelector(".sticky") !== null
          isPinned = !hasStickyDateHeader
        } else if (isFromCmdk) {
          const cmdkItem = el.closest("[cmdk-item]")
          const titleSpan = cmdkItem?.querySelector("span.truncate")
          title = titleSpan?.textContent?.trim() || ""
          isPinned = false
        }

        return { id, title, url: href, isPinned }
      },
      getTitleElement: (el: Element) => {
        const cmdkItem = el.closest("[cmdk-item]")
        if (cmdkItem) {
          return cmdkItem.querySelector("span.truncate") || el
        }
        return el.querySelector("span.flex-1, span.truncate, span") || el
      },
    }
  }

  navigateToConversation(id: string, url?: string): boolean {
    if (url) {
      window.location.href = url
      return true
    }
    window.location.href = `/c/${id}`
    return true
  }

  async deleteConversationOnSite(
    target: ConversationDeleteTarget,
  ): Promise<SiteDeleteConversationResult> {
    const result = await this.deleteConversationOnSiteInternal(target)
    if (result.success) {
      this.scheduleFullReloadAfterDelete([target.id])
    }
    return result
  }

  async deleteConversationsOnSite(
    targets: ConversationDeleteTarget[],
  ): Promise<SiteDeleteConversationResult[]> {
    const results: SiteDeleteConversationResult[] = []
    const deletedIds: string[] = []

    for (let index = 0; index < targets.length; index++) {
      const result = await this.deleteConversationOnSiteInternal(targets[index])
      results.push(result)
      if (result.success) {
        deletedIds.push(targets[index].id)
      }

      // UI fallback failsafe: avoid cascading wrong deletions during batch actions.
      if (!result.success && result.reason === DELETE_REASON.UI_FAILED) {
        for (let i = index + 1; i < targets.length; i++) {
          results.push({
            id: targets[i].id,
            success: false,
            method: "none",
            reason: DELETE_REASON.BATCH_ABORTED_AFTER_UI_FAILURE,
          })
        }
        break
      }
    }

    if (deletedIds.length > 0) {
      this.scheduleFullReloadAfterDelete(deletedIds)
    }

    return results
  }

  private async deleteConversationOnSiteInternal(
    target: ConversationDeleteTarget,
  ): Promise<SiteDeleteConversationResult> {
    const apiResult = await this.tryDeleteViaNativeApi(target.id)
    if (apiResult.success) {
      return apiResult
    }

    const uiSuccess = await this.deleteConversationViaUi(target.id)
    if (uiSuccess) {
      return {
        id: target.id,
        success: true,
        method: "ui",
      }
    }

    return {
      id: target.id,
      success: false,
      method: "none",
      reason: apiResult.reason || DELETE_REASON.UI_FAILED,
    }
  }

  private async tryDeleteViaNativeApi(id: string): Promise<SiteDeleteConversationResult> {
    const endpoint = `/rest/app-chat/conversations/soft/${encodeURIComponent(id)}`

    try {
      const response = await fetch(endpoint, {
        method: "DELETE",
        headers: this.buildNativeDeleteHeaders(),
        credentials: "include",
      })

      if (response.ok) {
        this.syncConversationListAfterDelete(id)
        return {
          id,
          success: true,
          method: "api",
        }
      }

      if (response.status === 404) {
        if (!this.isConversationVisible(id)) {
          this.syncConversationListAfterDelete(id)
          return {
            id,
            success: true,
            method: "api",
          }
        }

        return {
          id,
          success: false,
          method: "api",
          reason: DELETE_REASON.API_NOT_FOUND_BUT_VISIBLE,
        }
      }

      return {
        id,
        success: false,
        method: "api",
        reason: this.toDeleteApiHttpReason(response.status),
      }
    } catch {
      return {
        id,
        success: false,
        method: "api",
        reason: DELETE_REASON.API_REQUEST_FAILED,
      }
    }
  }

  private buildNativeDeleteHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      accept: "*/*",
      "x-xai-request-id": this.generateRequestId(),
    }

    const statsigId = this.getStatsigId()
    if (statsigId) {
      headers["x-statsig-id"] = statsigId
    }

    return headers
  }

  private getStatsigId(): string | null {
    const directKeys = ["x-statsig-id", "statsig.stableID", "statsig.stable_id", "statsigStableId"]
    for (const key of directKeys) {
      const value = localStorage.getItem(key)
      if (typeof value === "string" && value.length > 0) {
        return value
      }
    }

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (!key || !key.toLowerCase().includes("statsig")) continue
        const raw = localStorage.getItem(key)
        if (!raw) continue

        if (raw.startsWith("{")) {
          try {
            const parsed = JSON.parse(raw) as Record<string, unknown>
            const candidate = parsed?.stableID || parsed?.stableId || parsed?.id
            if (typeof candidate === "string" && candidate.length > 0) {
              return candidate
            }
          } catch {
            // ignore invalid JSON payload
          }
        }

        if (raw.length > 0) return raw
      }
    } catch {
      // ignore storage access issues
    }

    return null
  }

  private generateRequestId(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID()
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`
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

  private syncConversationListAfterDelete(id: string): void {
    this.cachedDialogConversations?.delete(id)
    const anchors = this.findConversationAnchors(id)
    for (const anchor of anchors) {
      const item = this.getConversationItemContainer(anchor)
      item.remove()
    }
  }

  private scheduleFullReloadAfterDelete(deletedIds: string[]): void {
    if (this.reloadScheduled || deletedIds.length === 0) return

    const currentId = this.extractConversationIdFromHref(window.location.pathname)
    if (currentId && deletedIds.includes(currentId)) {
      try {
        window.history.replaceState(window.history.state, "", "/")
      } catch {
        // ignore routing errors
      }
    }

    this.reloadScheduled = true
    window.setTimeout(() => {
      window.location.reload()
    }, 120)
  }

  private async deleteConversationViaUi(id: string): Promise<boolean> {
    let openedDialogByUs = false

    try {
      let anchor = await this.findConversationAnchorWithRetry(id, 400)

      if (!anchor) {
        openedDialogByUs = await this.openConversationDialogIfNeeded()
        if (this.getCmdkListElement()) {
          await this.scrollCmdkListToLoadAll()
        }
        anchor = await this.findConversationAnchorWithRetry(id, 1200)
      }

      if (!anchor) return false

      const item = this.getConversationItemContainer(anchor)
      this.revealConversationActions(item, anchor)

      const deleteButton = await this.waitForDeleteButton(item, 2000)
      if (!deleteButton) return false

      this.simulateClick(deleteButton)

      const confirmButton = await this.waitForConfirmButton(item, 2200)
      if (!confirmButton) return false

      this.simulateClick(confirmButton)

      const removed = await this.waitForConversationRemoved(id, 4000)
      if (removed) {
        this.syncConversationListAfterDelete(id)
      }

      return removed
    } finally {
      if (openedDialogByUs) {
        this.closeConversationDialog()
      }
    }
  }

  private async openConversationDialogIfNeeded(): Promise<boolean> {
    if (this.getCmdkListElement()) return false

    const viewAllButton = this.getViewAllButton()
    if (!viewAllButton) return false

    this.simulateClick(viewAllButton)

    const start = Date.now()
    while (Date.now() - start < 2500) {
      if (this.getCmdkListElement()) return true
      await this.sleep(80)
    }

    return false
  }

  private getViewAllButton(): HTMLElement | null {
    const sidebar = document.querySelector('[data-sidebar="content"]')
    if (!sidebar) return null

    return sidebar.querySelector(
      "button.w-full.justify-start.text-xs.text-secondary.font-semibold",
    ) as HTMLElement | null
  }

  private getCmdkListElement(): HTMLElement | null {
    return document.querySelector('[cmdk-list-sizer=""], [cmdk-list]') as HTMLElement | null
  }

  private closeConversationDialog(): void {
    this.dispatchEscapeKey()
  }

  private dispatchEscapeKey(): void {
    const dispatchTarget =
      (document.activeElement as HTMLElement | null) || document.body || document.documentElement
    if (!dispatchTarget) return

    try {
      const escEvent = new KeyboardEvent("keydown", {
        key: "Escape",
        code: "Escape",
        keyCode: 27,
        which: 27,
        bubbles: true,
        cancelable: true,
      })
      dispatchTarget.dispatchEvent(escEvent)
    } catch {
      dispatchTarget.dispatchEvent(
        new Event("keydown", {
          bubbles: true,
          cancelable: true,
        }),
      )
    }
  }

  private async scrollCmdkListToLoadAll(): Promise<void> {
    const list = this.getCmdkListElement()
    if (!list) return

    let previousHeight = -1
    let stableCount = 0

    for (let i = 0; i < 16; i++) {
      list.scrollTop = list.scrollHeight
      await this.sleep(300)

      const currentHeight = list.scrollHeight
      if (currentHeight === previousHeight) {
        stableCount++
        if (stableCount >= 3) {
          break
        }
      } else {
        previousHeight = currentHeight
        stableCount = 0
      }
    }
  }

  private async findConversationAnchorWithRetry(
    id: string,
    timeoutMs: number,
  ): Promise<HTMLAnchorElement | null> {
    const immediate = this.findConversationAnchors(id)[0]
    if (immediate) return immediate

    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      await this.sleep(80)
      const found = this.findConversationAnchors(id)[0]
      if (found) return found
    }

    return null
  }

  private findConversationAnchors(id: string): HTMLAnchorElement[] {
    const selector = [`a[href="/c/${id}"]`, `a[href$="/c/${id}"]`, `a[href*="/c/${id}?"]`].join(
      ", ",
    )

    const elements = Array.from(document.querySelectorAll(selector)) as HTMLAnchorElement[]
    return elements.filter(
      (element) => this.extractConversationIdFromHref(element.getAttribute("href")) === id,
    )
  }

  private getConversationItemContainer(anchor: HTMLAnchorElement): HTMLElement {
    const candidates = [
      anchor.closest("[cmdk-item]"),
      anchor.closest('[data-sidebar="menu-button"]'),
      anchor.closest('[data-sidebar="menu-item"]'),
      anchor.closest("li"),
      anchor.parentElement,
      anchor,
    ]

    for (const candidate of candidates) {
      if (candidate instanceof HTMLElement) {
        return candidate
      }
    }

    return anchor
  }

  private revealConversationActions(item: HTMLElement, anchor?: HTMLAnchorElement): void {
    try {
      item.scrollIntoView({
        block: "center",
        inline: "nearest",
        behavior: "instant" as ScrollBehavior,
      })
    } catch {
      // ignore
    }

    item.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }))
    item.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }))
    item.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }))

    if (anchor) {
      anchor.focus()
      anchor.dispatchEvent(new FocusEvent("focus", { bubbles: true }))
    }
  }

  private async waitForDeleteButton(
    item: HTMLElement,
    timeout: number,
  ): Promise<HTMLElement | null> {
    const start = Date.now()
    while (Date.now() - start < timeout) {
      this.revealConversationActions(item)

      const primaryButtons = this.findButtonsInScopes([item])
      let button = this.pickDeleteButton(primaryButtons, { allowIconOnlyFallback: true })
      if (!button) {
        const expandedButtons = this.findButtonsInScopes(this.getScopedActionContainers(item))
        button = this.pickDeleteButton(expandedButtons, { allowIconOnlyFallback: false })
      }
      if (button) return button

      await this.sleep(80)
    }

    return null
  }

  private async waitForConfirmButton(
    item: HTMLElement,
    timeout: number,
  ): Promise<HTMLElement | null> {
    const start = Date.now()
    while (Date.now() - start < timeout) {
      const primaryButtons = this.findButtonsInScopes([item])
      let button = this.pickConfirmButton(primaryButtons, { allowIconOnlyFallback: true })
      if (!button) {
        const expandedButtons = this.findButtonsInScopes(this.getScopedActionContainers(item))
        button = this.pickConfirmButton(expandedButtons, { allowIconOnlyFallback: false })
      }
      if (button) return button

      await this.sleep(80)
    }

    return null
  }

  private getScopedActionContainers(item: HTMLElement): ParentNode[] {
    const result: ParentNode[] = [item]
    const maybeContainers = [
      item.parentElement,
      item.closest("[cmdk-item]"),
      item.closest('[role="dialog"]'),
      item.closest("[cmdk-root]"),
      this.getCmdkListElement(),
    ]

    for (const container of maybeContainers) {
      if (!container) continue
      if (result.includes(container)) continue
      result.push(container)
    }

    return result
  }

  private pickDeleteButton(
    buttons: HTMLElement[],
    options?: { allowIconOnlyFallback?: boolean },
  ): HTMLElement | null {
    for (const button of buttons) {
      if (this.hasKeyword(this.getElementSignal(button), DELETE_KEYWORDS)) {
        return button
      }
    }

    for (const button of buttons) {
      if (this.hasKeyword(this.getIconSignal(button), DELETE_KEYWORDS)) {
        return button
      }
    }

    if (options?.allowIconOnlyFallback !== false) {
      const iconOnlyButtons = buttons.filter(
        (button) => button.querySelector("svg") && !(button.textContent || "").trim(),
      )
      const rightMost = this.pickRightMostButton(iconOnlyButtons)
      if (rightMost) {
        return rightMost
      }
    }

    return null
  }

  private pickConfirmButton(
    buttons: HTMLElement[],
    options?: { allowIconOnlyFallback?: boolean },
  ): HTMLElement | null {
    for (const button of buttons) {
      if (this.hasKeyword(this.getElementSignal(button), CONFIRM_KEYWORDS)) {
        return button
      }
    }

    for (const button of buttons) {
      if (this.hasKeyword(this.getIconSignal(button), CONFIRM_KEYWORDS)) {
        return button
      }
    }

    for (const button of buttons) {
      if (this.hasKeyword(this.getElementSignal(button), DELETE_KEYWORDS)) {
        return button
      }
    }

    if (options?.allowIconOnlyFallback !== false) {
      const iconOnlyButtons = buttons.filter(
        (button) => button.querySelector("svg") && !(button.textContent || "").trim(),
      )
      const rightMost = this.pickRightMostButton(iconOnlyButtons)
      if (rightMost) {
        return rightMost
      }
    }

    return null
  }

  private pickRightMostButton(buttons: HTMLElement[]): HTMLElement | null {
    if (buttons.length === 0) return null
    const sorted = [...buttons].sort(
      (a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right,
    )
    return sorted[0] || null
  }

  private findButtonsInScopes(scopes: ParentNode[]): HTMLElement[] {
    const unique = new Set<HTMLElement>()
    const result: HTMLElement[] = []

    for (const scope of scopes) {
      const buttons = Array.from(scope.querySelectorAll("button")) as HTMLElement[]
      for (const button of buttons) {
        if (unique.has(button)) continue
        if (!this.isVisible(button)) continue
        unique.add(button)
        result.push(button)
      }
    }

    return result
  }

  private getElementSignal(element: HTMLElement): string {
    const parts = [
      element.textContent || "",
      element.getAttribute("aria-label") || "",
      element.getAttribute("title") || "",
      element.getAttribute("data-testid") || "",
      element.className || "",
    ]

    return parts.join(" ").toLowerCase()
  }

  private getIconSignal(element: HTMLElement): string {
    const iconNodes = Array.from(
      element.querySelectorAll("svg, path, use, [data-icon], [class*='icon'], [aria-label]"),
    ) as HTMLElement[]

    const parts = iconNodes.map((node) => {
      const attrs = [
        node.getAttribute("aria-label") || "",
        node.getAttribute("data-icon") || "",
        node.getAttribute("name") || "",
        node.className || "",
      ]
      return attrs.join(" ")
    })

    return parts.join(" ").toLowerCase()
  }

  private hasKeyword(signal: string, keywords: string[]): boolean {
    const normalized = signal.toLowerCase()
    return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()))
  }

  private async waitForConversationRemoved(id: string, timeoutMs: number): Promise<boolean> {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      if (!this.isConversationVisible(id)) {
        return true
      }
      await this.sleep(80)
    }
    return false
  }

  private isConversationVisible(id: string): boolean {
    return this.findConversationAnchors(id).some(
      (anchor) => anchor.isConnected && this.isVisible(anchor),
    )
  }

  private extractConversationIdFromHref(href: string | null): string | null {
    if (!href) return null

    const match = href.match(/\/c\/([a-zA-Z0-9-]+)/)
    return match ? match[1] : null
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

  getSessionName(): string | null {
    const title = document.title
    if (title && title !== DEFAULT_TITLE) {
      return title.replace(` - ${DEFAULT_TITLE}`, "").trim()
    }
    return super.getSessionName()
  }

  getConversationTitle(): string | null {
    const title = document.title
    if (title && title !== DEFAULT_TITLE) {
      return title.replace(` - ${DEFAULT_TITLE}`, "").trim()
    }
    return null
  }

  getNewChatButtonSelectors(): string[] {
    return [
      'a[href="/"]',
      '[data-sidebar="header"] a',
      'button[aria-label*="New"]',
      'button[aria-label*="New"]',
    ]
  }

  getLatestReplyText(): string | null {
    const aiMessages = document.querySelectorAll(".message-bubble:not(.rounded-br-lg)")
    if (aiMessages.length === 0) return null

    const lastMessage = aiMessages[aiMessages.length - 1]

    const contentContainer = lastMessage.querySelector(".response-content-markdown")
    if (contentContainer) {
      return this.extractTextWithLineBreaks(contentContainer)
    }

    return this.extractTextWithLineBreaks(lastMessage)
  }

  getWidthSelectors() {
    return [
      {
        selector: '[class*="--content-max-width"]',
        property: "--content-max-width",
      },
    ]
  }

  getUserQueryWidthSelectors() {
    return [
      {
        selector: ".message-bubble.rounded-br-lg",
        property: "max-width",
      },
    ]
  }

  getTextareaSelectors(): string[] {
    return [
      ".tiptap.ProseMirror[contenteditable='true']",
      '[contenteditable="true"].ProseMirror',
      ".query-bar [contenteditable='true']",
      "form [contenteditable='true']",
    ]
  }

  getSubmitButtonSelectors(): string[] {
    return [
      'button[type="submit"]',
      'form button[type="submit"]',
      '.query-bar button[type="submit"]',
    ]
  }

  isValidTextarea(element: HTMLElement): boolean {
    if (element.offsetParent === null) return false
    if (element.closest(".gh-main-panel")) return false
    return element.getAttribute("contenteditable") === "true"
  }

  insertPrompt(content: string): boolean {
    const editor = this.textarea
    if (!editor) return false

    if (!editor.isConnected) {
      this.textarea = null
      return false
    }

    editor.focus()

    if (editor.getAttribute("contenteditable") === "true") {
      editor.replaceChildren()
      const paragraph = document.createElement("p")
      paragraph.textContent = content
      editor.appendChild(paragraph)
      editor.dispatchEvent(new Event("input", { bubbles: true }))
      const selection = window.getSelection()
      if (selection) {
        const range = document.createRange()
        range.selectNodeContents(editor)
        range.collapse(false)
        selection.removeAllRanges()
        selection.addRange(range)
      }
      return true
    }

    return false
  }

  clearTextarea(): void {
    if (!this.textarea) return
    if (!this.textarea.isConnected) {
      this.textarea = null
      return
    }

    this.textarea.focus()
    if (this.textarea.getAttribute("contenteditable") === "true") {
      this.textarea.replaceChildren()
      const paragraph = document.createElement("p")
      paragraph.className = "is-empty is-editor-empty"
      const lineBreak = document.createElement("br")
      lineBreak.className = "ProseMirror-trailingBreak"
      paragraph.appendChild(lineBreak)
      this.textarea.appendChild(paragraph)
      this.textarea.dispatchEvent(new Event("input", { bubbles: true }))
    }
  }

  getScrollContainer(): HTMLElement | null {
    const main = document.querySelector("main")
    if (main) {
      const scrollable = main.querySelector('[class*="overflow-auto"]') as HTMLElement
      if (scrollable && scrollable.scrollHeight > scrollable.clientHeight) {
        return scrollable
      }
      if (main.scrollHeight > main.clientHeight) {
        return main as HTMLElement
      }
    }

    const containers = document.querySelectorAll(
      '[class*="overflow-y-auto"], [class*="overflow-auto"]',
    )
    for (const container of Array.from(containers)) {
      const el = container as HTMLElement
      if (el.scrollHeight > el.clientHeight + 100) {
        return el
      }
    }

    return null
  }

  getResponseContainerSelector(): string {
    return "main"
  }

  getChatContentSelectors(): string[] {
    return ['[class*="prose"]', '[dir="ltr"]']
  }

  getUserQuerySelector(): string {
    return ".message-bubble.rounded-br-lg"
  }

  extractUserQueryText(element: Element): string {
    return this.extractTextWithLineBreaks(element)
  }

  extractUserQueryMarkdown(element: Element): string {
    // .message-bubble.rounded-br-lg > div.relative > div.relative > .response-content-markdown
    const markdownContainer = element.querySelector(".response-content-markdown")
    if (markdownContainer) {
      const paragraphs = markdownContainer.querySelectorAll("p")
      if (paragraphs.length > 0) {
        return Array.from(paragraphs)
          .map((p) => p.textContent?.trim() || "")
          .filter((text) => text.length > 0)
          .join("\n\n")
      }
    }
    return element.textContent?.trim() || ""
  }

  replaceUserQueryContent(element: Element, html: string): boolean {
    // .message-bubble.rounded-br-lg > div.relative > div.relative > .response-content-markdown
    const markdownContainer = element.querySelector(".response-content-markdown")
    if (!markdownContainer) return false

    if (markdownContainer.querySelector(".gh-user-query-markdown")) {
      return false
    }

    const originalContent = Array.from(markdownContainer.children)

    const originalWrapper = document.createElement("div")
    originalWrapper.className = "gh-user-query-original"
    originalWrapper.style.display = "none"
    originalContent.forEach((child) => {
      originalWrapper.appendChild(child)
    })
    markdownContainer.appendChild(originalWrapper)

    const rendered = document.createElement("div")
    rendered.className = "gh-user-query-markdown gh-markdown-preview"
    setSafeHTML(rendered, html)

    markdownContainer.insertBefore(rendered, originalWrapper)
    return true
  }

  getExportConfig(): ExportConfig | null {
    return {
      userQuerySelector: this.getUserQuerySelector(),
      assistantResponseSelector: ".message-bubble:not(.rounded-br-lg) .response-content-markdown",
      turnSelector: "",
      useShadowDOM: false,
    }
  }

  extractOutline(maxLevel = 6, includeUserQueries = false, showWordCount = false): OutlineItem[] {
    const outline: OutlineItem[] = []
    const container = document.querySelector(this.getResponseContainerSelector())
    if (!container) return outline

    const getResponseId = (el: Element): string | null => {
      const responseDiv = el.closest('[id^="response-"]')
      if (responseDiv) {
        return responseDiv.id
      }
      return null
    }

    const msgHeaderCounts: Record<string, Record<string, number>> = {}
    const generateHeaderId = (msgId: string, tagName: string, text: string): string => {
      if (!msgHeaderCounts[msgId]) msgHeaderCounts[msgId] = {}
      const key = `${tagName}-${text}`
      const count = msgHeaderCounts[msgId][key] || 0
      msgHeaderCounts[msgId][key] = count + 1
      return `${msgId}::${key}::${count}`
    }

    const userQuerySelector = this.getUserQuerySelector()
    const calculateUserQueryWordCount = (startEl: Element): number => {
      const parentContainer = startEl.closest('[id^="response-"]')
      if (!parentContainer) return 0

      let current = parentContainer.nextElementSibling
      let totalLength = 0

      while (current) {
        const userQueryInThis = current.querySelector(userQuerySelector)
        if (userQueryInThis) {
          break
        }

        const aiMessage = current.querySelector(".message-bubble:not(.rounded-br-lg)")
        if (aiMessage) {
          const markdownContent = aiMessage.querySelector(".response-content-markdown")
          if (markdownContent) {
            totalLength += markdownContent.textContent?.trim().length || 0
          }
        }

        current = current.nextElementSibling
      }

      if (totalLength === 0) {
        const allAiMessages = container.querySelectorAll(".message-bubble:not(.rounded-br-lg)")
        for (const aiMsg of Array.from(allAiMessages)) {
          const positionToStart = startEl.compareDocumentPosition(aiMsg)
          const isAfterStart = positionToStart & Node.DOCUMENT_POSITION_FOLLOWING
          if (!isAfterStart) continue

          const nextUserQuery =
            startEl.parentElement?.nextElementSibling?.querySelector(userQuerySelector)
          if (nextUserQuery) {
            const positionToEnd = nextUserQuery.compareDocumentPosition(aiMsg)
            const isBeforeEnd = positionToEnd & Node.DOCUMENT_POSITION_PRECEDING
            if (!isBeforeEnd) continue
          }

          const markdownContent = aiMsg.querySelector(".response-content-markdown")
          if (markdownContent) {
            totalLength += markdownContent.textContent?.trim().length || 0
          }
        }
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
        if (this.isInRenderedMarkdownContainer(heading)) return
        const level = parseInt(heading.tagName.charAt(1), 10)
        if (level <= maxLevel) {
          const item: OutlineItem = {
            level,
            text: heading.textContent?.trim() || "",
            element: heading,
          }

          // Stable ID for Headings
          const msgId = getResponseId(heading)
          if (msgId) {
            const tagName = heading.tagName.toLowerCase()
            item.id = generateHeaderId(msgId, tagName, item.text)
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
            const responseContainer = heading.closest('[id^="response-"]')
            item.wordCount = this.calculateRangeWordCount(
              heading,
              nextBoundaryEl,
              responseContainer || container,
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
      const isUserQuery = element.matches(userQuerySelector)

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

        // Stable ID for User Query
        const msgId = getResponseId(element)
        if (msgId) {
          item.id = msgId
        }

        if (showWordCount) {
          item.wordCount = calculateUserQueryWordCount(element)
        }

        outline.push(item)
      } else if (/^h[1-6]$/.test(tagName)) {
        if (this.isInRenderedMarkdownContainer(element)) return
        const level = parseInt(tagName.charAt(1), 10)
        if (level <= maxLevel) {
          const item: OutlineItem = {
            level,
            text: element.textContent?.trim() || "",
            element,
          }

          // Stable ID for Headings
          const msgId = getResponseId(element)
          if (msgId) {
            item.id = generateHeaderId(msgId, tagName, item.text)
          }

          if (showWordCount) {
            let nextBoundaryEl: Element | null = null
            for (let i = index + 1; i < allElements.length; i++) {
              const candidate = allElements[i]
              const candidateTagName = candidate.tagName.toLowerCase()

              if (candidate.matches(userQuerySelector)) {
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

            const responseContainer = element.closest('[id^="response-"]')
            item.wordCount = this.calculateRangeWordCount(
              element,
              nextBoundaryEl,
              responseContainer || container,
            )
          }

          outline.push(item)
        }
      }
    })

    return outline
  }

  isGenerating(): boolean {
    const stopButton = document.querySelector(
      'button[aria-label*="Stop"], button[aria-label*="Stop"]',
    )
    if (stopButton && (stopButton as HTMLElement).offsetParent !== null) {
      return true
    }

    const loading = document.querySelector('[class*="loading"], [class*="animate-pulse"]')
    if (loading && (loading as HTMLElement).offsetParent !== null) {
      return true
    }

    return false
  }

  getModelName(): string | null {
    const modelBtn = document.querySelector("#model-select-trigger")
    if (modelBtn) {
      const span = modelBtn.querySelector(".font-semibold")
      if (span) {
        return span.textContent?.trim() || null
      }
      return modelBtn.textContent?.trim() || null
    }
    return null
  }

  getNetworkMonitorConfig(): NetworkMonitorConfig | null {
    return {
      urlPatterns: ["rest/app-chat/conversations"],
      silenceThreshold: 500,
    }
  }

  getDefaultLockSettings(): { enabled: boolean; keyword: string } {
    return { enabled: false, keyword: "" }
  }

  getModelSwitcherConfig(keyword: string): ModelSwitcherConfig | null {
    return {
      targetModelKeyword: keyword,
      selectorButtonSelectors: ["#model-select-trigger"],
      menuItemSelector: '[role="menuitem"], [role="option"]',
      checkInterval: 1000,
      maxAttempts: 15,
      menuRenderDelay: 500,
    }
  }

  /**
   */
  protected simulateClick(element: HTMLElement): void {
    const eventTypes = ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]
    let dispatched = false
    for (const type of eventTypes) {
      try {
        if (typeof PointerEvent === "function") {
          element.dispatchEvent(
            new PointerEvent(type, {
              bubbles: true,
              cancelable: true,
              pointerId: 1,
            }),
          )
        } else {
          element.dispatchEvent(
            new MouseEvent(type, {
              bubbles: true,
              cancelable: true,
            }),
          )
        }
        dispatched = true
      } catch {
        try {
          element.dispatchEvent(
            new MouseEvent(type, {
              bubbles: true,
              cancelable: true,
            }),
          )
          dispatched = true
        } catch {
          // ignore and fallback below
        }
      }
    }

    if (!dispatched) {
      element.click()
    }
  }

  /**
   */
  async toggleTheme(targetMode: "light" | "dark"): Promise<boolean> {
    try {
      localStorage.setItem("theme", targetMode)

      document.documentElement.classList.remove("light", "dark")
      document.documentElement.classList.add(targetMode)

      document.documentElement.style.colorScheme = targetMode

      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "theme",
          newValue: targetMode,
          storageArea: localStorage,
        }),
      )

      return true
    } catch (error) {
      console.error("[GrokAdapter] toggleTheme error:", error)
      return false
    }
  }
}
