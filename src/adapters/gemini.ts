/**
 */
import { SITE_IDS } from "~constants"
import { DOMToolkit } from "~utils/dom-toolkit"
import { htmlToMarkdown } from "~utils/exporter"
import { setSafeHTML } from "~utils/trusted-types"

import {
  SiteAdapter,
  type ConversationDeleteTarget,
  type ConversationInfo,
  type ConversationObserverConfig,
  type ExportConfig,
  type ExportLifecycleContext,
  type MarkdownFixerConfig,
  type ModelSwitcherConfig,
  type NetworkMonitorConfig,
  type OutlineItem,
  type SiteDeleteConversationResult,
} from "./base"

const GEMINI_DELETE_REASON = {
  UI_FAILED: "delete_ui_failed",
  UI_EXCEPTION: "delete_ui_exception",
  BATCH_ABORTED_AFTER_UI_FAILURE: "delete_batch_aborted_after_ui_failure",
} as const

const GEMINI_DELETE_KEYWORDS = [
  "delete",
  "remove",
  "delete",
  "delete",
  "supprimer",
  "eliminar",
  "löschen",
  "삭제",
  "delete",
  "remove",
  "excluir",
  "hapus",
  "удал",
]

const GEMINI_CANCEL_KEYWORDS = [
  "cancel",
  "cancel",
  "annuler",
  "abbrechen",
  "취소",
  "キャンセル",
  "batal",
  "отмен",
]

const GEMINI_EXPORT_THOUGHT_MARKER_ATTR = "data-ophel-export-thought-id"
const GEMINI_EMAIL_REGEX = /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i
const GEMINI_ACCOUNT_HINT_REGEX = /(google|account|conta|compte|cuenta|konto|アカウント|계정|учет)/i

interface GeminiExportLifecycleState {
  toggledThoughtIds: string[]
}

export class GeminiAdapter extends SiteAdapter {
  private exportIncludeThoughtsOverride: boolean | null = null
  private cachedAccountEmail: string | null = null
  private accountEmailLastDetectAt = 0

  private getUserPathPrefix(): string {
    const match = window.location.pathname.match(/^\/u\/(\d+)(?:\/|$)/)
    if (!match) return ""
    const idx = match[1]
    return `/u/${idx}`
  }

  getCurrentCid(): string {
    const accountEmail = this.getCurrentAccountEmail()
    if (accountEmail) return accountEmail

    const match = window.location.pathname.match(/^\/u\/(\d+)(?:\/|$)/)
    return match ? match[1] : "0"
  }

