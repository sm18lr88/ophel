/**
 *
 */

import { SITE_IDS } from "~constants/defaults"
import { DOMToolkit } from "~utils/dom-toolkit"

export interface OutlineItem {
  level: number
  text: string
  element: Element | null
  isUserQuery?: boolean
  isTruncated?: boolean
  id?: string
  context?: string
  wordCount?: number
}

export interface ConversationInfo {
  id: string
  title: string
  url: string
  isActive?: boolean
  isPinned?: boolean
  cid?: string
}

export interface ConversationDeleteTarget {
  id: string
  title?: string
  url?: string
}

export interface SiteDeleteConversationResult {
  id: string
  success: boolean
  method: "api" | "ui" | "none"
  reason?: string
  learnedApiTemplate?: boolean
}

export interface NetworkMonitorConfig {
  urlPatterns: string[]
  silenceThreshold: number
}

export interface ModelSwitcherConfig {
  targetModelKeyword: string
  selectorButtonSelectors: string[]
  menuItemSelector: string
  checkInterval?: number
  maxAttempts?: number
  menuRenderDelay?: number
  subMenuTriggers?: string[]
  subMenuSelector?: string
}

export interface ExportConfig {
  userQuerySelector: string
  assistantResponseSelector: string
  turnSelector: string | null
  useShadowDOM: boolean
}

export interface ExportLifecycleContext {
  conversationId: string
  format: "markdown" | "json" | "txt" | "clipboard"
  includeThoughts: boolean
}

export interface ConversationObserverConfig {
  selector: string
  shadow: boolean
  extractInfo: (el: Element) => ConversationInfo | null
  getTitleElement: (el: Element) => Element | null
}

export interface AnchorData {
  type: "selector" | "index"
  selector?: string
  index?: number
  offset: number
  textSignature?: string
}

export interface ZenModeRule {
  selector: string
  action: "hide"
}

export interface MarkdownFixerConfig {
  selector: string
  fixSpanContent?: boolean
  shouldSkip?: (element: HTMLElement) => boolean
}

export abstract class SiteAdapter {
  protected textarea: HTMLElement | null = null
  protected _cachedFlutterScrollContainer: HTMLElement | null = null

  abstract match(): boolean

  abstract getSiteId(): string

  abstract getName(): string

  abstract getThemeColors(): { primary: string; secondary: string }

  abstract getTextareaSelectors(): string[]

  abstract insertPrompt(content: string): boolean

  getSessionId(): string {
    const urlWithoutQuery = window.location.href.split("?")[0]
    const parts = urlWithoutQuery.split("/").filter((p) => p)
    return parts.length > 0 ? parts[parts.length - 1] : "default"
  }

  supportsNewTab(): boolean {
    return true
  }

  getNewTabUrl(): string {
    return window.location.origin
  }

  supportsTabRename(): boolean {
    return true
  }

  getSessionName(): string | null {
    const title = document.title
    if (title) {
      const parts = title.split(" - ")
      if (parts.length > 1) {
        return parts.slice(0, -1).join(" - ").trim()
      }
      return title.trim()
    }
    return null
  }

  abstract getConversationTitle(): string | null

  isNewConversation(): boolean {
    return false
  }

  isSharePage(): boolean {
    return window.location.pathname.startsWith("/share/")
  }

  /**
   */
  getCurrentCid(): string | null {
    return null
  }

  getConversationList(): ConversationInfo[] {
    return []
  }

  getSidebarScrollContainer(): Element | null {
    return null
  }

  getConversationObserverConfig(): ConversationObserverConfig | null {
    return null
  }

  /**
   */
  navigateToConversation(id: string, url?: string): boolean {
    if (url) {
      window.location.href = url
      return true
    }
    return false
  }

  async deleteConversationOnSite(
    target: ConversationDeleteTarget,
  ): Promise<SiteDeleteConversationResult> {
    return {
      id: target.id,
      success: false,
      method: "none",
      reason: "not_supported",
    }
  }

