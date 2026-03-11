/**
 * Ophel -
 *
 *  local
 */

import { Storage } from "@plasmohq/storage"

import { DEFAULT_SHORTCUTS_SETTINGS, type ShortcutsSettings } from "~constants/shortcuts"

//
declare const __PLATFORM__: "extension" | "userscript" | undefined

//
const isUserscript = typeof __PLATFORM__ !== "undefined" && __PLATFORM__ === "userscript"

//  -  Zustand
export const localStorage = new Storage({ area: "local" })

// ====================  ====================

export const STORAGE_KEYS = {
  // Zustand  keys ( local)
  SETTINGS: "settings",
  FOLDERS: "folders",
  TAGS: "tags",
  PROMPTS: "prompts",
  CONVERSATIONS: "conversations",
  READING_HISTORY: "readingHistory",
  CLAUDE_SESSION_KEYS: "claudeSessionKeys", // Claude SessionKey
} as const

// /
export const CLEAR_ALL_FLAG_KEY = "ophel:clearAllFlag"
export const CLEAR_ALL_FLAG_TTL_MS = 5 * 1000

// ====================  ====================

//  ID
export type SiteId = "gemini" | "gemini-enterprise" | "aistudio" | "_default"

//
export type ThemeMode = "light" | "dark" | "system"

//
export interface SiteThemeConfig {
  mode: ThemeMode
  lightStyleId: string //  ID
  darkStyleId: string //  ID
}

//
export interface CustomStyle {
  id: string //  IDcrypto.randomUUID
  name: string //
  css: string // CSS
  mode: "light" | "dark" //
}

//
export interface PageWidthConfig {
  enabled: boolean
  value: string
  unit: string
}

//
export interface ModelLockConfig {
  enabled: boolean
  keyword: string
}

//
export interface ZenModeConfig {
  enabled: boolean
}

//
export interface ExportSettings {
  customUserName?: string //
  customModelName?: string //  AI
  exportFilenameTimestamp?: boolean //
  includeThoughts?: boolean //
}

// AI Studio
export interface AIStudioSettings {
  //
  collapseNavbar?: boolean //
  collapseRunSettings?: boolean //
  collapseTools?: boolean //
  collapseAdvanced?: boolean //

  //
  enableSearch?: boolean //  Google
  markdownFix?: boolean //

  //
  defaultModel?: string //  ID "models/gemini-3-flash-preview"

  //  DOM
  cachedModels?: Array<{ id: string; name: string }>

  //
  removeWatermark?: boolean
}

// ChatGPT
export interface ChatGPTSettings {
  markdownFix?: boolean //
}

export interface Settings {
  language: string
  hasAgreedToTerms: boolean //

  //
  panel: {
    defaultOpen: boolean
    autoHide: boolean
    edgeSnap: boolean
    preventAutoScroll: boolean
    defaultPosition: "left" | "right" //
    defaultEdgeDistance: number //  (0-400,  25)
    edgeSnapThreshold: number //  (10-100,  18)
    height: number //  (50-100,  85,  vh)
    width: number //  (200-600,  320,  px)
  }

  // Gemini Enterprise
  geminiEnterprise?: {
    policyRetry: {
      enabled: boolean
      maxRetries: number
    }
  }

  //
  content: {
    markdownFix: boolean
    watermarkRemoval: boolean
    formulaCopy: boolean
    formulaDelimiter: boolean
    tableCopy: boolean
    exportImagesToBase64: boolean
    userQueryMarkdown: boolean //  Markdown
  }

  //
  export?: ExportSettings

  //  +
  theme: {
    sites: Partial<Record<SiteId, SiteThemeConfig>>
    customStyles: CustomStyle[] //
  }

  //
  layout: {
    pageWidth: Record<SiteId, PageWidthConfig>
    userQueryWidth: Record<SiteId, PageWidthConfig>
    zenMode?: Record<SiteId, ZenModeConfig>
  }

  //
  modelLock: Record<string, ModelLockConfig>

  //
  globalSearch: {
    promptEnterBehavior: "smart" | "locate"
    enableFuzzySearch: boolean
    doubleShift: boolean
  }

