/**
 * UI
 */
import type React from "react"

import {
  AnchorIcon,
  BrainIcon,
  ConversationIcon,
  ManualAnchorIcon,
  OutlineIcon,
  PromptIcon,
  ScrollBottomIcon,
  ScrollTopIcon,
  SearchIcon,
  SettingsIcon,
} from "~components/icons"
import { SHORTCUT_META } from "~constants/shortcuts"

// ==================== Tab ID  ====================
//  Tab
export const TAB_IDS = {
  PROMPTS: "prompts",
  OUTLINE: "outline",
  CONVERSATIONS: "conversations",
  SETTINGS: "settings",
} as const

export type TabId = (typeof TAB_IDS)[keyof typeof TAB_IDS]

// ==================== Settings Navigation IDs ====================
export const NAV_IDS = {
  GENERAL: "general",
  APPEARANCE: "appearance",
  FEATURES: "features",
  SITE_SETTINGS: "siteSettings",
  GLOBAL_SEARCH: "globalSearch",
  SHORTCUTS: "shortcuts",
  BACKUP: "backup",
  PERMISSIONS: "permissions",
  ABOUT: "about",
} as const

// ==================== Features Page Tab IDs ====================
export const FEATURES_TAB_IDS = {
  OUTLINE: "outline",
  CONVERSATIONS: "conversations",
  PROMPTS: "prompts",
  TAB_SETTINGS: "tab",
  CONTENT: "content",
  READING_HISTORY: "readingHistory",
  TOOLBOX: "toolbox",
} as const

// ==================== Appearance Page Tab IDs ====================
export const APPEARANCE_TAB_IDS = {
  PRESETS: "presets",
  CUSTOM: "custom",
} as const

// ==================== Site Settings Page Tab IDs ====================
export const SITE_SETTINGS_TAB_IDS = {
  LAYOUT: "layout",
  MODEL_LOCK: "modelLock",
  //  Tab ID  SITE_IDS
} as const

// ==================== Settings Deep Link ====================
export interface SettingsNavigateDetail {
  page?: string
  subTab?: string
  settingId?: string
}

export interface SettingsSearchItem {
  settingId: string
  title: string
  keywords?: string[]
}

interface SettingRoute {
  page: string
  subTab?: string
}

interface SettingRouteRule {
  prefix: string
  route: SettingRoute
}

export const SETTING_ID_ROUTE_MAP: Record<string, SettingRoute> = {
  "appearance-preset-light": {
    page: NAV_IDS.APPEARANCE,
    subTab: APPEARANCE_TAB_IDS.PRESETS,
  },
  "appearance-preset-dark": {
    page: NAV_IDS.APPEARANCE,
    subTab: APPEARANCE_TAB_IDS.PRESETS,
  },
  "appearance-custom-styles": {
    page: NAV_IDS.APPEARANCE,
    subTab: APPEARANCE_TAB_IDS.CUSTOM,
  },
} as const