  private getCurrentAccountEmail(): string | null {
    const now = Date.now()
    if (now - this.accountEmailLastDetectAt < 2000) {
      return this.cachedAccountEmail
    }
    this.accountEmailLastDetectAt = now

    const attrs = ["aria-label", "title", "data-email", "data-identifier"] as const
    const selectors = [
      "[data-email]",
      '[data-identifier*="@"]',
      '[aria-label*="@"]',
      '[title*="@"]',
    ]

    const nodes = new Set<Element>()
    selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((el) => nodes.add(el))
    })

    for (const node of nodes) {
      for (const attr of attrs) {
        const value = node.getAttribute(attr)
        const email = this.extractEmailFromAttr(attr, value)
        if (email) {
          this.cachedAccountEmail = email
          return email
        }
      }
    }

    return this.cachedAccountEmail
  }

  private extractEmailFromAttr(
    attr: "aria-label" | "title" | "data-email" | "data-identifier",
    value: string | null | undefined,
  ): string | null {
    if (!value) return null

    if (attr === "data-email" || attr === "data-identifier") {
      return this.extractEmail(value)
    }

    if (!GEMINI_ACCOUNT_HINT_REGEX.test(value)) return null
    return this.extractEmail(value)
  }

  private extractEmail(value: string | null | undefined): string | null {
    if (!value) return null
    const match = value.match(GEMINI_EMAIL_REGEX)
    if (!match) return null
    return match[1].toLowerCase()
  }

  match(): boolean {
    return (
      window.location.hostname.includes("gemini.google") &&
      !window.location.hostname.includes("business.gemini.google")
    )
  }

  getSiteId(): string {
    return SITE_IDS.GEMINI
  }

  getName(): string {
    return "Gemini"
  }

  getThemeColors(): { primary: string; secondary: string } {
    return { primary: "#4285f4", secondary: "#34a853" }
  }

  getNewTabUrl(): string {
    return `https://gemini.google.com${this.getUserPathPrefix()}/app`
  }

  isNewConversation(): boolean {
    const path = window.location.pathname.replace(/^\/u\/\d+/, "")
    if (path === "/app" || path === "/app/") return true
    if (path === "/gems/create" || path === "/gems/create/") return true
    if (path.startsWith("/gems/edit/")) return true
    if (path.startsWith("/gem/")) {
      const parts = path.split("/").filter(Boolean)
      return parts.length <= 2
    }
    return false
  }

  getConversationList(): ConversationInfo[] {
    const items = (DOMToolkit.query(".conversation", { all: true }) as Element[]) || []
    const cid = this.getCurrentCid()
    const prefix = this.getUserPathPrefix()
    return Array.from(items)
      .map((el) => {
        const jslog = el.getAttribute("jslog") || ""
        const idMatch = jslog.match(/\["c_([^"]+)"/)
        const id = idMatch ? idMatch[1] : ""
        const title = el.querySelector(".conversation-title")?.textContent?.trim() || ""
        const isPinned = !!el.querySelector('mat-icon[fonticon="push_pin"]')

        return {
          id,
          cid,
          title,
          url: id ? `https://gemini.google.com${prefix}/app/${id}` : "",
          isActive: el.classList.contains("selected"),
          isPinned,
        }
      })
      .filter((c) => c.id)
  }

  getSidebarScrollContainer(): Element | null {
    return (
      (DOMToolkit.query('infinite-scroller[scrollable="true"]') as Element) ||
      (DOMToolkit.query("infinite-scroller") as Element)
    )
  }

  getConversationObserverConfig(): ConversationObserverConfig {
    return {
      selector: ".conversation",
      shadow: false,
      extractInfo: (el) => {
        const jslog = el.getAttribute("jslog") || ""
        const idMatch = jslog.match(/\["c_([^"]+)"/)
        const id = idMatch ? idMatch[1] : ""
        if (!id) return null
        const title = el.querySelector(".conversation-title")?.textContent?.trim() || ""
        const isPinned = !!el.querySelector('mat-icon[fonticon="push_pin"]')
        const cid = this.getCurrentCid()
        const prefix = this.getUserPathPrefix()
        return {
          id,
          cid,
          title,
          url: `https://gemini.google.com${prefix}/app/${id}`,
          isPinned,
        }
      },
      getTitleElement: (el) => el.querySelector(".conversation-title") || el,
    }
  }

  navigateToConversation(id: string, url?: string): boolean {
    const sidebarItem = document.querySelector(
      `.conversation[jslog*="${id}"]`,
    ) as HTMLElement | null
    if (sidebarItem) {
      const btn =
        sidebarItem.querySelector("button.list-item") || sidebarItem.querySelector("button")
      if (btn) (btn as HTMLElement).click()
      else sidebarItem.click()
      return true
    }
    return super.navigateToConversation(id, url)
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

      // Stop the remaining batch when UI deletion fails once,
      // to prevent accidental wrong-item deletions.
      if (!result.success && result.reason === GEMINI_DELETE_REASON.UI_FAILED) {
        for (let i = index + 1; i < targets.length; i++) {
          results.push({
            id: targets[i].id,
            success: false,
            method: "none",
            reason: GEMINI_DELETE_REASON.BATCH_ABORTED_AFTER_UI_FAILURE,
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
    try {
      const uiSuccess = await this.deleteConversationViaUi(target.id)
      return {
        id: target.id,
        success: uiSuccess,
        method: uiSuccess ? "ui" : "none",
        reason: uiSuccess ? undefined : GEMINI_DELETE_REASON.UI_FAILED,
      }
    } catch (error) {
      console.error(
        `[GeminiAdapter] deleteConversationOnSiteInternal error for "${target.id}":`,
        error,
      )
      return {
        id: target.id,
        success: false,
        method: "none",
        reason: GEMINI_DELETE_REASON.UI_EXCEPTION,
      }
    }
  }

  private async deleteConversationViaUi(id: string): Promise<boolean> {
    const row = await this.findConversationRowWithRetry(id)
    if (!row) return false

    row.scrollIntoView({ block: "center", behavior: "auto" })
    this.revealConversationActions(row)

    let menuButton = await this.findConversationMenuButton(row)
    if (!menuButton) return false

    const menuRoot = await this.openConversationMenu(row, menuButton)
    if (!menuRoot) return false

    const deleteItem = await this.waitForDeleteMenuItem(menuButton, 2500, menuRoot)
    if (!deleteItem) {
      document.body.click()
      return false
    }
    this.simulateClick(deleteItem)

    const dialogOpened = await this.waitForDialogOpen(2200)
    if (!dialogOpened) return false

    const confirmButton = await this.waitForDeleteConfirmButton(2800)
    if (!confirmButton) return false
    this.simulateClick(confirmButton)

    const removed = await this.waitForConversationRemoved(id, 4500)
    const dialogClosed = await this.waitForDialogClosed(1200)
    const success = removed || dialogClosed
    if (success) {
      this.syncConversationListAfterDelete(id)
    }
    return success
  }

  private async openConversationMenu(
    row: HTMLElement,
    initialTrigger: HTMLElement,
  ): Promise<HTMLElement | null> {
    let trigger: HTMLElement | null = initialTrigger

    for (let attempt = 0; attempt < 4; attempt++) {
      document.body.click()
      await this.sleep(60)

      this.revealConversationActions(row)
      if (!trigger || !trigger.isConnected) {
        trigger = await this.findConversationMenuButton(row)
      }
      if (!trigger) return null

      this.simulateClick(trigger)
      const menu = await this.waitForMenuOpen(trigger, 900)
      if (menu) return menu
    }

    return null
  }

  private async waitForMenuOpen(trigger: HTMLElement, timeout = 900): Promise<HTMLElement | null> {
    const start = Date.now()
    while (Date.now() - start < timeout) {
      const controlled = this.getMenuContainerFromTrigger(trigger)
      if (controlled && this.isVisible(controlled)) return controlled

      const fallback = this.findVisibleMenuContainer()
      if (fallback) return fallback

      await this.sleep(80)
    }
    return null
  }

  private async findConversationRowWithRetry(id: string): Promise<HTMLElement | null> {
    const firstTry = this.findConversationRow(id)
    if (firstTry) return firstTry

    await this.loadAllConversations()
    await this.sleep(250)
    return this.findConversationRow(id)
  }

  private findConversationRow(id: string): HTMLElement | null {
    const expected = this.normalizeConversationId(id)
    const rows = this.findAllElementsBySelector(".conversation") as HTMLElement[]
    for (const row of rows) {
      const rowId = this.normalizeConversationId(this.extractConversationIdFromElement(row))
      if (rowId && rowId === expected) {
        return row
      }
    }

    const hrefCandidates = [
      `a[href*="/app/${expected}"]`,
      `a[href*="/app/c_${expected}"]`,
      `a[href$="/${expected}"]`,
      `a[href$="/c_${expected}"]`,
    ]

    for (const selector of hrefCandidates) {
      const anchor = document.querySelector(selector) as HTMLElement | null
      if (!anchor) continue
      const container = (anchor.closest(".conversation") ||
        anchor.closest("li") ||
        anchor.parentElement) as HTMLElement | null
      if (container) return container
    }

    return null
  }

  private extractConversationIdFromElement(element: Element | null): string {
    if (!element) return ""
    const jslog = element.getAttribute("jslog") || ""
    const idMatch = jslog.match(/\["c_([^"]+)"/)
    return idMatch ? idMatch[1] : ""
  }

  private normalizeConversationId(id: string): string {
    if (!id) return ""
    return id.startsWith("c_") ? id.slice(2) : id
  }

  private revealConversationActions(row: HTMLElement): void {
    const events: Array<keyof GlobalEventHandlersEventMap> = [
      "mouseenter",
      "mouseover",
      "mousemove",
    ]

    for (const eventName of events) {
      row.dispatchEvent(
        new MouseEvent(eventName, {
          bubbles: true,
          cancelable: true,
        }),
      )
    }
  }

  private async findConversationMenuButton(row: HTMLElement): Promise<HTMLElement | null> {
    const actionSelectors = [
      'button[aria-haspopup="menu"]',
      'button[aria-label*="More"]',
      'button[aria-label*="more"]',
      'button[aria-label*="More"]',
      'button[aria-label*="Options"]',
      'button[title*="More"]',
      'button[title*="more"]',
      'button[data-test-id*="menu"]',
      'button[data-testid*="menu"]',
      "button",
    ].join(", ")

    for (let attempt = 0; attempt < 12; attempt++) {
      const scopes = this.getMenuSearchScopes(row)
      scopes.forEach((scope) => this.revealConversationActions(scope))

      const allCandidates = scopes.flatMap(
        (scope) => Array.from(scope.querySelectorAll(actionSelectors)) as HTMLElement[],
      )
      const candidates = allCandidates.filter((candidate) => {
        if (candidate.classList.contains("list-item")) return false
        if (candidate instanceof HTMLButtonElement && candidate.disabled) return false
        return true
      })

      if (candidates.length > 0) {
        const moreIconButton = candidates.find((candidate) => {
          return (
            candidate.querySelector(
              'mat-icon[fonticon="more_vert"], mat-icon[fonticon="more_horiz"]',
            ) !== null
          )
        })
        if (moreIconButton) return moreIconButton

        const preferred = candidates.find((candidate) => this.isLikelyMenuButton(candidate, row))
        if (preferred) return preferred

        const fallbackVisible = candidates
          .filter((candidate) => this.isVisible(candidate))
          .sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right)[0]
        if (fallbackVisible) return fallbackVisible

        if (attempt >= 8) {
          const fallbackAny = candidates[candidates.length - 1]
          if (fallbackAny) return fallbackAny
        }
      }

      await this.sleep(100)
    }

    return null
  }

  private getMenuSearchScopes(row: HTMLElement): HTMLElement[] {
    const scopes = [
      row,
      row.parentElement,
      row.parentElement?.parentElement,
      row.closest("li"),
    ].filter((item): item is HTMLElement => item instanceof HTMLElement)

    const unique = new Set<HTMLElement>()
    const deduplicated: HTMLElement[] = []
    for (const scope of scopes) {
      if (unique.has(scope)) continue
      unique.add(scope)
      deduplicated.push(scope)
    }
    return deduplicated
  }

  private isLikelyMenuButton(button: HTMLElement, row: HTMLElement): boolean {
    if (!row.contains(button)) return false
    if (button.classList.contains("list-item")) return false

    const hasMenuPopup = button.getAttribute("aria-haspopup") === "menu"
    if (hasMenuPopup) return true

    const signalText = this.getSignalText(button)
    return (
      signalText.includes("more") ||
      signalText.includes("more") ||
      signalText.includes("options") ||
      signalText.includes("menu") ||
      signalText.includes("menu")
    )
  }

  private async waitForDeleteMenuItem(
    trigger: HTMLElement,
    timeout = 2500,
    menuRoot?: HTMLElement | null,
  ): Promise<HTMLElement | null> {
    const start = Date.now()
    let lastVisibleItems: HTMLElement[] = []

    while (Date.now() - start < timeout) {
      const candidates = this.getMenuActionCandidates(trigger, menuRoot || null)
      for (const item of candidates) {
        if (!this.isVisible(item)) continue

        const deleteIcon = item.querySelector(
          'mat-icon[fonticon="delete"], mat-icon[data-mat-icon-name="delete"]',
        )
        if (deleteIcon) return item

        const text = this.getSignalText(item)
        if (!this.hasKeyword(text, GEMINI_DELETE_KEYWORDS)) continue
        if (this.hasKeyword(text, GEMINI_CANCEL_KEYWORDS)) continue
        return item
      }

      const visibleItems = candidates.filter((item) => this.isVisible(item))
      if (visibleItems.length > 0) {
        lastVisibleItems = visibleItems
      }

      await this.sleep(80)
    }

    // Last resort for multilingual/icon-only menus:
    // Gemini's delete action is usually the last actionable item.
    if (lastVisibleItems.length > 0) {
      const fallback = lastVisibleItems[lastVisibleItems.length - 1]
      const text = this.getSignalText(fallback)
      if (!this.hasKeyword(text, GEMINI_CANCEL_KEYWORDS)) {
        return fallback
      }
    }

    return null
  }

  private getMenuActionCandidates(
    trigger: HTMLElement,
    menuRoot?: HTMLElement | null,
  ): HTMLElement[] {
    const selectors = '[role="menuitem"], [role="menu"] button, .mat-mdc-menu-panel button'
    const results: HTMLElement[] = []

    if (menuRoot) {
      results.push(...(Array.from(menuRoot.querySelectorAll(selectors)) as HTMLElement[]))
    }

    const controlledId = trigger.getAttribute("aria-controls") || trigger.getAttribute("aria-owns")
    if (controlledId) {
      const controlledMenu = document.getElementById(controlledId)
      if (controlledMenu) {
        results.push(...(Array.from(controlledMenu.querySelectorAll(selectors)) as HTMLElement[]))
      }
    }

    const visibleMenu = this.findVisibleMenuContainer()
    if (visibleMenu) {
      results.push(...(Array.from(visibleMenu.querySelectorAll(selectors)) as HTMLElement[]))
    }

    results.push(...(this.findAllElementsBySelector(selectors) as HTMLElement[]))

    const unique = new Set<HTMLElement>()
    const deduplicated: HTMLElement[] = []
    for (const item of results) {
      if (unique.has(item)) continue
      unique.add(item)
      deduplicated.push(item)
    }

    return deduplicated
  }

  private getMenuContainerFromTrigger(trigger: HTMLElement): HTMLElement | null {
    const controlledId = trigger.getAttribute("aria-controls") || trigger.getAttribute("aria-owns")
    if (!controlledId) return null

    const controlled = document.getElementById(controlledId)
    return controlled instanceof HTMLElement ? controlled : null
  }

  private findVisibleMenuContainer(): HTMLElement | null {
    const menus = Array.from(
      document.querySelectorAll('[role="menu"], .mat-mdc-menu-panel, .mat-menu-panel'),
    ) as HTMLElement[]
    const visible = menus.filter((menu) => this.isVisible(menu))
    if (visible.length === 0) return null
    return visible[visible.length - 1]
  }

  private async waitForDialogOpen(timeout = 2200): Promise<boolean> {
    const start = Date.now()
    while (Date.now() - start < timeout) {
      if (this.findVisibleDialog()) return true
      await this.sleep(80)
    }
    return false
  }

  private async waitForDeleteConfirmButton(timeout = 2800): Promise<HTMLElement | null> {
    const start = Date.now()
    while (Date.now() - start < timeout) {
      const dialog = this.findVisibleDialog()

      const explicitConfirm = dialog?.querySelector(
        'button[data-test-id="confirm-button"], button[data-testid="confirm-button"]',
      ) as HTMLElement | null
      if (explicitConfirm && this.isVisible(explicitConfirm)) {
        return explicitConfirm
      }

      const buttons = dialog
        ? (Array.from(dialog.querySelectorAll("button")) as HTMLElement[])
        : (Array.from(document.querySelectorAll("button")) as HTMLElement[])
      const visibleButtons = buttons.filter((button) => this.isVisible(button))

      for (const button of visibleButtons) {
        const text = this.getSignalText(button)
        if (!this.hasKeyword(text, GEMINI_DELETE_KEYWORDS)) continue
        if (this.hasKeyword(text, GEMINI_CANCEL_KEYWORDS)) continue
        return button
      }

      const fallback = visibleButtons
        .filter((button) => !this.hasKeyword(this.getSignalText(button), GEMINI_CANCEL_KEYWORDS))
        .sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right)[0]
      if (fallback) return fallback

      await this.sleep(80)
    }

    return null
  }

  private async waitForDialogClosed(timeout = 1200): Promise<boolean> {
    const start = Date.now()
    while (Date.now() - start < timeout) {
      if (!this.findVisibleDialog()) return true
      await this.sleep(80)
    }
    return false
  }

  private findVisibleDialog(): HTMLElement | null {
    const dialogs = Array.from(
      document.querySelectorAll('[role="dialog"], mat-dialog-container, .mat-mdc-dialog-container'),
    ) as HTMLElement[]
    return dialogs.find((dialog) => this.isVisible(dialog)) || null
  }

  private async waitForConversationRemoved(id: string, timeout = 4500): Promise<boolean> {
    const start = Date.now()
    while (Date.now() - start < timeout) {
      if (!this.findConversationRow(id)) {
        return true
      }
      await this.sleep(90)
    }
    return false
  }

  private syncConversationListAfterDelete(id: string): void {
    const row = this.findConversationRow(id)
    if (!row) return
    row.remove()
  }

  private scheduleFullReloadAfterDelete(deletedIds: string[]): void {
    if (deletedIds.length === 0) return

    const currentId = this.getCurrentConversationIdFromPath()
    if (currentId && deletedIds.includes(currentId)) {
      const appPath = `${this.getUserPathPrefix()}/app` || "/app"
      try {
        window.history.replaceState(window.history.state, "", appPath)
      } catch {
        // ignore route state failures
      }
    }
  }

  private getCurrentConversationIdFromPath(): string | null {
    const match = window.location.pathname.match(/\/app\/([^/?#]+)/)
    if (match?.[1]) {
      const raw = match[1]
      if (raw === "app" || raw === "new_chat") return null
      return raw.startsWith("c_") ? raw.slice(2) : raw
    }
    return null
  }

  private getSignalText(element: HTMLElement): string {
    return [
      element.textContent || "",
      element.getAttribute("aria-label") || "",
      element.getAttribute("title") || "",
      element.getAttribute("data-test-id") || "",
      element.getAttribute("data-testid") || "",
      element.getAttribute("mattooltip") || "",
      element.getAttribute("ng-reflect-message") || "",
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

  protected simulateClick(element: HTMLElement): void {
    const eventTypes = ["pointerdown", "mousedown", "pointerup", "mouseup", "click"] as const
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
          // ignore event dispatch failure and fallback below
        }
      }
    }

    if (!dispatched) {
      element.click()
    }
  }

  getSessionName(): string | null {
    const titleEl = document.querySelector(".conversation-title")
    if (titleEl) {
      const name = titleEl.textContent?.trim()
      if (name) return name
    }
    return super.getSessionName()
  }

  getConversationTitle(): string | null {
    const selected = document.querySelector(".conversation.selected .conversation-title")
    if (selected) return selected.textContent?.trim() || null
    return null
  }

  getNewChatButtonSelectors(): string[] {
    return [
      ".new-chat-button",
      ".chat-history-new-chat-button",
      '[aria-label="New chat"]',
      '[aria-label="New chat"]',
      '[aria-label="Start new chat"]',
      '[data-testid="new-chat-button"]',
      '[data-test-id="new-chat-button"]',
      '[data-test-id="expanded-button"]',
      '[data-test-id="temp-chat-button"]',
      'button[aria-label="Temporary chat"]',
    ]
  }

  getLatestReplyText(): string | null {
    const container = document.querySelector(this.getResponseContainerSelector())
    if (!container) return null

    const responses = container.querySelectorAll("model-response")
    if (responses.length === 0) return null

    const lastResponse = responses[responses.length - 1]

    const textContainer = lastResponse.querySelector(".model-response-text") || lastResponse

    return this.extractTextWithLineBreaks(textContainer)
  }

  getWidthSelectors() {
    return [
      { selector: ".conversation-container", property: "max-width" },
      { selector: ".input-area-container", property: "max-width" },
      {
        selector: "user-query",
        property: "max-width",
        value: "100%",
        noCenter: true,
        extraCss: "display: flex !important; justify-content: flex-end !important;",
      },
      {
        selector: ".user-query-container",
        property: "max-width",
        value: "100%",
        noCenter: true,
        extraCss: "justify-content: flex-end !important;",
      },
    ]
  }

  getUserQueryWidthSelectors() {
    return [
      {
        selector: ".user-query-bubble-with-background:not(.edit-mode)",
        property: "max-width",
        noCenter: true,
      },
    ]
  }

  getZenModeSelectors() {
    return [{ selector: "hallucination-disclaimer", action: "hide" as const }]
  }

  getMarkdownFixerConfig(): MarkdownFixerConfig {
    return {
      selector: "message-content p",
      fixSpanContent: false,
    }
  }

  getTextareaSelectors(): string[] {
    return [
      'div[contenteditable="true"].ql-editor',
      'div[contenteditable="true"]',
      '[role="textbox"]',
      '[aria-label*="Enter a prompt"]',
    ]
  }

  getSubmitButtonSelectors(): string[] {
    return [
      'button[aria-label*="Send"]',
      'button[aria-label*="Send"]',
      ".send-button",
      '[data-testid*="send"]',
    ]
  }

  isValidTextarea(element: HTMLElement): boolean {
    if (element.offsetParent === null) return false
    const isContentEditable = element.getAttribute("contenteditable") === "true"
    const isTextbox = element.getAttribute("role") === "textbox"
    if (element.closest(".gh-main-panel")) return false
    return isContentEditable || isTextbox || element.classList.contains("ql-editor")
  }

  insertPrompt(content: string): boolean {
    const editor = this.textarea
    if (!editor) return false

    if (!editor.isConnected) {
      this.textarea = null
      return false
    }

    editor.focus()
    if (document.activeElement !== editor && !editor.contains(document.activeElement)) {
      console.warn("[Ophel] insertPrompt: focus failed")
      return false
    }

    try {
      document.execCommand("selectAll", false, undefined)
      const success = document.execCommand("insertText", false, content)
      if (!success) throw new Error("execCommand returned false")
    } catch {
      editor.textContent = content
      editor.dispatchEvent(new Event("input", { bubbles: true }))
      editor.dispatchEvent(new Event("change", { bubbles: true }))
    }
    return true
  }

  clearTextarea(): void {
    if (!this.textarea) return
    if (!this.textarea.isConnected) {
      this.textarea = null
      return
    }

    this.textarea.focus()
    if (
      document.activeElement !== this.textarea &&
      !this.textarea.contains(document.activeElement)
    ) {
      return
    }

    document.execCommand("selectAll", false, undefined)
    document.execCommand("delete", false, undefined)
  }

  getScrollContainer(): HTMLElement | null {
    if (this.isSharePage()) {
      return document.querySelector("div.content-container") as HTMLElement
    }
    return document.querySelector("infinite-scroller.chat-history") as HTMLElement
  }

  getResponseContainerSelector(): string {
    if (this.isSharePage()) {
      return "div.content-container"
    }
    return "infinite-scroller.chat-history"
  }

  getChatContentSelectors(): string[] {
    return [
      ".model-response-container",
      "model-response",
      ".response-container",
      "[data-message-id]",
      "message-content",
    ]
  }

  getUserQuerySelector(): string {
    return "user-query"
  }

  /**
   */
  private sanitizeUserQueryElement(element: Element): Element {
    const clone = element.cloneNode(true) as Element
    const hiddenNodes = clone.querySelectorAll(".cdk-visually-hidden")
    hiddenNodes.forEach((node) => node.remove())
    return clone
  }

  extractUserQueryText(element: Element): string {
    const sanitized = this.sanitizeUserQueryElement(element)
    const queryText = sanitized.querySelector(".query-text")
    const target = queryText || sanitized
    return this.extractTextWithLineBreaks(target)
  }

  /**
   */
  extractUserQueryMarkdown(element: Element): string {
    const sanitized = this.sanitizeUserQueryElement(element)
    const lines = sanitized.querySelectorAll(".query-text-line")
    if (lines.length === 0) {
      return this.extractUserQueryText(sanitized)
    }

    const textLines = Array.from(lines).map((line) => {
      if (line.querySelector("br") && line.textContent?.trim() === "") {
        return ""
      }
      return line.textContent?.trim() || ""
    })

    return textLines.join("\n")
  }

  /**
   */
  async prepareConversationExport(
    context: ExportLifecycleContext,
  ): Promise<GeminiExportLifecycleState> {
    this.exportIncludeThoughtsOverride = context.includeThoughts

    if (!context.includeThoughts) {
      this.clearThoughtExportMarkers()
      return { toggledThoughtIds: [] }
    }

    const toggledThoughtIds = new Set<string>()
    this.clearThoughtExportMarkers()

    let stableRounds = 0
    let previousThoughtCount = -1

    for (let round = 0; round < 10 && stableRounds < 2; round++) {
      const thoughts = this.getThoughtNodesForExport()
      if (thoughts.length === previousThoughtCount) {
        stableRounds++
      } else {
        stableRounds = 0
        previousThoughtCount = thoughts.length
      }

      for (const thought of thoughts) {
        if (this.isThoughtExpanded(thought)) continue

        const button = this.getThoughtHeaderButton(thought)
        if (!button) continue

        let markerId = thought.getAttribute(GEMINI_EXPORT_THOUGHT_MARKER_ATTR)
        if (!markerId) {
          markerId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
          thought.setAttribute(GEMINI_EXPORT_THOUGHT_MARKER_ATTR, markerId)
        }

        try {
          button.scrollIntoView({ block: "center", behavior: "auto" })
        } catch {
          // ignore scroll failures
        }

        this.simulateClick(button)
        const expanded = await this.waitForThoughtState(thought, true, 2200)
        if (expanded) {
          toggledThoughtIds.add(markerId)
        }

        await this.sleep(60)
      }

      await this.sleep(120)
    }

    this.getThoughtNodesForExport().forEach((thought) => {
      const markerId = thought.getAttribute(GEMINI_EXPORT_THOUGHT_MARKER_ATTR)
      if (markerId && !toggledThoughtIds.has(markerId)) {
        thought.removeAttribute(GEMINI_EXPORT_THOUGHT_MARKER_ATTR)
      }
    })

    return {
      toggledThoughtIds: Array.from(toggledThoughtIds),
    }
  }

  /**
   */
  async restoreConversationAfterExport(
    _context: ExportLifecycleContext,
    state: unknown,
  ): Promise<void> {
    const parsed = this.parseExportLifecycleState(state)
    if (!parsed) {
      this.exportIncludeThoughtsOverride = null
      this.clearThoughtExportMarkers()
      return
    }

    try {
      for (let i = parsed.toggledThoughtIds.length - 1; i >= 0; i--) {
        const markerId = parsed.toggledThoughtIds[i]
        const thought = this.findThoughtNodeByMarker(markerId)
        if (!thought) continue

        const button = this.getThoughtHeaderButton(thought)
        if (!button) {
          thought.removeAttribute(GEMINI_EXPORT_THOUGHT_MARKER_ATTR)
          continue
        }

        if (this.isThoughtExpanded(thought)) {
          try {
            button.scrollIntoView({ block: "center", behavior: "auto" })
          } catch {
            // ignore scroll failures
          }

          this.simulateClick(button)
          await this.waitForThoughtState(thought, false, 1800)
        }

        thought.removeAttribute(GEMINI_EXPORT_THOUGHT_MARKER_ATTR)
        await this.sleep(40)
      }
    } finally {
      this.exportIncludeThoughtsOverride = null
      this.clearThoughtExportMarkers()
    }
  }

  private parseExportLifecycleState(state: unknown): GeminiExportLifecycleState | null {
    if (!state || typeof state !== "object") return null
    const candidate = state as Partial<GeminiExportLifecycleState>
    if (!Array.isArray(candidate.toggledThoughtIds)) return null

    const toggledThoughtIds = candidate.toggledThoughtIds.filter(
      (id): id is string => typeof id === "string" && id.length > 0,
    )
    return { toggledThoughtIds }
  }

  private getThoughtNodesForExport(): Element[] {
    return Array.from(
      document.querySelectorAll('model-thoughts[data-test-id="model-thoughts"], model-thoughts'),
    )
  }

  private getThoughtHeaderButton(thought: Element): HTMLElement | null {
    return thought.querySelector('button[data-test-id="thoughts-header-button"]')
  }

  private isThoughtExpanded(thought: Element): boolean {
    const icon = thought.querySelector("button[data-test-id='thoughts-header-button'] mat-icon")
    const iconName =
      icon?.getAttribute("data-mat-icon-name") || icon?.getAttribute("fonticon") || ""

    if (iconName.includes("expand_less")) return true
    if (iconName.includes("expand_more")) return false

    const thoughtContent = thought.querySelector('[data-test-id="thoughts-content"]')
    if (thoughtContent) return true

    return thought.querySelector(".thoughts-content-expanded") !== null
  }

  private isThoughtContentReady(thought: Element): boolean {
    const thoughtContent = thought.querySelector('[data-test-id="thoughts-content"]')
    if (!thoughtContent) return false
    return (thoughtContent.textContent?.trim().length || 0) > 0
  }

  private async waitForThoughtState(
    thought: Element,
    expectedExpanded: boolean,
    timeout = 2200,
  ): Promise<boolean> {
    const start = Date.now()

    while (Date.now() - start < timeout) {
      const expanded = this.isThoughtExpanded(thought)
      if (expectedExpanded) {
        if (expanded && this.isThoughtContentReady(thought)) return true
      } else if (!expanded) {
        return true
      }
      await this.sleep(80)
    }

    const expanded = this.isThoughtExpanded(thought)
    return expectedExpanded ? expanded : !expanded
  }

  private findThoughtNodeByMarker(markerId: string): Element | null {
    const thoughts = this.getThoughtNodesForExport()
    for (const thought of thoughts) {
      if (thought.getAttribute(GEMINI_EXPORT_THOUGHT_MARKER_ATTR) === markerId) {
        return thought
      }
    }
    return null
  }

  private clearThoughtExportMarkers(): void {
    this.getThoughtNodesForExport().forEach((thought) => {
      if (thought.hasAttribute(GEMINI_EXPORT_THOUGHT_MARKER_ATTR)) {
        thought.removeAttribute(GEMINI_EXPORT_THOUGHT_MARKER_ATTR)
      }
    })
  }

  private shouldIncludeThoughtsInExport(): boolean {
    if (typeof this.exportIncludeThoughtsOverride === "boolean") {
      return this.exportIncludeThoughtsOverride
    }
    return true
  }

  private formatAsThoughtBlockquote(markdown: string): string {
    const lines = markdown.replace(/\r\n/g, "\n").split("\n")
    const quotedLines = lines.map((line) => (line.trim().length > 0 ? `> ${line}` : ">"))
    return ["> [Thoughts]", ...quotedLines].join("\n")
  }

  private extractThoughtBlockquotesFromElement(element: Element): string[] {
    const thoughtNodes = Array.from(element.querySelectorAll("model-thoughts"))
    const blocks: string[] = []

    for (const thought of thoughtNodes) {
      const thoughtContent =
        thought.querySelector('[data-test-id="thoughts-content"]') ||
        thought.querySelector(".thoughts-content")
      if (!thoughtContent) continue

      const markdown =
        htmlToMarkdown(thoughtContent) || this.extractTextWithLineBreaks(thoughtContent)
      const normalized = markdown.trim()
      if (!normalized) continue

      blocks.push(this.formatAsThoughtBlockquote(normalized))
    }

    return blocks
  }

  /**
   */
  private sanitizeAssistantExportElement(element: Element): Element {
    const clone = element.cloneNode(true) as Element
    const hiddenNodes = clone.querySelectorAll(".cdk-visually-hidden")
    hiddenNodes.forEach((node) => node.remove())

    clone
      .querySelectorAll(`model-thoughts[${GEMINI_EXPORT_THOUGHT_MARKER_ATTR}]`)
      .forEach((node) => {
        node.removeAttribute(GEMINI_EXPORT_THOUGHT_MARKER_ATTR)
      })
    return clone
  }

  /**
   */
  private shouldSkipOutlineHeading(heading: Element): boolean {
    if (this.isInRenderedMarkdownContainer(heading)) return true

    if (heading.classList.contains("cdk-visually-hidden")) return true

    return false
  }

  /**
   */
  extractAssistantResponseText(element: Element): string {
    const sanitized = this.sanitizeAssistantExportElement(element)
    const includeThoughts = this.shouldIncludeThoughtsInExport()

    let thoughtBlocks: string[] = []
    if (includeThoughts) {
      thoughtBlocks = this.extractThoughtBlockquotesFromElement(sanitized)
    }

    sanitized.querySelectorAll("model-thoughts").forEach((node) => node.remove())

    const bodyMarkdown = htmlToMarkdown(sanitized) || this.extractTextWithLineBreaks(sanitized)
    const normalizedBody = bodyMarkdown.trim()

    if (includeThoughts && thoughtBlocks.length > 0) {
      const thoughtSection = thoughtBlocks.join("\n\n")
      return normalizedBody ? `${thoughtSection}\n\n${normalizedBody}` : thoughtSection
    }

    return normalizedBody
  }

  /**
   */
  replaceUserQueryContent(element: Element, html: string): boolean {
    const textContainer = element.querySelector(".query-text")
    if (!textContainer) return false

    if (textContainer.nextElementSibling?.classList.contains("gh-user-query-markdown")) {
      return false
    }

    ;(textContainer as HTMLElement).style.display = "none"

    const rendered = document.createElement("div")
    rendered.className = "gh-user-query-markdown gh-markdown-preview"
    setSafeHTML(rendered, html)

    textContainer.after(rendered)
    return true
  }

  getExportConfig(): ExportConfig {
    return {
      userQuerySelector: "user-query",
      assistantResponseSelector: "model-response, .model-response-container .markdown",
      turnSelector: ".conversation-turn",
      useShadowDOM: false,
    }
  }

  extractOutline(maxLevel = 6, includeUserQueries = false, showWordCount = false): OutlineItem[] {
    const outline: OutlineItem[] = []
    const container = document.querySelector(this.getResponseContainerSelector())
    if (!container) return outline

    const getMessageId = (el: Element): string | null => {
      const msgContent = el.closest("message-content")
      if (msgContent && msgContent.id) {
        const match = msgContent.id.match(/(r_[a-f0-9]+)/)
        if (match) return match[1]
      }
      return null
    }

    const getUserQueryId = (el: Element): string | null => {
      const btn = el.querySelector('button[jslog*="BardVeMetadataKey"]')
      if (btn) {
        const jslog = btn.getAttribute("jslog") || ""
        const match = jslog.match(/BardVeMetadataKey.*?["'](r_[a-f0-9]+)["']/)
        if (match) return match[1]
      }
      return null
    }

    const messageHeaderCounts: Record<string, Record<string, number>> = {}
    const generateHeaderId = (msgId: string, tagName: string, text: string): string => {
      if (!messageHeaderCounts[msgId]) {
        messageHeaderCounts[msgId] = {}
      }

      const key = `${tagName}-${text}`
      const count = messageHeaderCounts[msgId][key] || 0
      messageHeaderCounts[msgId][key] = count + 1

      return `${msgId}::${key}::${count}`
    }

    const userQuerySelector = this.getUserQuerySelector()
    const calculateWordCount = (
      startEl: Element,
      nextEl: Element | null,
      isUserQueryItem: boolean,
    ): number => {
      if (!startEl) return 0
      try {
        if (isUserQueryItem) {
          // <user-query>...</user-query>
          let current = startEl.nextElementSibling
          let totalLength = 0

          while (current) {
            const tagName = current.tagName.toLowerCase()
            if (tagName === "user-query") {
              break
            }

            if (tagName === "model-response") {
              const markdownContent = current.querySelector(".model-response-text, message-content")
              if (markdownContent) {
                const thoughts = current.querySelector("model-thoughts")
                const thoughtsLength = thoughts?.textContent?.trim().length || 0
                const totalText = markdownContent.textContent?.trim().length || 0
                totalLength += Math.max(0, totalText - thoughtsLength)
              }
            }

            current = current.nextElementSibling
          }
          return totalLength
        }

        const messageContent = startEl.closest("message-content")
        return this.calculateRangeWordCount(startEl, nextEl, messageContent || container)
      } catch {
        return 0
      }
    }

    if (!includeUserQueries) {
      const headingSelectors: string[] = []
      for (let i = 1; i <= maxLevel; i++) {
        headingSelectors.push(`h${i}`)
      }

      const headings = Array.from(container.querySelectorAll(headingSelectors.join(", ")))

      headings.forEach((heading, index) => {
        if (this.shouldSkipOutlineHeading(heading)) return

        const level = parseInt(heading.tagName.charAt(1), 10)
        if (level <= maxLevel) {
          const item: OutlineItem = {
            level,
            text: heading.textContent?.trim() || "",
            element: heading,
          }

          const msgId = getMessageId(heading)
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
            item.wordCount = calculateWordCount(heading, nextBoundaryEl, false)
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

      if (tagName === "user-query") {
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

        const msgId = getUserQueryId(element)
        if (msgId) {
          item.id = msgId
        }

        if (showWordCount) {
          item.wordCount = calculateWordCount(element, null, true)
        }

        outline.push(item)
      } else if (/^h[1-6]$/.test(tagName)) {
        if (this.shouldSkipOutlineHeading(element)) return

        const level = parseInt(tagName.charAt(1), 10)
        if (level <= maxLevel) {
          const item: OutlineItem = {
            level,
            text: element.textContent?.trim() || "",
            element,
          }

          const msgId = getMessageId(element)
          if (msgId) {
            const tagName = element.tagName.toLowerCase()
            item.id = generateHeaderId(msgId, tagName, item.text)
          }

          if (showWordCount) {
            let nextBoundaryEl: Element | null = null
            for (let i = index + 1; i < allElements.length; i++) {
              const candidate = allElements[i]
              const candidateTagName = candidate.tagName.toLowerCase()

              if (candidateTagName === "user-query") {
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
            item.wordCount = calculateWordCount(element, nextBoundaryEl, false)
          }

          outline.push(item)
        }
      }
    })

    return outline
  }

  isGenerating(): boolean {
    const stopIcon = document.querySelector('mat-icon[fonticon="stop"]')
    return stopIcon !== null && (stopIcon as HTMLElement).offsetParent !== null
  }

  getModelName(): string | null {
    const switchLabel = document.querySelector(".input-area-switch-label")
    if (switchLabel) {
      const firstSpan = switchLabel.querySelector("span")
      if (firstSpan?.textContent) {
        const text = firstSpan.textContent.trim()
        if (text.length > 0 && text.length <= 20) {
          return text
        }
      }
    }
    return null
  }

  getNetworkMonitorConfig(): NetworkMonitorConfig {
    return {
      urlPatterns: ["BardFrontendService", "StreamGenerate"],
      silenceThreshold: 3000,
    }
  }

  getDefaultLockSettings(): { enabled: boolean; keyword: string } {
    return { enabled: false, keyword: "" }
  }

  getModelSwitcherConfig(keyword: string): ModelSwitcherConfig {
    return {
      targetModelKeyword: keyword,
      selectorButtonSelectors: [
        ".input-area-switch-label",
        ".model-selector",
        '[data-test-id="model-selector"]',
        '[aria-label*="model"]',
        'button[aria-haspopup="menu"]',
      ],
      menuItemSelector: '.mode-title, [role="menuitem"], [role="option"]',
      checkInterval: 1000,
      maxAttempts: 15,
      menuRenderDelay: 300,
    }
  }

  /**
   */
  async toggleTheme(targetMode: "light" | "dark"): Promise<boolean> {
    try {
      const themeValue = targetMode === "dark" ? "Bard-Dark-Theme" : "Bard-Light-Theme"
      localStorage.setItem("Bard-Color-Theme", themeValue)

      if (targetMode === "dark") {
        document.body.classList.add("dark-theme")
        document.body.classList.remove("light-theme")
      } else {
        document.body.classList.remove("dark-theme")
        document.body.classList.add("light-theme")
      }

      document.body.style.colorScheme = targetMode

      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "Bard-Color-Theme",
          newValue: themeValue,
          storageArea: localStorage,
        }),
      )

      return true
    } catch (error) {
      console.error("[GeminiAdapter] toggleTheme error:", error)
      return false
    }
  }
}
