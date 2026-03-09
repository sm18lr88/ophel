/**
 */
import { SITE_IDS } from "~constants"
import { DOMToolkit } from "~utils/dom-toolkit"
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

const GEMINI_ENTERPRISE_DELETE_REASON = {
  UI_FAILED: "delete_ui_failed",
  BATCH_ABORTED_AFTER_UI_FAILURE: "delete_batch_aborted_after_ui_failure",
} as const

const GEMINI_ENTERPRISE_DELETE_KEYWORDS = [
  "delete",
  "remove",
  "delete",
  "delete",
  "remove",
  "supprimer",
  "eliminar",
  "löschen",
  "삭제",
  "delete",
  "hapus",
  "удал",
]

const GEMINI_ENTERPRISE_CANCEL_KEYWORDS = [
  "cancel",
  "cancel",
  "annuler",
  "abbrechen",
  "취소",
  "キャンセル",
  "batal",
  "отмен",
]

export class GeminiEnterpriseAdapter extends SiteAdapter {
  private clearOnInit = false

  match(): boolean {
    return window.location.hostname.includes("business.gemini.google")
  }

  getSiteId(): string {
    return SITE_IDS.GEMINI_ENTERPRISE
  }

  getName(): string {
    return "Gemini Enterprise"
  }

  getThemeColors(): { primary: string; secondary: string } {
    return { primary: "#4285f4", secondary: "#34a853" }
  }

  getNewTabUrl(): string {
    return "https://business.gemini.google"
  }

  isNewConversation(): boolean {
    return !window.location.pathname.includes("/session/")
  }

  isSharePage(): boolean {
    return window.location.pathname.includes("/r/share/")
  }

  supportsTabRename(): boolean {
    return true
  }

  getCurrentCid(): string {
    const currentPath = window.location.pathname
    const cidMatch = currentPath.match(/\/home\/cid\/([^/]+)/)
    return cidMatch ? cidMatch[1] : ""
  }

  getSessionName(): string | null {
    const conversations = DOMToolkit.query(".conversation", {
      all: true,
      shadow: true,
    }) as Element[]

    for (const conv of conversations) {
      const button = conv.querySelector("button.list-item") || conv.querySelector("button")
      if (!button) continue

      const isActive =
        button.classList.contains("selected") ||
        button.classList.contains("active") ||
        button.getAttribute("aria-selected") === "true"

      if (isActive) {
        const titleEl = button.querySelector(".conversation-title")
        if (titleEl) {
          const name = titleEl.textContent?.trim()
          if (name) return name
        }
      }
    }

    return super.getSessionName()
  }

  getConversationTitle(): string | null {
    const items = DOMToolkit.query(".conversation", {
      all: true,
      shadow: true,
    }) as Element[]
    for (const el of items) {
      const button = el.querySelector("button.list-item") || el.querySelector("button")
      if (
        button &&
        (button.classList.contains("selected") || button.classList.contains("active"))
      ) {
        return button.querySelector(".conversation-title")?.textContent?.trim() || null
      }
    }
    return null
  }

  getConversationList(): ConversationInfo[] {
    const items = DOMToolkit.query(".conversation", {
      all: true,
      shadow: true,
    }) as Element[]
    const cid = this.getCurrentCid()

    return Array.from(items)
      .map((el) => {
        const button = el.querySelector("button.list-item") || el.querySelector("button")
        if (!button) return null

        const menuBtn = button.querySelector(".conversation-action-menu-button")
        let id = ""
        if (menuBtn && menuBtn.id && menuBtn.id.startsWith("menu-")) {
          id = menuBtn.id.replace("menu-", "")
        }

        if (!id || !/^\d+$/.test(id)) return null

        const titleEl = button.querySelector(".conversation-title")
        const title = titleEl ? titleEl.textContent?.trim() || "" : ""

        const isActive =
          button.classList.contains("selected") ||
          button.classList.contains("active") ||
          button.getAttribute("aria-selected") === "true"

        let url = `https://business.gemini.google/session/${id}`
        if (cid) {
          url = `https://business.gemini.google/home/cid/${cid}/r/session/${id}`
        }

        return {
          id,
          cid,
          title,
          url,
          isActive,
        }
      })
      .filter((c): c is NonNullable<typeof c> => c !== null) as ConversationInfo[]
  }

  getLatestReplyText(): string | null {
    const ucsConversation = DOMToolkit.query("ucs-conversation", { shadow: true }) as Element | null
    if (!ucsConversation || !ucsConversation.shadowRoot) return null

    const main = ucsConversation.shadowRoot.querySelector(".main")
    if (!main) return null

    const turns = main.querySelectorAll(".turn")
    if (turns.length === 0) return null

    const lastTurn = turns[turns.length - 1]

    const ucsSummary = lastTurn.querySelector("ucs-summary")
    if (!ucsSummary) return null

    const markdownDoc = this.extractSummaryContent(ucsSummary)
    if (!markdownDoc) {
      return this.extractTextWithLineBreaks(ucsSummary)
    }

    return this.extractTextWithLineBreaks(markdownDoc)
  }

