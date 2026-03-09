/**
 * History Loader - 
 *
 *  Gemini 
 * """"
 */

import type { SiteAdapter } from "~adapters/base"
import {
  getScrollInfo,
  isFlutterProxy,
  smartScrollTo,
  smartScrollToTop,
} from "~utils/scroll-helper"

// ====================  ====================

export interface LoadHistoryOptions {
  /**  */
  adapter: SiteAdapter | null
  /**  */
  targetHeight?: number
  /**  */
  loadAll?: boolean
  /**  */
  onProgress?: (msg: string) => void
  /**  */
  signal?: AbortSignal
  /**  */
  allowShortCircuit?: boolean
}

export interface LoadHistoryResult {
  /**  */
  success: boolean
  /**  */
  finalHeight: number
  /**  */
  heightAdded: number
  /**  */
  previousScrollTop: number
  /**  Flutter  */
  isFlutterMode: boolean
  /**  */
  silent: boolean
}

// ====================  ====================

const CONFIG = {
  /**  demo.js  */
  WAIT_MS: 1200,
  /**  */
  MAX_NO_CHANGE_ROUNDS: 2,
  /**  12  */
  MAX_INITIAL_WAIT_ROUNDS: 10,
  /**  */
  MAX_TOTAL_ROUNDS: 50,
}

// ====================  ====================

/**
 * 
 *
 * @param options 
 * @returns 
 */
export async function loadHistoryUntil(options: LoadHistoryOptions): Promise<LoadHistoryResult> {
  const {
    adapter,
    targetHeight,
    loadAll: _loadAll = false,
    onProgress,
    signal,
    allowShortCircuit = false,
  } = options

  // 
  let { previousScrollTop, container } = await smartScrollToTop(adapter)

  //  Flutter 
  const isFlutterMode = isFlutterProxy(container)

  // Flutter  Main World 
  if (isFlutterMode) {
    const info = await getScrollInfo(adapter)
    return {
      success: true,
      finalHeight: info.scrollHeight,
      heightAdded: 0,
      previousScrollTop,
      isFlutterMode: true,
      silent: true,
    }
  }

  // 
  let initialHeight = container.scrollHeight
  let lastHeight = initialHeight
  let noChangeCount = 0
  let loopCount = 0

  // 
  while (true) {
    // 
    if (signal?.aborted) {
      return {
        success: false,
        finalHeight: container.scrollHeight,
        heightAdded: container.scrollHeight - initialHeight,
        previousScrollTop,
        isFlutterMode: false,
        silent: false,
      }
    }

    loopCount++

    // 
    if (loopCount >= CONFIG.MAX_TOTAL_ROUNDS) {
      return {
        success: true,
        finalHeight: container.scrollHeight,
        heightAdded: container.scrollHeight - initialHeight,
        previousScrollTop,
        isFlutterMode: false,
        silent: false,
      }
    }

    //  WheelEvent 
    container.scrollTop = 0
    container.dispatchEvent(new WheelEvent("wheel", { deltaY: -100, bubbles: true }))

    // 
    await sleep(CONFIG.WAIT_MS)

    // 
    if (signal?.aborted) {
      return {
        success: false,
        finalHeight: container.scrollHeight,
        heightAdded: container.scrollHeight - initialHeight,
        previousScrollTop,
        isFlutterMode: false,
        silent: false,
      }
    }

    // 
    if (adapter && (container.tagName === "HTML" || container.tagName === "BODY")) {
      const newContainer = adapter.getScrollContainer()
      if (
        newContainer &&
        newContainer !== container &&
        newContainer.tagName !== "HTML" &&
        newContainer.tagName !== "BODY"
      ) {
        container = newContainer
        // 
        initialHeight = container.scrollHeight
        lastHeight = container.scrollHeight
        // 
        container.scrollTop = 0
      }
    }

    // 
    const currentHeight = container.scrollHeight

    // 
    if (targetHeight !== undefined && currentHeight >= targetHeight) {
      return {
        success: true,
        finalHeight: currentHeight,
        heightAdded: currentHeight - initialHeight,
        previousScrollTop,
        isFlutterMode: false,
        silent: false,
      }
    }

    if (currentHeight > lastHeight) {
      // 
      lastHeight = currentHeight
      noChangeCount = 0
      onProgress?.(`${Math.round(currentHeight / 1000)}k`)
    } else {
      noChangeCount++

      // 
      const isContentReady = container.scrollHeight > container.clientHeight + 100
      const isFirstRoundNoChange = loopCount === 1 && currentHeight === initialHeight

      //  = 
      if (isFirstRoundNoChange && allowShortCircuit) {
        return {
          success: true,
          finalHeight: currentHeight,
          heightAdded: 0,
          previousScrollTop,
          isFlutterMode: false,
          silent: true,
        }
      }

      // 
      if (isFirstRoundNoChange && isContentReady) {
        return {
          success: true,
          finalHeight: currentHeight,
          heightAdded: 0,
          previousScrollTop,
          isFlutterMode: false,
          silent: true,
        }
      }

      // 
      const maxNoChangeRounds = isContentReady
        ? CONFIG.MAX_NO_CHANGE_ROUNDS
        : CONFIG.MAX_INITIAL_WAIT_ROUNDS

      if (noChangeCount >= maxNoChangeRounds) {
        // 
        return {
          success: true,
          finalHeight: currentHeight,
          heightAdded: currentHeight - initialHeight,
          previousScrollTop,
          isFlutterMode: false,
          silent: false,
        }
      }
    }
  }
}

/**
 * 
 *
 * @deprecated 
 *  reading-history.ts  restoreProgress 
 *
 * @param options 
 * @param targetScrollTop 
 * @returns 
 */
export async function loadAndScrollTo(
  options: Omit<LoadHistoryOptions, "loadAll">,
  targetScrollTop: number,
): Promise<boolean> {
  const result = await loadHistoryUntil({
    ...options,
    targetHeight: targetScrollTop,
  })

  if (!result.success) {
    return false
  }

  // 
  await smartScrollTo(options.adapter, targetScrollTop)
  return true
}

// ====================  ====================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