const SETTING_ID_ROUTE_RULES: SettingRouteRule[] = [
  { prefix: "panel-", route: { page: NAV_IDS.GENERAL, subTab: "panel" } },
  { prefix: "quick-buttons-", route: { page: NAV_IDS.GENERAL, subTab: "shortcuts" } },
  { prefix: "tools-menu-", route: { page: NAV_IDS.GENERAL, subTab: "toolsMenu" } },
  { prefix: "shortcuts-", route: { page: NAV_IDS.SHORTCUTS } },
  { prefix: "shortcut-binding-", route: { page: NAV_IDS.SHORTCUTS } },
  {
    prefix: "layout-",
    route: { page: NAV_IDS.SITE_SETTINGS, subTab: SITE_SETTINGS_TAB_IDS.LAYOUT },
  },
  {
    prefix: "model-lock-",
    route: { page: NAV_IDS.SITE_SETTINGS, subTab: SITE_SETTINGS_TAB_IDS.MODEL_LOCK },
  },
  {
    prefix: "gemini-",
    route: { page: NAV_IDS.SITE_SETTINGS, subTab: "gemini" },
  },
  {
    prefix: "aistudio-",
    route: { page: NAV_IDS.SITE_SETTINGS, subTab: "aistudio" },
  },
  {
    prefix: "chatgpt-",
    route: { page: NAV_IDS.SITE_SETTINGS, subTab: "chatgpt" },
  },
  {
    prefix: "claude-",
    route: { page: NAV_IDS.SITE_SETTINGS, subTab: "claude" },
  },
  {
    prefix: "global-search-",
    route: { page: NAV_IDS.GLOBAL_SEARCH },
  },
  {
    prefix: "tab-",
    route: { page: NAV_IDS.FEATURES, subTab: FEATURES_TAB_IDS.TAB_SETTINGS },
  },
  {
    prefix: "outline-",
    route: { page: NAV_IDS.FEATURES, subTab: FEATURES_TAB_IDS.OUTLINE },
  },
  {
    prefix: "conversation-",
    route: { page: NAV_IDS.FEATURES, subTab: FEATURES_TAB_IDS.CONVERSATIONS },
  },
  {
    prefix: "export-",
    route: { page: NAV_IDS.FEATURES, subTab: FEATURES_TAB_IDS.CONVERSATIONS },
  },
  {
    prefix: "prompt-",
    route: { page: NAV_IDS.FEATURES, subTab: FEATURES_TAB_IDS.PROMPTS },
  },
  {
    prefix: "reading-history-",
    route: { page: NAV_IDS.FEATURES, subTab: FEATURES_TAB_IDS.READING_HISTORY },
  },
  {
    prefix: "content-",
    route: { page: NAV_IDS.FEATURES, subTab: FEATURES_TAB_IDS.CONTENT },
  },
  {
    prefix: "appearance-preset-",
    route: { page: NAV_IDS.APPEARANCE, subTab: APPEARANCE_TAB_IDS.PRESETS },
  },
  {
    prefix: "appearance-custom-",
    route: { page: NAV_IDS.APPEARANCE, subTab: APPEARANCE_TAB_IDS.CUSTOM },
  },
]

export const SETTING_ID_ALIASES: Record<string, string> = {
  "general.panel.defaultOpen": "panel-default-open",
  "general.panel.defaultPosition": "panel-default-position",
  "general.panel.defaultEdgeDistance": "panel-edge-distance",
  "general.panel.width": "panel-width",
  "general.panel.height": "panel-height",
  "general.panel.edgeSnap": "panel-edge-snap",
  "general.panel.edgeSnapThreshold": "panel-edge-snap-threshold",
  "general.panel.autoHide": "panel-auto-hide",
  "general.shortcuts.quickButtonsOpacity": "quick-buttons-opacity",
  "general.toolsMenu": "tools-menu-scrollTop",
  "siteSettings.layout.pageWidth.enabled": "layout-page-width-enabled",
  "siteSettings.layout.pageWidth.value": "layout-page-width-value",
  "siteSettings.layout.userQueryWidth.enabled": "layout-user-query-width-enabled",
  "siteSettings.layout.userQueryWidth.value": "layout-user-query-width-value",
  "siteSettings.layout.zenMode.enabled": "layout-zen-mode-enabled",
  "siteSettings.modelLock": "model-lock-gemini",
  "globalSearch.promptEnterBehavior": "global-search-prompt-enter-behavior",
  "globalSearch.enableFuzzySearch": "global-search-fuzzy-search",
  "globalSearch.doubleShift": "global-search-double-shift",
  "shortcuts.enabled": "shortcuts-enabled",
  "shortcuts.globalUrl": "shortcuts-global-url",
  "features.prompts.submitShortcut": "shortcuts-prompt-submit-shortcut",
  "features.tab.openInNewTab": "tab-open-new",
  "features.tab.autoRename": "tab-auto-rename",
  "features.outline.autoUpdate": "outline-auto-update",
  "features.outline.inlineBookmarkMode": "outline-inline-bookmark-mode",
  "features.outline.panelBookmarkMode": "outline-panel-bookmark-mode",
  "features.outline.preventAutoScroll": "outline-prevent-auto-scroll",
  "features.prompts.promptQueue": "prompt-queue",
  "features.export.includeThoughts": "export-include-thoughts",
  "features.readingHistory.persistence": "reading-history-persistence",
  "features.content.formulaCopy": "content-formula-copy",
  "panel.preventAutoScroll": "outline-prevent-auto-scroll",
  "content.markdownFix": "gemini-markdown-fix",
  "content.watermarkRemoval": "gemini-watermark-removal",
  "geminiEnterprise.policyRetry.enabled": "gemini-policy-retry",
  "geminiEnterprise.policyRetry.maxRetries": "gemini-policy-max-retries",
  "aistudio.collapseNavbar": "aistudio-collapse-navbar",
  "aistudio.collapseRunSettings": "aistudio-collapse-run-settings",
  "aistudio.collapseTools": "aistudio-collapse-tools",
  "aistudio.collapseAdvanced": "aistudio-collapse-advanced",
  "aistudio.enableSearch": "aistudio-enable-search",
  "aistudio.removeWatermark": "aistudio-remove-watermark",
  "aistudio.markdownFix": "aistudio-markdown-fix",
  "chatgpt.markdownFix": "chatgpt-markdown-fix",
  "claude.sessionKeys": "claude-session-keys",
  "appearance.presets.light": "appearance-preset-light",
  "appearance.presets.dark": "appearance-preset-dark",
  "appearance.custom.styles": "appearance-custom-styles",
}