  getSidebarScrollContainer(): Element | null {
    return (
      (DOMToolkit.query(".conversation-list", { shadow: true }) as Element) ||
      (DOMToolkit.query("mat-sidenav", { shadow: true }) as Element)
    )
  }

  getConversationObserverConfig(): ConversationObserverConfig {
    return {
      selector: ".conversation",
      shadow: true,
      extractInfo: (el) => {
        const button = el.querySelector("button.list-item") || el.querySelector("button")
        if (!button) return null

        const menuBtn = button.querySelector(".conversation-action-menu-button")
        if (!menuBtn || !menuBtn.id?.startsWith("menu-")) return null

        const id = menuBtn.id.replace("menu-", "")
        if (!/^\d+$/.test(id)) return null

        const titleEl = button.querySelector(".conversation-title")
        const title = titleEl?.textContent?.trim() || ""
        const cid = this.getCurrentCid()

        return {
          id,
          cid,
          title,
          url: `https://business.gemini.google/home/cid/${cid}/r/session/${id}`,
        }
      },
      getTitleElement: (el) => {
        const button = el.querySelector("button.list-item") || el.querySelector("button")
        return button?.querySelector(".conversation-title") || el
      },
    }
  }

  navigateToConversation(id: string, url?: string): boolean {
    const conversations = DOMToolkit.query(".conversation", {
      all: true,
      shadow: true,
    }) as Element[] | null

    if (conversations) {
      for (const convEl of Array.from(conversations)) {
        const menuBtn =
          convEl.querySelector(`#menu-${id}`) ||
          convEl.querySelector(`.conversation-action-menu-button[id="menu-${id}"]`)
        if (menuBtn) {
          const btn = convEl.querySelector("button.list-item") || convEl.querySelector("button")
          if (btn) (btn as HTMLElement).click()
          else (convEl as HTMLElement).click()
          return true
        }
      }
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
      if (!result.success && result.reason === GEMINI_ENTERPRISE_DELETE_REASON.UI_FAILED) {
        for (let i = index + 1; i < targets.length; i++) {
          results.push({
            id: targets[i].id,
            success: false,
            method: "none",
            reason: GEMINI_ENTERPRISE_DELETE_REASON.BATCH_ABORTED_AFTER_UI_FAILURE,
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
    const uiSuccess = await this.deleteConversationViaUi(target.id)
    return {
      id: target.id,
      success: uiSuccess,
      method: uiSuccess ? "ui" : "none",
      reason: uiSuccess ? undefined : GEMINI_ENTERPRISE_DELETE_REASON.UI_FAILED,
    }
  }

  private async deleteConversationViaUi(id: string): Promise<boolean> {
    const row = await this.findConversationRowWithRetry(id)
    if (!row) return false

    row.scrollIntoView({ block: "center", behavior: "auto" })
    this.revealConversationActions(row)

    const menuButton = await this.findConversationMenuButton(row)
    if (!menuButton) return false

    const menuRoot = await this.openConversationMenu(row, menuButton)
    if (!menuRoot) return false

    const deleteItem = await this.waitForDeleteMenuItem(menuButton, 2500, menuRoot)
    if (!deleteItem) {
      document.body.click()
      return false
    }
    this.simulateClick(deleteItem)

    // Optimistically remove current row from DOM to prevent observer from re-adding
    // the just-deleted item back into local store before remote UI finishes syncing.
    this.removeConversationRowElement(row, id)

    // Gemini Enterprise deletes immediately after clicking delete (no second confirm dialog).
    const removed = await this.waitForConversationRemoved(id, 5200)
    const menuClosed = await this.waitForMenuClosed(1200)
    const success = removed || menuClosed
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
    const expected = id.trim()
    const rows = this.findAllElementsBySelector(".conversation") as HTMLElement[]
    for (const row of rows) {
      const rowId = this.extractConversationIdFromElement(row)
      if (rowId && rowId === expected) {
        return row
      }
    }

    const hrefCandidates = [
      `a[href*="/session/${expected}"]`,
      `a[href$="/session/${expected}"]`,
      `a[href*="/r/session/${expected}"]`,
      `a[href$="/r/session/${expected}"]`,
    ]

    for (const selector of hrefCandidates) {
      const anchor = DOMToolkit.query(selector, { shadow: true }) as HTMLElement | null
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

    const menuBtn = element.querySelector(
      '.conversation-action-menu-button[id^="menu-"], button[id^="menu-"]',
    ) as HTMLElement | null
    if (!menuBtn?.id?.startsWith("menu-")) return ""

    const id = menuBtn.id.replace("menu-", "")
    return /^\d+$/.test(id) ? id : ""
  }

  private async findConversationMenuButton(row: HTMLElement): Promise<HTMLElement | null> {
    const actionSelectors = [
      ".conversation-action-menu-button",
      'button[id^="menu-"]',
      'button[aria-haspopup="menu"]',
      'button[aria-label*="More"]',
      'button[aria-label*="more"]',
      'button[aria-label*="More"]',
      'button[title*="More"]',
      'button[title*="more"]',
      "button",
    ].join(", ")

    const rowId = this.extractConversationIdFromElement(row)

    for (let attempt = 0; attempt < 10; attempt++) {
      const scopes = this.getMenuSearchScopes(row)
      scopes.forEach((scope) => this.revealConversationActions(scope))

      const allCandidates = scopes.flatMap(
        (scope) => Array.from(scope.querySelectorAll(actionSelectors)) as HTMLElement[],
      )
      const candidates = allCandidates.filter((candidate) => {
        if (candidate instanceof HTMLButtonElement && candidate.disabled) return false
        return true
      })

      if (candidates.length > 0) {
        if (rowId) {
          const exact = candidates.find((candidate) => candidate.id === `menu-${rowId}`)
          if (exact) return exact
        }

        const menuIconCandidate = candidates.find((candidate) => {
          return (
            candidate.querySelector(
              'mat-icon[fonticon="more_vert"], mat-icon[fonticon="more_horiz"], md-icon',
            ) !== null
          )
        })
        if (menuIconCandidate) return menuIconCandidate

        const fallbackVisible = candidates
          .filter((candidate) => this.isVisible(candidate))
          .sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right)[0]
        if (fallbackVisible) return fallbackVisible
      }

      await this.sleep(90)
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

  private revealConversationActions(scope: HTMLElement): void {
    const events: Array<keyof GlobalEventHandlersEventMap> = [
      "mouseenter",
      "mouseover",
      "mousemove",
    ]

    for (const eventName of events) {
      scope.dispatchEvent(
        new MouseEvent(eventName, {
          bubbles: true,
          cancelable: true,
          view: window,
        }),
      )
    }
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

        const text = this.getSignalText(item)
        if (!this.hasKeyword(text, GEMINI_ENTERPRISE_DELETE_KEYWORDS)) continue
        if (this.hasKeyword(text, GEMINI_ENTERPRISE_CANCEL_KEYWORDS)) continue
        return item
      }

      const visibleItems = candidates.filter((item) => this.isVisible(item))
      if (visibleItems.length > 0) {
        lastVisibleItems = visibleItems
      }

      await this.sleep(80)
    }

    if (lastVisibleItems.length > 0) {
      const fallback = lastVisibleItems[lastVisibleItems.length - 1]
      const text = this.getSignalText(fallback)
      if (!this.hasKeyword(text, GEMINI_ENTERPRISE_CANCEL_KEYWORDS)) {
        return fallback
      }
    }

    return null
  }

  private getMenuActionCandidates(
    trigger: HTMLElement,
    menuRoot?: HTMLElement | null,
  ): HTMLElement[] {
    const selectors =
      'md-menu-item, [role="menuitem"], [role="menu"] button, .mat-mdc-menu-panel button'
    const results: HTMLElement[] = []

    if (menuRoot) {
      results.push(...(Array.from(menuRoot.querySelectorAll(selectors)) as HTMLElement[]))
    }

    const controlled = this.getMenuContainerFromTrigger(trigger)
    if (controlled) {
      results.push(...(Array.from(controlled.querySelectorAll(selectors)) as HTMLElement[]))
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

    const safeId =
      typeof CSS !== "undefined" && typeof CSS.escape === "function"
        ? CSS.escape(controlledId)
        : controlledId
    return (DOMToolkit.query(`#${safeId}`, { shadow: true }) as HTMLElement | null) || null
  }

  private findVisibleMenuContainer(): HTMLElement | null {
    const menus = this.findAllElementsBySelector(
      'md-menu-surface, .menu[popover], .mat-mdc-menu-panel, [role="menu"]',
    ) as HTMLElement[]
    const visible = menus.filter((menu) => this.isVisible(menu))
    if (visible.length === 0) return null
    return visible[visible.length - 1]
  }

  private async waitForMenuClosed(timeout = 1200): Promise<boolean> {
    const start = Date.now()
    while (Date.now() - start < timeout) {
      if (!this.findVisibleMenuContainer()) return true
      await this.sleep(80)
    }
    return false
  }

  private removeConversationRowElement(row: HTMLElement, id: string): void {
    const candidates = [
      row,
      row.closest("li") as HTMLElement | null,
      this.findConversationRow(id),
    ].filter((item): item is HTMLElement => item instanceof HTMLElement)

    const unique = new Set<HTMLElement>()
    for (const candidate of candidates) {
      if (unique.has(candidate)) continue
      unique.add(candidate)
      if (candidate.isConnected) {
        candidate.remove()
      }
    }
  }

  private async waitForConversationRemoved(id: string, timeout = 5200): Promise<boolean> {
    const start = Date.now()
    while (Date.now() - start < timeout) {
      if (!this.findConversationRow(id)) return true
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
      const cid = this.getCurrentCid()
      const fallback = cid ? `/home/cid/${cid}/r` : "/"
      try {
        window.history.replaceState(window.history.state, "", fallback)
      } catch {
        // ignore route state failures
      }
    }
  }

  private getCurrentConversationIdFromPath(): string | null {
    const match = window.location.pathname.match(/\/session\/([^/?#]+)/)
    return match?.[1] || null
  }

  private getSignalText(element: HTMLElement): string {
    return [
      element.textContent || "",
      element.getAttribute("aria-label") || "",
      element.getAttribute("title") || "",
      element.getAttribute("data-test-id") || "",
      element.getAttribute("data-testid") || "",
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

  getNewChatButtonSelectors(): string[] {
    return [
      ".chat-button.list-item",
      'button[aria-label="New chat"]',
      'button[aria-label="New chat"]',
    ]
  }

  getWidthSelectors() {
    const config = (selector: string, value?: string, extraCss?: string, noCenter = false) => ({
      selector,
      globalSelector: `mat-sidenav-content ${selector}`,
      property: "max-width",
      value,
      extraCss,
      noCenter,
    })

    return [
      config("mat-sidenav-content", "100%", undefined, true),
      config(".main.chat-mode", "100%", undefined, true),

      config("ucs-summary"),
      config("ucs-conversation"),
      config("ucs-search-bar"),
      config(".summary-container.expanded"),
      config(".conversation-container"),

      config(".input-area-container", undefined, "left: 0 !important; right: 0 !important;", true),
    ]
  }

  getUserQueryWidthSelectors() {
    return [
      {
        selector: ".question-block .question-wrapper",
        property: "max-width",
        noCenter: true,
      },
    ]
  }

  getZenModeSelectors() {
    return [{ selector: ".disclaimer", action: "hide" as const }]
  }

  getTextareaSelectors(): string[] {
    return [
      "div.ProseMirror",
      ".ProseMirror",
      '[contenteditable="true"]:not([type="search"])',
      '[role="textbox"]',
      'textarea:not([type="search"])',
    ]
  }

  getSubmitButtonSelectors(): string[] {
    return [
      'button[aria-label*="Submit"]',
      'button[aria-label*="Submit"]',
      'button[aria-label*="Send"]',
      'button[aria-label*="Send"]',
      ".send-button",
      '[data-testid*="send"]',
    ]
  }

  isValidTextarea(element: HTMLElement): boolean {
    if ((element as HTMLInputElement).type === "search") return false
    if (element.classList.contains("main-input")) return false
    if (element.getAttribute("aria-label")?.includes("Search")) return false
    if ((element as HTMLInputElement).placeholder?.includes("Search")) return false
    if (element.classList.contains("prompt-search-input")) return false
    if (element.id === "prompt-search") return false
    if (element.closest(".gh-main-panel")) return false
    if (element.closest(".gh-queue-panel")) return false
    if (
      Array.from(element.classList).some(
        (cls) => cls.startsWith("gh-queue-") || cls.startsWith("gh-"),
      )
    )
      return false

    const isVisible = element.offsetParent !== null
    const isContentEditable = element.getAttribute("contenteditable") === "true"
    const isProseMirror = element.classList.contains("ProseMirror")
    return isVisible && (isContentEditable || isProseMirror || element.tagName === "TEXTAREA")
  }

  findTextarea(): HTMLElement | null {
    const element = DOMToolkit.query(this.getTextareaSelectors(), {
      shadow: true,
      filter: (el) => this.isValidTextarea(el as HTMLElement),
    }) as HTMLElement | null

    if (element) {
      this.textarea = element
      return element
    }
    return super.findTextarea()
  }

  clearTextarea(): void {
    if (!this.textarea) return
    if (!this.textarea.isConnected) {
      this.textarea = null
      return
    }

    this.textarea.focus()

    document.execCommand("selectAll", false, undefined)
    document.execCommand("insertText", false, "\u200B")
  }

  clearTextareaNormal(): void {
    if (!this.textarea) return
    if (!this.textarea.isConnected) {
      this.textarea = null
      return
    }

    this.textarea.focus()
    document.execCommand("selectAll", false, undefined)
    document.execCommand("delete", false, undefined)
  }

  insertPrompt(content: string): boolean {
    const editor = this.textarea || this.findTextarea()

    if (!editor) {
      console.warn("[GeminiEnterpriseAdapter] Editor not found during insert.")
      return false
    }

    if (!editor.isConnected) {
      this.textarea = null
      return false
    }

    this.textarea = editor
    editor.click()
    editor.focus()

    const hasContent = () => {
      const text = editor.textContent?.replace(/[\u200B\u200C\u200D\uFEFF]/g, "") || ""
      return text.includes(content)
    }

    try {
      const dataTransfer = new DataTransfer()
      dataTransfer.setData("text/plain", content)
      const pasteEvent = new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: dataTransfer,
      })

      editor.dispatchEvent(pasteEvent)

      if (hasContent()) {
        editor.dispatchEvent(new Event("input", { bubbles: true }))
        editor.dispatchEvent(new Event("change", { bubbles: true }))
        editor.dispatchEvent(
          new KeyboardEvent("keydown", { bubbles: true, key: " ", code: "Space" }),
        )
        editor.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: " ", code: "Space" }))
        return true
      }
    } catch {}

    try {
      document.execCommand("selectAll", false, undefined)
      const success = document.execCommand("insertText", false, content)
      if (success && hasContent()) {
        editor.dispatchEvent(new Event("input", { bubbles: true }))
        editor.dispatchEvent(new Event("change", { bubbles: true }))
        return true
      }
    } catch {}

    try {
      editor.focus()
      const sel = editor.ownerDocument.getSelection()
      if (sel) {
        sel.selectAllChildren(editor)
        sel.collapseToEnd()
      }

      const beforeInputEvent = new InputEvent("beforeinput", {
        bubbles: true,
        cancelable: true,
        inputType: "insertText",
        data: content,
      })
      editor.dispatchEvent(beforeInputEvent)

      const inputEvent = new InputEvent("input", {
        bubbles: true,
        cancelable: true,
        inputType: "insertText",
        data: content,
      })
      editor.dispatchEvent(inputEvent)

      if (hasContent()) {
        return true
      }
    } catch {}

    try {
      let p = editor.querySelector("p")
      let isNewP = false
      if (!p) {
        p = document.createElement("p")
        editor.appendChild(p)
        isNewP = true
      }

      p.textContent = content

      if (isNewP || content) {
        editor.dispatchEvent(new Event("input", { bubbles: true }))
        editor.dispatchEvent(new Event("change", { bubbles: true }))
      }

      editor.dispatchEvent(
        new InputEvent("input", {
          bubbles: true,
          cancelable: true,
          inputType: "insertText",
          data: content,
        }),
      )
      editor.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: " ", code: "Space" }))
      editor.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: " ", code: "Space" }))
      editor.dispatchEvent(new Event("change", { bubbles: true }))

      if (hasContent()) {
        return true
      }
    } catch {}

    console.warn("[GeminiEnterpriseAdapter] All insert strategies failed for content insertion.")
    return false
  }