  //
  features: {
    order: string[]
    prompts: {
      enabled: boolean
      doubleClickToSend: boolean
      submitShortcut: "enter" | "ctrlEnter"
      promptQueue: boolean
    }
    conversations: {
      enabled: boolean
      syncUnpin: boolean
      syncDelete: boolean
      folderRainbow: boolean
    }
    outline: {
      enabled: boolean
      maxLevel: number
      autoUpdate: boolean
      updateInterval: number
      showUserQueries: boolean
      followMode: "current" | "latest" | "manual"
      expandLevel: number
      inlineBookmarkMode: "always" | "hover" | "hidden" //
      panelBookmarkMode: "always" | "hover" | "hidden" //
      showWordCount: boolean
    }
  }

  //
  tab: {
    openInNewTab: boolean
    autoRename: boolean
    renameInterval: number
    showStatus: boolean
    titleFormat: string
    showNotification: boolean
    notificationSound: boolean
    notificationVolume: number
    notifyWhenFocused: boolean
    autoFocus: boolean
    privacyMode: boolean
    privacyTitle: string
    customIcon: string
  }

  //
  readingHistory: {
    persistence: boolean
    autoRestore: boolean
    cleanupDays: number
  }

  //
  collapsedButtons: Array<{ id: string; enabled: boolean }>
  quickButtonsOpacity: number

  //  ( ID undefined )
  toolsMenu?: string[]

  floatingToolbar: {
    open: boolean
  }

  // Claude
  claude?: {
    currentKeyId: string // SessionKey ID,cookie
  }

  //  WebDAV
  webdav?: {
    enabled: boolean
    url: string
    username: string
    password: string
    syncMode: "manual" | "auto"
    syncInterval: number
    remoteDir: string
    dataSources?: Array<"settings" | "conversations" | "prompts" | "claudeSessionKeys"> //
    lastSyncTime?: number //
    lastSyncStatus?: "success" | "failed" | "syncing"
  }

  //
  shortcuts: ShortcutsSettings

  // AI Studio
  aistudio?: AIStudioSettings

  // ChatGPT
  chatgpt?: ChatGPTSettings
}

//
const DEFAULT_SITE_THEME: SiteThemeConfig = {
  mode: "light",
  lightStyleId: "google-gradient",
  darkStyleId: "classic-dark",
}

//
const DEFAULT_PAGE_WIDTH: PageWidthConfig = {
  enabled: false,
  value: "1280",
  unit: "px",
}

//  px
const DEFAULT_USER_QUERY_WIDTH: PageWidthConfig = {
  enabled: false,
  value: "600",
  unit: "px",
}

//
const DEFAULT_ZEN_MODE: ZenModeConfig = {
  enabled: false,
}

