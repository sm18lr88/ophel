/**
 * 
 *  window 
 */

import type { ThemeManager } from "~core/theme-manager"

declare global {
  interface Window {
    /** Ophel  */
    ophelInitialized?: boolean
    /**  ThemeManager  */
    __ophelThemeManager?: ThemeManager
    /**  */
    __ophelScrollLockInitialized?: boolean
    /**  */
    __ophelScrollLockEnabled?: boolean
    /**  API  */
    __ophelOriginalApis?: {
      scrollIntoView: typeof Element.prototype.scrollIntoView
      scrollTo: typeof window.scrollTo
    }
    /** iframe  */
    __ophelIframeScrollInitialized?: boolean
  }
}

export {}