  async deleteConversationsOnSite(
    targets: ConversationDeleteTarget[],
  ): Promise<SiteDeleteConversationResult[]> {
    const results: SiteDeleteConversationResult[] = []
    for (const target of targets) {
      results.push(await this.deleteConversationOnSite(target))
    }
    return results
  }

  async loadAllConversations(): Promise<void> {
    const container = this.getSidebarScrollContainer()
    if (!container) return

    let lastCount = 0
    let stableRounds = 0
    const maxStableRounds = 3

    while (stableRounds < maxStableRounds) {
      container.scrollTop = container.scrollHeight
      await new Promise((r) => setTimeout(r, 500))

      const conversations =
        (DOMToolkit.query(".conversation", { all: true, shadow: true }) as Element[]) || []
      const currentCount = conversations.length
      if (currentCount === lastCount) {
        stableRounds++
      } else {
        lastCount = currentCount
        stableRounds = 0
      }
    }
  }

  isGenerating(): boolean {
    return false
  }

  getModelName(): string | null {
    return null
  }

  getNetworkMonitorConfig(): NetworkMonitorConfig | null {
    return null
  }

  /**
   */
  async toggleTheme(_targetMode: "light" | "dark"): Promise<boolean> {
    return false
  }

  getWidthSelectors(): Array<{ selector: string; property: string }> {
    return []
  }

  getUserQueryWidthSelectors(): Array<{ selector: string; property: string }> {
    return []
  }

  getZenModeSelectors(): ZenModeRule[] {
    return []
  }

  getMarkdownFixerConfig(): MarkdownFixerConfig | null {
    return null
  }

  getSubmitButtonSelectors(): string[] {
    return []
  }

  /**
   */
  getSubmitKeyConfig(): { key: "Enter" | "Ctrl+Enter" } {
    return { key: "Enter" }
  }

  findTextarea(): HTMLElement | null {
    for (const selector of this.getTextareaSelectors()) {
      const elements = document.querySelectorAll(selector)
      for (const element of Array.from(elements)) {
        if (this.isValidTextarea(element as HTMLElement)) {
          this.textarea = element as HTMLElement
          return element as HTMLElement
        }
      }
    }
    return null
  }

  isValidTextarea(element: HTMLElement): boolean {
    if (element.closest(".gh-main-panel") || element.closest(".gh-queue-panel")) return false
    if (
      Array.from(element.classList).some(
        (cls) => cls.startsWith("gh-queue-") || cls.startsWith("gh-"),
      )
    )
      return false
    return element.offsetParent !== null
  }

  clearTextarea(): void {
    if (this.textarea) {
      if (
        this.textarea instanceof HTMLInputElement ||
        this.textarea instanceof HTMLTextAreaElement
      ) {
        this.textarea.value = ""
      } else {
        this.textarea.textContent = ""
      }
      this.textarea.dispatchEvent(new Event("input", { bubbles: true }))
    }
  }

  getTextareaElement(): HTMLElement | null {
    if (this.textarea && this.textarea.isConnected) {
      return this.textarea
    }
    return this.findTextarea()
  }

