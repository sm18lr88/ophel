/**
 *
 */

import type { SiteAdapter } from "~adapters/base"
import { DOMToolkit } from "~utils/dom-toolkit"
import { initCopyButtons, showCopySuccess } from "~utils/icons"
import { getHighlightStyles, renderMarkdown } from "~utils/markdown"

const MARKDOWN_PATTERNS = [
  /^#{1,6}\s+\S/m,
  /\*\*[^*]+\*\*/,
  /`[^`]+`/,
  /^```/m,
  /^>\s+\S/m,
  /^[-*]\s+\S/m,
  /^\d+\.\s+\S/m,
  /\[.+\]\(.+\)/,
]

const RESCAN_INTERVAL = 2000
const INITIAL_DELAY = 1000
const STYLE_ID = "gh-user-query-markdown-style"

const USER_QUERY_MARKDOWN_CSS = `
.gh-user-query-markdown {
  font-size: 15px;
  line-height: 1.6;
}

.gh-user-query-markdown pre {
  margin: 0.5em 0;
  padding: 0.75em;
  padding-right: 0.5em;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 6px;
  font-size: 0.95em;
  max-height: 200px;
  overflow: auto;
  position: relative;
}

.gh-user-query-markdown pre::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
.gh-user-query-markdown pre::-webkit-scrollbar-track {
  background: transparent;
}
.gh-user-query-markdown pre::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.15);
  border-radius: 3px;
}
.gh-user-query-markdown pre::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.25);
}

.gh-user-query-markdown pre code {
  background: transparent;
  padding: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
  word-break: break-all;
  overflow: visible;
}

.gh-user-query-markdown code {
  background: rgba(0, 0, 0, 0.05);
  padding: 0.2em 0.4em;
  border-radius: 4px;
  font-size: 0.9em;
}

.gh-user-query-markdown .gh-code-copy-btn {
  position: sticky;
  top: 6px;
  float: right;
  margin-top: -1.5em;
  margin-right: -1.0em;
  width: 24px;
  height: 24px;
  padding: 0;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 4px;
  color: #666;
  font-size: 12px;
  cursor: pointer;
  opacity: 0.2;
  transition: opacity 0.2s, background 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
}
.gh-user-query-markdown pre:hover .gh-code-copy-btn {
  opacity: 1;
}
.gh-user-query-markdown .gh-code-copy-btn:hover {
  background: #4285f4;
  color: white;
  border-color: #4285f4;
}

.gh-user-query-markdown h1,
.gh-user-query-markdown h2,
.gh-user-query-markdown h3,
.gh-user-query-markdown h4,
.gh-user-query-markdown h5,
.gh-user-query-markdown h6 {
  margin: 0.5em 0 0.3em;
  line-height: 1.3;
}

.gh-user-query-markdown h1 { font-size: 1.3em; }
.gh-user-query-markdown h2 { font-size: 1.2em; }
.gh-user-query-markdown h3 { font-size: 1.1em; }

.gh-user-query-markdown ul,
.gh-user-query-markdown ol {
  margin: 0.4em 0;
  padding-left: 1.5em;
}

.gh-user-query-markdown li {
  margin: 0.2em 0;
}

.gh-user-query-markdown blockquote {
  margin: 0.5em 0;
  padding: 0.5em 1em;
  border-left: 3px solid #4285f4;
  background: rgba(0, 0, 0, 0.03);
  border-radius: 0 4px 4px 0;
}

.gh-user-query-markdown table {
  margin: 0.5em 0;
  font-size: 0.9em;
}

.gh-user-query-markdown hr {
  margin: 0.5em 0;
  border: none;
  border-top: 1px solid #e5e7eb;
}

body.dark-theme .gh-user-query-markdown pre,
body.dark-theme .gh-user-query-markdown code {
  background: rgba(255, 255, 255, 0.08);
}
body.dark-theme .gh-user-query-markdown pre::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
}
body.dark-theme .gh-user-query-markdown pre::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.25);
}
body.dark-theme .gh-user-query-markdown .gh-code-copy-btn {
  background: rgba(0, 0, 0, 0.5);
  border-color: rgba(255, 255, 255, 0.1);
  color: #aaa;
}
body.dark-theme .gh-user-query-markdown blockquote {
  background: rgba(255, 255, 255, 0.05);
}
body.dark-theme .gh-user-query-markdown hr {
  border-top-color: #4b5563;
}

html[dark-theme] .gh-user-query-markdown pre,
html[dark-theme] .gh-user-query-markdown code {
  background: rgba(255, 255, 255, 0.08);
}
html[dark-theme] .gh-user-query-markdown pre::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
}
html[dark-theme] .gh-user-query-markdown pre::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.25);
}
html[dark-theme] .gh-user-query-markdown .gh-code-copy-btn {
  background: rgba(0, 0, 0, 0.5);
  border-color: rgba(255, 255, 255, 0.1);
  color: #aaa;
}
html[dark-theme] .gh-user-query-markdown blockquote {
  background: rgba(255, 255, 255, 0.05);
}
html[dark-theme] .gh-user-query-markdown hr {
  border-top-color: #4b5563;
}

html.dark .gh-user-query-markdown pre,
html.dark .gh-user-query-markdown code {
  background: rgba(255, 255, 255, 0.08);
}
html.dark .gh-user-query-markdown pre::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
}
html.dark .gh-user-query-markdown pre::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.25);
}
html.dark .gh-user-query-markdown .gh-code-copy-btn {
  background: rgba(0, 0, 0, 0.5);
  border-color: rgba(255, 255, 255, 0.1);
  color: #aaa;
}
html.dark .gh-user-query-markdown blockquote {
  background: rgba(255, 255, 255, 0.05);
}
html.dark .gh-user-query-markdown hr {
  border-top-color: #4b5563;
}
`

