/**
 * 
 *
 *  MarkdownJSONTXT 
 *  HTML  Markdown 
 */

import { t } from "~utils/i18n"
import { showToast } from "~utils/toast"

//  String.fromCodePoint  emoji
//  Unicode  UTF-16 
const EMOJI_EXPORT = String.fromCodePoint(0x1f4e4) // 📤
const EMOJI_USER = String.fromCodePoint(0x1f64b) // 🙋
const EMOJI_ASSISTANT = String.fromCodePoint(0x1f916) // 🤖

export interface ExportMessage {
  role: "user" | "assistant" | string
  content: string
}

export interface ExportMetadata {
  title: string
  id?: string
  url: string
  exportTime: string
  source: string
  customUserName?: string
  customModelName?: string
}

export type ExportFormat = "markdown" | "json" | "txt" | "clipboard"

// ==================== HTML  Markdown ====================

/**
 *  HTML  Markdown
 * 
 */
export function htmlToMarkdown(el: Element): string {
  if (!el) return ""

  const processNode = (node: Node): string => {
    try {
      if (!node) return ""

      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent || ""
      }

      if (node.nodeType !== Node.ELEMENT_NODE) {
        return ""
      }

      const element = node as HTMLElement

      // 
      if (element.classList?.contains("math-block")) {
        const latex = element.getAttribute("data-math")
        if (latex) return `\n$$${latex}$$\n`
      }

      if (element.classList?.contains("math-inline")) {
        const latex = element.getAttribute("data-math")
        if (latex) return `$${latex}$`
      }

      const tag = element.tagName?.toLowerCase() || ""
      if (!tag) return ""

      // 
      if (tag === "img") {
        const alt = (element as HTMLImageElement).alt || element.getAttribute("alt") || ""
        const src = (element as HTMLImageElement).src || element.getAttribute("src") || ""
        return `![${alt}](${src})`
      }

      // 
      if (tag === "code-block") {
        const decoration = element.querySelector(".code-block-decoration")
        const lang = decoration?.querySelector("span")?.textContent?.trim().toLowerCase() || ""
        const codeEl = element.querySelector("pre code")
        const text = codeEl?.textContent || element.querySelector("pre")?.textContent || ""
        return `\n\`\`\`${lang}\n${text}\n\`\`\`\n`
      }

      // pre 
      if (tag === "pre") {
        const code = element.querySelector("code")
        const lang = code?.className.match(/language-(\w+)/)?.[1] || ""
        const text = code?.textContent || element.textContent
        return `\n\`\`\`${lang}\n${text}\n\`\`\`\n`
      }

      // 
      if (tag === "code") {
        if (element.parentElement?.tagName.toLowerCase() === "pre") return ""
        return `\`${element.textContent}\``
      }

      // 
      if (tag === "table") {
        const rows: string[] = []
        const thead = element.querySelector("thead")
        const tbody = element.querySelector("tbody")

        const getCellContent = (cell: Element): string => {
          return cell.textContent?.trim() || ""
        }

        if (thead) {
          const headerRow = thead.querySelector("tr")
          if (headerRow) {
            const headers = Array.from(headerRow.querySelectorAll("td, th")).map(getCellContent)
            if (headers.some((h) => h)) {
              rows.push("| " + headers.join(" | ") + " |")
              rows.push("| " + headers.map(() => "---").join(" | ") + " |")
            }
          }
        }

        if (tbody) {
          const bodyRows = tbody.querySelectorAll("tr")
          bodyRows.forEach((tr) => {
            const cells = Array.from(tr.querySelectorAll("td, th")).map(getCellContent)
            if (cells.some((c) => c)) {
              rows.push("| " + cells.join(" | ") + " |")
            }
          })
        }

        if (!thead && !tbody) {
          const allRows = element.querySelectorAll("tr")
          let isFirst = true
          allRows.forEach((tr) => {
            const cells = Array.from(tr.querySelectorAll("td, th")).map(getCellContent)
            if (cells.some((c) => c)) {
              rows.push("| " + cells.join(" | ") + " |")
              if (isFirst) {
                rows.push("| " + cells.map(() => "---").join(" | ") + " |")
                isFirst = false
              }
            }
          })
        }

        return rows.length > 0 ? "\n" + rows.join("\n") + "\n" : ""
      }

      // 
      if (tag === "table-block" || tag === "ucs-markdown-table") {
        const innerTable = element.querySelector("table")
        if (innerTable) {
          return processNode(innerTable)
        }
      }

      // 
      const children = Array.from(element.childNodes).map(processNode).join("")

      switch (tag) {
        case "h1":
          return `\n# ${children}\n`
        case "h2":
          return `\n## ${children}\n`
        case "h3":
          return `\n### ${children}\n`
        case "h4":
          return `\n#### ${children}\n`
        case "h5":
          return `\n##### ${children}\n`
        case "h6":
          return `\n###### ${children}\n`
        case "strong":
        case "b":
          return `**${children}**`
        case "em":
        case "i":
          return `*${children}*`
        case "a":
          return `[${children}](${(element as HTMLAnchorElement).href || ""})`
        case "li":
          return `- ${children}\n`
        case "p":
          return `${children}\n\n`
        case "br":
          return "\n"
        case "ul":
        case "ol":
          return `\n${children}`
        default:
          //  Shadow DOM
          if ((element as HTMLElement).shadowRoot) {
            return Array.from((element as HTMLElement).shadowRoot?.childNodes || [])
              .map(processNode)
              .join("")
          }
          return children
      }
    } catch (err) {
      console.error("Error processing node in htmlToMarkdown:", err)
      // 
      return node.textContent || ""
    }
  }

  return processNode(el).trim()
}