  getScrollContainer(): HTMLElement | null {
    const container = DOMToolkit.query(".chat-mode-scroller", { shadow: true }) as HTMLElement

    if (container && container.scrollHeight > container.clientHeight) {
      return container
    }

    return super.getScrollContainer()
  }

  getResponseContainerSelector(): string {
    return ".conversation-container"
  }

  getChatContentSelectors(): string[] {
    return [
      ".model-response-container",
      ".message-content",
      "[data-message-id]",
      "ucs-conversation-message",
      ".conversation-message",
    ]
  }

  getUserQuerySelector(): string {
    return ".question-block"
  }

  /**
   */
  extractUserQueryText(element: Element): string {
    const markdown = element.querySelector("ucs-fast-markdown")
    if (!markdown || !markdown.shadowRoot) {
      return this.extractTextWithLineBreaks(element)
    }

    const markdownDoc = markdown.shadowRoot.querySelector(".markdown-document")
    if (markdownDoc) {
      return this.extractTextWithLineBreaks(markdownDoc)
    }

    return this.extractTextWithLineBreaks(element)
  }

  /**
   */
  extractUserQueryMarkdown(element: Element): string {
    const markdown = element.querySelector("ucs-fast-markdown")
    if (!markdown || !markdown.shadowRoot) {
      return element.textContent?.trimEnd() || ""
    }

    const markdownDoc = markdown.shadowRoot.querySelector(".markdown-document")
    if (!markdownDoc) {
      return element.textContent?.trimEnd() || ""
    }

    const paragraphs = markdownDoc.querySelectorAll("p")
    if (paragraphs.length === 0) {
      return markdownDoc.textContent?.trimEnd() || ""
    }

    const lines = Array.from(paragraphs).map((p) => p.textContent || "")
    return lines.join("\n").trimEnd()
  }