/**
 */
function looksLikeMarkdown(text: string): boolean {
  if (!text.includes("\n")) return false

  return MARKDOWN_PATTERNS.some((pattern) => pattern.test(text))
}

export class UserQueryMarkdownRenderer {
  private adapter: SiteAdapter
  private enabled: boolean
  private processedElements = new WeakMap<Element, string>()
  private stopWatch: (() => void) | null = null
  private rescanTimer: number | null = null
  private injectedShadowRoots = new WeakSet<ShadowRoot>()
  private codeCopyHandler: ((e: MouseEvent) => void) | null = null

  constructor(adapter: SiteAdapter, enabled: boolean) {
    this.adapter = adapter
    this.enabled = enabled
    if (enabled) {
      this.init()
    }
  }

  private init() {
    const selector = this.adapter.getUserQuerySelector()
    if (!selector) {
      console.warn("[UserQueryMarkdownRenderer] No user query selector found for this site")
      return
    }

    const usesShadowDOM = this.adapter.usesShadowDOM()

    if (usesShadowDOM) {
      this.startRescanTimer()
    } else {
      this.injectGlobalStyles()
      this.initCodeCopyHandler()

      this.stopWatch = DOMToolkit.each(
        selector,
        (el) => {
          this.processQueryElement(el)
        },
        { shadow: true },
      )
    }
  }

  /**
   */
  private injectGlobalStyles() {
    if (document.getElementById(STYLE_ID)) return

    const style = document.createElement("style")
    style.id = STYLE_ID
    style.textContent = getHighlightStyles() + "\n" + USER_QUERY_MARKDOWN_CSS
    document.head.appendChild(style)
  }

  /**
   */
  private injectStyleToShadowRoot(shadowRoot: ShadowRoot) {
    if (this.injectedShadowRoots.has(shadowRoot)) return
    if (shadowRoot.querySelector(`#${STYLE_ID}`)) return

    const style = document.createElement("style")
    style.id = STYLE_ID
    style.textContent = getHighlightStyles() + "\n" + USER_QUERY_MARKDOWN_CSS
    shadowRoot.prepend(style)
    this.injectedShadowRoots.add(shadowRoot)

    shadowRoot.addEventListener("click", (e: Event) => this.handleCodeCopy(e))
  }

