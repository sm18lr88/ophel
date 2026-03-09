/**
 * Trusted Types 
 *  CSP  innerHTML 
 */

// 
declare const __PLATFORM__: "extension" | "userscript" | undefined
const isUserscript = typeof __PLATFORM__ !== "undefined" && __PLATFORM__ === "userscript"

const ALLOWED_TAGS = new Set([
  "a",
  "blockquote",
  "br",
  "button",
  "code",
  "div",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "input",
  "li",
  "mark",
  "ol",
  "p",
  "pre",
  "span",
  "strong",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "ul",
])

const DROP_TAGS = new Set(["iframe", "object", "embed", "script", "style", "link", "meta"])

// Trusted Types 
type SafeTrustedHtml = TrustedHTML | string

interface TrustedTypesPolicyLike {
  createHTML: (value: string) => SafeTrustedHtml
}

interface TrustedTypesFactoryLike {
  createPolicy: (
    name: string,
    policy: {
      createHTML: (value: string) => string
    },
  ) => TrustedTypesPolicyLike
}

let htmlPolicy: TrustedTypesPolicyLike | null = null

export function sanitizeHTML(html: string): string {
  if (typeof document === "undefined" || !html) return html

  const template = document.createElement("template")
  template.innerHTML = html
  sanitizeNode(template.content)
  return template.innerHTML
}

/**
 *  Trusted Types 
 */
function initTrustedTypesPolicy(): boolean {
  if (htmlPolicy) return true
  if (typeof window === "undefined") return false

  const tt = (window as Window & { trustedTypes?: TrustedTypesFactoryLike }).trustedTypes
  if (tt?.createPolicy) {
    try {
      // 
      //  Userscript 
      const suffix = Math.random().toString(36).slice(2, 8)
      const baseName = isUserscript ? "ophel-userscript-html" : "ophel-extension-html"
      const policyName = `${baseName}-${suffix}`

      htmlPolicy = tt.createPolicy(policyName, {
        createHTML: (s: string) => sanitizeHTML(s),
      })
      return true
    } catch (e) {
      console.warn("[TrustedTypes] Failed to create Trusted Types policy:", e)
      return false
    }
  }
  return false
}

/**
 *  HTML  (TrustedHTML)
 *  TrustedHTML 
 */
export function createSafeHTML(html: string): SafeTrustedHtml {
  const sanitized = sanitizeHTML(html)

  if (!htmlPolicy) {
    initTrustedTypesPolicy()
  }

  if (htmlPolicy) {
    try {
      return htmlPolicy.createHTML(sanitized)
    } catch (e) {
      console.warn("[TrustedTypes] Failed to create safe HTML:", e)
    }
  }
  return sanitized
}

/**
 *  innerHTML
 */
export function setSafeHTML(element: HTMLElement, html: string): boolean {
  try {
    const safeHtml = createSafeHTML(html)
    element.innerHTML = safeHtml as unknown as string
    return true
  } catch (e) {
    console.warn("[TrustedTypes] Failed to set innerHTML:", e)
    return false
  }
}

function sanitizeNode(node: Node) {
  if (node.nodeType === Node.COMMENT_NODE) {
    node.parentNode?.removeChild(node)
    return
  }

  if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) {
    return
  }

  const children = Array.from(node.childNodes)
  for (const child of children) {
    if (child.nodeType !== Node.ELEMENT_NODE) {
      sanitizeNode(child)
      continue
    }

    const element = child as HTMLElement
    const tag = element.tagName.toLowerCase()

    if (DROP_TAGS.has(tag)) {
      element.remove()
      continue
    }

    if (!ALLOWED_TAGS.has(tag)) {
      const fragment = document.createDocumentFragment()
      while (element.firstChild) {
        fragment.appendChild(element.firstChild)
      }
      element.replaceWith(fragment)
      sanitizeNode(fragment)
      continue
    }

    sanitizeAttributes(element, tag)
    sanitizeNode(element)
  }
}

function sanitizeAttributes(element: HTMLElement, tag: string) {
  const attributes = Array.from(element.attributes)

  for (const attr of attributes) {
    const name = attr.name.toLowerCase()
    const value = attr.value

    if (name.startsWith("on") || name === "style") {
      element.removeAttribute(attr.name)
      continue
    }

    if (name === "href") {
      if (tag !== "a") {
        element.removeAttribute(attr.name)
        continue
      }

      if (!isSafeHref(value)) {
        element.removeAttribute(attr.name)
        continue
      }

      element.setAttribute("rel", "noopener noreferrer nofollow")
      continue
    }

    if (name === "type") {
      if (tag !== "input" || value.toLowerCase() !== "checkbox") {
        element.removeAttribute(attr.name)
      }
      continue
    }

    if (name === "checked" || name === "disabled") {
      if (tag !== "input") {
        element.removeAttribute(attr.name)
      }
      continue
    }

    if (
      name === "class" ||
      name === "title" ||
      name === "role" ||
      name === "target" ||
      name.startsWith("aria-") ||
      name.startsWith("data-")
    ) {
      continue
    }

    element.removeAttribute(attr.name)
  }
}

function isSafeHref(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  if (trimmed.startsWith("#") || trimmed.startsWith("/")) return true

  try {
    const url = new URL(trimmed, window.location.href)
    return ["http:", "https:", "mailto:"].includes(url.protocol)
  } catch {
    return false
  }
}