  /**
   */
  replaceUserQueryContent(element: Element, html: string): boolean {
    const markdown = element.querySelector("ucs-fast-markdown")
    if (!markdown || !markdown.shadowRoot) return false

    const markdownDoc = markdown.shadowRoot.querySelector(".markdown-document")
    if (!markdownDoc) return false

    if (markdownDoc.nextElementSibling?.classList.contains("gh-user-query-markdown")) {
      return false
    }

    ;(markdownDoc as HTMLElement).style.display = "none"

    const rendered = document.createElement("div")
    rendered.className = "gh-user-query-markdown gh-markdown-preview"
    setSafeHTML(rendered, html)

    markdownDoc.after(rendered)
    return true
  }

  /**
   */
  usesShadowDOM(): boolean {
    return true
  }

  /**
   */
  extractSummaryContent(ucsSummary: Element): Element | null {
    const findMarkdownDocument = (root: Element | ShadowRoot, depth = 0): Element | null => {
      if (depth > 10 || !root) return null

      const shadowRoot = (root as Element).shadowRoot || (root.nodeType === 11 ? root : null)
      const searchRoot = shadowRoot || root

      if ("querySelector" in searchRoot) {
        const markdownDoc = searchRoot.querySelector(".markdown-document")
        if (markdownDoc) return markdownDoc
      }

      const elements = "querySelectorAll" in searchRoot ? searchRoot.querySelectorAll("*") : []
      for (const el of Array.from(elements)) {
        if (el.shadowRoot) {
          const found = findMarkdownDocument(el.shadowRoot, depth + 1)
          if (found) return found
        }
      }

      return null
    }

    return findMarkdownDocument(ucsSummary)
  }