  getScrollContainer(): HTMLElement | null {
    const selectors = [
      "infinite-scroller.chat-history",
      ".chat-mode-scroller",
      "main",
      '[role="main"]',
      ".conversation-container",
      ".chat-container",
      "div.content-container",
    ]

    for (const selector of selectors) {
      const container = document.querySelector(selector) as HTMLElement
      if (container && container.scrollHeight > container.clientHeight) {
        this._cachedFlutterScrollContainer = null
        return container
      }
    }

    if (this._cachedFlutterScrollContainer && this._cachedFlutterScrollContainer.isConnected) {
      return this._cachedFlutterScrollContainer
    }

    if (this.getSiteId() === SITE_IDS.GEMINI) {
      const iframes = document.querySelectorAll('iframe[sandbox*="allow-same-origin"]')
      for (const iframe of Array.from(iframes)) {
        try {
          const iframeDoc =
            (iframe as HTMLIFrameElement).contentDocument ||
            (iframe as HTMLIFrameElement).contentWindow?.document
          if (iframeDoc) {
            const scrollContainer = iframeDoc.querySelector(
              'flt-semantics[style*="overflow-y: scroll"]:not([style*="overflow-x: scroll"])',
            ) as HTMLElement
            if (scrollContainer && scrollContainer.scrollHeight > scrollContainer.clientHeight) {
              this._cachedFlutterScrollContainer = scrollContainer
              return scrollContainer
            }
          }
        } catch (e) {
          console.warn("[Ophel] Failed to access iframe:", (e as Error).message)
        }
      }
    }

    return null
  }

  getVisibleAnchorElement(): AnchorData | null {
    const container = this.getScrollContainer()
    if (!container) return null

    const scrollTop = container.scrollTop
    const selectors = this.getChatContentSelectors()
    if (!selectors.length) return null

    const candidates = Array.from(container.querySelectorAll(selectors.join(", ")))
    if (!candidates.length) return null

    let bestElement: Element | null = null

    for (let i = 0; i < candidates.length; i++) {
      const el = candidates[i] as HTMLElement
      const top = el.offsetTop

      if (top <= scrollTop + 100) {
        bestElement = el
      } else {
        break
      }
    }

    if (!bestElement && candidates.length > 0) bestElement = candidates[0]

    if (bestElement) {
      const offset = scrollTop - (bestElement as HTMLElement).offsetTop
      const id = bestElement.getAttribute("data-message-id") || bestElement.id

      if (id) {
        let selector = `[data-message-id="${id}"]`
        if (!bestElement.matches(selector)) selector = `#${id}`
        return { type: "selector", selector, offset }
      } else {
        const globalIndex = candidates.indexOf(bestElement)
        if (globalIndex !== -1) {
          const textSignature = (bestElement.textContent || "").trim().substring(0, 50)
          return { type: "index", index: globalIndex, offset, textSignature }
        }
      }
    }
    return null
  }

  restoreScroll(anchorData: AnchorData): boolean {
    const container = this.getScrollContainer()
    if (!container || !anchorData) return false

    let targetElement: Element | null = null

    if (anchorData.type === "selector" && anchorData.selector) {
      targetElement = container.querySelector(anchorData.selector)
    } else if (anchorData.type === "index" && typeof anchorData.index === "number") {
      const selectors = this.getChatContentSelectors()
      const candidates = Array.from(container.querySelectorAll(selectors.join(", ")))

      if (candidates[anchorData.index]) {
        targetElement = candidates[anchorData.index]

        if (anchorData.textSignature) {
          const currentText = (targetElement.textContent || "").trim().substring(0, 50)
          if (currentText !== anchorData.textSignature) {
            const found = candidates.find(
              (c) => (c.textContent || "").trim().substring(0, 50) === anchorData.textSignature,
            )
            if (found) targetElement = found
          }
        }
      } else if (anchorData.textSignature) {
        const found = candidates.find(
          (c) => (c.textContent || "").trim().substring(0, 50) === anchorData.textSignature,
        )
        if (found) targetElement = found
      }
    }

    if (targetElement) {
      const targetTop = (targetElement as HTMLElement).offsetTop + (anchorData.offset || 0)
      container.scrollTo({
        top: targetTop,
        behavior: "instant" as ScrollBehavior,
      })
      return true
    }
    return false
  }

  getResponseContainerSelector(): string {
    return ""
  }

  getChatContentSelectors(): string[] {
    return []
  }

  getUserQuerySelector(): string | null {
    return null
  }

