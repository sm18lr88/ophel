import type { SiteAdapter } from "~adapters/base"
import { DOMToolkit } from "~utils/dom-toolkit"
import { t } from "~utils/i18n"
import { createCopyIcon, showCopySuccess } from "~utils/icons"
import type { Settings } from "~utils/storage"
import { showToast } from "~utils/toast"

const TABLE_RESCAN_INTERVAL = 1000

/**
 */
export class CopyManager {
  private settings: Settings["content"]
  private siteAdapter: SiteAdapter | null = null
  private formulaCopyInitialized = false
  private tableCopyInitialized = false
  private formulaDblClickHandler: ((e: MouseEvent) => void) | null = null
  private stopTableWatch: (() => void) | null = null
  private rescanTimer: ReturnType<typeof setInterval> | null = null

  constructor(settings: Settings["content"], siteAdapter?: SiteAdapter) {
    this.settings = settings
    this.siteAdapter = siteAdapter || null
  }

  updateSettings(settings: Settings["content"]) {
    if (settings.formulaCopy !== this.settings.formulaCopy) {
      if (settings.formulaCopy) {
        this.settings = settings
        this.initFormulaCopy()
      } else {
        this.destroyFormulaCopy()
      }
    }

    if (settings.tableCopy !== this.settings.tableCopy) {
      if (settings.tableCopy) {
        this.settings = settings
        this.initTableCopy()
      } else {
        this.destroyTableCopy()
      }
    }

    this.settings = settings
  }

  // ==================== Formula Copy ====================

  /**
   */
  initFormulaCopy() {
    if (this.formulaCopyInitialized) return
    this.formulaCopyInitialized = true

    const styleId = "gh-formula-copy-style"
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style")
      style.id = styleId
      style.textContent = `
        .math-block, .math-inline, .katex {
            user-select: none !important;
            cursor: pointer !important;
        }
        .math-block:hover, .math-inline:hover, .katex:hover {
            outline: 2px solid #4285f4;
            outline-offset: 2px;
            border-radius: 4px;
        }
      `
      document.head.appendChild(style)
    }

    this.formulaDblClickHandler = (e: MouseEvent) => {
      const target = e.target as HTMLElement

      const geminiMathEl = target.closest(".math-block, .math-inline")
      if (geminiMathEl) {
        let latex = geminiMathEl.getAttribute("data-math")

        if (latex) {
          latex = latex.trim()

          this.copyLatex(latex, geminiMathEl.classList.contains("math-block"))
          e.preventDefault()
          e.stopPropagation()
          return
        }
      }

      const katexEl = target.closest(".katex")
      if (katexEl) {
        const annotation = katexEl.querySelector('annotation[encoding="application/x-tex"]')
        if (annotation?.textContent) {
          const isBlock = !!katexEl.closest(".katex-display")
          this.copyLatex(annotation.textContent, isBlock)
          e.preventDefault()
          e.stopPropagation()
          return
        }
      }
    }