  private findHeadingsInShadowDOM(
    root: Element | Document | ShadowRoot,
    outline: OutlineItem[],
    maxLevel: number,
    depth: number,
    turnId?: string,
    messageHeaderCounts: Record<string, number> = {},
  ): void {
    if (depth > 15) return

    if ("shadowRoot" in root && (root as Element).shadowRoot) {
      this.findHeadingsInShadowDOM(
        (root as Element).shadowRoot!,
        outline,
        maxLevel,
        depth + 1,
        turnId,
        messageHeaderCounts,
      )
      return
    }

    if (root !== document && "querySelectorAll" in root) {
      const headingSelector = Array.from({ length: maxLevel }, (_, i) => `h${i + 1}`).join(", ")
      try {
        const headings = root.querySelectorAll(headingSelector)
        headings.forEach((heading) => {
          if (this.isInRenderedMarkdownContainer(heading)) return

          const spans = heading.querySelectorAll("span[data-markdown-start-index]")
          if (spans.length > 0) {
            const level = parseInt(heading.tagName[1], 10)
            const text = Array.from(spans)
              .map((s) => s.textContent?.trim())
              .join("")
            if (text) {
              const item: OutlineItem = { level, text, element: heading }

              if (turnId) {
                const tagName = heading.tagName.toLowerCase()
                const key = `${tagName}-${text}`
                const count = messageHeaderCounts[key] || 0
                messageHeaderCounts[key] = count + 1
                item.id = `${turnId}::${key}::${count}`
              }

              outline.push(item)
            }
          }
        })
      } catch {}
    }

    if ("querySelectorAll" in root) {
      const allElements = root.querySelectorAll("*")
      for (const el of Array.from(allElements)) {
        if (el.shadowRoot) {
          this.findHeadingsInShadowDOM(
            el.shadowRoot,
            outline,
            maxLevel,
            depth + 1,
            turnId,
            messageHeaderCounts,
          )
        }
      }
    }
  }

