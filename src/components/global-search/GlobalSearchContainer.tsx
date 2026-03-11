import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"

import type { SiteAdapter } from "~adapters"
import {
  APPEARANCE_TAB_IDS,
  FEATURES_TAB_IDS,
  NAV_IDS,
  SITE_SETTINGS_TAB_IDS,
  TAB_IDS,
  resolveSettingRoute,
  searchSettingsItems,
  type SettingsSearchItem,
} from "~constants"
import {
  DEFAULT_KEYBINDINGS,
  formatShortcut,
  SHORTCUT_ACTIONS,
  SHORTCUT_META,
} from "~constants/shortcuts"
import { ConversationManager } from "~core/conversation-manager"
import { OutlineManager, type OutlineNode } from "~core/outline-manager"
import { PromptManager } from "~core/prompt-manager"
import { useConversationsStore } from "~stores/conversations-store"
import { useFoldersStore } from "~stores/folders-store"
import { usePromptsStore } from "~stores/prompts-store"
import { useSettingsStore } from "~stores/settings-store"
import { useTagsStore } from "~stores/tags-store"
import { DEFAULT_SETTINGS, type Settings } from "~utils/storage"
import { setLanguage, t } from "~utils/i18n"
import { getHighlightStyles, renderMarkdown } from "~utils/markdown"
import { createSafeHTML } from "~utils/trusted-types"
import { showToast } from "~utils/toast"
import { initCopyButtons, showCopySuccess } from "~utils/icons"

import { GlobalSearchOverlay } from "./GlobalSearchOverlay"
import { GlobalSearchResultItemView } from "./GlobalSearchResultItemView"
import { useGlobalSearchData } from "./useGlobalSearchData"
import { useGlobalSearchKeyboard } from "./useGlobalSearchKeyboard"
import { useGlobalSearchPreview } from "./useGlobalSearchPreview"
import { useGlobalSearchSyntax } from "./useGlobalSearchSyntax"
import {
  getGlobalSearchTrailingTokenInfo,
  parseGlobalSearchQuery,
  stringifyGlobalSearchQuery,
  toGlobalSearchTokens,
} from "./syntax"
import type {
  GlobalSearchCategoryId,
  GlobalSearchMatchReason,
  GlobalSearchResultCategory,
  GlobalSearchResultItem,
  GlobalSearchSyntaxSuggestionItem,
} from "./types"

interface GlobalSearchContainerProps {
  isOpen: boolean
  onClose: () => void
  onOpenSettings: () => void
  onPanelOpen: () => void
  adapter: SiteAdapter
  outlineManager: OutlineManager | null
  conversationManager: ConversationManager | null
  promptManager: PromptManager | null
  edgeSnapState: "left" | "right" | null
  onEdgePeek: (peeking: boolean) => void
  settings: Settings
}

interface LocalizedLabelDefinition {
  key: string
  fallback: string
}

const SETTINGS_PAGE_LABEL_DEFINITIONS: Record<string, LocalizedLabelDefinition> = {
  [NAV_IDS.GENERAL]: { key: "navGeneral", fallback: "General" },
  [NAV_IDS.FEATURES]: { key: "navFeatures", fallback: "Features" },
  [NAV_IDS.SITE_SETTINGS]: { key: "navSiteSettings", fallback: "Site Config" },
  [NAV_IDS.GLOBAL_SEARCH]: { key: "navGlobalSearch", fallback: "Global Search" },
  [NAV_IDS.APPEARANCE]: { key: "navAppearance", fallback: "Appearance" },
  [NAV_IDS.SHORTCUTS]: { key: "navShortcuts", fallback: "Keyboard Shortcuts" },
  [NAV_IDS.BACKUP]: { key: "navBackup", fallback: "Data Management" },
  [NAV_IDS.PERMISSIONS]: { key: "navPermissions", fallback: "Permissions" },
  [NAV_IDS.ABOUT]: { key: "navAbout", fallback: "About" },
}

const SETTINGS_SUB_TAB_LABEL_DEFINITIONS: Record<string, LocalizedLabelDefinition> = {
  panel: { key: "panelTab", fallback: "Panel" },
  tabOrder: { key: "tabOrderTab", fallback: "Tab Order" },
  shortcuts: { key: "shortcutsTab", fallback: "Quick Buttons" },
  toolsMenu: { key: "toolboxMenu", fallback: "Toolbox" },
  [FEATURES_TAB_IDS.TAB_SETTINGS]: { key: "tabSettingsTab", fallback: "Tab Settings" },
  [FEATURES_TAB_IDS.OUTLINE]: { key: "outlineSettingsTitle", fallback: "Outline" },
  [FEATURES_TAB_IDS.CONVERSATIONS]: {
    key: "conversationsSettingsTitle",
    fallback: "Conversations",
  },
  [FEATURES_TAB_IDS.PROMPTS]: { key: "promptSettingsTitle", fallback: "Prompts" },
  [FEATURES_TAB_IDS.READING_HISTORY]: {
    key: "readingHistorySettings",
    fallback: "Reading History",
  },
  [FEATURES_TAB_IDS.CONTENT]: { key: "contentProcessing", fallback: "Content" },
  [FEATURES_TAB_IDS.TOOLBOX]: { key: "toolboxMenu", fallback: "Toolbox" },
  [SITE_SETTINGS_TAB_IDS.LAYOUT]: { key: "layoutTab", fallback: "Layout" },
  [SITE_SETTINGS_TAB_IDS.MODEL_LOCK]: { key: "tabModelLock", fallback: "Model Lock" },
  gemini: { key: "geminiSettingsTab", fallback: "Gemini" },
  aistudio: { key: "aistudioSettingsTitle", fallback: "AI Studio" },
  chatgpt: { key: "chatgptSettingsTitle", fallback: "ChatGPT" },
  claude: { key: "claudeSettingsTab", fallback: "Claude" },
  [APPEARANCE_TAB_IDS.PRESETS]: { key: "themePresetsTab", fallback: "Theme Presets" },
  [APPEARANCE_TAB_IDS.CUSTOM]: { key: "customStylesTab", fallback: "Custom Styles" },
}

interface GlobalSearchCategoryDefinition {
  id: GlobalSearchCategoryId
  label: LocalizedLabelDefinition
  placeholder: LocalizedLabelDefinition
  emptyText: LocalizedLabelDefinition
}

type GlobalSearchOpenSource = "shortcut" | "ui" | "event"

interface GlobalSearchShortcutNudgeState {
  shownCount: number
  lastShownAt: number
  dismissed: boolean
  shortcutUsedCount: number
}

const isLikelyMacPlatform = () => {
  if (typeof navigator === "undefined") return false
  const platform = navigator.platform?.toLowerCase?.() || ""
  const userAgent = navigator.userAgent?.toLowerCase?.() || ""
  return platform.includes("mac") || userAgent.includes("mac os")
}

const GLOBAL_SEARCH_CATEGORY_DEFINITIONS: GlobalSearchCategoryDefinition[] = [
  {
    id: "all",
    label: { key: "globalSearchCategoryAll", fallback: "All" },
    placeholder: { key: "globalSearchPlaceholderAll", fallback: "Search all" },
    emptyText: { key: "globalSearchEmptyAll", fallback: "No matching results" },
  },
  {
    id: "outline",
    label: { key: "globalSearchCategoryOutline", fallback: "Outline" },
    placeholder: { key: "globalSearchPlaceholderOutline", fallback: "Search outline" },
    emptyText: { key: "globalSearchEmptyOutline", fallback: "No outline results" },
  },
  {
    id: "conversations",
    label: { key: "globalSearchCategoryConversations", fallback: "Conversations" },
    placeholder: {
      key: "globalSearchPlaceholderConversations",
      fallback: "Search conversations on current site",
    },
    emptyText: {
      key: "globalSearchEmptyConversations",
      fallback: "No conversation results",
    },
  },
  {
    id: "prompts",
    label: { key: "globalSearchCategoryPrompts", fallback: "Prompts" },
    placeholder: { key: "globalSearchPlaceholderPrompts", fallback: "Search prompts" },
    emptyText: { key: "globalSearchEmptyPrompts", fallback: "No prompt results" },
  },
  {
    id: "settings",
    label: { key: "globalSearchCategorySettings", fallback: "Settings" },
    placeholder: { key: "globalSearchPlaceholderSettings", fallback: "Search settings" },
    emptyText: { key: "globalSearchEmptySettings", fallback: "No matching settings" },
  },
]

const GLOBAL_SEARCH_RESULT_CATEGORY_LABELS: Record<
  GlobalSearchResultCategory,
  LocalizedLabelDefinition
> = {
  outline: { key: "globalSearchCategoryOutline", fallback: "Outline" },
  settings: { key: "globalSearchCategorySettings", fallback: "Settings" },
  conversations: { key: "globalSearchCategoryConversations", fallback: "Conversations" },
  prompts: { key: "globalSearchCategoryPrompts", fallback: "Prompts" },
}

