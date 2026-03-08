const WATERMARK_ALLOWED_HOST_PATTERNS = [/^([a-z0-9-]+\.)*googleusercontent\.com$/i]

const CONTROL_CHAR_REGEX = /[\u0000-\u001f\u007f]/g
const CONTROL_CHAR_TEST_REGEX = /[\u0000-\u001f\u007f]/
const IPV4_REGEX = /^\d{1,3}(?:\.\d{1,3}){3}$/

export const WEBDAV_ALLOWED_METHODS = ["DELETE", "GET", "MKCOL", "PROPFIND", "PUT"] as const

export type ApprovedWebDavMethod = (typeof WEBDAV_ALLOWED_METHODS)[number]

const LLM_PROVIDER_HOSTS = new Set([
  "gemini.google.com",
  "business.gemini.google",
  "aistudio.google.com",
  "chatgpt.com",
  "chat.openai.com",
  "grok.com",
  "claude.ai",
])

const LLM_PROVIDER_HOST_SUFFIXES = [".googleusercontent.com", ".claude.ai"]

function isLlmProviderHost(hostname: string): boolean {
  const h = hostname.toLowerCase()
  if (LLM_PROVIDER_HOSTS.has(h)) return true
  return LLM_PROVIDER_HOST_SUFFIXES.some((suffix) => h.endsWith(suffix))
}

export function validateLlmProviderUrl(input: string, baseUrl?: string): URL {
  const url = validatePublicHttpsUrl(input, baseUrl)
  if (!isLlmProviderHost(url.hostname)) {
    throw new Error("Blocked: destination is not an approved LLM provider")
  }
  return url
}

export function sanitizeErrorMessage(error: unknown, fallback = "Request failed"): string {
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : fallback

  return redactSecrets(raw).slice(0, 300) || fallback
}

export function redactSecrets(value: string): string {
  return value
    .replace(/\b(Basic|Bearer)\s+[A-Za-z0-9._~+/=-]+/gi, "$1 [redacted]")
    .replace(/(sessionKey=)[^;,\s]+/gi, "$1[redacted]")
    .replace(/([?&](?:token|key|password|auth)=)[^&]+/gi, "$1[redacted]")
}

export function validateWatermarkFetchUrl(input: string): URL {
  const url = validatePublicHttpsUrl(input)

  if (!WATERMARK_ALLOWED_HOST_PATTERNS.some((pattern) => pattern.test(url.hostname))) {
    throw new Error("Blocked outbound request to unapproved watermark host")
  }

  return url
}

export function validatePublicHttpsUrl(input: string, baseUrl?: string): URL {
  const url = new URL(input, baseUrl)

  if (url.protocol !== "https:") {
    throw new Error("Only HTTPS outbound requests are allowed")
  }

  if (url.username || url.password) {
    throw new Error("Embedded URL credentials are not allowed")
  }

  if (isPrivateHostname(url.hostname)) {
    throw new Error("Private or local network targets are blocked")
  }

  return url
}

export function validatePermissionOriginPattern(originPattern: string): string {
  if (!originPattern.endsWith("/*")) {
    throw new Error("Invalid permission origin pattern")
  }

  const base = originPattern.slice(0, -1)
  const url = validatePublicHttpsUrl(base)
  if (url.pathname !== "/") {
    throw new Error("Permission origins must not include a path")
  }

  return `${url.origin}/*`
}

export function validateOpenTabUrl(input: string): string {
  const trimmed = input.trim()
  if (trimmed === "chrome://extensions/shortcuts") return trimmed
  if (trimmed === "edge://extensions/shortcuts") return trimmed
  if (trimmed === "about:addons") return trimmed
  return validateLlmProviderUrl(trimmed).toString()
}

export function getWebDavPermissionOrigin(url: string): string {
  return `${validatePublicHttpsUrl(url).origin}/*`
}

export function validateWebDavMethod(method: string): ApprovedWebDavMethod {
  const normalized = method.trim().toUpperCase() as ApprovedWebDavMethod
  if (!WEBDAV_ALLOWED_METHODS.includes(normalized)) {
    throw new Error(`Blocked WebDAV method: ${method}`)
  }
  return normalized
}

export function sanitizeWebDavHeaders(headers?: Record<string, string>): Record<string, string> {
  const allowedHeaders = new Set(["content-type", "depth"])
  const sanitized: Record<string, string> = {}

  if (!headers) return sanitized

  for (const [rawName, rawValue] of Object.entries(headers)) {
    const name = rawName.trim().toLowerCase()
    if (!allowedHeaders.has(name)) continue

    const value = sanitizeHeaderValue(rawValue)
    if (!value) continue

    if (name === "depth" && !["0", "1", "infinity"].includes(value.toLowerCase())) {
      continue
    }

    sanitized[name === "content-type" ? "Content-Type" : "Depth"] = value
  }

  return sanitized
}

export function sanitizeWebDavPath(input: string): string {
  const cleaned = input.replace(CONTROL_CHAR_REGEX, "").replace(/\\/g, "/").trim()
  if (!cleaned) return ""

  const segments = cleaned
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)

  for (const segment of segments) {
    if (segment === "." || segment === "..") {
      throw new Error("Relative WebDAV paths are not allowed")
    }

    if (CONTROL_CHAR_TEST_REGEX.test(segment)) {
      throw new Error("Invalid control characters in WebDAV path")
    }
  }

  return segments.join("/")
}

export function buildWebDavUrl(baseUrl: string, path: string): string {
  const base = validatePublicHttpsUrl(baseUrl)
  const cleanBase = base.toString().endsWith("/") ? base.toString() : `${base.toString()}/`
  const cleanPath = sanitizeWebDavPath(path)
  return new URL(cleanPath, cleanBase).toString()
}

function sanitizeHeaderValue(value: string): string {
  return String(value || "")
    .replace(/[\r\n]/g, "")
    .trim()
}

function isPrivateHostname(hostname: string): boolean {
  const normalized = hostname
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
  if (!normalized) return true

  if (
    normalized === "localhost" ||
    normalized === "0.0.0.0" ||
    normalized === "::1" ||
    normalized === "0:0:0:0:0:0:0:1" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".internal")
  ) {
    return true
  }

  if (IPV4_REGEX.test(normalized)) {
    const octets = normalized.split(".").map((value) => Number.parseInt(value, 10))
    if (octets.some((value) => Number.isNaN(value) || value < 0 || value > 255)) {
      return true
    }

    const [a, b] = octets
    if (a === 10 || a === 127 || a === 0) return true
    if (a === 169 && b === 254) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 100 && b >= 64 && b <= 127) return true
    if (a === 198 && (b === 18 || b === 19)) return true
    return false
  }

  if (normalized.includes(":")) {
    return (
      normalized.startsWith("fe80:") ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("::ffff:127.") ||
      normalized.startsWith("::ffff:10.") ||
      normalized.startsWith("::ffff:192.168.") ||
      /^::ffff:172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)
    )
  }

  return false
}
