/**
 *
 */

import type { OutlineItem, SiteAdapter } from "~adapters/base"
import type { OutlineManager } from "~core/outline-manager"
import { useBookmarkStore } from "~stores/bookmarks-store"

import { DOMToolkit } from "~utils/dom-toolkit"
import { createSVGElement } from "~utils/icons"

export type InlineBookmarkDisplayMode = "always" | "hover" | "hidden"

const ICON_CLASS = "gh-inline-bookmark"
const ICON_BOOKMARKED_CLASS = "gh-inline-bookmark--bookmarked"

// Style IDs
const GLOBAL_STYLE_ID = "gh-inline-bookmark-global-styles"
const SCOPED_STYLE_ID = "gh-inline-bookmark-scoped-styles"

export class InlineBookmarkManager {
  private outlineManager: OutlineManager
  private adapter: SiteAdapter
  private displayMode: InlineBookmarkDisplayMode = "always"
  private unsubscribe: (() => void) | null = null
  private unsubscribeBookmarks: (() => void) | null = null
  private injectedElements = new WeakSet<Element>()
  private injectedRoots = new WeakSet<Node>()

  constructor(
    outlineManager: OutlineManager,
    adapter: SiteAdapter,
    displayMode: InlineBookmarkDisplayMode = "always",
  ) {
    this.outlineManager = outlineManager
    this.adapter = adapter
    this.displayMode = displayMode

    this.injectGlobalStyles()

    this.unsubscribe = outlineManager.subscribe(() => {
      this.injectBookmarkIcons()
    })

    this.unsubscribeBookmarks = useBookmarkStore.subscribe(() => {
      this.updateAllIconStates()
    })

    this.injectBookmarkIcons()
    this.setDisplayMode(displayMode)
  }

  /**
   */
  private injectGlobalStyles() {
    if (document.getElementById(GLOBAL_STYLE_ID)) return

    const style = document.createElement("style")
    style.id = GLOBAL_STYLE_ID
    style.textContent = `
      :root {
        --gh-icon-display: flex;
        --gh-icon-opacity-default: 0.3;
        --gh-icon-opacity-parent-hover: 0.5;
      }

      body.gh-inline-bookmark-mode-always {
        --gh-icon-display: flex;
        --gh-icon-opacity-default: 0.3;
        --gh-icon-opacity-parent-hover: 0.3;
      }

      body.gh-inline-bookmark-mode-hover {
        --gh-icon-display: flex;
        --gh-icon-opacity-default: 0;
        --gh-icon-opacity-parent-hover: 0.5;
      }

      body.gh-inline-bookmark-mode-hidden {
        --gh-icon-display: none;
        --gh-icon-opacity-default: 0;
      }
    `
    document.head.appendChild(style)
  }

  /**
   */
  private injectScopedStyles(root: Node) {
    if (this.injectedRoots.has(root)) return

    // const parent = root instanceof Document ? document.head : root

    if (root instanceof Document) {
      // Global styles handled separately, but scoped styles for main doc also needed?
      // Actually injectGlobalStyles handles body classes.
      // We need similar .gh-inline-bookmark rules in main document too if not shadow.
      // Let's use a specific ID check for the root
      if (document.getElementById(SCOPED_STYLE_ID)) {
        this.injectedRoots.add(root)
        return
      }
    } else {
      // Check inside shadow root
      if ((root as ParentNode).querySelector(`#${SCOPED_STYLE_ID}`)) {
        this.injectedRoots.add(root)
        return
      }
    }

    const style = document.createElement("style")
    style.id = SCOPED_STYLE_ID
    style.textContent = `
      .${ICON_CLASS} {
        position: absolute;
        left: var(--gh-icon-left, -24px);
        top: 50%;
        transform: translateY(-50%);
        cursor: pointer;
        transition: opacity 0.2s, transform 0.2s;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        z-index: 10;
        color: var(--gh-primary, #f59e0b);

        display: var(--gh-icon-display, flex);
        opacity: var(--gh-icon-opacity-default, 0.3);
      }

      /* Hover Effects depend on local structure, so must be in scoped css */
      .${ICON_CLASS}:hover {
        opacity: 1 !important;
        transform: translateY(-50%) scale(1.1);
      }

      .${ICON_CLASS}.${ICON_BOOKMARKED_CLASS} {
        opacity: 1 !important;
      }

      /* Parent Hover Effect */
      .gh-has-inline-bookmark:hover .${ICON_CLASS}:not(.${ICON_BOOKMARKED_CLASS}) {
        opacity: var(--gh-icon-opacity-parent-hover, 0.5);
      }

      /* Ensure parent relative positioning */
      .gh-has-inline-bookmark {
        position: relative !important;
      }
    `

    // Append to appropriate place
    if (root instanceof Document) {
      document.head.appendChild(style)
    } else {
      ;(root as ShadowRoot).appendChild(style)
    }

    this.injectedRoots.add(root)
  }

  /**
   */
  setDisplayMode(mode: InlineBookmarkDisplayMode) {
    this.displayMode = mode
    document.body.classList.remove(
      "gh-inline-bookmark-mode-always",
      "gh-inline-bookmark-mode-hover",
      "gh-inline-bookmark-mode-hidden",
    )
    document.body.classList.add(`gh-inline-bookmark-mode-${mode}`)
  }