export const resolveSettingId = (settingId?: string): string | undefined => {
  const normalized = settingId?.trim()
  if (!normalized) return undefined
  return SETTING_ID_ALIASES[normalized] ?? normalized
}

export const resolveSettingRoute = (settingId?: string): SettingRoute | undefined => {
  const resolvedSettingId = resolveSettingId(settingId)
  if (!resolvedSettingId) return undefined

  if (SETTING_ID_ROUTE_MAP[resolvedSettingId]) {
    return SETTING_ID_ROUTE_MAP[resolvedSettingId]
  }

  return SETTING_ID_ROUTE_RULES.find((rule) => resolvedSettingId.startsWith(rule.prefix))?.route
}

export const resolveSettingsNavigateDetail = (
  detail: SettingsNavigateDetail,
): SettingsNavigateDetail => {
  const resolvedSettingId = resolveSettingId(detail.settingId)
  const route = resolveSettingRoute(resolvedSettingId)

  const resolvedPage = detail.page ?? route?.page
  const resolvedSubTab =
    detail.subTab ?? (detail.page && detail.page !== route?.page ? undefined : route?.subTab)

  return {
    page: resolvedPage,
    subTab: resolvedSubTab,
    settingId: resolvedSettingId,
  }
}

const SHORTCUT_SETTINGS_SEARCH_ITEMS: SettingsSearchItem[] = Object.entries(SHORTCUT_META).map(
  ([actionId, meta]) => ({
    settingId: `shortcut-binding-${actionId}`,
    title: `${meta.label}`,
    keywords: [
      "shortcut",
      "shortcuts",
      "keybinding",
      "hotkey",
      "keyboard",
      "",
      "",
      "",
      meta.label,
      meta.labelKey,
      actionId,
      meta.category,
    ],
  }),
)