  /**
   */
  protected extractTextWithLineBreaks(element: Element): string {
    const result: string[] = []
    const blockTags = new Set([
      "div",
      "p",
      "li",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "pre",
      "blockquote",
      "tr",
      "section",
      "article",
    ])

    const walk = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || ""
        result.push(text)
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element
        const tag = el.tagName.toLowerCase()

        if (tag === "br") {
          result.push("\n")
          return
        }

        for (const child of el.childNodes) {
          walk(child)
        }

        if (blockTags.has(tag) && result.length > 0) {
          const lastChar = result[result.length - 1]
          if (!lastChar.endsWith("\n")) {
            result.push("\n")
          }
        }
      }
    }

    walk(element)

    return result
      .join("")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  }

  /**
   */
  protected calculateRangeWordCount(
    startEl: Element,
    endEl: Element | null,
    fallbackContainer?: Element | null,
  ): number {
    if (!startEl) return 0
    try {
      const range = document.createRange()
      range.setStartAfter(startEl)
      if (endEl) {
        range.setEndBefore(endEl)
      } else if (fallbackContainer?.lastChild) {
        range.setEndAfter(fallbackContainer.lastChild)
      } else {
        return 0
      }
      return range.toString().trim().length
    } catch {
      return 0
    }
  }

  extractUserQueryText(element: Element): string {
    return this.extractTextWithLineBreaks(element)
  }

  /**
   */
  extractUserQueryMarkdown(element: Element): string {
    return this.extractUserQueryText(element)
  }

  /**
   */
  replaceUserQueryContent(_element: Element, _html: string): boolean {
    return false
  }

  /**
   */
  extractAssistantResponseText(element: Element): string {
    return this.extractTextWithLineBreaks(element)
  }

  /**
   */
  isInRenderedMarkdownContainer(element: Element): boolean {
    return element.closest(".gh-user-query-markdown") !== null
  }

  /**
   */
  usesShadowDOM(): boolean {
    return false
  }

  extractOutline(
    _maxLevel = 6,
    _includeUserQueries = false,
    _showWordCount = false,
  ): OutlineItem[] {
    return []
  }

  /**
   */
  findElementByHeading(level: number, text: string): Element | null {
    const headings = document.querySelectorAll(`h${level}`)
    for (const h of Array.from(headings)) {
      if (h.textContent?.trim() === text) {
        return h
      }
    }
    return null
  }

  /**
   */
  findUserQueryElement(queryIndex: number, text: string): Element | null {
    const selector = this.getUserQuerySelector()
    if (!selector) return null

    const elements = DOMToolkit.query(selector, { all: true, shadow: true }) as Element[]
    if (!elements || elements.length === 0) return null

    if (elements.length >= queryIndex) {
      const candidate = elements[queryIndex - 1]
      const candidateText = this.extractUserQueryText(candidate)
      if (
        candidateText === text ||
        candidateText.startsWith(text) ||
        text.startsWith(candidateText)
      ) {
        return candidate
      }
    }

    for (const el of elements) {
      const elText = this.extractUserQueryText(el)
      if (elText === text || elText.startsWith(text) || text.startsWith(elText)) {
        return el
      }
    }

    return null
  }

  supportsScrollLock(): boolean {
    return false
  }

  getExportConfig(): ExportConfig | null {
    return null
  }

  /**
   */
  async prepareConversationExport(_context: ExportLifecycleContext): Promise<unknown> {
    return null
  }

  /**
   */
  async restoreConversationAfterExport(
    _context: ExportLifecycleContext,
    _state: unknown,
  ): Promise<void> {}

  getLatestReplyText(): string | null {
    return null
  }

  getNewChatButtonSelectors(): string[] {
    return []
  }

  bindNewChatListeners(callback: () => void): void {
    document.addEventListener("keydown", (e) => {
      if (e.ctrlKey && e.shiftKey && (e.key === "o" || e.key === "O")) {
        setTimeout(callback, 500)
      }
    })

    document.addEventListener(
      "click",
      (e) => {
        const selectors = this.getNewChatButtonSelectors()
        if (selectors.length === 0) return

        const path = e.composedPath()
        for (const target of path) {
          if (target === document || target === window) break

          for (const selector of selectors) {
            if ((target as Element).matches && (target as Element).matches(selector)) {
              setTimeout(callback, 500)
              return
            }
          }
        }
      },
      true,
    )
  }

  getDefaultLockSettings(): { enabled: boolean; keyword: string } {
    return { enabled: false, keyword: "" }
  }

  getModelSwitcherConfig(_keyword: string): ModelSwitcherConfig | null {
    return null
  }

  /**
   */
  protected simulateClick(element: HTMLElement): void {
    element.click()
  }

  /**
   */
  clickModelSelector(): boolean {
    const config = this.getModelSwitcherConfig("")
    if (!config || !config.selectorButtonSelectors) {
      return false
    }

    const btn = this.findElementBySelectors(config.selectorButtonSelectors)
    if (btn && btn.offsetParent !== null) {
      this.simulateClick(btn)
      return true
    }
    return false
  }

  /**
   *
   */
  lockModel(keyword: string, onSuccess?: () => void): void {
    const config = this.getModelSwitcherConfig(keyword)
    if (!config) return

    const {
      targetModelKeyword,
      selectorButtonSelectors,
      menuItemSelector,
      checkInterval = 1000,
      maxAttempts = 10,
      menuRenderDelay = 500,
      subMenuTriggers = [],
      subMenuSelector,
    } = config

    const normalize = (str: string) => (str || "").toLowerCase().trim()
    const target = normalize(targetModelKeyword)

    let buttonWaitAttempts = 0
    const maxButtonWait = maxAttempts

    const waitForButton = setInterval(() => {
      buttonWaitAttempts++

      const selectorBtn = this.findElementBySelectors(selectorButtonSelectors)

      if (selectorBtn) {
        clearInterval(waitForButton)

        const currentText = normalize(selectorBtn.textContent || selectorBtn.innerText || "")
        if (currentText.includes(target)) {
          if (onSuccess) onSuccess()
          return
        }

        this.performMenuSearch(
          selectorBtn,
          target,
          menuItemSelector,
          menuRenderDelay,
          subMenuTriggers,
          subMenuSelector,
          onSuccess,
          maxAttempts,
        )
      } else if (buttonWaitAttempts >= maxButtonWait) {
        clearInterval(waitForButton)
        console.warn(`Ophel: Model selector button not found after ${maxButtonWait} attempts.`)
        this.showModelLockFailure(targetModelKeyword, "button_not_found")
      }
    }, checkInterval)
  }

  /**
   */
  private performMenuSearch(
    selectorBtn: HTMLElement,
    target: string,
    menuItemSelector: string,
    menuRenderDelay: number,
    subMenuTriggers: string[],
    subMenuSelector: string | undefined,
    onSuccess?: () => void,
    maxMenuAttempts = 10,
  ): void {
    // Open menu
    this.simulateClick(selectorBtn)

    const maxWaitAttempts = Math.max(3, maxMenuAttempts)
    let menuAttempts = 0

    const tryFindMenuItems = () => {
      menuAttempts++
      const menuItems = this.getVisibleMenuItems(menuItemSelector, selectorBtn)

      if (menuItems.length > 0) {
        this.searchAndSelectModel(
          menuItems,
          target,
          menuItemSelector,
          menuRenderDelay,
          subMenuTriggers,
          subMenuSelector,
          onSuccess,
        )
        return
      }

      if (menuAttempts >= maxWaitAttempts) {
        document.body.click()
        console.warn(`Ophel: Menu items not found.`)
        this.showModelLockFailure(target, "menu_empty")
        return
      }

      setTimeout(tryFindMenuItems, menuRenderDelay)
    }

    setTimeout(tryFindMenuItems, menuRenderDelay)
  }

  /**
   */
  private searchAndSelectModel(
    menuItems: Element[],
    target: string,
    menuItemSelector: string,
    menuRenderDelay: number,
    subMenuTriggers: string[],
    subMenuSelector: string | undefined,
    onSuccess?: () => void,
  ): void {
    const normalize = (str: string) => (str || "").toLowerCase().trim()

    const matchedItem = this.findBestMatchingItem(menuItems, target)
    if (matchedItem) {
      this.simulateClick(matchedItem as HTMLElement)
      setTimeout(() => {
        document.body.click()
        if (onSuccess) onSuccess()
      }, 100)
      return
    }

    let subMenuItem: Element | undefined

    if (subMenuSelector) {
      subMenuItem = menuItems.find((item) => item.matches(subMenuSelector))
    }

    if (!subMenuItem && subMenuTriggers.length > 0) {
      subMenuItem = menuItems.find((item) => {
        const text = normalize(item.textContent || "")
        return subMenuTriggers.some((trigger) => text.includes(normalize(trigger)))
      })
    }

    if (subMenuItem) {
      this.simulateClick(subMenuItem as HTMLElement)

      setTimeout(() => {
        const subItems = this.getVisibleMenuItems(menuItemSelector, subMenuItem as HTMLElement)
        const matchedSubItem = this.findBestMatchingItem(subItems, target)
        if (matchedSubItem) {
          this.simulateClick(matchedSubItem as HTMLElement)
          setTimeout(() => {
            document.body.click()
            if (onSuccess) onSuccess()
          }, 100)
          return
        }

        document.body.click()
        console.warn(`Ophel: Model "${target}" not found in sub-menu.`)
        this.showModelLockFailure(target, "not_found")
      }, menuRenderDelay)
      return
    }

    document.body.click()
    console.warn(`Ophel: Model "${target}" not found in menu.`)
    this.showModelLockFailure(target, "not_found")
  }

  private getVisibleMenuItems(menuItemSelector: string, anchor?: HTMLElement): Element[] {
    const items = this.getVisibleElementsBySelector(menuItemSelector)
    if (!anchor || items.length === 0) return items

    const ariaContainer = this.getMenuContainerByAria(anchor)
    if (ariaContainer) {
      const scoped = items.filter((item) => ariaContainer.contains(item))
      if (scoped.length > 0) return scoped
    }

    const containerSelector = this.getMenuContainerSelector()
    const containerMap = new Map<Element, Element[]>()

    for (const item of items) {
      const container = item.closest(containerSelector)
      if (!container || !this.isElementVisible(container)) continue
      const list = containerMap.get(container)
      if (list) list.push(item)
      else containerMap.set(container, [item])
    }

    if (containerMap.size > 0) {
      const bestContainer = this.pickBestMenuContainer(anchor, containerMap)
      if (bestContainer) {
        return containerMap.get(bestContainer) || items
      }
    }

    return items
  }

  private getVisibleElementsBySelector(selector: string): Element[] {
    return (
      (DOMToolkit.query(selector, {
        all: true,
        shadow: true,
        filter: (el) => this.isElementVisible(el),
      }) as Element[]) || []
    )
  }

  private getMenuContainerByAria(anchor: HTMLElement): Element | null {
    const menuId = anchor.getAttribute("aria-controls") || anchor.getAttribute("aria-owns")
    if (!menuId) return null
    const selector = `#${this.escapeSelector(menuId)}`
    const container = DOMToolkit.query(selector, { shadow: true }) as Element | null
    if (container && this.isElementVisible(container)) return container
    return null
  }

  private getMenuContainerSelector(): string {
    return [
      '[role="menu"]',
      '[role="listbox"]',
      "md-menu-surface",
      ".mdc-menu-surface",
      ".mat-menu-panel",
      ".menu[popover]",
      "[data-radix-popper-content-wrapper]",
      ".cdk-overlay-pane",
    ].join(", ")
  }

  private pickBestMenuContainer(
    anchor: HTMLElement,
    containerMap: Map<Element, Element[]>,
  ): Element | null {
    const anchorRect = anchor.getBoundingClientRect()
    let best: {
      container: Element
      distance: number
      count: number
    } | null = null

    containerMap.forEach((items, container) => {
      if (items.length === 0) return
      const rect = (container as HTMLElement).getBoundingClientRect()
      const distance = this.getRectDistance(anchorRect, rect)
      if (
        !best ||
        distance < best.distance - 1 ||
        (Math.abs(distance - best.distance) <= 1 && items.length > best.count)
      ) {
        best = { container, distance, count: items.length }
      }
    })

    return best ? best.container : null
  }

  private getRectDistance(a: DOMRect, b: DOMRect): number {
    const dx = Math.max(a.left - b.right, b.left - a.right, 0)
    const dy = Math.max(a.top - b.bottom, b.top - a.bottom, 0)
    return Math.sqrt(dx * dx + dy * dy)
  }

  private isElementVisible(element: Element | null): boolean {
    if (!element) return false
    const htmlEl = element as HTMLElement
    if (!htmlEl.isConnected) return false
    const style = window.getComputedStyle(htmlEl)
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      parseFloat(style.opacity) === 0
    ) {
      return false
    }
    const rect = htmlEl.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0
  }

  private escapeSelector(value: string): string {
    if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
      return CSS.escape(value)
    }
    return value.replace(/[^a-zA-Z0-9_-]/g, "\\$&")
  }

  /**
   */
  private findBestMatchingItem(menuItems: Element[], target: string): Element | undefined {
    const normalize = (str: string) => (str || "").toLowerCase().trim()

    for (const item of menuItems) {
      const itemText = normalize(item.textContent || (item as HTMLElement).innerText || "")
      const mainText = itemText.split("\n")[0].trim()
      if (mainText === target || itemText === target) {
        return item
      }
    }

    for (const item of menuItems) {
      const itemText = normalize(item.textContent || (item as HTMLElement).innerText || "")
      const mainText = itemText.split("\n")[0].trim()
      if (mainText.endsWith(target)) {
        return item
      }
    }

    for (const item of menuItems) {
      const itemText = normalize(item.textContent || (item as HTMLElement).innerText || "")
      if (itemText.includes(target)) {
        return item
      }
    }

    return undefined
  }

  /**
   */
  private async showModelLockFailure(
    keyword: string,
    reason: "button_not_found" | "menu_empty" | "not_found",
  ): Promise<void> {
    try {
      const { showToast } = await import("~utils/toast")
      const { t } = await import("~utils/i18n")

      let message: string
      switch (reason) {
        case "button_not_found":
          message = t("modelLockFailedNoButton") || "Model selector not found"
          break
        case "menu_empty":
          message = t("modelLockFailedMenuEmpty") || "Model menu failed to load"
          break
        case "not_found":
        default:
          message = (t("modelLockFailedNotFound") || 'Model "{model}" not found').replace(
            "{model}",
            keyword,
          )
      }

      showToast(message, 3000)
    } catch (e) {
      console.error("Ophel: Failed to show toast:", e)
    }
  }

  findElementBySelectors(selectors: string[]): HTMLElement | null {
    return DOMToolkit.query(selectors, { shadow: true }) as HTMLElement | null
  }

  findAllElementsBySelector(selector: string): Element[] {
    return (DOMToolkit.query(selector, { all: true, shadow: true }) as Element[]) || []
  }

  afterPropertiesSet(
    options: { modelLockConfig?: { enabled: boolean; keyword: string } } = {},
  ): void {
    const { modelLockConfig } = options
    if (modelLockConfig && modelLockConfig.enabled) {
      this.lockModel(modelLockConfig.keyword)
    }
  }

  shouldInjectIntoShadow(_host: Element): boolean {
    return true
  }
}