export const DEFAULT_SETTINGS: Settings = {
  language: "en",
  hasAgreedToTerms: false,

  panel: {
    defaultOpen: false,
    autoHide: false,
    edgeSnap: true,
    preventAutoScroll: false,
    defaultPosition: "right",
    defaultEdgeDistance: 25,
    edgeSnapThreshold: 18,
    height: 85,
    width: 320,
  },

  geminiEnterprise: {
    policyRetry: {
      enabled: false,
      maxRetries: 3,
    },
  },

  content: {
    markdownFix: true,
    // GM_xmlhttpRequest  @grant
    watermarkRemoval: isUserscript,
    formulaCopy: true,
    formulaDelimiter: true,
    tableCopy: true,
    exportImagesToBase64: false,
    userQueryMarkdown: false, //
  },

  export: {
    customUserName: "",
    customModelName: "",
    exportFilenameTimestamp: false,
    includeThoughts: true,
  },

  theme: {
    sites: {
      gemini: { ...DEFAULT_SITE_THEME },
      "gemini-enterprise": { ...DEFAULT_SITE_THEME },
      _default: { ...DEFAULT_SITE_THEME },
    },
    customStyles: [], //
  },

  layout: {
    pageWidth: {
      gemini: { ...DEFAULT_PAGE_WIDTH },
      "gemini-enterprise": { ...DEFAULT_PAGE_WIDTH },
      aistudio: { ...DEFAULT_PAGE_WIDTH },
      _default: { ...DEFAULT_PAGE_WIDTH },
    },
    userQueryWidth: {
      gemini: { ...DEFAULT_USER_QUERY_WIDTH },
      "gemini-enterprise": { ...DEFAULT_USER_QUERY_WIDTH },
      aistudio: { ...DEFAULT_USER_QUERY_WIDTH },
      _default: { ...DEFAULT_USER_QUERY_WIDTH },
    },
    zenMode: {
      gemini: { ...DEFAULT_ZEN_MODE },
      "gemini-enterprise": { ...DEFAULT_ZEN_MODE },
      aistudio: { ...DEFAULT_ZEN_MODE },
      _default: { ...DEFAULT_ZEN_MODE },
    },
  },

  modelLock: {
    gemini: { enabled: false, keyword: "" },
    "gemini-enterprise": { enabled: false, keyword: "" },
  },

  globalSearch: {
    promptEnterBehavior: "smart",
    enableFuzzySearch: false,
    doubleShift: false,
  },

  features: {
    order: ["outline", "conversations", "prompts"],
    prompts: {
      enabled: true,
      doubleClickToSend: false,
      submitShortcut: "enter",
      promptQueue: false,
    },
    conversations: {
      enabled: true,
      syncUnpin: false,
      syncDelete: true,
      folderRainbow: true,
    },
    outline: {
      enabled: true,
      maxLevel: 6,
      autoUpdate: true,
      updateInterval: 2,
      showUserQueries: true,
      followMode: "current",
      expandLevel: 6,
      inlineBookmarkMode: "always",
      panelBookmarkMode: "always", //  (Always Dimmed)
      showWordCount: false,
    },
  },

  tab: {
    openInNewTab: true,
    autoRename: true,
    renameInterval: 3,
    showStatus: true,
    titleFormat: "{status}{title}->{model}",
    // GM_notification  @grant
    showNotification: isUserscript,
    notificationSound: true,
    notificationVolume: 0.6,
    notifyWhenFocused: false,
    autoFocus: false,
    privacyMode: false,
    privacyTitle: "Google",
    customIcon: "default",
  },

  readingHistory: {
    persistence: true,
    autoRestore: true,
    cleanupDays: 30,
  },

  collapsedButtons: [
    { id: "panel", enabled: true },
    { id: "floatingToolbar", enabled: true },
    { id: "globalSearch", enabled: true },
    { id: "theme", enabled: true },
    { id: "scrollTop", enabled: true },
    { id: "manualAnchor", enabled: false },
    { id: "anchor", enabled: true },
    { id: "scrollBottom", enabled: true },
  ],
  quickButtonsOpacity: 1,
  floatingToolbar: {
    open: true,
  },

  claude: {
    currentKeyId: "", // cookie
  },

  webdav: {
    enabled: false,
    url: "",
    username: "",
    password: "",
    syncMode: "manual",
    syncInterval: 30,
    remoteDir: "ophel",
    dataSources: ["settings", "conversations", "prompts", "claudeSessionKeys"], //
  },

  shortcuts: DEFAULT_SHORTCUTS_SETTINGS,

  aistudio: {
    collapseNavbar: false,
    collapseTools: false,
    collapseAdvanced: false,
    enableSearch: true,
    defaultModel: "", //
    //
    markdownFix: isUserscript,
    removeWatermark: isUserscript,
  },

  chatgpt: {
    //
    markdownFix: true,
  },
}

export interface Folder {
  id: string
  name: string
  icon: string
  isDefault?: boolean
}

export interface Tag {
  id: string
  name: string
  color: string
}

export interface Prompt {
  id: string
  title: string
  content: string
  category: string
  pinned?: boolean //
  lastUsedAt?: number //
}

// Claude SessionKey
export interface ClaudeSessionKey {
  id: string // crypto.randomUUID
  name: string //
  key: string // sk-ant-sid01-...
  accountType?: "Free" | "Pro(5x)" | "Pro(20x)" | "API" | "Unknown"
  isValid?: boolean //
  testedAt?: number //
  createdAt: number
}