export const SETTINGS_SEARCH_ITEMS: SettingsSearchItem[] = [
  {
    settingId: "panel-default-open",
    title: "",
    keywords: ["panel", "default open", ""],
  },
  {
    settingId: "panel-default-position",
    title: "",
    keywords: ["panel", "left", "right", ""],
  },
  {
    settingId: "panel-edge-distance",
    title: "",
    keywords: ["panel", "edge distance", "margin"],
  },
  {
    settingId: "panel-width",
    title: "",
    keywords: ["panel width", ""],
  },
  {
    settingId: "panel-height",
    title: "",
    keywords: ["panel height", ""],
  },
  {
    settingId: "panel-edge-snap",
    title: "",
    keywords: ["snap", "edge", ""],
  },
  {
    settingId: "panel-edge-snap-threshold",
    title: "",
    keywords: ["snap threshold", "edge snap", ""],
  },
  {
    settingId: "panel-auto-hide",
    title: "",
    keywords: ["auto hide", "panel"],
  },
  {
    settingId: "quick-buttons-opacity",
    title: "",
    keywords: ["quick buttons", "opacity", ""],
  },
  {
    settingId: "tools-menu-export",
    title: "",
    keywords: ["tools menu", "export", "", ""],
  },
  {
    settingId: "tools-menu-copyMarkdown",
    title: " Markdown",
    keywords: ["tools menu", "copy", "markdown", ""],
  },
  {
    settingId: "tools-menu-move",
    title: "",
    keywords: ["tools menu", "move", "folder", ""],
  },
  {
    settingId: "tools-menu-setTag",
    title: "",
    keywords: ["tools menu", "tag", "", ""],
  },
  {
    settingId: "tools-menu-scrollLock",
    title: "",
    keywords: ["tools menu", "scroll lock", "", ""],
  },
  {
    settingId: "tools-menu-modelLock",
    title: "",
    keywords: ["tools menu", "model lock", "", ""],
  },
  {
    settingId: "tools-menu-cleanup",
    title: "",
    keywords: ["tools menu", "cleanup", "", ""],
  },
  {
    settingId: "tools-menu-settings",
    title: "",
    keywords: ["tools menu", "settings", "", ""],
  },
  {
    settingId: "tab-open-new",
    title: "",
    keywords: ["tab", "new conversation", "open in new tab", ""],
  },
  {
    settingId: "tab-auto-rename",
    title: "",
    keywords: ["tab", "auto rename", ""],
  },
  {
    settingId: "tab-rename-interval",
    title: "",
    keywords: ["tab", "rename interval", ""],
  },
  {
    settingId: "tab-title-format",
    title: "",
    keywords: ["tab", "title format", ""],
  },
  {
    settingId: "tab-show-status",
    title: "",
    keywords: ["tab", "status", ""],
  },
  {
    settingId: "tab-show-notification",
    title: "",
    keywords: ["tab", "notification", ""],
  },
  {
    settingId: "tab-notification-sound",
    title: "",
    keywords: ["tab", "notification sound", ""],
  },
  {
    settingId: "tab-notification-volume",
    title: "",
    keywords: ["tab", "notification volume", ""],
  },
  {
    settingId: "tab-notify-when-focused",
    title: "",
    keywords: ["tab", "focused", "notify", ""],
  },
  {
    settingId: "tab-auto-focus",
    title: "",
    keywords: ["tab", "auto focus", ""],
  },
  {
    settingId: "tab-privacy-mode",
    title: "",
    keywords: ["tab", "privacy", ""],
  },
  {
    settingId: "tab-privacy-title",
    title: "",
    keywords: ["tab", "privacy title", ""],
  },
  {
    settingId: "outline-auto-update",
    title: "",
    keywords: ["outline", "auto update", ""],
  },
  {
    settingId: "outline-update-interval",
    title: "",
    keywords: ["outline", "interval", ""],
  },
  {
    settingId: "outline-follow-mode",
    title: "",
    keywords: ["outline", "follow", ""],
  },
  {
    settingId: "outline-show-word-count",
    title: "",
    keywords: ["outline", "word count", ""],
  },
  {
    settingId: "outline-inline-bookmark-mode",
    title: "",
    keywords: ["outline", "bookmark", "", "inline"],
  },
  {
    settingId: "outline-panel-bookmark-mode",
    title: "",
    keywords: ["outline", "bookmark", "", "panel"],
  },
  {
    settingId: "outline-prevent-auto-scroll",
    title: "",
    keywords: ["outline", "auto scroll", ""],
  },
  {
    settingId: "conversation-folder-rainbow",
    title: "",
    keywords: ["conversation", "folder", "rainbow", ""],
  },
  {
    settingId: "conversation-sync-unpin",
    title: "",
    keywords: ["conversation", "sync", "unpin", ""],
  },
  {
    settingId: "conversation-sync-delete",
    title: "",
    keywords: ["conversation", "sync", "delete", "cloud", "", ""],
  },
  {
    settingId: "export-custom-user-name",
    title: "",
    keywords: ["export", "user name", ""],
  },
  {
    settingId: "export-custom-model-name",
    title: "",
    keywords: ["export", "model name", ""],
  },
  {
    settingId: "export-filename-timestamp",
    title: "",
    keywords: ["export", "filename", "timestamp", ""],
  },
  {
    settingId: "export-include-thoughts",
    title: "",
    keywords: ["export", "thoughts", "reasoning", "thinking", "", "", ""],
  },
  {
    settingId: "export-images-base64",
    title: " Base64",
    keywords: ["export", "image", "base64", ""],
  },
  {
    settingId: "prompt-double-click-send",
    title: "",
    keywords: ["prompt", "double click", "send", ""],
  },
  {
    settingId: "prompt-queue",
    title: "",
    keywords: ["prompt", "queue", "", ""],
  },
  {
    settingId: "reading-history-persistence",
    title: "",
    keywords: ["reading history", "persistence", ""],
  },
  {
    settingId: "reading-history-auto-restore",
    title: "",
    keywords: ["reading history", "restore", ""],
  },
  {
    settingId: "reading-history-cleanup-days",
    title: "",
    keywords: ["reading history", "cleanup", "days", ""],
  },
  {
    settingId: "content-user-query-markdown",
    title: " Markdown",
    keywords: ["content", "markdown", "user query", ""],
  },
  {
    settingId: "content-formula-copy",
    title: "",
    keywords: ["content", "formula", "copy", ""],
  },
  {
    settingId: "content-formula-delimiter",
    title: "",
    keywords: ["content", "formula delimiter", ""],
  },
  {
    settingId: "content-table-copy",
    title: "",
    keywords: ["content", "table copy", ""],
  },
  {
    settingId: "layout-page-width-enabled",
    title: "",
    keywords: ["layout", "page width", ""],
  },
  {
    settingId: "layout-page-width-value",
    title: "",
    keywords: ["layout", "page width value", ""],
  },
  {
    settingId: "layout-user-query-width-enabled",
    title: "",
    keywords: ["layout", "user query width", ""],
  },
  {
    settingId: "layout-user-query-width-value",
    title: "",
    keywords: ["layout", "user query width value", ""],
  },
  {
    settingId: "layout-zen-mode-enabled",
    title: " (Zen Mode)",
    keywords: ["layout", "zen mode", "", "disclaimer", "", ""],
  },
  {
    settingId: "model-lock-gemini",
    title: "Gemini",
    keywords: ["model lock", "gemini", ""],
  },
  {
    settingId: "model-lock-gemini-enterprise",
    title: "Gemini Enterprise",
    keywords: ["model lock", "gemini enterprise", ""],
  },
  {
    settingId: "model-lock-aistudio",
    title: "AI Studio",
    keywords: ["model lock", "aistudio", ""],
  },
  {
    settingId: "model-lock-chatgpt",
    title: "ChatGPT",
    keywords: ["model lock", "chatgpt", ""],
  },
  {
    settingId: "model-lock-claude",
    title: "Claude",
    keywords: ["model lock", "claude", ""],
  },
  {
    settingId: "model-lock-grok",
    title: "Grok",
    keywords: ["model lock", "grok", ""],
  },
  {
    settingId: "gemini-markdown-fix",
    title: "GeminiMarkdown ",
    keywords: ["gemini", "markdown", "fix", ""],
  },
  {
    settingId: "gemini-watermark-removal",
    title: "Gemini",
    keywords: ["gemini", "watermark", ""],
  },
  {
    settingId: "gemini-policy-retry",
    title: "Gemini",
    keywords: ["gemini", "policy retry", ""],
  },
  {
    settingId: "gemini-policy-max-retries",
    title: "Gemini",
    keywords: ["gemini", "max retries", ""],
  },
  {
    settingId: "aistudio-collapse-navbar",
    title: "AI Studio",
    keywords: ["aistudio", "collapse navbar", ""],
  },
  {
    settingId: "aistudio-collapse-run-settings",
    title: "AI Studio Run settings",
    keywords: ["aistudio", "run settings", ""],
  },
  {
    settingId: "aistudio-collapse-tools",
    title: "AI Studio Tools",
    keywords: ["aistudio", "tools", ""],
  },
  {
    settingId: "aistudio-collapse-advanced",
    title: "AI Studio Advanced",
    keywords: ["aistudio", "advanced", ""],
  },
  {
    settingId: "aistudio-enable-search",
    title: "AI Studio",
    keywords: ["aistudio", "search", ""],
  },
  {
    settingId: "aistudio-remove-watermark",
    title: "AI Studio",
    keywords: ["aistudio", "watermark", ""],
  },
  {
    settingId: "aistudio-markdown-fix",
    title: "AI StudioMarkdown ",
    keywords: ["aistudio", "markdown", "fix", ""],
  },
  {
    settingId: "chatgpt-markdown-fix",
    title: "ChatGPTMarkdown ",
    keywords: ["chatgpt", "markdown", "fix", ""],
  },
  {
    settingId: "claude-session-keys",
    title: "ClaudeSession Keys",
    keywords: ["claude", "session key", "token", ""],
  },
  {
    settingId: "global-search-prompt-enter-behavior",
    title: "",
    keywords: ["global search", "prompt", "enter", "", "", ""],
  },
  {
    settingId: "global-search-fuzzy-search",
    title: "Global Search: Enable fuzzy search",
    keywords: ["global search", "fuzzy", "search everywhere", "matching"],
  },
  {
    settingId: "global-search-double-shift",
    title: " Shift ",
    keywords: ["global search", "double shift", "shortcut", "", " shift", ""],
  },
  {
    settingId: "global-search-shortcut-setting-link",
    title: "",
    keywords: ["global search", "shortcut", "keybinding", "", "", ""],
  },
  {
    settingId: "shortcuts-enabled",
    title: "",
    keywords: ["shortcuts", "enable", "", "", ""],
  },
  {
    settingId: "shortcuts-global-url",
    title: " URL",
    keywords: ["shortcuts", "global url", "alt+g", "", "url"],
  },
  {
    settingId: "shortcuts-browser-shortcuts",
    title: "",
    keywords: ["shortcuts", "browser shortcuts", "chrome://extensions/shortcuts", ""],
  },
  {
    settingId: "shortcuts-prompt-submit-shortcut",
    title: "",
    keywords: ["shortcuts", "submit", "enter", "ctrl+enter", "", ""],
  },
  {
    settingId: "appearance-preset-light",
    title: "",
    keywords: ["appearance", "theme", "light", ""],
  },
  {
    settingId: "appearance-preset-dark",
    title: "",
    keywords: ["appearance", "theme", "dark", ""],
  },
  {
    settingId: "appearance-custom-styles",
    title: "",
    keywords: ["appearance", "custom style", "", "css"],
  },
  ...SHORTCUT_SETTINGS_SEARCH_ITEMS,
]