const GLOBAL_SEARCH_MATCH_REASON_LABEL_DEFINITIONS: Record<
  GlobalSearchMatchReason,
  LocalizedLabelDefinition
> = {
  title: { key: "globalSearchMatchReasonTitle", fallback: "Title match" },
  folder: { key: "globalSearchMatchReasonFolder", fallback: "Folder match" },
  tag: { key: "globalSearchMatchReasonTag", fallback: "Tag match" },
  type: { key: "globalSearchMatchReasonType", fallback: "Type match" },
  code: { key: "globalSearchMatchReasonCode", fallback: "Code match" },
  category: { key: "globalSearchMatchReasonCategory", fallback: "Category match" },
  content: { key: "globalSearchMatchReasonContent", fallback: "Content match" },
  id: { key: "globalSearchMatchReasonId", fallback: "ID match" },
  keyword: { key: "globalSearchMatchReasonKeyword", fallback: "Keyword match" },
  alias: { key: "globalSearchMatchReasonAlias", fallback: "Alias match" },
  fuzzy: { key: "globalSearchMatchReasonFuzzy", fallback: "Fuzzy match" },
}

const GLOBAL_SEARCH_ALL_CATEGORY_ITEM_LIMIT = 12
const GLOBAL_SEARCH_RESULTS_LISTBOX_ID = "settings-search-results-listbox"
const GLOBAL_SEARCH_OPTION_ID_PREFIX = "settings-search-option"
const GLOBAL_SEARCH_KEYBOARD_SAFE_TOP = 8
const GLOBAL_SEARCH_KEYBOARD_SAFE_BOTTOM = 12
const GLOBAL_SEARCH_SHORTCUT_NUDGE_STORAGE_KEY = "ophel:global-search-shortcut-nudge:v1"
const GLOBAL_SEARCH_SHORTCUT_NUDGE_MAX_SHOWS = 3
const GLOBAL_SEARCH_SHORTCUT_NUDGE_MIN_INTERVAL = 24 * 60 * 60 * 1000
const GLOBAL_SEARCH_SHORTCUT_NUDGE_AUTO_HIDE_MS = 6000
const GLOBAL_SEARCH_SHORTCUT_NUDGE_AUTO_DISMISS_SHORTCUT_COUNT = 2
const GLOBAL_SEARCH_PROMPT_PREVIEW_POINTER_DELAY_MS = 450
const GLOBAL_SEARCH_PROMPT_PREVIEW_KEYBOARD_DELAY_MS = 700
const GLOBAL_SEARCH_PROMPT_PREVIEW_HIDE_DELAY_MS = 220
const GLOBAL_SEARCH_INPUT_DEBOUNCE_MS = 140
const GLOBAL_SEARCH_SYNTAX_SUGGESTION_LIMIT = 8
const GLOBAL_SEARCH_FILTER_CHIP_MAX_COUNT = 4

const SETTING_SEARCH_TITLE_KEY_MAP: Record<string, string> = {
  "aistudio-collapse-advanced": "aistudioCollapseAdvanced",
  "aistudio-collapse-navbar": "aistudioCollapseNavbar",
  "aistudio-collapse-run-settings": "aistudioCollapseRunSettings",
  "aistudio-collapse-tools": "aistudioCollapseTools",
  "aistudio-enable-search": "aistudioEnableSearch",
  "aistudio-markdown-fix": "aistudioMarkdownFixLabel",
  "aistudio-remove-watermark": "aistudioRemoveWatermark",
  "appearance-custom-styles": "customCSS",
  "appearance-preset-dark": "darkModePreset",
  "appearance-preset-light": "lightModePreset",
  "chatgpt-markdown-fix": "chatgptMarkdownFixLabel",
  "conversation-sync-delete": "conversationsSyncDeleteLabel",
  "global-search-fuzzy-search": "globalSearchEnableFuzzySearchLabel",
  "global-search-double-shift": "doubleShiftToSearch",
  "global-search-shortcut-setting-link": "globalSearchShortcutSettingLabel",
  "global-search-prompt-enter-behavior": "globalSearchPromptEnterBehaviorLabel",
  "claude-session-keys": "claudeSessionKeyTitle",
  "content-formula-copy": "formulaCopyLabel",
  "content-formula-delimiter": "formulaDelimiterLabel",
  "content-table-copy": "tableCopyLabel",
  "content-user-query-markdown": "userQueryMarkdownLabel",
  "conversation-folder-rainbow": "folderRainbowLabel",
  "conversation-sync-unpin": "conversationsSyncUnpinLabel",
  "export-custom-model-name": "exportCustomModelName",
  "export-custom-user-name": "exportCustomUserName",
  "export-filename-timestamp": "exportFilenameTimestamp",
  "export-include-thoughts": "exportIncludeThoughtsLabel",
  "export-images-base64": "exportImagesToBase64Label",
  "gemini-markdown-fix": "markdownFixLabel",
  "gemini-policy-max-retries": "maxRetriesLabel",
  "gemini-policy-retry": "policyRetryLabel",
  "gemini-watermark-removal": "watermarkRemovalLabel",
  "layout-page-width-enabled": "enablePageWidth",
  "layout-page-width-value": "pageWidthValueLabel",
  "layout-user-query-width-enabled": "enableUserQueryWidth",
  "layout-user-query-width-value": "userQueryWidthValueLabel",
  "layout-zen-mode-enabled": "zenModeTitle",
  "outline-auto-update": "outlineAutoUpdateLabel",
  "outline-follow-mode": "outlineFollowModeLabel",
  "outline-inline-bookmark-mode": "inlineBookmarkModeLabel",
  "outline-panel-bookmark-mode": "panelBookmarkModeLabel",
  "outline-prevent-auto-scroll": "preventAutoScrollLabel",
  "outline-show-word-count": "outlineShowWordCountLabel",
  "outline-update-interval": "outlineUpdateIntervalLabel",
  "panel-auto-hide": "autoHidePanelLabel",
  "panel-default-open": "defaultPanelStateLabel",
  "panel-default-position": "defaultPositionLabel",
  "panel-edge-distance": "defaultEdgeDistanceLabel",
  "panel-edge-snap": "edgeSnapHideLabel",
  "panel-edge-snap-threshold": "edgeSnapThresholdLabel",
  "panel-height": "panelHeightLabel",
  "panel-width": "panelWidthLabel",
  "prompt-double-click-send": "promptDoubleClickSendLabel",
  "prompt-queue": "queueSettingLabel",
  "quick-buttons-opacity": "quickButtonsOpacityLabel",
  "reading-history-auto-restore": "readingHistoryAutoRestoreLabel",
  "reading-history-cleanup-days": "readingHistoryCleanup",
  "reading-history-persistence": "readingHistoryPersistenceLabel",
  "shortcuts-enabled": "enableShortcuts",
  "shortcuts-global-url": "globalShortcutUrl",
  "shortcuts-browser-shortcuts": "globalShortcutsTitle",
  "shortcuts-prompt-submit-shortcut": "promptSubmitShortcutLabel",
  "tab-auto-focus": "autoFocusLabel",
  "tab-auto-rename": "autoRenameTabLabel",
  "tab-notification-sound": "notificationSoundLabel",
  "tab-notification-volume": "notificationVolumeLabel",
  "tab-notify-when-focused": "notifyWhenFocusedLabel",
  "tab-open-new": "openNewTabLabel",
  "tab-privacy-mode": "privacyModeLabel",
  "tab-privacy-title": "privacyTitleLabel",
  "tab-rename-interval": "renameIntervalLabel",
  "tab-show-notification": "showNotificationLabel",
  "tab-show-status": "showStatusLabel",
  "tab-title-format": "titleFormatLabel",
  "tools-menu-export": "export",
  "tools-menu-copyMarkdown": "exportToClipboard",
  "tools-menu-move": "conversationsMoveTo",
  "tools-menu-setTag": "conversationsSetTag",
  "tools-menu-scrollLock": "shortcutToggleScrollLock",
  "tools-menu-modelLock": "modelLockTitle",
  "tools-menu-cleanup": "cleanup",
  "tools-menu-settings": "tabSettings",
}

const MODEL_LOCK_SITE_LABEL_DEFINITIONS: Record<string, LocalizedLabelDefinition> = {
  gemini: { key: "globalSearchSiteGemini", fallback: "Gemini" },
  "gemini-enterprise": {
    key: "globalSearchSiteGeminiEnterprise",
    fallback: "Gemini Enterprise",
  },
  aistudio: { key: "globalSearchSiteAIStudio", fallback: "AI Studio" },
  chatgpt: { key: "globalSearchSiteChatGPT", fallback: "ChatGPT" },
  claude: { key: "globalSearchSiteClaude", fallback: "Claude" },
  grok: { key: "globalSearchSiteGrok", fallback: "Grok" },
}

const toSearchTitleFallback = (settingId: string): string =>
  settingId
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b([a-z])/g, (_matched, first) => first.toUpperCase())

const hasPromptVariables = (content: string): boolean => /\{\{([^\s{}]+)\}\}/.test(content)