export interface ClaudeSessionKeysState {
  keys: ClaudeSessionKey[]
  currentKeyId: string // cookie
}

// ====================  ====================

/**
 *
 */
export function getSiteTheme(settings: Settings, siteId: string): SiteThemeConfig {
  const sites = settings.theme?.sites
  if (sites && siteId in sites) {
    return sites[siteId as SiteId]
  }
  return sites?._default ?? DEFAULT_SITE_THEME
}

export function getSitePageWidth(settings: Settings, siteId: string): PageWidthConfig {
  const pageWidth = settings.layout?.pageWidth
  if (pageWidth && siteId in pageWidth) {
    return pageWidth[siteId as SiteId]
  }
  return pageWidth?._default ?? DEFAULT_PAGE_WIDTH
}

export function getSiteModelLock(settings: Settings, siteId: string): ModelLockConfig {
  return settings.modelLock?.[siteId] ?? { enabled: false, keyword: "" }
}

export function getSiteUserQueryWidth(settings: Settings, siteId: string): PageWidthConfig {
  const userQueryWidth = settings.layout?.userQueryWidth
  if (userQueryWidth && siteId in userQueryWidth) {
    return userQueryWidth[siteId as SiteId]
  }
  return userQueryWidth?._default ?? DEFAULT_USER_QUERY_WIDTH
}

export function getSiteZenMode(settings: Settings, siteId: string): ZenModeConfig {
  const zenMode = settings.layout?.zenMode
  if (zenMode && siteId in zenMode) {
    return zenMode[siteId as SiteId]
  }
  return zenMode?._default ?? DEFAULT_ZEN_MODE
}

let clearAllFlagPromise: Promise<boolean> | null = null

/**
 * “” true
 * - /
 * -
 */
export function consumeClearAllFlag(): Promise<boolean> {
  if (clearAllFlagPromise) {
    return clearAllFlagPromise
  }

  clearAllFlagPromise = new Promise((resolve) => {
    if (typeof chrome === "undefined" || !chrome.storage?.local) {
      resolve(false)
      return
    }

    chrome.storage.local.get(CLEAR_ALL_FLAG_KEY, (result) => {
      const rawValue = result?.[CLEAR_ALL_FLAG_KEY]
      const hasFlag = rawValue !== undefined
      if (!hasFlag) {
        resolve(false)
        return
      }

      const ts = typeof rawValue === "number" ? rawValue : Number(rawValue)
      if (!Number.isFinite(ts)) {
        resolve(true)
        return
      }

      const age = Date.now() - ts
      if (age <= CLEAR_ALL_FLAG_TTL_MS) {
        resolve(true)
        return
      }

      chrome.storage.local.remove(CLEAR_ALL_FLAG_KEY, () => resolve(false))
    })
  })

  return clearAllFlagPromise
}

//
export const RESTORE_FLAG_KEY = "ophel:restoreFlag"
export const RESTORE_FLAG_TTL_MS = 10 * 1000

let restoreFlagPromise: Promise<boolean> | null = null

/**
 * ""TTL  true
 * -  autoFullSync
 * -
 */
export function consumeRestoreFlag(): Promise<boolean> {
  if (restoreFlagPromise) {
    return restoreFlagPromise
  }

  restoreFlagPromise = new Promise((resolve) => {
    if (typeof chrome === "undefined" || !chrome.storage?.local) {
      resolve(false)
      return
    }

    chrome.storage.local.get(RESTORE_FLAG_KEY, (result) => {
      const rawValue = result?.[RESTORE_FLAG_KEY]
      const hasFlag = rawValue !== undefined
      if (!hasFlag) {
        resolve(false)
        return
      }

      const ts = typeof rawValue === "number" ? rawValue : Number(rawValue)
      if (!Number.isFinite(ts)) {
        resolve(true)
        return
      }

      const age = Date.now() - ts
      if (age <= RESTORE_FLAG_TTL_MS) {
        //  TTL
        resolve(true)
        return
      }

      //
      chrome.storage.local.remove(RESTORE_FLAG_KEY, () => resolve(false))
    })
  })

  return restoreFlagPromise
}