const SETTING_ID_ALIAS_SEARCH_MAP = Object.entries(SETTING_ID_ALIASES).reduce(
  (collector, [aliasId, targetSettingId]) => {
    if (!collector[targetSettingId]) {
      collector[targetSettingId] = []
    }
    collector[targetSettingId].push(aliasId)
    return collector
  },
  {} as Record<string, string[]>,
)

const normalizeSearchValue = (value: string): string => value.trim().toLowerCase()
const toSearchTokens = (query: string): string[] =>
  normalizeSearchValue(query)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 0)

export const searchSettingsItems = (query: string, limit?: number): SettingsSearchItem[] => {
  const normalizedQuery = normalizeSearchValue(query)
  const tokens = toSearchTokens(normalizedQuery)

  const scoredItems = SETTINGS_SEARCH_ITEMS.map((item, index) => {
    const normalizedTitle = normalizeSearchValue(item.title)
    const normalizedKeywords = normalizeSearchValue((item.keywords || []).join(" "))
    const normalizedSettingId = normalizeSearchValue(item.settingId)
    const normalizedAliasKeywords = normalizeSearchValue(
      (SETTING_ID_ALIAS_SEARCH_MAP[item.settingId] || []).join(" "),
    )
    const searchableText = `${normalizedTitle} ${normalizedKeywords} ${normalizedSettingId} ${normalizedAliasKeywords}`

    if (tokens.some((token) => !searchableText.includes(token))) {
      return null
    }

    let score = 0
    if (!normalizedQuery) {
      score = 1000 - index
    } else {
      if (normalizedTitle === normalizedQuery) score += 200
      if (normalizedTitle.startsWith(normalizedQuery)) score += 120
      if (normalizedTitle.includes(normalizedQuery)) score += 80
      if (normalizedKeywords.includes(normalizedQuery)) score += 70
      if (normalizedSettingId.includes(normalizedQuery)) score += 60
      if (normalizedAliasKeywords.includes(normalizedQuery)) score += 50

      tokens.forEach((token) => {
        if (normalizedTitle.startsWith(token)) score += 16
        if (normalizedTitle.includes(token)) score += 8
        if (normalizedKeywords.includes(token)) score += 6
        if (normalizedSettingId.includes(token)) score += 5
        if (normalizedAliasKeywords.includes(token)) score += 4
      })

      score += Math.max(0, 24 - Math.min(24, normalizedTitle.length))
    }

    return { item, score, index }
  })
    .filter((entry): entry is { item: SettingsSearchItem; score: number; index: number } => !!entry)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score
      return left.index - right.index
    })

  const items = scoredItems.map(({ item }) => item)

  if (typeof limit === "number" && Number.isFinite(limit)) {
    return items.slice(0, Math.max(0, limit))
  }

  return items
}

