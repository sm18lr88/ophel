/**
 *
 */

import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: [
    "https://gemini.google.com/*",
    "https://business.gemini.google/*",
    "https://aistudio.google.com/*",
    "https://chatgpt.com/*",
    "https://chat.openai.com/*",
    "https://grok.com/*",
    "https://claude.ai/*",
  ],
  world: "MAIN",
  run_at: "document_start",
}

type ScrollAction = "scrollToTop" | "scrollToBottom" | "scrollTo" | "getScrollInfo"

type ScrollLockToggleMessage = {
  type: "OPHEL_SCROLL_LOCK_TOGGLE"
  enabled: boolean
}

type ScrollRequestMessage = {
  type: "OPHEL_SCROLL_REQUEST"
  action: ScrollAction
  position?: number
}

type ScrollLockMessage = ScrollLockToggleMessage | ScrollRequestMessage

type ScrollIntoViewWithBypass = ScrollIntoViewOptions & { __bypassLock?: boolean }

type OriginalApis = {
  scrollIntoView: Element["scrollIntoView"]
  scrollTo: Window["scrollTo"]
  scrollTopDescriptor?: PropertyDescriptor
}

type ScrollLockWindow = Window & {
  __ophelScrollLockInitialized?: boolean
  __ophelOriginalApis?: OriginalApis
  __ophelScrollLockEnabled?: boolean
}

const scrollLockWindow = window as ScrollLockWindow

const callWindowScrollTo = (
  originalScrollTo: Window["scrollTo"],
  targetWindow: Window,
  x?: ScrollToOptions | number,
  y?: number,
) => {
  if (typeof x === "number") {
    return originalScrollTo.call(targetWindow, x, y ?? 0)
  }
  if (typeof x === "object") {
    return originalScrollTo.call(targetWindow, x)
  }
  return originalScrollTo.call(targetWindow)
}

const callElementScrollMethod = (
  method: (this: Element, optionsOrX?: ScrollToOptions | number, y?: number) => void,
  element: Element,
  optionsOrX?: ScrollToOptions | number,
  y?: number,
) => {
  if (typeof optionsOrX === "number") {
    return method.call(element, optionsOrX, y ?? 0)
  }
  if (typeof optionsOrX === "object") {
    return method.call(element, optionsOrX)
  }
  return method.call(element)
}

if (!scrollLockWindow.__ophelScrollLockInitialized) {
  scrollLockWindow.__ophelScrollLockInitialized = true

  const originalApis = {
    scrollIntoView: Element.prototype.scrollIntoView,
    scrollTo: window.scrollTo.bind(window),
    scrollTopDescriptor:
      Object.getOwnPropertyDescriptor(Element.prototype, "scrollTop") ||
      Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollTop"),
  }

  scrollLockWindow.__ophelOriginalApis = originalApis

  scrollLockWindow.__ophelScrollLockEnabled = false

  Element.prototype.scrollIntoView = function (options?: boolean | ScrollIntoViewOptions) {
    const shouldBypass =
      options &&
      typeof options === "object" &&
      Boolean((options as ScrollIntoViewWithBypass).__bypassLock)

    if (!scrollLockWindow.__ophelScrollLockEnabled) {
      return originalApis.scrollIntoView.call(this, options)
    }

    if (!shouldBypass) {
      return
    }

    return originalApis.scrollIntoView.call(this, options)
  }

  scrollLockWindow.scrollTo = function (x?: ScrollToOptions | number, y?: number) {
    if (!scrollLockWindow.__ophelScrollLockEnabled) {
      return callWindowScrollTo(originalApis.scrollTo, scrollLockWindow, x, y)
    }

    let targetY: number | undefined
    if (typeof x === "object" && x !== null) {
      targetY = x.top
    } else {
      targetY = y
    }

    if (typeof targetY === "number" && targetY > window.scrollY + 50) {
      return
    }

    return callWindowScrollTo(originalApis.scrollTo, scrollLockWindow, x, y)
  }

  if (originalApis.scrollTopDescriptor) {
    const descriptor = originalApis.scrollTopDescriptor
    Object.defineProperty(Element.prototype, "scrollTop", {
      get: function () {
        return descriptor.get ? descriptor.get.call(this) : 0
      },
      set: function (value: number) {
        if (!scrollLockWindow.__ophelScrollLockEnabled) {
          if (descriptor.set) {
            descriptor.set.call(this, value)
          }
          return
        }

        const currentScrollTop = descriptor.get ? descriptor.get.call(this) : 0

        if (value > currentScrollTop + 50) {
          return
        }

        if (descriptor.set) {
          descriptor.set.call(this, value)
        }
      },
      configurable: true,
    })
  }

  const originalElementScrollTo = Element.prototype.scrollTo
  Element.prototype.scrollTo = function (
    this: Element,
    optionsOrX?: ScrollToOptions | number,
    y?: number,
  ) {
    if (!scrollLockWindow.__ophelScrollLockEnabled) {
      return callElementScrollMethod(originalElementScrollTo, this, optionsOrX, y)
    }

    let targetY: number | undefined
    if (typeof optionsOrX === "object" && optionsOrX !== null) {
      targetY = optionsOrX.top
    } else if (typeof y === "number") {
      targetY = y
    }

    const currentScrollTop = this.scrollTop || 0

    if (typeof targetY === "number" && targetY > currentScrollTop + 50) {
      return
    }

    return callElementScrollMethod(originalElementScrollTo, this, optionsOrX, y)
  }

  const originalElementScroll = Element.prototype.scroll
  Element.prototype.scroll = function (
    this: Element,
    optionsOrX?: ScrollToOptions | number,
    y?: number,
  ) {
    if (!scrollLockWindow.__ophelScrollLockEnabled) {
      return callElementScrollMethod(originalElementScroll, this, optionsOrX, y)
    }

    let targetY: number | undefined
    if (typeof optionsOrX === "object" && optionsOrX !== null) {
      targetY = optionsOrX.top
    } else if (typeof y === "number") {
      targetY = y
    }

    const currentScrollTop = this.scrollTop || 0

    if (typeof targetY === "number" && targetY > currentScrollTop + 50) {
      return
    }

    return callElementScrollMethod(originalElementScroll, this, optionsOrX, y)
  }

  const originalElementScrollBy = Element.prototype.scrollBy
  Element.prototype.scrollBy = function (
    this: Element,
    optionsOrX?: ScrollToOptions | number,
    y?: number,
  ) {
    if (!scrollLockWindow.__ophelScrollLockEnabled) {
      return callElementScrollMethod(originalElementScrollBy, this, optionsOrX, y)
    }

    let deltaY: number | undefined
    if (typeof optionsOrX === "object" && optionsOrX !== null) {
      deltaY = optionsOrX.top
    } else if (typeof y === "number") {
      deltaY = y
    }

    if (typeof deltaY === "number" && deltaY > 50) {
      return
    }

    return callElementScrollMethod(originalElementScrollBy, this, optionsOrX, y)
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return
    if (event.origin !== window.location.origin) return

    const data = event.data as unknown
    if (!data || typeof data !== "object") {
      return
    }

    const message = data as ScrollLockMessage
    if (message.type !== "OPHEL_SCROLL_LOCK_TOGGLE" || typeof message.enabled !== "boolean") {
      return
    }

    scrollLockWindow.__ophelScrollLockEnabled = message.enabled
  })
}
