/**
 * 
 *
 *  Main World  iframe  Flutter 
 * Content Script (Isolated World)  iframe  contentDocument
 *  postMessage  Main World 
 *
 *  unsafeWindow  DOM
 */

import type { SiteAdapter } from "~adapters/base"

// 
declare const __PLATFORM__: "extension" | "userscript" | undefined
const isUserscript = typeof __PLATFORM__ !== "undefined" && __PLATFORM__ === "userscript"

interface ScrollResponse {
  success: boolean
  scrollTop?: number
  scrollHeight?: number
  reason?: string
}

type ScrollWindow = Window & {
  unsafeWindow?: Window
}

type ExtendedScrollToOptions = ScrollToOptions & {
  behavior?: ScrollBehavior | "instant"
  __bypassLock?: boolean
}

type FlutterProxyElement = HTMLElement & {
  __isFlutterProxy?: boolean
}

/**
 *  window 
 *  unsafeWindow
 *  window
 */
function getMainWindow(): Window {
  const scrollWindow = window as ScrollWindow
  if (isUserscript && scrollWindow.unsafeWindow) {
    return scrollWindow.unsafeWindow
  }
  return window
}

/**
 *  Flutter 
 *  unsafeWindow.document  DOM
 */
function getFlutterScrollContainerDirect(): HTMLElement | null {
  const mainWindow = getMainWindow()
  const iframes = mainWindow.document.querySelectorAll("iframe")

  for (const iframe of iframes) {
    try {
      const iframeDoc =
        (iframe as HTMLIFrameElement).contentDocument ||
        (iframe as HTMLIFrameElement).contentWindow?.document
      if (iframeDoc) {
        const scrollContainer = iframeDoc.querySelector(
          'flt-semantics[style*="overflow-y: scroll"]',
        ) as HTMLElement
        if (scrollContainer && scrollContainer.scrollHeight > scrollContainer.clientHeight) {
          return scrollContainer
        }
      }
    } catch {
      //  iframe 
    }
  }
  return null
}

/**
 *  Main World  iframe 
 *  Flutter 
 * @param action 
 * @param position  scrollTo 
 * @returns Promise 
 */
function sendScrollRequest(
  action: "scrollToTop" | "scrollToBottom" | "scrollTo" | "getScrollInfo",
  position?: number,
): Promise<ScrollResponse> {
  //  Flutter 
  if (isUserscript) {
    const container = getFlutterScrollContainerDirect()
    if (!container) {
      return Promise.resolve({ success: false, reason: "no_flutter_container" })
    }

    let result: ScrollResponse
    switch (action) {
      case "scrollToTop":
        container.scrollTop = 0
        result = { success: true, scrollTop: container.scrollTop }
        break
      case "scrollToBottom":
        container.scrollTop = container.scrollHeight
        result = { success: true, scrollTop: container.scrollTop }
        break
      case "scrollTo":
        if (typeof position === "number") {
          container.scrollTop = position
        }
        result = { success: true, scrollTop: container.scrollTop }
        break
      case "getScrollInfo":
        result = {
          success: true,
          scrollTop: container.scrollTop,
          scrollHeight: container.scrollHeight,
        }
        break
      default:
        result = { success: false }
    }
    return Promise.resolve(result)
  }

  //  postMessage  Main World 
  return new Promise((resolve) => {
    const handler = (event: MessageEvent) => {
      if (event.source !== window) return
      if (event.origin !== window.location.origin) return
      const data = event.data
      if (!data || typeof data !== "object" || data.type !== "OPHEL_SCROLL_RESPONSE") return
      window.removeEventListener("message", handler)
      resolve(data as ScrollResponse)
    }

    window.addEventListener("message", handler)

    //  Main World
    window.postMessage({ type: "OPHEL_SCROLL_REQUEST", action, position }, window.location.origin)

    // 100ms  Main World  Flutter 
    setTimeout(() => {
      window.removeEventListener("message", handler)
      resolve({ success: false, reason: "timeout" })
    }, 100)
  })
}

/**
 * 
 *  adapter  Main World 
 */
export function getScrollContainer(adapter: SiteAdapter | null): HTMLElement | null {
  if (!adapter) return document.documentElement

  //  adapter 
  const container = adapter.getScrollContainer()
  if (container) {
    return container
  }

  //  adapter  document.documentElement  fallback
  //  iframe  Main World 
  return document.documentElement
}

/**
 * 
 *  Main World  iframe 
 */