  /**
   */
  extractOutline(maxLevel = 6, includeUserQueries = false, showWordCount = false): OutlineItem[] {
    const outline: OutlineItem[] = []

    const extractSummaryWordCount = (ucsSummary: Element): number => {
      const markdownDoc = this.extractSummaryContent(ucsSummary)
      if (markdownDoc) {
        return markdownDoc.textContent?.trim().length || 0
      }
      return ucsSummary.textContent?.trim().length || 0
    }

    if (!includeUserQueries) {
      this.findHeadingsInShadowDOM(document, outline, maxLevel, 0)

      if (showWordCount) {
        outline.forEach((item, index) => {
          if (!item.element) return

          const markdownDoc = item.element.closest(".markdown-document")
          if (markdownDoc) {
            let nextBoundaryEl: Element | null = null
            for (let i = index + 1; i < outline.length; i++) {
              if (outline[i].level <= item.level) {
                nextBoundaryEl = outline[i].element || null
                break
              }
            }
            item.wordCount = this.calculateRangeWordCount(item.element, nextBoundaryEl, markdownDoc)
          }
        })
      }

      return outline
    }

    const ucsConversation = DOMToolkit.query("ucs-conversation", { shadow: true }) as Element | null
    if (!ucsConversation || !ucsConversation.shadowRoot) {
      this.findHeadingsInShadowDOM(document, outline, maxLevel, 0)
      return outline
    }

    const main = ucsConversation.shadowRoot.querySelector(".main")
    if (!main) {
      this.findHeadingsInShadowDOM(document, outline, maxLevel, 0)
      return outline
    }

    const turnContainers = main.querySelectorAll(".turn")

    turnContainers.forEach((turn) => {
      // jslog="257629;track:impressionasVeMetadata:[null,null,null,&quot;7038012297388346599_5593580960293487735&quot;];"
      const jslog = turn.getAttribute("jslog") || ""
      const idMatch = jslog.match(/(\d+_\d+)/)
      const turnId = idMatch ? idMatch[1] : undefined

      const questionBlock = turn.querySelector(".question-block")
      const ucsSummary = turn.querySelector("ucs-summary")

      if (questionBlock) {
        let queryText = this.extractUserQueryText(questionBlock)
        let isTruncated = false
        if (queryText.length > 200) {
          queryText = queryText.substring(0, 200)
          isTruncated = true
        }

        const item: OutlineItem = {
          level: 0,
          text: queryText,
          element: questionBlock,
          isUserQuery: true,
          isTruncated,
          id: turnId, // Assign Turn ID to User Query
        }

        if (showWordCount && ucsSummary) {
          item.wordCount = extractSummaryWordCount(ucsSummary)
        }

        outline.push(item)
      }

      if (ucsSummary) {
        const turnHeadings: OutlineItem[] = []
        // Pass Turn ID as context for generating heading IDs
        this.findHeadingsInShadowDOM(ucsSummary, turnHeadings, maxLevel, 0, turnId)

        if (showWordCount) {
          const markdownDoc = this.extractSummaryContent(ucsSummary)
          turnHeadings.forEach((h, index) => {
            if (!h.element) return

            let nextBoundaryEl: Element | null = null
            for (let i = index + 1; i < turnHeadings.length; i++) {
              if (turnHeadings[i].level <= h.level) {
                nextBoundaryEl = turnHeadings[i].element || null
                break
              }
            }

            h.wordCount = this.calculateRangeWordCount(
              h.element,
              nextBoundaryEl,
              markdownDoc || ucsSummary,
            )
          })
        }

        turnHeadings.forEach((h) => outline.push(h))
      }
    })

    return outline
  }