  /**
   */
  injectBookmarkIcons() {
    const flatItems = this.outlineManager.getFlatItems()
    const sessionId = this.adapter.getSessionId()
    const bookmarkStore = useBookmarkStore.getState()

    for (let idx = 0; idx < flatItems.length; idx++) {
      const item = flatItems[idx]
      if (!item.element || !item.element.isConnected) continue

      const element = item.element as HTMLElement

      const root = element.getRootNode()
      if (root) {
        this.injectScopedStyles(root)
      }

      if (this.injectedElements.has(element)) continue
      if (element.querySelector(`.${ICON_CLASS}`)) {
        this.injectedElements.add(element)
        continue
      }

      element.classList.add("gh-has-inline-bookmark")

      const iconWrapper = document.createElement("span")
      iconWrapper.className = ICON_CLASS

      const signature = this.outlineManager.getSignature(item)
      const isBookmarked = bookmarkStore.getBookmarkId(sessionId, signature) !== null

      if (isBookmarked) {
        iconWrapper.classList.add(ICON_BOOKMARKED_CLASS)
      }

      iconWrapper.replaceChildren(this.createStarSvgElement(isBookmarked))

      iconWrapper.dataset.signature = signature
      iconWrapper.dataset.level = String(item.level)
      iconWrapper.dataset.text = item.text

      iconWrapper.addEventListener("click", (e) => {
        e.stopPropagation()
        e.preventDefault()
        this.handleBookmarkClick(item, signature, iconWrapper)
      })

      element.insertBefore(iconWrapper, element.firstChild)
      this.injectedElements.add(element)
    }
  }

  /**
   */
  /**
   */
  private createStarSvgElement(filled: boolean): SVGElement {
    const fillColor = filled ? "#f59e0b" : "none"
    const strokeColor = filled ? "#f59e0b" : "currentColor"

    const svg = createSVGElement("svg", {
      viewBox: "0 0 24 24",
      width: "16",
      height: "16",
      fill: fillColor,
      stroke: strokeColor,
      "stroke-width": "2",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    })

    const polygon = createSVGElement("polygon", {
      points:
        "12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2",
    })

    svg.appendChild(polygon)
    return svg
  }

  /**
   */
  private handleBookmarkClick(item: OutlineItem, signature: string, _iconWrapper: HTMLElement) {
    const bookmarkStore = useBookmarkStore.getState()
    const sessionId = this.adapter.getSessionId()
    const siteId = this.adapter.getSiteId()
    const cid = this.adapter.getCurrentCid() || ""

    const scrollContainer = this.outlineManager.getScrollContainer()
    const scrollTop = (item.element as HTMLElement).offsetTop + (scrollContainer?.scrollTop || 0)

    bookmarkStore.toggleBookmark(sessionId, siteId, cid, item, signature, scrollTop)
  }

  /**
   */
  updateAllIconStates() {
    const bookmarkStore = useBookmarkStore.getState()
    const sessionId = this.adapter.getSessionId()

    const icons = DOMToolkit.query(`.${ICON_CLASS}`, {
      all: true,
      shadow: true,
    }) as Element[]

    icons.forEach((iconWrapper) => {
      const wrapper = iconWrapper as HTMLElement
      const signature = wrapper.dataset.signature
      if (!signature) return

      const isBookmarked = bookmarkStore.getBookmarkId(sessionId, signature) !== null
      const hasClass = wrapper.classList.contains(ICON_BOOKMARKED_CLASS)

      if (isBookmarked !== hasClass) {
        if (isBookmarked) {
          wrapper.classList.add(ICON_BOOKMARKED_CLASS)
          wrapper.replaceChildren(this.createStarSvgElement(true))
        } else {
          wrapper.classList.remove(ICON_BOOKMARKED_CLASS)
          wrapper.replaceChildren(this.createStarSvgElement(false))
        }
      }
    })
  }

  /**
   */
  cleanup() {
    if (this.unsubscribe) {
      this.unsubscribe()
      this.unsubscribe = null
    }
    if (this.unsubscribeBookmarks) {
      this.unsubscribeBookmarks()
      this.unsubscribeBookmarks = null
    }

    document.getElementById(GLOBAL_STYLE_ID)?.remove()
    document.getElementById(SCOPED_STYLE_ID)?.remove()

    const scopedStyles = DOMToolkit.query(`#${SCOPED_STYLE_ID}`, {
      all: true,
      shadow: true,
    }) as Element[]
    scopedStyles.forEach((el) => el.remove())

    const icons = DOMToolkit.query(`.${ICON_CLASS}`, {
      all: true,
      shadow: true,
    }) as Element[]
    icons.forEach((el) => el.remove())

    const containers = DOMToolkit.query(".gh-has-inline-bookmark", {
      all: true,
      shadow: true,
    }) as Element[]
    containers.forEach((el) => {
      el.classList.remove("gh-has-inline-bookmark")
    })

    document.body.classList.remove(
      "gh-inline-bookmark-mode-always",
      "gh-inline-bookmark-mode-hover",
      "gh-inline-bookmark-mode-hidden",
    )
    this.injectedElements = new WeakSet()
    this.injectedRoots = new WeakSet()
  }
}