export async function smartScrollToTop(adapter: SiteAdapter | null): Promise<{
  container: HTMLElement
  previousScrollTop: number
  scrollHeight: number
}> {
  //  Main World  iframe 
  const infoResult = await sendScrollRequest("getScrollInfo")
  if (infoResult.success) {
    const previousScrollTop = infoResult.scrollTop || 0
    const scrollHeight = infoResult.scrollHeight || 0
    await sendScrollRequest("scrollToTop")
    return { container: createFlutterScrollProxy(), previousScrollTop, scrollHeight }
  }

  // Main World  Flutter 
  const container = adapter?.getScrollContainer()

  if (container && container.scrollHeight > container.clientHeight) {
    const previousScrollTop = container.scrollTop
    const scrollHeight = container.scrollHeight

    const options: ExtendedScrollToOptions = { top: 0, behavior: "instant", __bypassLock: true }
    container.scrollTo(options)

    return { container, previousScrollTop, scrollHeight }
  }

  //  document.documentElement
  const fallback = document.documentElement
  return {
    container: fallback,
    previousScrollTop: fallback.scrollTop,
    scrollHeight: fallback.scrollHeight,
  }
}

/**
 * 
 *  Main World  iframe 
 */
export async function smartScrollToBottom(adapter: SiteAdapter | null): Promise<{
  container: HTMLElement
  previousScrollTop: number
}> {
  //  Main World  iframe 
  const infoResult = await sendScrollRequest("getScrollInfo")
  if (infoResult.success) {
    const previousScrollTop = infoResult.scrollTop || 0
    await sendScrollRequest("scrollToBottom")
    return { container: createFlutterScrollProxy(), previousScrollTop }
  }

  // Main World  Flutter 
  const container = adapter?.getScrollContainer()

  if (container && container.scrollHeight > container.clientHeight) {
    const previousScrollTop = container.scrollTop

    const options: ExtendedScrollToOptions = {
      top: container.scrollHeight,
      behavior: "instant",
      __bypassLock: true,
    }
    container.scrollTo(options)

    return { container, previousScrollTop }
  }

  //  document.documentElement
  const fallback = document.documentElement
  return { container: fallback, previousScrollTop: fallback.scrollTop }
}

/**
 * 
 *  Main World 
 */
export async function smartScrollTo(
  adapter: SiteAdapter | null,
  position: number,
): Promise<{ success: boolean; currentScrollTop: number }> {
  //  Main World 
  const result = await sendScrollRequest("scrollTo", position)
  if (result.success) {
    return { success: true, currentScrollTop: result.scrollTop || 0 }
  }

  // Main World 
  const container = adapter?.getScrollContainer()

  if (container && container.scrollHeight > container.clientHeight) {
    const options: ExtendedScrollToOptions = {
      top: position,
      behavior: "instant",
      __bypassLock: true,
    }
    container.scrollTo(options)
    return { success: true, currentScrollTop: container.scrollTop }
  }

  // 
  const options: ExtendedScrollToOptions = {
    top: position,
    behavior: "instant",
    __bypassLock: true,
  }
  document.documentElement.scrollTo(options)
  return { success: true, currentScrollTop: document.documentElement.scrollTop }
}

/**
 * 
 *  Main World 
 */
export async function getScrollInfo(adapter: SiteAdapter | null): Promise<{
  scrollTop: number
  scrollHeight: number
  clientHeight: number
  isFlutterMode: boolean
}> {
  //  Main World  Flutter 
  const result = await sendScrollRequest("getScrollInfo")
  if (result.success) {
    return {
      scrollTop: result.scrollTop || 0,
      scrollHeight: result.scrollHeight || 0,
      clientHeight: 0, // Flutter 
      isFlutterMode: true,
    }
  }

  // Main World 
  const container = adapter?.getScrollContainer()

  if (container && container.scrollHeight > container.clientHeight) {
    return {
      scrollTop: container.scrollTop,
      scrollHeight: container.scrollHeight,
      clientHeight: container.clientHeight,
      isFlutterMode: false,
    }
  }

  // 
  return {
    scrollTop: document.documentElement.scrollTop,
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight,
    isFlutterMode: false,
  }
}

/**
 *  Flutter 
 *  HTMLElement  Main World 
 */
function createFlutterScrollProxy(): HTMLElement {
  // 
  //  smartScrollTo 
  const proxy = document.createElement("div")
  Object.defineProperty(proxy, "__isFlutterProxy", { value: true })
  return proxy
}

/**
 *  Flutter 
 */
export function isFlutterProxy(container: HTMLElement): boolean {
  return (container as FlutterProxyElement).__isFlutterProxy === true
}
