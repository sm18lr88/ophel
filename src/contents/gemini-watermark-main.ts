import type { PlasmoCSConfig } from "plasmo"

const OPHEL_WATERMARK_FETCH_TOGGLE = "OPHEL_WATERMARK_FETCH_TOGGLE"
const OPHEL_WATERMARK_PROCESS_REQUEST = "OPHEL_WATERMARK_PROCESS_REQUEST"
const OPHEL_WATERMARK_PROCESS_RESPONSE = "OPHEL_WATERMARK_PROCESS_RESPONSE"
const GEMINI_MAIN_IMAGE_URL_PATTERN = /^https:\/\/lh3\.googleusercontent\.com\//i

type GeminiWatermarkResponseMessage = {
  type: typeof OPHEL_WATERMARK_PROCESS_RESPONSE
  requestId?: string
  success?: boolean
  dataUrl?: string
  error?: string
}

type GeminiWatermarkToggleMessage = {
  type: typeof OPHEL_WATERMARK_FETCH_TOGGLE
  enabled?: boolean
}

type GeminiWatermarkMainMessage = GeminiWatermarkResponseMessage | GeminiWatermarkToggleMessage

type GeminiWatermarkMainWindow = Window & {
  __ophelGeminiWatermarkMainInitialized?: boolean
}

const mainWindow = window as GeminiWatermarkMainWindow

export const config: PlasmoCSConfig = {
  matches: ["https://gemini.google.com/*"],
  world: "MAIN",
  run_at: "document_start",
}

if (!mainWindow.__ophelGeminiWatermarkMainInitialized) {
  mainWindow.__ophelGeminiWatermarkMainInitialized = true
  document.documentElement.setAttribute("data-ophel-wm-main", "1")
  document.documentElement.setAttribute("data-ophel-wm-main-fetch-enabled", "0")

  let watermarkFetchEnabled = false
  let watermarkRequestCounter = 0

  const pendingWatermarkRequests = new Map<
    string,
    {
      resolve: (dataUrl: string) => void
      reject: (error?: unknown) => void
      timeoutId: number
    }
  >()

  const clearPendingWatermarkRequests = (reason: string) => {
    for (const [requestId, request] of pendingWatermarkRequests.entries()) {
      window.clearTimeout(request.timeoutId)
      request.reject(new Error(reason))
      pendingWatermarkRequests.delete(requestId)
    }
  }

  const getRequestUrl = (input: unknown): string => {
    if (typeof input === "string") return input
    if (input && typeof input === "object" && "url" in input) {
      const requestLike = input as { url?: unknown }
      if (typeof requestLike.url === "string") return requestLike.url
    }
    return ""
  }

  const replaceWithNormalSize = (src: string): string => {
    if (!src) return src
    const suffixIndex = src.search(/[?#]/)
    const endIndex = suffixIndex === -1 ? src.length : suffixIndex
    const lastSlashIndex = src.lastIndexOf("/", endIndex)
    const optionStartIndex = src.lastIndexOf("=", endIndex)

    if (optionStartIndex === -1 || optionStartIndex < lastSlashIndex) {
      return src
    }

    const rawOptions = src.slice(optionStartIndex + 1, endIndex)
    if (!rawOptions) return src

    const optionTokens = rawOptions.split("-").filter(Boolean)
    const keptTokens = optionTokens.filter((token) => {
      const normalized = token.toLowerCase()
      if (/^s\d+$/.test(normalized)) return false
      if (/^w\d+$/.test(normalized)) return false
      if (/^h\d+$/.test(normalized)) return false
      if (normalized === "rj") return false
      return true
    })

    const normalizedOptions = ["s0", ...keptTokens].join("-")
    return `${src.slice(0, optionStartIndex + 1)}${normalizedOptions}${src.slice(endIndex)}`
  }

  const requestProcessedDataUrl = async (payload: {
    url: string
    blob?: Blob
  }): Promise<string> => {
    const requestId = `ophel-wm-${Date.now()}-${watermarkRequestCounter++}`
    let arrayBuffer: ArrayBuffer | undefined
    let mimeType = ""

    if (payload.blob) {
      arrayBuffer = await payload.blob.arrayBuffer()
      mimeType = payload.blob.type || ""
    }

    return new Promise((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        pendingWatermarkRequests.delete(requestId)
        reject(new Error("Watermark process timeout"))
      }, 30000)

      pendingWatermarkRequests.set(requestId, {
        resolve,
        reject,
        timeoutId,
      })

      window.postMessage(
        {
          type: OPHEL_WATERMARK_PROCESS_REQUEST,
          requestId,
          url: payload.url,
          arrayBuffer,
          mimeType,
        },
        window.location.origin,
        arrayBuffer ? [arrayBuffer] : undefined,
      )
    })
  }

  const originalFetch = window.fetch.bind(window)
  window.fetch = async function (...args: Parameters<typeof fetch>) {
    if (!watermarkFetchEnabled) {
      return originalFetch(...args)
    }

    const requestUrl = getRequestUrl(args[0])
    if (!requestUrl || !GEMINI_MAIN_IMAGE_URL_PATTERN.test(requestUrl)) {
      return originalFetch(...args)
    }

    const normalizedUrl = replaceWithNormalSize(requestUrl)

    let requestInput: RequestInfo | URL = args[0]
    if (typeof requestInput === "string") {
      requestInput = normalizedUrl
    } else if (requestInput instanceof Request) {
      requestInput = new Request(normalizedUrl, requestInput)
    }

    let originalResponse: Response | null = null
    let originalBlob: Blob | null = null

    try {
      originalResponse = await originalFetch(requestInput, args[1])
      if (!originalResponse.ok) {
        return originalResponse
      }

      originalBlob = await originalResponse.blob()

      const processedDataUrl = await requestProcessedDataUrl({
        url: requestUrl,
        blob: originalBlob,
      })

      const processedResponse = await originalFetch(processedDataUrl)
      const processedBlob = await processedResponse.blob()

      return new Response(processedBlob, {
        status: originalResponse.status,
        statusText: originalResponse.statusText,
        headers: new Headers({
          "Content-Type": processedBlob.type || "image/png",
        }),
      })
    } catch {
      if (originalResponse && originalBlob) {
        return new Response(originalBlob, {
          status: originalResponse.status,
          statusText: originalResponse.statusText,
          headers: originalResponse.headers,
        })
      }

      return originalFetch(...args)
    }
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return
    if (event.origin !== window.location.origin) return

    const data = event.data as unknown
    if (!data || typeof data !== "object") return

    const message = data as GeminiWatermarkMainMessage

    if (message.type === OPHEL_WATERMARK_FETCH_TOGGLE) {
      watermarkFetchEnabled = !!message.enabled
      document.documentElement.setAttribute(
        "data-ophel-wm-main-fetch-enabled",
        watermarkFetchEnabled ? "1" : "0",
      )
      if (!watermarkFetchEnabled) {
        clearPendingWatermarkRequests("Watermark interceptor disabled")
      }
      return
    }

    if (message.type === OPHEL_WATERMARK_PROCESS_RESPONSE) {
      const requestId = message.requestId
      if (typeof requestId !== "string" || !pendingWatermarkRequests.has(requestId)) return

      const pending = pendingWatermarkRequests.get(requestId)
      if (!pending) return

      pendingWatermarkRequests.delete(requestId)
      window.clearTimeout(pending.timeoutId)

      if (message.success && typeof message.dataUrl === "string") {
        pending.resolve(message.dataUrl)
      } else {
        pending.reject(new Error(message.error || "Watermark process failed"))
      }
    }
  })
}