  /**
   */
  private handleCodeCopy(e: Event) {
    const target = e.target as HTMLElement
    const btn = target.closest(".gh-code-copy-btn") as HTMLElement
    if (btn && btn.closest(".gh-user-query-markdown")) {
      e.preventDefault()
      e.stopPropagation()

      const code = btn.nextElementSibling?.textContent || ""
      navigator.clipboard
        .writeText(code)
        .then(() => {
          showCopySuccess(btn, { size: 14 })
        })
        .catch((err) => {
          console.error("[UserQueryMarkdownRenderer] Copy failed:", err)
        })
    }
  }

  /**
   */
  private initCodeCopyHandler() {
    if (this.codeCopyHandler) return

    this.codeCopyHandler = (e: MouseEvent) => this.handleCodeCopy(e)
    document.addEventListener("click", this.codeCopyHandler, true)
  }

  /**
   */
  private startRescanTimer() {
    if (this.rescanTimer) return

    setTimeout(() => {
      if (this.enabled) this.rescan()
    }, INITIAL_DELAY)

    this.rescanTimer = window.setInterval(() => {
      if (!this.enabled) return
      this.rescan()
    }, RESCAN_INTERVAL)
  }

  /**
   */
  private rescan() {
    if (document.hidden || !document.hasFocus()) return

    const selector = this.adapter.getUserQuerySelector()
    if (!selector) return

    const elements = DOMToolkit.query(selector, { all: true, shadow: true }) as Element[]
    for (const el of elements) {
      this.processQueryElement(el)
    }
  }

  private processQueryElement(element: Element) {
    const rawMarkdown = this.adapter.extractUserQueryMarkdown(element)
    if (!rawMarkdown) return

    if (!looksLikeMarkdown(rawMarkdown)) return

    const processedMarkdown = this.processedElements.get(element)
    if (processedMarkdown === rawMarkdown) return

    const html = renderMarkdown(rawMarkdown, false)

    if (this.adapter.usesShadowDOM()) {
      const markdown = element.querySelector("ucs-fast-markdown")
      if (markdown?.shadowRoot) {
        this.injectStyleToShadowRoot(markdown.shadowRoot)
      }
    }

    const replaced = this.adapter.replaceUserQueryContent(element, html)

    let container = element.querySelector(".gh-user-query-markdown")
    if (!container && this.adapter.usesShadowDOM()) {
      const markdown = element.querySelector("ucs-fast-markdown")
      if (markdown?.shadowRoot) {
        container = markdown.shadowRoot.querySelector(".gh-user-query-markdown")
      }
    }
    if (container) {
      initCopyButtons(container, { size: 14, color: "#6b7280" })
      this.processedElements.set(element, rawMarkdown)
      return
    }

    if (replaced) {
      this.processedElements.set(element, rawMarkdown)
    }
  }

  /**
   */
  updateSettings(enabled: boolean) {
    if (this.enabled === enabled) return

    this.enabled = enabled

    if (enabled) {
      this.init()
    } else {
      this.stop()
    }
  }

  /**
   */
  stop() {
    if (this.stopWatch) {
      this.stopWatch()
      this.stopWatch = null
    }
    if (this.rescanTimer) {
      clearInterval(this.rescanTimer)
      this.rescanTimer = null
    }
  }

  /**
   */
  destroy() {
    this.stop()
    this.processedElements = new WeakMap()
    this.injectedShadowRoots = new WeakSet()

    const style = document.getElementById(STYLE_ID)
    if (style) style.remove()

    if (this.codeCopyHandler) {
      document.removeEventListener("click", this.codeCopyHandler, true)
      this.codeCopyHandler = null
    }
  }
}