  /**
   */
  findElementByHeading(level: number, text: string): Element | null {
    const headings = DOMToolkit.query(`h${level}`, {
      all: true,
      shadow: true,
    }) as Element[]

    for (const h of headings) {
      if (h.textContent?.trim() === text) {
        return h
      }
    }
    return null
  }

  getExportConfig(): ExportConfig {
    return {
      userQuerySelector: ".question-block",
      assistantResponseSelector: "ucs-summary",
      turnSelector: ".turn",
      useShadowDOM: true,
    }
  }

  isGenerating(): boolean {
    const findInShadow = (root: Document | ShadowRoot, depth = 0): boolean => {
      if (depth > 10) return false

      const stopButton = root.querySelector(
        'button[aria-label*="Stop"], button[aria-label*="Stop"], ' +
          '[data-test-id="stop-button"], .stop-button, md-icon-button[aria-label*="Stop"]',
      )
      if (stopButton && (stopButton as HTMLElement).offsetParent !== null) {
        return true
      }

      const spinner = root.querySelector(
        'mat-spinner, md-spinner, .loading-spinner, [role="progressbar"], ' +
          ".generating-indicator, .response-loading",
      )
      if (spinner && (spinner as HTMLElement).offsetParent !== null) {
        return true
      }

      const elements = root.querySelectorAll("*")
      for (const el of Array.from(elements)) {
        if (el.shadowRoot) {
          if (findInShadow(el.shadowRoot, depth + 1)) {
            return true
          }
        }
      }
      return false
    }

    return findInShadow(document)
  }

  getModelName(): string | null {
    const findInShadow = (root: Document | ShadowRoot, depth = 0): string | null => {
      if (depth > 10) return null

      const modelSelectors = [
        "#model-selector-menu-anchor",
        ".action-model-selector",
        ".model-selector",
        '[data-test-id="model-selector"]',
        ".current-model",
      ]

      for (const selector of modelSelectors) {
        const el = root.querySelector(selector)
        if (el && el.textContent) {
          const text = el.textContent.trim()
          const modelMatch = text.match(/(\d+\.?\d*\s*)?(Pro|Flash|Ultra|Nano|Gemini|auto)/i)
          if (modelMatch) {
            return modelMatch[0].trim()
          }
          if (text.length <= 20 && text.length > 0) {
            return text
          }
        }
      }

      const elements = root.querySelectorAll("*")
      for (const el of Array.from(elements)) {
        if (el.shadowRoot) {
          const result = findInShadow(el.shadowRoot, depth + 1)
          if (result) return result
        }
      }
      return null
    }

    return findInShadow(document)
  }