// ====================  ====================

/**
 *  UTF-8  BOM Windows 
 */
export function ensureUtf8Bom(content: string): string {
  if (!content) return "\ufeff"
  return content.startsWith("\ufeff") ? content : `\ufeff${content}`
}

/**
 *  Markdown
 */
export function formatToMarkdown(metadata: ExportMetadata, messages: ExportMessage[]): string {
  const lines: string[] = []

  // 
  lines.push(`# ${metadata.title}`)
  lines.push("")
  lines.push("---")
  lines.push(`## ${EMOJI_EXPORT} ${t("exportMetaTitle")}`)
  lines.push(`- **${t("exportMetaConvTitle")}**: ${metadata.title}`)
  lines.push(`- **${t("exportMetaTime")}**: ${metadata.exportTime}`)
  lines.push(`- **${t("exportMetaSource")}**: ${metadata.source}`)
  lines.push(`- **${t("exportMetaUrl")}**: ${metadata.url}`)
  lines.push("---")
  lines.push("")

  // 
  messages.forEach((msg) => {
    if (msg.role === "user") {
      const userLabel = metadata.customUserName || t("exportUserLabel")
      lines.push(`## ${EMOJI_USER} ${userLabel}`)
      lines.push("")
      lines.push(msg.content)
      lines.push("")
      lines.push("---")
      lines.push("")
    } else {
      const modelLabel = metadata.customModelName || metadata.source
      lines.push(`## ${EMOJI_ASSISTANT} ${modelLabel}`)
      lines.push("")
      lines.push(msg.content)
      lines.push("")
      lines.push("---")
      lines.push("")
    }
  })

  return lines.join("\n")
}

/**
 *  JSON
 */
export function formatToJSON(metadata: ExportMetadata, messages: ExportMessage[]): string {
  const data = {
    metadata: {
      title: metadata.title,
      id: metadata.id,
      url: metadata.url,
      exportTime: metadata.exportTime,
      source: metadata.source,
    },
    messages: messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    })),
  }
  return JSON.stringify(data, null, 2)
}

/**
 *  TXT
 */
export function formatToTXT(metadata: ExportMetadata, messages: ExportMessage[]): string {
  const lines: string[] = []

  lines.push(`${t("exportMetaConvTitle")}: ${metadata.title}`)
  lines.push(`${t("exportMetaTime")}: ${metadata.exportTime}`)
  lines.push(`${t("exportMetaSource")}: ${metadata.source}`)
  lines.push(`${t("exportMetaUrl")}: ${metadata.url}`)
  lines.push("")
  lines.push("=".repeat(50))
  lines.push("")

  messages.forEach((msg) => {
    if (msg.role === "user") {
      const userLabel = metadata.customUserName || t("exportUserLabel")
      lines.push(`[${userLabel}]`)
    } else {
      const modelLabel = metadata.customModelName || metadata.source
      lines.push(`[${modelLabel}]`)
    }
    lines.push(msg.content)
    lines.push("")
    lines.push("-".repeat(50))
    lines.push("")
  })

  return lines.join("\n")
}

// ====================  ====================

/**
 * 
 *  Blob + createObjectURL 
 */
export async function downloadFile(
  content: string,
  filename: string,
  mimeType: string = "text/plain;charset=utf-8",
): Promise<boolean> {
  try {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    return true
  } catch (err: unknown) {
    console.error("[Exporter] Download failed:", err)
    const errorMessage = err instanceof Error ? err.message : String(err)
    showToast(": " + errorMessage)
    return false
  }
}

/**
 * 
 */
export async function copyToClipboard(content: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(content)
    return true
  } catch (e) {
    console.error("[Exporter] Failed to copy:", e)
    return false
  }
}

/**
 * 
 */
export function createExportMetadata(
  title: string,
  source: string,
  id?: string,
  options?: { customUserName?: string; customModelName?: string },
): ExportMetadata {
  return {
    title: title || t("exportUntitled"),
    id,
    url: window.location.href,
    exportTime: new Date().toLocaleString(),
    source,
    customUserName: options?.customUserName,
    customModelName: options?.customModelName,
  }
}