// ==================== Tab  ====================
// Tab
export const TAB_DEFINITIONS: Record<
  string,
  {
    label: string
    icon: string
    IconComponent?: React.ComponentType<{ size?: number; color?: string }>
  }
> = {
  [TAB_IDS.PROMPTS]: { label: "tabPrompts", icon: "✏️", IconComponent: PromptIcon },
  [TAB_IDS.CONVERSATIONS]: {
    label: "tabConversations",
    icon: "💬",
    IconComponent: ConversationIcon,
  },
  [TAB_IDS.OUTLINE]: { label: "tabOutline", icon: "📑", IconComponent: OutlineIcon },
  [TAB_IDS.SETTINGS]: { label: "tabSettings", icon: "⚙️" },
}

// ====================  ====================
// isPanelOnly: true false
// IconComponent: React  icon
export const COLLAPSED_BUTTON_DEFS: Record<
  string,
  {
    icon: string
    labelKey: string
    canToggle: boolean
    isPanelOnly: boolean
    isGroup?: boolean
    IconComponent?: React.ComponentType<{ size?: number; color?: string }>
  }
> = {
  scrollTop: {
    icon: "⬆",
    labelKey: "scrollTop",
    canToggle: false,
    isPanelOnly: false,
    IconComponent: ScrollTopIcon,
  },
  panel: {
    icon: "✨",
    labelKey: "panelTitle",
    canToggle: false,
    isPanelOnly: true,
    IconComponent: BrainIcon,
  },
  floatingToolbar: {
    icon: "⚙️",
    labelKey: "tools", // Changed from floatingToolbarLabel
    canToggle: true, // This toggle will now open the menu
    isPanelOnly: false,
    IconComponent: SettingsIcon,
  },
  globalSearch: {
    icon: "🔎",
    labelKey: "navGlobalSearch",
    canToggle: true,
    isPanelOnly: false,
    IconComponent: SearchIcon,
  },
  anchor: {
    icon: "⚓",
    canToggle: true,
    labelKey: "showCollapsedAnchorLabel",
    isPanelOnly: false,
    IconComponent: AnchorIcon,
  },
  theme: {
    icon: "☀",
    labelKey: "showCollapsedThemeLabel",
    canToggle: true,
    isPanelOnly: false,
  },
  manualAnchor: {
    icon: "📍",
    labelKey: "manualAnchorLabel",
    canToggle: true,
    isPanelOnly: false,
    isGroup: true,
    IconComponent: ManualAnchorIcon,
  },
  scrollBottom: {
    icon: "⬇",
    labelKey: "scrollBottom",
    canToggle: false,
    isPanelOnly: false,
    IconComponent: ScrollBottomIcon,
  },
}

