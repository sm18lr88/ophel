/**
 * 滚动锁定 - 主世界脚本
 *
 * 这个脚本运行在主世界（Main World），可以直接劫持页面的 API
 * 通过 Plasmo 的 world: "MAIN" 配置绕过 CSP 限制
 */

import type { PlasmoCSConfig } from "plasmo"

// 配置为主世界运行
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
  run_at: "document_start", // 尽早运行以劫持 API
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

// 防止重复初始化
if (!scrollLockWindow.__ophelScrollLockInitialized) {
  scrollLockWindow.__ophelScrollLockInitialized = true

  // 保存原始 API
  const originalApis = {
    scrollIntoView: Element.prototype.scrollIntoView,
    scrollTo: window.scrollTo.bind(window),
    scrollTopDescriptor:
      Object.getOwnPropertyDescriptor(Element.prototype, "scrollTop") ||
      Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollTop"),
  }

  // 保存原始 API 供恢复使用
  scrollLockWindow.__ophelOriginalApis = originalApis

  // 默认禁用，等待 Content Script 通过消息启用
  scrollLockWindow.__ophelScrollLockEnabled = false

  // 1. 劫持 Element.prototype.scrollIntoView
  Element.prototype.scrollIntoView = function (options?: boolean | ScrollIntoViewOptions) {
    // 检查是否包含绕过锁定的标志
    const shouldBypass =
      options &&
      typeof options === "object" &&
      Boolean((options as ScrollIntoViewWithBypass).__bypassLock)

    // 如果劫持未启用，直接调用原始 API
    if (!scrollLockWindow.__ophelScrollLockEnabled) {
      return originalApis.scrollIntoView.call(this, options)
    }

    if (!shouldBypass) {
      return
    }

    return originalApis.scrollIntoView.call(this, options)
  }

  // 2. 劫持 window.scrollTo
  scrollLockWindow.scrollTo = function (x?: ScrollToOptions | number, y?: number) {
    // 如果劫持未启用，直接调用原始 API
    if (!scrollLockWindow.__ophelScrollLockEnabled) {
      return callWindowScrollTo(originalApis.scrollTo, scrollLockWindow, x, y)
    }

    // 解析目标 Y 位置
    let targetY: number | undefined
    if (typeof x === "object" && x !== null) {
      targetY = x.top
    } else {
      targetY = y
    }

    // 只有当向下大幅滚动时才拦截（防止系统自动拉到底）
    if (typeof targetY === "number" && targetY > window.scrollY + 50) {
      return
    }

    return callWindowScrollTo(originalApis.scrollTo, scrollLockWindow, x, y)
  }

  // 3. 劫持 scrollTop setter
  if (originalApis.scrollTopDescriptor) {
    const descriptor = originalApis.scrollTopDescriptor
    Object.defineProperty(Element.prototype, "scrollTop", {
      get: function () {
        return descriptor.get ? descriptor.get.call(this) : 0
      },
      set: function (value: number) {
        // 如果劫持未启用，直接设置
        if (!scrollLockWindow.__ophelScrollLockEnabled) {
          if (descriptor.set) {
            descriptor.set.call(this, value)
          }
          return
        }

        const currentScrollTop = descriptor.get ? descriptor.get.call(this) : 0

        // 如果启用且是向下滚动超过 50px，阻止
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

  // 4. 劫持 Element.prototype.scrollTo（元素级滚动方法）
  const originalElementScrollTo = Element.prototype.scrollTo
  Element.prototype.scrollTo = function (
    this: Element,
    optionsOrX?: ScrollToOptions | number,
    y?: number,
  ) {
    // 如果劫持未启用，直接调用原始 API
    if (!scrollLockWindow.__ophelScrollLockEnabled) {
      return callElementScrollMethod(originalElementScrollTo, this, optionsOrX, y)
    }

    // 解析目标 Y 位置
    let targetY: number | undefined
    if (typeof optionsOrX === "object" && optionsOrX !== null) {
      targetY = optionsOrX.top
    } else if (typeof y === "number") {
      targetY = y
    }

    // 获取当前滚动位置
    const currentScrollTop = this.scrollTop || 0

    // 只有当向下大幅滚动时才拦截
    if (typeof targetY === "number" && targetY > currentScrollTop + 50) {
      return
    }

    return callElementScrollMethod(originalElementScrollTo, this, optionsOrX, y)
  }

  // 5. 劫持 Element.prototype.scroll（scrollTo 的别名）
  const originalElementScroll = Element.prototype.scroll
  Element.prototype.scroll = function (
    this: Element,
    optionsOrX?: ScrollToOptions | number,
    y?: number,
  ) {
    // 如果劫持未启用，直接调用原始 API
    if (!scrollLockWindow.__ophelScrollLockEnabled) {
      return callElementScrollMethod(originalElementScroll, this, optionsOrX, y)
    }

    // 解析目标 Y 位置
    let targetY: number | undefined
    if (typeof optionsOrX === "object" && optionsOrX !== null) {
      targetY = optionsOrX.top
    } else if (typeof y === "number") {
      targetY = y
    }

    // 获取当前滚动位置
    const currentScrollTop = this.scrollTop || 0

    // 只有当向下大幅滚动时才拦截
    if (typeof targetY === "number" && targetY > currentScrollTop + 50) {
      return
    }

    return callElementScrollMethod(originalElementScroll, this, optionsOrX, y)
  }

  // 6. 劫持 Element.prototype.scrollBy（相对滚动方法）
  const originalElementScrollBy = Element.prototype.scrollBy
  Element.prototype.scrollBy = function (
    this: Element,
    optionsOrX?: ScrollToOptions | number,
    y?: number,
  ) {
    // 如果劫持未启用，直接调用原始 API
    if (!scrollLockWindow.__ophelScrollLockEnabled) {
      return callElementScrollMethod(originalElementScrollBy, this, optionsOrX, y)
    }

    // 解析 Y 偏移量
    let deltaY: number | undefined
    if (typeof optionsOrX === "object" && optionsOrX !== null) {
      deltaY = optionsOrX.top
    } else if (typeof y === "number") {
      deltaY = y
    }

    // 只有当向下大幅滚动时才拦截（scrollBy 是相对偏移）
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
