/**
 *
 */

import { DOMToolkit } from "~utils/dom-toolkit"
import { setSafeHTML } from "~utils/trusted-types"

const REGEX_CODE_BLOCK = /<code\b[^>]*>[\s\S]*?<\/code>/gi
const REGEX_BOLD_TAG = /<b\b[^>]*>([\s\S]*?)<\/b>/gi
const REGEX_STRONG_TAG = /<strong\b[^>]*>([\s\S]*?)<\/strong>/gi
const REGEX_MD_BOLD = /\*\*([^*]+(?:\*(?!\*)[^*]*)*)\*\*/g
const REGEX_PLACEHOLDER = /###OPHEL_CODE_(\d+)###/g

/**
 */
export interface MarkdownFixerConfig {
  selector: string
  fixSpanContent?: boolean
  shouldSkip?: (element: HTMLElement) => boolean
}

export class MarkdownFixer {
  private stopObserver: (() => void) | null = null
  private enabled = false
  private config: MarkdownFixerConfig

  constructor(config: MarkdownFixerConfig) {
    this.config = config
  }

  /**
   */
  start() {
    if (this.enabled) return
    this.enabled = true

    this.fixAllParagraphs()

    this.stopObserver = DOMToolkit.each(this.config.selector, (p, isNew) => {
      if (isNew) {
        setTimeout(() => this.fixParagraph(p as HTMLElement), 100)
      }
    })
  }

  /**
   */
  stop() {
    if (!this.enabled) return
    this.enabled = false
    if (this.stopObserver) {
      this.stopObserver()
      this.stopObserver = null
    }
  }

  /**
   */
  private fixAllParagraphs() {
    const paragraphs = DOMToolkit.query(this.config.selector, {
      all: true,
    }) as Element[]
    paragraphs.forEach((p) => this.fixParagraph(p as HTMLElement))
  }

  /**
   */
  fixParagraph(p: HTMLElement) {
    if (!p.isConnected) return

    if (this.config.shouldSkip?.(p)) {
      setTimeout(() => this.fixParagraph(p), 500)
      return
    }

    const currentHtml = p.innerHTML

    if (p.dataset.mdFixerHash === String(currentHtml.length)) {
      return
    }

    if (
      !currentHtml.includes("<b") &&
      !currentHtml.includes("<strong") &&
      !currentHtml.includes("**")
    ) {
      p.dataset.mdFixerHash = String(currentHtml.length)
      return
    }


    const codeBlocks: string[] = []
    let protectedHtml = currentHtml.replace(REGEX_CODE_BLOCK, (match) => {
      codeBlocks.push(match)
      return `###OPHEL_CODE_${codeBlocks.length - 1}###`
    })

    let processedHtml = protectedHtml.replace(REGEX_STRONG_TAG, "**$1**")
    processedHtml = processedHtml.replace(REGEX_BOLD_TAG, "**$1**")

    let hasChanges = false
    processedHtml = processedHtml.replace(REGEX_MD_BOLD, (_match, content) => {
      hasChanges = true
      return `<strong data-original-markdown="**">${content}</strong>`
    })

    if (hasChanges) {
      const finalHtml = processedHtml.replace(REGEX_PLACEHOLDER, (_match, index) => {
        return codeBlocks[parseInt(index, 10)]
      })

      if (currentHtml !== finalHtml) {
        setSafeHTML(p, finalHtml)
      }
    }

    p.dataset.mdFixerHash = String(p.innerHTML.length)
  }
}