    document.addEventListener("dblclick", this.formulaDblClickHandler, true)
  }

  /**
   */
  private copyLatex(latex: string, isBlock: boolean) {
    let copyText = latex
    if (this.settings.formulaDelimiter) {
      copyText = isBlock ? `$$${latex}$$` : `$${latex}$`
    }

    navigator.clipboard
      .writeText(copyText)
      .then(() => showToast(t("formulaCopied")))
      .catch((err) => {
        /* clipboard fallback */
        console.error("[FormulaCopy] Copy failed:", err)
        showToast(t("copyFailed"))
      })
  }

  /**
   */
  destroyFormulaCopy() {
    this.formulaCopyInitialized = false

    const style = document.getElementById("gh-formula-copy-style")
    if (style) style.remove()

    if (this.formulaDblClickHandler) {
      document.removeEventListener("dblclick", this.formulaDblClickHandler, true)
      this.formulaDblClickHandler = null
    }
  }

  // ==================== Table Copy ====================

  /**
   */
  initTableCopy() {
    if (this.tableCopyInitialized) return
    this.tableCopyInitialized = true

    const styleId = "gh-table-copy-style"
    const css = `
        .gh-table-copy-btn {
            position: absolute;
            top: 4px;
            right: 4px;
            width: 28px;
            height: 28px;
            border: none;
            border-radius: 6px;
            background: rgba(255,255,255,0.9);
            color: #374151;
            cursor: pointer;
            font-size: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0.7;
            transition: opacity 0.2s, background 0.2s;
            z-index: 10;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .gh-table-container:hover .gh-table-copy-btn,
        table-block:hover .gh-table-copy-btn,
        ucs-markdown-table:hover .gh-table-copy-btn {
            opacity: 1;
        }
        .gh-table-copy-btn:hover {
            background: #4285f4;
            color: white;
        }
    `
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style")
      style.id = styleId
      style.textContent = css
      document.head.appendChild(style)
    }

    const usesShadowDOM = this.siteAdapter?.usesShadowDOM() ?? false

    if (usesShadowDOM) {
      this.startRescanTimer()
    } else {
      this.stopTableWatch = DOMToolkit.each(
        "table",
        (table) => {
          this.injectTableButton(table as HTMLTableElement)
        },
        { shadow: true },
      )
    }
  }

  /**
   */
  private startRescanTimer() {
    this.rescanTables()

    this.rescanTimer = setInterval(() => {
      this.rescanTables()
    }, TABLE_RESCAN_INTERVAL)
  }

  /**
   */
  private rescanTables() {
    if (document.hidden) return

    const tables = DOMToolkit.query("table", { all: true, shadow: true }) as Element[]
    for (const table of tables) {
      this.injectTableButton(table as HTMLTableElement)
    }
  }

  private injectTableButton(table: HTMLTableElement) {
    if (table.dataset.ghTableCopy) return
    table.dataset.ghTableCopy = "true"

    const isInMarkdownPreview =
      table.closest(".gh-user-query-markdown") || table.closest(".gh-markdown-preview")

    try {
      let container: HTMLElement
      if (isInMarkdownPreview) {
        container = table
        table.style.position = "relative"
      } else {
        container = table.closest("table-block, ucs-markdown-table") as HTMLElement
        if (!container) {
          container = table.parentNode as HTMLElement
          if (!container) return
          container.classList.add("gh-table-container")
        }
        container.style.position = "relative"
      }

      const btn = document.createElement("button")
      btn.className = "gh-table-copy-btn"
      btn.appendChild(createCopyIcon({ size: 14, color: "#6b7280" }))
      btn.title = t("tableCopyLabel")

      const tagName = container.tagName?.toLowerCase()
      const isGeminiEnterprise =
        tagName === "ucs-markdown-table" ||
        container.closest("ucs-markdown-table") ||
        container.classList.contains("gh-table-container")
      const rightOffset = isGeminiEnterprise ? "80px" : "4px"

      Object.assign(btn.style, {
        position: "absolute",
        top: "4px",
        right: rightOffset,
        width: "28px",
        height: "28px",
        border: "none",
        borderRadius: "6px",
        background: "rgba(255,255,255,0.9)",
        color: "#374151",
        cursor: "pointer",
        fontSize: "14px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: "0.6",
        transition: "opacity 0.2s, background 0.2s, transform 0.2s",
        zIndex: "10",
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        pointerEvents: "auto",
      })

      btn.addEventListener("mouseenter", () => {
        btn.style.opacity = "1"
        btn.style.transform = "scale(1.1)"
      })
      btn.addEventListener("mouseleave", () => {
        btn.style.opacity = "0.6"
        btn.style.transform = "scale(1)"
      })

      btn.addEventListener("click", (e) => {
        e.preventDefault()
        e.stopPropagation()

        const markdown = this.tableToMarkdown(table)
        navigator.clipboard
          .writeText(markdown)
          .then(() => {
            showToast(t("tableCopied"))
            showCopySuccess(btn, { size: 14 })
          })
          .catch((err) => {
            /* clipboard fallback */
            console.error("[TableCopy] Copy failed:", err)
            showToast(t("copyFailed"))
          })
      })

      container.appendChild(btn)
    } catch (err) {
      console.error("[TableCopy] Error injecting button:", err)
    }
  }

  /**
   */
  tableToMarkdown(table: HTMLTableElement): string {
    const rows = table.querySelectorAll("tr")
    if (rows.length === 0) return ""

    const lines: string[] = []
    let headerProcessed = false

    const getCellContent = (cell: HTMLTableCellElement) => {
      if (this.settings.formulaCopy) {
        const clone = cell.cloneNode(true) as HTMLElement
        const mathEls = clone.querySelectorAll(".math-block, .math-inline")
        mathEls.forEach((mathEl) => {
          const el = mathEl as HTMLElement
          const latex = el.getAttribute("data-math")
          if (latex) {
            const isBlock = el.classList.contains("math-block")
            let replacement
            if (this.settings.formulaDelimiter) {
              replacement = isBlock ? `$$${latex}$$` : `$${latex}$`
            } else {
              replacement = latex
            }
            el.replaceWith(document.createTextNode(replacement))
          }
        })
        return clone.innerText?.trim().replace(/\|/g, "\\|").replace(/\n/g, " ") || ""
      }
      return cell.innerText?.trim().replace(/\|/g, "\\|").replace(/\n/g, " ") || ""
    }

    rows.forEach((row, rowIndex) => {
      const cells = row.querySelectorAll("th, td")
      const cellTexts = Array.from(cells).map((cell) =>
        getCellContent(cell as HTMLTableCellElement),
      )
      lines.push("| " + cellTexts.join(" | ") + " |")

      if (!headerProcessed && (row.querySelector("th") || rowIndex === 0)) {
        const alignments = Array.from(cells).map((cell) => {
          if (cell.classList.contains("align-center")) return ":---:"
          if (cell.classList.contains("align-right")) return "---:"
          return "---"
        })
        lines.push("| " + alignments.join(" | ") + " |")
        headerProcessed = true
      }
    })

    return lines.join("\n")
  }

  /**
   */
  destroyTableCopy() {
    this.tableCopyInitialized = false

    if (this.stopTableWatch) {
      this.stopTableWatch()
      this.stopTableWatch = null
    }

    if (this.rescanTimer) {
      clearInterval(this.rescanTimer)
      this.rescanTimer = null
    }

    const style = document.getElementById("gh-table-copy-style")
    if (style)
      style.remove()

    ;(
      DOMToolkit.query(".gh-table-copy-btn", {
        all: true,
        shadow: true,
      }) as Element[]
    )?.forEach((btn) => btn.remove())
    ;(
      DOMToolkit.query("[data-gh-table-copy]", {
        all: true,
        shadow: true,
      }) as Element[]
    )?.forEach((el) => {
      if (el instanceof HTMLElement) {
        el.removeAttribute("data-gh-table-copy")
      }
    })
    ;(
      DOMToolkit.query(".gh-table-container", {
        all: true,
        shadow: true,
      }) as Element[]
    )?.forEach((el) => {
      el.classList.remove("gh-table-container")
    })
  }

  /**
   */
  stop() {
    this.destroyFormulaCopy()
    this.destroyTableCopy()
  }
}