// ==================== Emoji  ====================
//  Emoji  (64)
export const PRESET_EMOJIS = [
  // 📂
  "📁",
  "📂",
  "📥",
  "🗂️",
  "📊",
  "📈",
  "📉",
  "📋",
  // 💼 /
  "💼",
  "📅",
  "📌",
  "📎",
  "📝",
  "✒️",
  "🔍",
  "💡",
  // 💻 /
  "💻",
  "⌨️",
  "🖥️",
  "🖱️",
  "🐛",
  "🔧",
  "🔨",
  "⚙️",
  // 🤖 AI/
  "🤖",
  "👾",
  "🧠",
  "⚡",
  "🔥",
  "✨",
  "🎓",
  "📚",
  // 🎨 /
  "🎨",
  "🎭",
  "🎬",
  "🎹",
  "🎵",
  "📷",
  "🖌️",
  "🖍️",
  // 🏠 /
  "🏠",
  "🛒",
  "✈️",
  "🎮",
  "⚽",
  "🍔",
  "☕",
  "❤️",
  // 🌈 /
  "🔴",
  "🟠",
  "🟡",
  "🟢",
  "🔵",
  "🟣",
  "⚫",
  "⚪",
  //
  "⭐",
  "🌟",
  "🎉",
  "🔒",
  "🔑",
  "🚫",
  "✅",
  "❓",
]

// ====================  ====================
// 30
export const TAG_COLORS = [
  //
  "#FF461F",
  "#FF6B6B",
  "#FA8072",
  "#DC143C",
  "#CD5C5C",
  "#FF4500",
  //
  "#FFA500",
  "#FFB347",
  "#F0E68C",
  "#DAA520",
  "#FFD700",
  "#9ACD32",
  //
  "#32CD32",
  "#3CB371",
  "#20B2AA",
  "#00CED1",
  "#5F9EA0",
  "#4682B4",
  //
  "#6495ED",
  "#4169E1",
  "#0000CD",
  "#8A2BE2",
  "#9370DB",
  "#BA55D3",
  //
  "#DB7093",
  "#C71585",
  "#8B4513",
  "#A0522D",
  "#708090",
  "#2F4F4F",
]

// ==================== Toast  ====================
export const TOAST_DURATION = {
  SHORT: 1500,
  MEDIUM: 2000,
  LONG: 3000,
} as const

// ====================  ====================
export const STATUS_COLORS = {
  SUCCESS: "#10b981", // green-500
  ERROR: "#ef4444", // red-500
  WARNING: "#f59e0b", // amber-500
  INFO: "var(--gh-text-secondary)",
} as const