export const GlobalSearchContainer = ({
  isOpen,
  onClose,
  onOpenSettings,
  onPanelOpen,
  adapter,
  outlineManager,
  conversationManager,
  promptManager,
  edgeSnapState,
  onEdgePeek,
  settings,
}: GlobalSearchContainerProps) => {
  const { setSettings } = useSettingsStore()
  const [i18nRenderTick, setI18nRenderTick] = useState(0)
  const [isGlobalSettingsSearchOpen, setIsGlobalSettingsSearchOpen] = useState(false)
  const [activeGlobalSearchCategory, setActiveGlobalSearchCategory] =
    useState<GlobalSearchCategoryId>("all")
  const [settingsSearchInputValue, setSettingsSearchInputValue] = useState("")
  const [settingsSearchQuery, setSettingsSearchQuery] = useState("")
  const [settingsSearchActiveIndex, setSettingsSearchActiveIndex] = useState(0)
  const [settingsSearchHoverLocked, setSettingsSearchHoverLocked] = useState(false)
  const [settingsSearchNavigationMode, setSettingsSearchNavigationMode] = useState<
    "keyboard" | "pointer"
  >("pointer")
  const [expandedGlobalSearchCategories, setExpandedGlobalSearchCategories] = useState<
    Partial<Record<GlobalSearchResultCategory, boolean>>
  >({})
  const [showGlobalSearchShortcutNudge, setShowGlobalSearchShortcutNudge] = useState(false)
  const [globalSearchShortcutNudgeMessage, setGlobalSearchShortcutNudgeMessage] = useState("")
  const [showGlobalSearchSyntaxHelp, setShowGlobalSearchSyntaxHelp] = useState(false)
  const [activeSearchSyntaxSuggestionIndex, setActiveSearchSyntaxSuggestionIndex] = useState(-1)
  const [outlineSearchVersion, setOutlineSearchVersion] = useState(0)

  const settingsSearchInputRef = useRef<HTMLInputElement | null>(null)
  const globalSearchSyntaxHelpTriggerRef = useRef<HTMLButtonElement | null>(null)
  const globalSearchSyntaxHelpPopoverRef = useRef<HTMLDivElement | null>(null)
  const settingsSearchResultsRef = useRef<HTMLDivElement | null>(null)
  const promptPreviewContainerRef = useRef<HTMLDivElement | null>(null)
  const searchInputDebounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const settingsSearchWheelFreezeUntilRef = useRef(0)
  const globalSearchNudgeHideTimerRef = useRef<NodeJS.Timeout | null>(null)
  const globalSearchOpenSourceRef = useRef<GlobalSearchOpenSource>("ui")
  const lastShiftPressedAtRef = useRef(0)
  const settingsSearchRestoreFocusRef = useRef<HTMLElement | null>(null)
  const searchOpenedFromSettingsRef = useRef(false)
  const isGlobalSettingsSearchOpenRef = useRef(isGlobalSettingsSearchOpen)
  const settingsRef = useRef(settings)

  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  const getLocalizedText = useCallback(
    (definition: LocalizedLabelDefinition) => {
      void i18nRenderTick
      const translated = t(definition.key)
      return translated === definition.key ? definition.fallback : translated
    },
    [i18nRenderTick],
  )

  const formatLocalizedText = useCallback(
    (definition: LocalizedLabelDefinition, params: Record<string, string>) => {
      let text = getLocalizedText(definition)
      Object.keys(params).forEach((paramKey) => {
        text = text.replace(new RegExp(`{${paramKey}}`, "g"), params[paramKey])
      })
      return text
    },
    [getLocalizedText],
  )

  const isMacLike = useMemo(() => isLikelyMacPlatform(), [])
  const globalSearchPrimaryBinding = useMemo(() => {
    const userBinding = settings?.shortcuts?.keybindings?.[SHORTCUT_ACTIONS.OPEN_GLOBAL_SEARCH]
    if (userBinding === null) return null
    return userBinding || DEFAULT_KEYBINDINGS[SHORTCUT_ACTIONS.OPEN_GLOBAL_SEARCH]
  }, [settings?.shortcuts?.keybindings])
  const globalSearchPrimaryShortcutLabel = globalSearchPrimaryBinding
    ? formatShortcut(globalSearchPrimaryBinding, isMacLike)
    : ""
  const isDoubleShiftSearchShortcutEnabled =
    settings?.globalSearch?.doubleShift ?? DEFAULT_SETTINGS.globalSearch.doubleShift
  const globalSearchShortcutHintLabel = useMemo(() => {
    const labels: string[] = []
    if (globalSearchPrimaryShortcutLabel) labels.push(globalSearchPrimaryShortcutLabel)
    if (isDoubleShiftSearchShortcutEnabled) labels.push("double shift")
    return labels.join(" / ")
  }, [globalSearchPrimaryShortcutLabel, isDoubleShiftSearchShortcutEnabled])
  const globalSearchOverlayHotkeyLabel =
    globalSearchShortcutHintLabel || t("shortcutNotSet") || "Not set"
  const isGlobalSearchFuzzySearchEnabled =
    settings?.globalSearch?.enableFuzzySearch ?? DEFAULT_SETTINGS.globalSearch.enableFuzzySearch

  const globalSearchShortcutNudgeText = useMemo(() => {
    if (!globalSearchShortcutHintLabel) return ""
    return formatLocalizedText(
      { key: "globalSearchShortcutNudge", fallback: "Press {shortcut} next time to open quickly" },
      { shortcut: globalSearchShortcutHintLabel },
    )
  }, [formatLocalizedText, globalSearchShortcutHintLabel])

  const getGlobalSearchShortcutNudgeState = useCallback((): GlobalSearchShortcutNudgeState => {
    if (typeof window === "undefined") {
      return { shownCount: 0, lastShownAt: 0, dismissed: false, shortcutUsedCount: 0 }
    }
    try {
      const rawValue = window.localStorage.getItem(GLOBAL_SEARCH_SHORTCUT_NUDGE_STORAGE_KEY)
      if (!rawValue) {
        return { shownCount: 0, lastShownAt: 0, dismissed: false, shortcutUsedCount: 0 }
      }
      const parsedValue = JSON.parse(rawValue) as Partial<GlobalSearchShortcutNudgeState>
      return {
        shownCount: Number.isFinite(parsedValue.shownCount)
          ? Math.max(0, Number(parsedValue.shownCount))
          : 0,
        lastShownAt: Number.isFinite(parsedValue.lastShownAt)
          ? Math.max(0, Number(parsedValue.lastShownAt))
          : 0,
        dismissed: Boolean(parsedValue.dismissed),
        shortcutUsedCount: Number.isFinite(parsedValue.shortcutUsedCount)
          ? Math.max(0, Number(parsedValue.shortcutUsedCount))
          : 0,
      }
    } catch {
      return { shownCount: 0, lastShownAt: 0, dismissed: false, shortcutUsedCount: 0 }
    }
  }, [])

  const saveGlobalSearchShortcutNudgeState = useCallback(
    (nextState: GlobalSearchShortcutNudgeState) => {
      if (typeof window === "undefined") return
      try {
        window.localStorage.setItem(
          GLOBAL_SEARCH_SHORTCUT_NUDGE_STORAGE_KEY,
          JSON.stringify(nextState),
        )
      } catch {}
    },
    [],
  )

  const clearGlobalSearchNudgeHideTimer = useCallback(() => {
    if (globalSearchNudgeHideTimerRef.current) {
      clearTimeout(globalSearchNudgeHideTimerRef.current)
      globalSearchNudgeHideTimerRef.current = null
    }
  }, [])

  const handleGlobalSearchPromptPreviewClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.stopPropagation()
      const target = event.target as HTMLElement
      const copyButton = target.closest(".gh-code-copy-btn") as HTMLElement | null
      if (!copyButton) return
      const code = copyButton.nextElementSibling?.textContent || ""
      if (!code) return
      if (!navigator.clipboard?.writeText) {
        showToast(getLocalizedText({ key: "copyFailed", fallback: "Copy failed" }))
        return
      }
      void navigator.clipboard
        .writeText(code)
        .then(() => showCopySuccess(copyButton, { size: 14 }))
        .catch(() => showToast(getLocalizedText({ key: "copyFailed", fallback: "Copy failed" })))
    },
    [getLocalizedText],
  )

  const clearSettingsSearchInputDebounceTimer = useCallback(() => {
    if (!searchInputDebounceTimerRef.current) return
    clearTimeout(searchInputDebounceTimerRef.current)
    searchInputDebounceTimerRef.current = null
  }, [])

  const syncSettingsSearchInputAndQuery = useCallback(
    (nextValue: string) => {
      clearSettingsSearchInputDebounceTimer()
      setSettingsSearchInputValue(nextValue)
      setSettingsSearchQuery(nextValue)
    },
    [clearSettingsSearchInputDebounceTimer],
  )

  const toggleGlobalSearchFuzzySearch = useCallback(() => {
    setSettings({
      globalSearch: {
        ...DEFAULT_SETTINGS.globalSearch,
        ...(settings?.globalSearch || {}),
        enableFuzzySearch: !isGlobalSearchFuzzySearchEnabled,
      },
    })
  }, [isGlobalSearchFuzzySearchEnabled, setSettings, settings?.globalSearch])

  const commitSettingsSearchInputValue = useCallback(
    (nextValue: string) => {
      setSettingsSearchInputValue(nextValue)
      clearSettingsSearchInputDebounceTimer()
      searchInputDebounceTimerRef.current = setTimeout(() => {
        setSettingsSearchQuery(nextValue)
        searchInputDebounceTimerRef.current = null
      }, GLOBAL_SEARCH_INPUT_DEBOUNCE_MS)
    },
    [clearSettingsSearchInputDebounceTimer],
  )

  const hideGlobalSearchShortcutNudge = useCallback(() => {
    clearGlobalSearchNudgeHideTimer()
    setShowGlobalSearchShortcutNudge(false)
    setGlobalSearchShortcutNudgeMessage("")
  }, [clearGlobalSearchNudgeHideTimer])

  const dismissGlobalSearchShortcutNudgeForever = useCallback(() => {
    const currentState = getGlobalSearchShortcutNudgeState()
    saveGlobalSearchShortcutNudgeState({ ...currentState, dismissed: true })
    hideGlobalSearchShortcutNudge()
  }, [
    getGlobalSearchShortcutNudgeState,
    hideGlobalSearchShortcutNudge,
    saveGlobalSearchShortcutNudgeState,
  ])

  const markGlobalSearchShortcutUsed = useCallback(() => {
    const currentState = getGlobalSearchShortcutNudgeState()
    const nextShortcutUsedCount = currentState.shortcutUsedCount + 1
    saveGlobalSearchShortcutNudgeState({
      ...currentState,
      shortcutUsedCount: nextShortcutUsedCount,
      dismissed:
        currentState.dismissed ||
        nextShortcutUsedCount >= GLOBAL_SEARCH_SHORTCUT_NUDGE_AUTO_DISMISS_SHORTCUT_COUNT,
    })
    hideGlobalSearchShortcutNudge()
  }, [
    getGlobalSearchShortcutNudgeState,
    hideGlobalSearchShortcutNudge,
    saveGlobalSearchShortcutNudgeState,
  ])

  const tryShowGlobalSearchShortcutNudge = useCallback(() => {
    if (!globalSearchShortcutNudgeText) return
    const currentState = getGlobalSearchShortcutNudgeState()
    if (currentState.dismissed) return
    if (
      currentState.shortcutUsedCount >= GLOBAL_SEARCH_SHORTCUT_NUDGE_AUTO_DISMISS_SHORTCUT_COUNT
    ) {
      saveGlobalSearchShortcutNudgeState({ ...currentState, dismissed: true })
      return
    }
    if (currentState.shownCount >= GLOBAL_SEARCH_SHORTCUT_NUDGE_MAX_SHOWS) return
    const now = Date.now()
    if (
      currentState.lastShownAt > 0 &&
      now - currentState.lastShownAt < GLOBAL_SEARCH_SHORTCUT_NUDGE_MIN_INTERVAL
    ) {
      return
    }
    saveGlobalSearchShortcutNudgeState({
      ...currentState,
      shownCount: currentState.shownCount + 1,
      lastShownAt: now,
    })
    setGlobalSearchShortcutNudgeMessage(globalSearchShortcutNudgeText)
    setShowGlobalSearchShortcutNudge(true)
    clearGlobalSearchNudgeHideTimer()
    globalSearchNudgeHideTimerRef.current = setTimeout(() => {
      setShowGlobalSearchShortcutNudge(false)
      setGlobalSearchShortcutNudgeMessage("")
      globalSearchNudgeHideTimerRef.current = null
    }, GLOBAL_SEARCH_SHORTCUT_NUDGE_AUTO_HIDE_MS)
  }, [
    clearGlobalSearchNudgeHideTimer,
    getGlobalSearchShortcutNudgeState,
    globalSearchShortcutNudgeText,
    saveGlobalSearchShortcutNudgeState,
  ])

  const getPageLabel = useCallback(
    (page: string) => {
      const definition = SETTINGS_PAGE_LABEL_DEFINITIONS[page]
      if (!definition) return page
      return getLocalizedText(definition)
    },
    [getLocalizedText],
  )

  const getSubTabLabel = useCallback(
    (subTab: string) => {
      const definition = SETTINGS_SUB_TAB_LABEL_DEFINITIONS[subTab]
      if (!definition) return subTab
      return getLocalizedText(definition)
    },
    [getLocalizedText],
  )

  const resolveSettingSearchTitle = useCallback(
    (item: SettingsSearchItem): string => {
      const titleKey = SETTING_SEARCH_TITLE_KEY_MAP[item.settingId]
      if (titleKey) {
        return getLocalizedText({ key: titleKey, fallback: toSearchTitleFallback(item.settingId) })
      }
      if (item.settingId.startsWith("model-lock-")) {
        const siteKey = item.settingId.slice("model-lock-".length)
        const siteLabelDefinition = MODEL_LOCK_SITE_LABEL_DEFINITIONS[siteKey]
        if (siteLabelDefinition) {
          const modelLockLabel = getLocalizedText({ key: "tabModelLock", fallback: "Model Lock" })
          const siteLabel = getLocalizedText(siteLabelDefinition)
          return `${modelLockLabel}: ${siteLabel}`
        }
      }
      if (item.settingId.startsWith("shortcut-binding-")) {
        const actionId = item.settingId.slice("shortcut-binding-".length)
        const shortcutMeta = SHORTCUT_META[actionId as keyof typeof SHORTCUT_META]
        if (shortcutMeta) {
          const shortcutsLabel = getLocalizedText({
            key: "navShortcuts",
            fallback: "Keyboard Shortcuts",
          })
          const actionLabel = getLocalizedText({
            key: shortcutMeta.labelKey,
            fallback: shortcutMeta.label,
          })
          return `${shortcutsLabel}: ${actionLabel}`
        }
      }
      return toSearchTitleFallback(item.settingId)
    },
    [getLocalizedText],
  )

  const getSettingsBreadcrumb = useCallback(
    (settingId: string): string => {
      const route = resolveSettingRoute(settingId)
      if (!route) {
        return getLocalizedText({ key: "globalSearchCategorySettings", fallback: "Settings" })
      }
      const pageLabel = getPageLabel(route.page)
      if (!route.subTab) return pageLabel
      return `${pageLabel} / ${getSubTabLabel(route.subTab)}`
    },
    [getLocalizedText, getPageLabel, getSubTabLabel],
  )

  const conversationsSnapshot = useConversationsStore((state) => state.conversations)
  const foldersSnapshot = useFoldersStore((state) => state.folders)
  const tagsSnapshot = useTagsStore((state) => state.tags)
  const promptsSnapshot = usePromptsStore((state) => state.prompts)

  const parsedGlobalSearchQuery = useMemo(
    () => parseGlobalSearchQuery(settingsSearchQuery),
    [settingsSearchQuery],
  )
  const activeGlobalSearchSyntaxFilters = useMemo(
    () => parsedGlobalSearchQuery.filters,
    [parsedGlobalSearchQuery.filters],
  )
  const activeGlobalSearchSyntaxDiagnostics = useMemo(
    () => parsedGlobalSearchQuery.diagnostics,
    [parsedGlobalSearchQuery.diagnostics],
  )
  const activeGlobalSearchPlainQuery = useMemo(
    () => parsedGlobalSearchQuery.plainQuery,
    [parsedGlobalSearchQuery.plainQuery],
  )
  const settingsSearchResults = useMemo(() => searchSettingsItems(""), [])

  useEffect(() => {
    if (!outlineManager || !isGlobalSettingsSearchOpen) return
    const syncOutlineForSearch = () => {
      outlineManager.refresh()
      setOutlineSearchVersion((previousVersion) => previousVersion + 1)
    }
    syncOutlineForSearch()
    const unsubscribe = outlineManager.subscribe(() => {
      setOutlineSearchVersion((previousVersion) => previousVersion + 1)
    })
    const pollingId = window.setInterval(() => {
      syncOutlineForSearch()
    }, 1200)
    return () => {
      unsubscribe()
      window.clearInterval(pollingId)
    }
  }, [isGlobalSettingsSearchOpen, outlineManager])

  const settingsSearchHighlightTokens = useMemo(
    () =>
      Array.from(new Set(toGlobalSearchTokens(activeGlobalSearchPlainQuery))).sort(
        (left, right) => right.length - left.length,
      ),
    [activeGlobalSearchPlainQuery],
  )

  const {
    filteredGlobalSearchResults,
    globalSearchResultCounts,
    groupedGlobalSearchResults,
    visibleGlobalSearchResults,
  } = useGlobalSearchData({
    activeGlobalSearchPlainQuery,
    enableFuzzySearch: isGlobalSearchFuzzySearchEnabled,
    activeGlobalSearchSyntaxFilters,
    settingsSearchResults,
    resolveSettingSearchTitle,
    getSettingsBreadcrumb,
    conversationManager,
    conversationsSnapshot,
    foldersSnapshot,
    tagsSnapshot,
    promptsSnapshot,
    outlineManager,
    outlineSearchVersion,
    getLocalizedText,
    activeGlobalSearchCategory,
    expandedGlobalSearchCategories,
    allCategoryItemLimit: GLOBAL_SEARCH_ALL_CATEGORY_ITEM_LIMIT,
  })

  const visibleSearchResultIndexMap = useMemo(() => {
    const map = new Map<string, number>()
    visibleGlobalSearchResults.forEach((item, index) => {
      map.set(item.id, index)
    })
    return map
  }, [visibleGlobalSearchResults])

  const activeVisibleGlobalSearchIndex = useMemo(() => {
    if (visibleGlobalSearchResults.length === 0) return -1
    return Math.min(settingsSearchActiveIndex, visibleGlobalSearchResults.length - 1)
  }, [settingsSearchActiveIndex, visibleGlobalSearchResults.length])

  const activeGlobalSearchOptionId =
    activeVisibleGlobalSearchIndex >= 0
      ? `${GLOBAL_SEARCH_OPTION_ID_PREFIX}-${activeVisibleGlobalSearchIndex}`
      : undefined

  const activeGlobalSearchCategoryDefinition = useMemo(
    () =>
      GLOBAL_SEARCH_CATEGORY_DEFINITIONS.find(
        (category) => category.id === activeGlobalSearchCategory,
      ) || GLOBAL_SEARCH_CATEGORY_DEFINITIONS[0],
    [activeGlobalSearchCategory],
  )

  const resolvedActiveGlobalSearchCategoryText = useMemo(
    () => ({
      label: getLocalizedText(activeGlobalSearchCategoryDefinition.label),
      placeholder: getLocalizedText(activeGlobalSearchCategoryDefinition.placeholder),
      emptyText: getLocalizedText(activeGlobalSearchCategoryDefinition.emptyText),
    }),
    [activeGlobalSearchCategoryDefinition, getLocalizedText],
  )

  const resolvedGlobalSearchCategoryLabels = useMemo(
    () =>
      GLOBAL_SEARCH_CATEGORY_DEFINITIONS.reduce(
        (collector, category) => {
          collector[category.id] = getLocalizedText(category.label)
          return collector
        },
        {} as Record<GlobalSearchCategoryId, string>,
      ),
    [getLocalizedText],
  )

  const resolvedGlobalSearchResultCategoryLabels = useMemo(
    () =>
      (
        Object.entries(GLOBAL_SEARCH_RESULT_CATEGORY_LABELS) as [
          GlobalSearchResultCategory,
          LocalizedLabelDefinition,
        ][]
      ).reduce(
        (collector, [category, definition]) => {
          collector[category] = getLocalizedText(definition)
          return collector
        },
        {} as Record<GlobalSearchResultCategory, string>,
      ),
    [getLocalizedText],
  )

  const resolvedGlobalSearchMatchReasonLabels = useMemo(
    () =>
      (
        Object.entries(GLOBAL_SEARCH_MATCH_REASON_LABEL_DEFINITIONS) as [
          GlobalSearchMatchReason,
          LocalizedLabelDefinition,
        ][]
      ).reduce(
        (collector, [reason, definition]) => {
          collector[reason] = getLocalizedText(definition)
          return collector
        },
        {} as Record<GlobalSearchMatchReason, string>,
      ),
    [getLocalizedText],
  )

  const {
    activeGlobalSearchFilterChips,
    hasOverflowGlobalSearchFilterChips,
    globalSearchSyntaxDiagnosticMessages,
    globalSearchSyntaxHelpTitle,
    globalSearchSyntaxHelpDescription,
    globalSearchSyntaxHelpItems,
    globalSearchSyntaxSuggestions,
    shouldShowGlobalSearchSyntaxSuggestions,
  } = useGlobalSearchSyntax({
    getLocalizedText,
    activeGlobalSearchSyntaxFilters,
    filterChipMaxCount: GLOBAL_SEARCH_FILTER_CHIP_MAX_COUNT,
    isGlobalSettingsSearchOpen,
    settingsSearchInputValue,
    filteredGlobalSearchResults,
    suggestionLimit: GLOBAL_SEARCH_SYNTAX_SUGGESTION_LIMIT,
  })

  const globalSearchListboxLabel = useMemo(
    () => getLocalizedText({ key: "globalSearchResultsLabel", fallback: "Global search results" }),
    [getLocalizedText],
  )

  const applyGlobalSearchSyntaxSuggestion = useCallback(
    (suggestion: GlobalSearchSyntaxSuggestionItem) => {
      const trailingTokenInfo = getGlobalSearchTrailingTokenInfo(settingsSearchInputValue)
      const shouldAppendTrailingSpace = !suggestion.token.endsWith(":")
      const nextToken = `${suggestion.token}${shouldAppendTrailingSpace ? " " : ""}`
      const nextValue = trailingTokenInfo
        ? `${settingsSearchInputValue.slice(0, trailingTokenInfo.start)}${nextToken}`
        : `${settingsSearchInputValue}${settingsSearchInputValue.endsWith(" ") ? "" : " "}${nextToken}`
      syncSettingsSearchInputAndQuery(nextValue)
      setActiveSearchSyntaxSuggestionIndex(-1)
      setSettingsSearchActiveIndex(0)
      window.requestAnimationFrame(() => {
        const inputElement = settingsSearchInputRef.current
        if (!inputElement) return
        const cursorPosition = nextValue.length
        inputElement.focus({ preventScroll: true })
        inputElement.setSelectionRange(cursorPosition, cursorPosition)
      })
    },
    [settingsSearchInputValue, syncSettingsSearchInputAndQuery],
  )

  const applyGlobalSearchSyntaxHelpItem = useCallback(
    (item: GlobalSearchSyntaxSuggestionItem) => {
      applyGlobalSearchSyntaxSuggestion(item)
      setShowGlobalSearchSyntaxHelp(false)
    },
    [applyGlobalSearchSyntaxSuggestion],
  )

  const handleRemoveGlobalSearchFilterChip = useCallback(
    (chipId: string) => {
      const nextFilters = activeGlobalSearchSyntaxFilters.filter((filter) => filter.id !== chipId)
      const nextQuery = stringifyGlobalSearchQuery({
        plainQuery: activeGlobalSearchPlainQuery,
        filters: nextFilters,
      })
      syncSettingsSearchInputAndQuery(nextQuery)
      setActiveSearchSyntaxSuggestionIndex(-1)
      setSettingsSearchActiveIndex(0)
    },
    [
      activeGlobalSearchPlainQuery,
      activeGlobalSearchSyntaxFilters,
      syncSettingsSearchInputAndQuery,
    ],
  )

  const clearAllGlobalSearchSyntaxFilters = useCallback(() => {
    syncSettingsSearchInputAndQuery(activeGlobalSearchPlainQuery)
    setActiveSearchSyntaxSuggestionIndex(-1)
    setSettingsSearchActiveIndex(0)
  }, [activeGlobalSearchPlainQuery, syncSettingsSearchInputAndQuery])

  const activeGlobalSearchContext = useMemo(() => {
    if (activeVisibleGlobalSearchIndex < 0) return null
    const activeItem = visibleGlobalSearchResults[activeVisibleGlobalSearchIndex]
    if (!activeItem) return null
    const label = resolvedGlobalSearchResultCategoryLabels[activeItem.category]
    const currentItemText = formatLocalizedText(
      { key: "globalSearchContextCurrentItem", fallback: "Item {current}" },
      { current: String(activeVisibleGlobalSearchIndex + 1) },
    )
    if (activeGlobalSearchCategory !== "all") {
      return {
        label,
        meta: `${currentItemText} · ${formatLocalizedText(
          { key: "globalSearchContextTotalItems", fallback: " {total} " },
          { total: String(visibleGlobalSearchResults.length) },
        )}`,
      }
    }
    const activeGroup = groupedGlobalSearchResults.find(
      (group) => group.category === activeItem.category,
    )
    if (!activeGroup) {
      return {
        label,
        meta: `${currentItemText} · ${formatLocalizedText(
          { key: "globalSearchContextTotalItems", fallback: " {total} " },
          { total: String(visibleGlobalSearchResults.length) },
        )}`,
      }
    }
    return {
      label,
      meta: `${currentItemText} · ${formatLocalizedText(
        { key: "globalSearchContextShownProgress", fallback: "Showing {shown}/{total}" },
        { shown: String(activeGroup.items.length), total: String(activeGroup.totalCount) },
      )}`,
    }
  }, [
    activeGlobalSearchCategory,
    activeVisibleGlobalSearchIndex,
    formatLocalizedText,
    groupedGlobalSearchResults,
    resolvedGlobalSearchResultCategoryLabels,
    visibleGlobalSearchResults,
  ])

  const {
    globalSearchPromptPreview,
    globalSearchPromptPreviewPosition,
    clearPromptPreviewTimer,
    clearPromptPreviewHideTimer,
    hideGlobalSearchPromptPreview,
    scheduleHideGlobalSearchPromptPreview,
    scheduleGlobalSearchPromptPreview,
    scheduleGlobalSearchPointerPreview,
    refreshGlobalSearchPromptPreviewAnchorRect,
  } = useGlobalSearchPreview({
    settingsSearchResultsRef,
    pointerDelayMs: GLOBAL_SEARCH_PROMPT_PREVIEW_POINTER_DELAY_MS,
    hideDelayMs: GLOBAL_SEARCH_PROMPT_PREVIEW_HIDE_DELAY_MS,
  })

  const openGlobalSettingsSearch = useCallback(
    (source: GlobalSearchOpenSource = "ui") => {
      globalSearchOpenSourceRef.current = source
      if (edgeSnapState && settingsRef.current?.panel?.edgeSnap) {
        onEdgePeek(true)
      }
      const activeElement = document.activeElement
      if (activeElement instanceof HTMLElement && activeElement !== document.body) {
        settingsSearchRestoreFocusRef.current = activeElement
      } else {
        settingsSearchRestoreFocusRef.current = null
      }
      clearSettingsSearchInputDebounceTimer()
      setSettingsSearchInputValue("")
      setSettingsSearchQuery("")
      setShowGlobalSearchSyntaxHelp(false)
      setActiveSearchSyntaxSuggestionIndex(-1)
      setActiveGlobalSearchCategory("all")
      setSettingsSearchActiveIndex(0)
      setSettingsSearchHoverLocked(false)
      setSettingsSearchNavigationMode("pointer")
      setExpandedGlobalSearchCategories({})
      settingsSearchWheelFreezeUntilRef.current = 0
      setIsGlobalSettingsSearchOpen(true)
    },
    [clearSettingsSearchInputDebounceTimer, edgeSnapState, onEdgePeek],
  )

  const closeGlobalSettingsSearch = useCallback(
    (options?: { restoreFocus?: boolean; reopenSettings?: boolean }) => {
      const shouldRestoreFocus = options?.restoreFocus ?? true
      const shouldReopenSettings = options?.reopenSettings ?? false
      const restoreElement = settingsSearchRestoreFocusRef.current
      settingsSearchRestoreFocusRef.current = null
      searchOpenedFromSettingsRef.current = false
      clearSettingsSearchInputDebounceTimer()
      setIsGlobalSettingsSearchOpen(false)
      setActiveGlobalSearchCategory("all")
      setSettingsSearchInputValue("")
      setSettingsSearchQuery("")
      setShowGlobalSearchSyntaxHelp(false)
      setActiveSearchSyntaxSuggestionIndex(-1)
      setSettingsSearchActiveIndex(0)
      setSettingsSearchHoverLocked(false)
      setSettingsSearchNavigationMode("pointer")
      setExpandedGlobalSearchCategories({})
      settingsSearchWheelFreezeUntilRef.current = 0
      onClose()
      if (shouldReopenSettings) {
        onOpenSettings()
        return
      }
      if (!shouldRestoreFocus || !restoreElement || !restoreElement.isConnected) {
        return
      }
      window.requestAnimationFrame(() => {
        if (!restoreElement.isConnected) return
        try {
          restoreElement.focus({ preventScroll: true })
        } catch {
          restoreElement.focus()
        }
      })
    },
    [clearSettingsSearchInputDebounceTimer, onClose, onOpenSettings],
  )

  const navigateToSearchResult = useCallback(
    (item: GlobalSearchResultItem) => {
      closeGlobalSettingsSearch({ restoreFocus: false })
      if (item.category === "settings" && item.settingId) {
        window.dispatchEvent(
          new CustomEvent("ophel:navigateSettingsPage", { detail: { settingId: item.settingId } }),
        )
        return
      }
      if (item.category === "outline" && item.outlineTarget && outlineManager) {
        const findOutlineNodeByIndex = (
          nodes: OutlineNode[],
          targetIndex: number,
        ): OutlineNode | null => {
          for (const node of nodes) {
            if (node.index === targetIndex) return node
            if (node.children && node.children.length > 0) {
              const found = findOutlineNodeByIndex(node.children, targetIndex)
              if (found) return found
            }
          }
          return null
        }
        const targetNode = findOutlineNodeByIndex(
          outlineManager.getTree(),
          item.outlineTarget.index,
        )
        let targetElement = targetNode?.element || null
        if (!targetElement || !targetElement.isConnected) {
          if (item.outlineTarget.isUserQuery && item.outlineTarget.queryIndex) {
            const found = outlineManager.findUserQueryElement(
              item.outlineTarget.queryIndex,
              item.outlineTarget.text,
            )
            if (found) targetElement = found
          } else {
            const found = outlineManager.findElementByHeading(
              item.outlineTarget.level,
              item.outlineTarget.text,
            )
            if (found) targetElement = found
          }
        }
        if (targetElement && targetElement.isConnected) {
          targetElement.scrollIntoView({
            behavior: "instant",
            block: "start",
            __bypassLock: true,
          } as ScrollIntoViewOptions & { __bypassLock?: boolean })
          targetElement.classList.add("outline-highlight")
          setTimeout(() => targetElement?.classList.remove("outline-highlight"), 2000)
          return
        }
        if (item.outlineTarget.isGhost && item.outlineTarget.scrollTop !== undefined) {
          const scrollContainer = outlineManager.getScrollContainer()
          if (scrollContainer) {
            scrollContainer.scrollTo({ top: item.outlineTarget.scrollTop, behavior: "smooth" })
            showToast(t("bookmarkContentMissing") || "", 3000)
            return
          }
        }
        showToast(t("bookmarkContentMissing") || "", 2000)
        return
      }
      if (item.category === "prompts" && item.promptId) {
        const targetPrompt = promptsSnapshot.find((prompt) => prompt.id === item.promptId)
        if (!targetPrompt) return
        const openPromptsTab = () => {
          onPanelOpen()
          const tabOrder = settings?.features?.order || DEFAULT_SETTINGS.features.order
          const promptsTabIndex = tabOrder.indexOf(TAB_IDS.PROMPTS)
          if (promptsTabIndex >= 0) {
            window.dispatchEvent(
              new CustomEvent("ophel:switchTab", { detail: { index: promptsTabIndex } }),
            )
          }
        }
        const locatePrompt = () => {
          openPromptsTab()
          const pendingDetail = { promptId: targetPrompt.id }
          const ophelWindow = window as Window & {
            __ophelPendingLocatePrompt?: typeof pendingDetail | null
          }
          ophelWindow.__ophelPendingLocatePrompt = pendingDetail
          window.dispatchEvent(new CustomEvent("ophel:locatePrompt", { detail: pendingDetail }))
        }
        const promptEnterBehavior = settings?.globalSearch?.promptEnterBehavior ?? "smart"
        if (promptEnterBehavior === "locate") {
          locatePrompt()
          return
        }
        if (!promptManager) {
          openPromptsTab()
          return
        }
        if (hasPromptVariables(targetPrompt.content)) {
          openPromptsTab()
          const pendingDetail = { promptId: targetPrompt.id, submitAfterInsert: false }
          const ophelWindow = window as Window & {
            __ophelPendingPromptVariableDialog?: typeof pendingDetail | null
          }
          ophelWindow.__ophelPendingPromptVariableDialog = pendingDetail
          window.dispatchEvent(
            new CustomEvent("ophel:openPromptVariableDialog", { detail: pendingDetail }),
          )
          return
        }
        void (async () => {
          const inserted = await promptManager.insertPrompt(targetPrompt.content)
          if (inserted) {
            promptManager.updateLastUsed(targetPrompt.id)
            showToast(`${t("inserted") || ""}: ${targetPrompt.title}`)
            return
          }
          locatePrompt()
          showToast(t("insertFailed") || "")
        })()
        return
      }
      if (item.category === "conversations" && item.conversationId) {
        adapter?.navigateToConversation(item.conversationId, item.conversationUrl)
      }
    },
    [
      adapter,
      closeGlobalSettingsSearch,
      onPanelOpen,
      outlineManager,
      promptManager,
      promptsSnapshot,
      settings,
    ],
  )

  const handleToggleGlobalSearchGroup = useCallback((category: GlobalSearchResultCategory) => {
    setSettingsSearchNavigationMode("pointer")
    setExpandedGlobalSearchCategories((prev) => ({ ...prev, [category]: !prev[category] }))
  }, [])

  const outlineRoleLabels = useMemo(
    () => ({
      query: getLocalizedText({ key: "outlineOnlyUserQueries", fallback: "Query" }),
      reply: getLocalizedText({ key: "globalSearchOutlineReplies", fallback: "Replies" }),
    }),
    [getLocalizedText],
  )

  const renderSearchResultItem = (item: GlobalSearchResultItem, index: number) => (
    <GlobalSearchResultItemView
      key={item.id}
      item={item}
      index={index}
      optionIdPrefix={GLOBAL_SEARCH_OPTION_ID_PREFIX}
      isActive={index === settingsSearchActiveIndex}
      highlightTokens={settingsSearchHighlightTokens}
      outlineRoleLabels={outlineRoleLabels}
      matchReasonLabels={resolvedGlobalSearchMatchReasonLabels}
      onMouseMove={() => {
        setSettingsSearchNavigationMode("pointer")
        if (Date.now() < settingsSearchWheelFreezeUntilRef.current) return
        if (settingsSearchHoverLocked) {
          setSettingsSearchHoverLocked(false)
          return
        }
        setSettingsSearchActiveIndex(index)
      }}
      onMouseEnter={(event) => {
        setSettingsSearchNavigationMode("pointer")
        scheduleGlobalSearchPointerPreview({ item, anchorElement: event.currentTarget })
      }}
      onMouseLeave={() => {
        scheduleHideGlobalSearchPromptPreview()
      }}
      onClick={() => navigateToSearchResult(item)}
    />
  )

  useEffect(() => {
    if (isOpen) {
      openGlobalSettingsSearch("ui")
      return
    }
    if (isGlobalSettingsSearchOpen) {
      closeGlobalSettingsSearch({ restoreFocus: false })
    }
  }, [closeGlobalSettingsSearch, isGlobalSettingsSearchOpen, isOpen, openGlobalSettingsSearch])

  useEffect(() => {
    if (!isGlobalSettingsSearchOpen) return
    settingsSearchInputRef.current?.focus()
    settingsSearchInputRef.current?.select()
  }, [isGlobalSettingsSearchOpen])

  useEffect(() => {
    if (!isGlobalSettingsSearchOpen) return
    if (globalSearchOpenSourceRef.current !== "ui") return
    tryShowGlobalSearchShortcutNudge()
  }, [isGlobalSettingsSearchOpen, tryShowGlobalSearchShortcutNudge])

  useEffect(() => {
    return () => {
      clearGlobalSearchNudgeHideTimer()
    }
  }, [clearGlobalSearchNudgeHideTimer])

  useEffect(() => {
    isGlobalSettingsSearchOpenRef.current = isGlobalSettingsSearchOpen
  }, [isGlobalSettingsSearchOpen])

  useEffect(() => {
    const handleOpenSearchShortcut = (event: KeyboardEvent) => {
      if (isGlobalSettingsSearchOpenRef.current) return
      if (event.key !== "Shift") {
        lastShiftPressedAtRef.current = 0
      }
      if (event.key !== "Shift" || event.repeat || event.ctrlKey || event.metaKey || event.altKey) {
        return
      }
      const now = Date.now()
      const isDoubleShiftEnabled =
        settingsRef.current?.globalSearch?.doubleShift ?? DEFAULT_SETTINGS.globalSearch.doubleShift
      if (isDoubleShiftEnabled && now - lastShiftPressedAtRef.current <= 360) {
        event.preventDefault()
        event.stopPropagation()
        lastShiftPressedAtRef.current = 0
        markGlobalSearchShortcutUsed()
        openGlobalSettingsSearch("shortcut")
        return
      }
      lastShiftPressedAtRef.current = now
    }
    window.addEventListener("keydown", handleOpenSearchShortcut, true)
    return () => {
      window.removeEventListener("keydown", handleOpenSearchShortcut, true)
    }
  }, [markGlobalSearchShortcutUsed, openGlobalSettingsSearch])

  useEffect(() => {
    const handleOpenSearchEvent = () => {
      openGlobalSettingsSearch("event")
    }
    window.addEventListener("ophel:openSettingsSearch", handleOpenSearchEvent)
    return () => {
      window.removeEventListener("ophel:openSettingsSearch", handleOpenSearchEvent)
    }
  }, [openGlobalSettingsSearch])

  useEffect(
    () => () => {
      clearSettingsSearchInputDebounceTimer()
    },
    [clearSettingsSearchInputDebounceTimer],
  )

  useEffect(() => {
    if (!isGlobalSettingsSearchOpen || !showGlobalSearchSyntaxHelp) return
    const handleOutsidePress = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (globalSearchSyntaxHelpTriggerRef.current?.contains(target)) return
      if (globalSearchSyntaxHelpPopoverRef.current?.contains(target)) return
      setShowGlobalSearchSyntaxHelp(false)
    }
    document.addEventListener("mousedown", handleOutsidePress, true)
    return () => {
      document.removeEventListener("mousedown", handleOutsidePress, true)
    }
  }, [isGlobalSettingsSearchOpen, showGlobalSearchSyntaxHelp])

  useEffect(() => {
    if (!isGlobalSettingsSearchOpen) {
      hideGlobalSearchPromptPreview()
      return
    }
    if (settingsSearchNavigationMode !== "keyboard") return
    const activeItem = visibleGlobalSearchResults[settingsSearchActiveIndex]
    if (!activeItem || activeItem.category !== "prompts") {
      hideGlobalSearchPromptPreview()
      return
    }
    const container = settingsSearchResultsRef.current
    if (!container) return
    const anchorElement = container.querySelector<HTMLElement>(
      `[data-global-search-index="${settingsSearchActiveIndex}"]`,
    )
    if (!anchorElement) return
    scheduleGlobalSearchPromptPreview({
      item: activeItem,
      anchorElement,
      delay: GLOBAL_SEARCH_PROMPT_PREVIEW_KEYBOARD_DELAY_MS,
      source: "keyboard",
    })
  }, [
    hideGlobalSearchPromptPreview,
    isGlobalSettingsSearchOpen,
    scheduleGlobalSearchPromptPreview,
    settingsSearchActiveIndex,
    settingsSearchNavigationMode,
    visibleGlobalSearchResults,
  ])

  useEffect(() => {
    setSettingsSearchActiveIndex(0)
    setSettingsSearchHoverLocked(false)
    setSettingsSearchNavigationMode("pointer")
    setExpandedGlobalSearchCategories({})
    settingsSearchWheelFreezeUntilRef.current = 0
    hideGlobalSearchPromptPreview()
  }, [activeGlobalSearchCategory, hideGlobalSearchPromptPreview, settingsSearchQuery])

  useEffect(() => {
    if (!isGlobalSettingsSearchOpen) {
      hideGlobalSearchPromptPreview()
    }
  }, [hideGlobalSearchPromptPreview, isGlobalSettingsSearchOpen])

  useEffect(() => {
    if (!globalSearchPromptPreview || !promptPreviewContainerRef.current) return
    initCopyButtons(promptPreviewContainerRef.current, { size: 14 })
  }, [globalSearchPromptPreview])

  useEffect(() => {
    if (!isGlobalSettingsSearchOpen || !globalSearchPromptPreview) return
    const handlePositionUpdate = () => {
      refreshGlobalSearchPromptPreviewAnchorRect()
    }
    const resultContainer = settingsSearchResultsRef.current
    window.addEventListener("resize", handlePositionUpdate)
    window.addEventListener("scroll", handlePositionUpdate, true)
    resultContainer?.addEventListener("scroll", handlePositionUpdate)
    return () => {
      window.removeEventListener("resize", handlePositionUpdate)
      window.removeEventListener("scroll", handlePositionUpdate, true)
      resultContainer?.removeEventListener("scroll", handlePositionUpdate)
    }
  }, [
    globalSearchPromptPreview,
    isGlobalSettingsSearchOpen,
    refreshGlobalSearchPromptPreviewAnchorRect,
  ])

  useEffect(() => {
    return () => {
      clearPromptPreviewTimer()
      clearPromptPreviewHideTimer()
    }
  }, [clearPromptPreviewHideTimer, clearPromptPreviewTimer])

  useGlobalSearchKeyboard({
    isGlobalSettingsSearchOpen,
    showGlobalSearchSyntaxHelp,
    setShowGlobalSearchSyntaxHelp,
    activeGlobalSearchCategory,
    categoryIds: GLOBAL_SEARCH_CATEGORY_DEFINITIONS.map((category) => category.id),
    setActiveGlobalSearchCategory,
    settingsSearchActiveIndex,
    setSettingsSearchActiveIndex,
    settingsSearchNavigationMode,
    setSettingsSearchNavigationMode,
    setSettingsSearchHoverLocked,
    shouldShowGlobalSearchSyntaxSuggestions,
    globalSearchSyntaxSuggestions,
    activeSearchSyntaxSuggestionIndex,
    setActiveSearchSyntaxSuggestionIndex,
    applyGlobalSearchSyntaxSuggestion,
    visibleGlobalSearchResults,
    navigateToSearchResult,
    closeGlobalSettingsSearch,
    getShouldReturnToSettingsOnEscape: () => searchOpenedFromSettingsRef.current,
    settingsSearchResultsRef,
    keyboardSafeTop: GLOBAL_SEARCH_KEYBOARD_SAFE_TOP,
    keyboardSafeBottom: GLOBAL_SEARCH_KEYBOARD_SAFE_BOTTOM,
  })

  useEffect(() => {
    if (settings?.language) {
      setLanguage(settings.language)
      setI18nRenderTick((prev) => prev + 1)
    }
  }, [settings?.language])

  return (
    <GlobalSearchOverlay
      isOpen={isGlobalSettingsSearchOpen}
      onClose={() => {
        hideGlobalSearchPromptPreview()
        closeGlobalSettingsSearch()
      }}
      inputRef={settingsSearchInputRef}
      resultsRef={settingsSearchResultsRef}
      activeOptionId={activeGlobalSearchOptionId}
      inputValue={settingsSearchInputValue}
      inputPlaceholder={
        globalSearchPrimaryShortcutLabel
          ? `${resolvedActiveGlobalSearchCategoryText.placeholder}${globalSearchPrimaryShortcutLabel}`
          : resolvedActiveGlobalSearchCategoryText.placeholder
      }
      onInputChange={(nextValue) => {
        commitSettingsSearchInputValue(nextValue)
        setActiveSearchSyntaxSuggestionIndex(-1)
        setSettingsSearchActiveIndex(0)
      }}
      hotkeyLabel={globalSearchOverlayHotkeyLabel}
      fuzzySearchToggleLabel={getLocalizedText({
        key: "globalSearchFuzzySearchToggle",
        fallback: "Fuzzy",
      })}
      fuzzySearchToggleAriaLabel={getLocalizedText({
        key: "globalSearchFuzzySearchToggleAria",
        fallback: "Toggle fuzzy search",
      })}
      isFuzzySearchEnabled={isGlobalSearchFuzzySearchEnabled}
      onToggleFuzzySearch={toggleGlobalSearchFuzzySearch}
      syntaxHelpTriggerRef={globalSearchSyntaxHelpTriggerRef}
      syntaxHelpPopoverRef={globalSearchSyntaxHelpPopoverRef}
      showSyntaxHelp={showGlobalSearchSyntaxHelp}
      onToggleSyntaxHelp={() => setShowGlobalSearchSyntaxHelp((previous) => !previous)}
      syntaxHelpTriggerAriaLabel={getLocalizedText({
        key: "globalSearchSyntaxHelpTriggerAria",
        fallback: "Open search syntax help",
      })}
      syntaxHelpTitle={globalSearchSyntaxHelpTitle}
      syntaxHelpDescription={globalSearchSyntaxHelpDescription}
      syntaxHelpItems={globalSearchSyntaxHelpItems}
      onApplySyntaxHelpItem={applyGlobalSearchSyntaxHelpItem}
      activeFilterChips={activeGlobalSearchFilterChips}
      hasOverflowFilterChips={hasOverflowGlobalSearchFilterChips}
      overflowFilterChipText={formatLocalizedText(
        { key: "globalSearchSyntaxChipOverflow", fallback: "+{count} more" },
        {
          count: String(
            activeGlobalSearchSyntaxFilters.length - GLOBAL_SEARCH_FILTER_CHIP_MAX_COUNT,
          ),
        },
      )}
      filterChipRemoveTitle={getLocalizedText({
        key: "globalSearchSyntaxChipRemove",
        fallback: "Click to remove filter",
      })}
      clearFiltersLabel={getLocalizedText({ key: "clear", fallback: "Clear" })}
      onRemoveFilterChip={handleRemoveGlobalSearchFilterChip}
      onClearAllFilterChips={clearAllGlobalSearchSyntaxFilters}
      shouldShowSyntaxSuggestions={shouldShowGlobalSearchSyntaxSuggestions}
      syntaxSuggestions={globalSearchSyntaxSuggestions}
      activeSyntaxSuggestionIndex={activeSearchSyntaxSuggestionIndex}
      onHoverSyntaxSuggestion={setActiveSearchSyntaxSuggestionIndex}
      onApplySyntaxSuggestion={applyGlobalSearchSyntaxSuggestion}
      syntaxDiagnostics={activeGlobalSearchSyntaxDiagnostics}
      resolveSyntaxDiagnosticTitle={(code) =>
        globalSearchSyntaxDiagnosticMessages[
          code as keyof typeof globalSearchSyntaxDiagnosticMessages
        ] || globalSearchSyntaxDiagnosticMessages.invalidValue
      }
      showShortcutNudge={showGlobalSearchShortcutNudge}
      shortcutNudgeMessage={globalSearchShortcutNudgeMessage}
      closeLabel={getLocalizedText({ key: "close", fallback: "Close" })}
      dismissShortcutNudgeLabel={getLocalizedText({
        key: "globalSearchShortcutNudgeDismiss",
        fallback: "Don't remind me",
      })}
      onHideShortcutNudge={hideGlobalSearchShortcutNudge}
      onDismissShortcutNudgeForever={dismissGlobalSearchShortcutNudgeForever}
      categoriesLabel={getLocalizedText({
        key: "globalSearchCategoriesLabel",
        fallback: "Global search categories",
      })}
      categories={GLOBAL_SEARCH_CATEGORY_DEFINITIONS.map((category) => ({
        id: category.id,
        label: resolvedGlobalSearchCategoryLabels[category.id],
        count: globalSearchResultCounts[category.id],
      }))}
      activeCategoryId={activeGlobalSearchCategory}
      onSelectCategory={(categoryId) => {
        setActiveGlobalSearchCategory(categoryId)
        setSettingsSearchActiveIndex(0)
      }}
      activeContext={activeGlobalSearchContext}
      listboxId={GLOBAL_SEARCH_RESULTS_LISTBOX_ID}
      listboxLabel={globalSearchListboxLabel}
      onResultsWheel={() => {
        setSettingsSearchNavigationMode("pointer")
        settingsSearchWheelFreezeUntilRef.current = Date.now() + 200
        hideGlobalSearchPromptPreview()
      }}
      visibleResults={visibleGlobalSearchResults}
      groupedResults={groupedGlobalSearchResults}
      getGroupLabel={(categoryId) => resolvedGlobalSearchResultCategoryLabels[categoryId]}
      allCategoryItemLimit={GLOBAL_SEARCH_ALL_CATEGORY_ITEM_LIMIT}
      isAllCategory={activeGlobalSearchCategory === "all"}
      emptyText={resolvedActiveGlobalSearchCategoryText.emptyText}
      emptyGuideTitle={getLocalizedText({
        key: "globalSearchSyntaxEmptyGuideTitle",
        fallback: "Try search filters",
      })}
      emptyGuideDescription={getLocalizedText({
        key: "globalSearchSyntaxEmptyGuideDesc",
        fallback: "Use filter syntax to narrow results quickly",
      })}
      emptyGuideExamples={[
        {
          id: "example:type-prompts",
          token: "type:prompts",
          onClick: () => syncSettingsSearchInputAndQuery("type:prompts "),
        },
        {
          id: "example:is-pinned",
          token: "is:pinned",
          onClick: () => syncSettingsSearchInputAndQuery("is:pinned "),
        },
        {
          id: "example:folder-inbox",
          token: "folder:inbox",
          onClick: () => syncSettingsSearchInputAndQuery("folder:inbox "),
        },
        {
          id: "example:tag-work",
          token: "tag:work",
          onClick: () => syncSettingsSearchInputAndQuery("tag:work "),
        },
        {
          id: "example:level-0",
          token: "level:0",
          onClick: () => syncSettingsSearchInputAndQuery("level:0 "),
        },
        {
          id: "example:date-7d",
          token: "date:7d",
          onClick: () => syncSettingsSearchInputAndQuery("date:7d "),
        },
      ]}
      renderSearchResultItem={renderSearchResultItem}
      resolveVisibleResultIndex={(item, fallbackIndex) =>
        visibleSearchResultIndexMap.get(item.id) ?? fallbackIndex
      }
      collapseLabel={getLocalizedText({ key: "collapse", fallback: "Collapse" })}
      moreLabel={getLocalizedText({ key: "floatingToolbarMore", fallback: "More" })}
      onToggleCategoryGroup={handleToggleGlobalSearchGroup}
      footerTips={getLocalizedText({
        key: "globalSearchFooterTips",
        fallback: "Enter to jump · ↑↓ to select · Tab category · Esc to close",
      })}
      promptPreview={
        globalSearchPromptPreview && globalSearchPromptPreviewPosition ? (
          <>
            <div
              ref={promptPreviewContainerRef}
              className="settings-search-prompt-preview-float gh-markdown-preview"
              style={{
                top: globalSearchPromptPreviewPosition.top,
                left: globalSearchPromptPreviewPosition.left,
              }}
              onMouseEnter={() => {
                clearPromptPreviewTimer()
                clearPromptPreviewHideTimer()
              }}
              onMouseLeave={() => {
                scheduleHideGlobalSearchPromptPreview()
              }}
              onClick={handleGlobalSearchPromptPreviewClick}
              dangerouslySetInnerHTML={{
                __html: createSafeHTML(renderMarkdown(globalSearchPromptPreview.content, false)),
              }}
            />
            <style>{getHighlightStyles()}</style>
          </>
        ) : undefined
      }
    />
  )
}