  getNetworkMonitorConfig(): NetworkMonitorConfig {
    return {
      urlPatterns: ["widgetStreamAssist"],
      silenceThreshold: 3000,
    }
  }

  afterPropertiesSet(
    options: {
      modelLockConfig?: { enabled: boolean; keyword: string }
      clearOnInit?: boolean
    } = {},
  ): void {
    this.clearOnInit = options.clearOnInit || false

    super.afterPropertiesSet(options)

    if (this.clearOnInit) {
      this.clearTextarea()
    }
  }

  lockModel(keyword: string, onSuccess: (() => void) | null = null): void {
    super.lockModel(keyword, onSuccess ?? undefined)
  }

  shouldInjectIntoShadow(host: Element): boolean {
    return !(
      host.closest("mat-sidenav") ||
      host.closest("mat-drawer") ||
      host.closest('[class*="bg-sidebar"]')
    )
  }

  async loadAllConversations(): Promise<void> {
    const maxIterations = 20

    for (let i = 0; i < maxIterations; i++) {
      const allBtns =
        (DOMToolkit.query("button.show-more", { all: true, shadow: true }) as Element[]) || []

      const expandBtns = allBtns.filter((btn) => {
        const icon = btn.querySelector(".show-more-icon")
        return icon && !icon.classList.contains("more-visible")
      })

      if (expandBtns.length === 0) {
        break
      }

      for (const btn of expandBtns) {
        ;(btn as HTMLElement).click()
      }

      await new Promise((r) => setTimeout(r, 300))
    }
  }

  getDefaultLockSettings(): { enabled: boolean; keyword: string } {
    return { enabled: true, keyword: "3 Pro" }
  }

  getModelSwitcherConfig(keyword: string): ModelSwitcherConfig {
    return {
      targetModelKeyword: keyword || "3 Pro",
      selectorButtonSelectors: ["#model-selector-menu-anchor", ".action-model-selector"],
      menuItemSelector: "md-menu-item",
      checkInterval: 1500,
      maxAttempts: 20,
      menuRenderDelay: 500,
    }
  }

  /**
   */
  async toggleTheme(targetMode: "light" | "dark" | "system"): Promise<boolean> {
    let stopSuppression = false
    const suppressMenu = () => {
      if (stopSuppression) return

      try {
        const menus = DOMToolkit.query(
          '.menu[popover], md-menu-surface, .mat-menu-panel, [role="menu"]',
          {
            all: true,
            shadow: true,
          },
        ) as Element[]
        menus.forEach((el) => {
          const htmlEl = el as HTMLElement
          if (htmlEl.style.opacity !== "0") {
            htmlEl.style.setProperty("opacity", "0", "important")
            htmlEl.style.setProperty("visibility", "hidden", "important")
            htmlEl.style.setProperty("pointer-events", "none", "important")
          }
        })
      } catch {
        // Ignore errors during suppression
      }

      requestAnimationFrame(suppressMenu)
    }
    suppressMenu()

    document.body.classList.add("gh-stealth-mode")

    try {
      let settingsBtn = DOMToolkit.query(".settings-button", { shadow: true }) as HTMLElement

      if (!settingsBtn) {
        console.error("[GeminiEnterpriseAdapter] Settings button not found (.settings-button)")
        return false
      } else {
        if (typeof settingsBtn.click === "function") {
          settingsBtn.click()
        } else {
          settingsBtn.dispatchEvent(
            new MouseEvent("click", {
              bubbles: true,
              cancelable: true,
              view: window,
            }),
          )
        }
      }

      let attempts = 0
      const findAndClickOption = (): boolean => {
        const targetIcon =
          targetMode === "system" ? "computer" : targetMode === "dark" ? "dark_mode" : "light_mode"

        // Query all md-primary-tab in the document
        const tabs = DOMToolkit.query("md-primary-tab", { all: true, shadow: true }) as Element[]

        for (const tab of tabs) {
          const icon =
            tab.querySelector("md-icon") ||
            (DOMToolkit.query("md-icon", {
              parent: tab,
              shadow: true,
            }) as Element)
          if (icon && icon.textContent?.trim() === targetIcon) {
            ;(tab as HTMLElement).click()
            return true
          }
        }
        return false
      }

      return await new Promise((resolve) => {
        const interval = setInterval(() => {
          attempts++
          if (findAndClickOption()) {
            clearInterval(interval)
            resolve(true)
          } else if (attempts > 20) {
            // Timeout 2s
            clearInterval(interval)
            console.error("[GeminiEnterpriseAdapter] Target theme option not found")
            resolve(false)
            // Try clicking settings again to close if failed
            if (settingsBtn && typeof settingsBtn.click === "function") settingsBtn.click()
          }
        }, 100)
      })
    } finally {
      stopSuppression = true
      setTimeout(() => {
        document.body.classList.remove("gh-stealth-mode")
      }, 200)
    }
  }
}
