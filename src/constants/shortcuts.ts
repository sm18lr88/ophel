/**
 * 
 *
 * 
 */

export interface ShortcutBinding {
  key: string //  (e.g., "t", "1", ",", "ArrowUp")
  alt?: boolean // Windows Alt / Mac Option
  ctrl?: boolean // Windows Ctrl
  meta?: boolean // Mac Cmd
  shift?: boolean
}

export interface ShortcutsSettings {
  enabled: boolean // 
  globalUrl: string //  URL
  keybindings: Record<string, ShortcutBinding | null> // null 
}

//  ID
export const SHORTCUT_ACTIONS = {
  // 
  SCROLL_TOP: "scrollTop",
  SCROLL_BOTTOM: "scrollBottom",
  GO_TO_ANCHOR: "goToAnchor",

  // 
  TOGGLE_PANEL: "togglePanel",
  TOGGLE_THEME: "toggleTheme",
  OPEN_SETTINGS: "openSettings",
  SWITCH_TAB_1: "switchTab1",
  SWITCH_TAB_2: "switchTab2",
  SWITCH_TAB_3: "switchTab3",

  // 
  TOGGLE_USER_QUERIES: "toggleUserQueries",
  ONLY_USER_QUERIES: "onlyUserQueries",
  TOGGLE_BOOKMARKS: "toggleBookmarks",
  LOCATE_OUTLINE: "locateOutline",
  SEARCH_OUTLINE: "searchOutline",
  REFRESH_OUTLINE: "refreshOutline",
  PREV_HEADING: "prevHeading",
  NEXT_HEADING: "nextHeading",
  TOGGLE_OUTLINE_EXPAND: "toggleOutlineExpand",
  EXPAND_LEVEL_1: "expandLevel1",
  EXPAND_LEVEL_2: "expandLevel2",
  EXPAND_LEVEL_3: "expandLevel3",
  EXPAND_LEVEL_4: "expandLevel4",
  EXPAND_LEVEL_5: "expandLevel5",
  EXPAND_LEVEL_6: "expandLevel6",

  // 
  NEW_CONVERSATION: "newConversation",
  REFRESH_CONVERSATIONS: "refreshConversations",
  LOCATE_CONVERSATION: "locateConversation",
  PREV_CONVERSATION: "prevConversation",
  NEXT_CONVERSATION: "nextConversation",

  // 
  EXPORT_CONVERSATION: "exportConversation",
  COPY_LATEST_REPLY: "copyLatestReply",
  COPY_LAST_CODE_BLOCK: "copyLastCodeBlock",
  TOGGLE_SCROLL_LOCK: "toggleScrollLock",
  FOCUS_INPUT: "focusInput",
  OPEN_GLOBAL_SEARCH: "openGlobalSearch",
  STOP_GENERATION: "stopGeneration",
  TOGGLE_PROMPT_QUEUE: "togglePromptQueue",

  // 
  SHOW_SHORTCUTS: "showShortcuts",
  SHOW_MODEL_SELECTOR: "showModelSelector",

  // 
  OPEN_CLAUDE_SETTINGS: "openClaudeSettings",
  SWITCH_CLAUDE_KEY: "switchClaudeKey",
  OPEN_GEMINI_SETTINGS: "openGeminiSettings",
  OPEN_THEME_SETTINGS: "openThemeSettings",
  OPEN_MODEL_LOCK_SETTINGS: "openModelLockSettings",
} as const

export type ShortcutActionId = (typeof SHORTCUT_ACTIONS)[keyof typeof SHORTCUT_ACTIONS]

//  UI 
export const SHORTCUT_META: Record<
  ShortcutActionId,
  { labelKey: string; label: string; category: string }
> = {
  // 
  scrollTop: { labelKey: "shortcutScrollTop", label: "", category: "navigation" },
  scrollBottom: { labelKey: "shortcutScrollBottom", label: "", category: "navigation" },
  goToAnchor: { labelKey: "shortcutGoToAnchor", label: "", category: "navigation" },

  // 
  togglePanel: { labelKey: "shortcutTogglePanel", label: "/", category: "panel" },
  toggleTheme: { labelKey: "shortcutToggleTheme", label: "", category: "panel" },
  switchTab1: { labelKey: "shortcutSwitchTab1", label: " 1 ", category: "panel" },
  switchTab2: { labelKey: "shortcutSwitchTab2", label: " 2 ", category: "panel" },
  switchTab3: { labelKey: "shortcutSwitchTab3", label: " 3 ", category: "panel" },

  // 
  toggleUserQueries: {
    labelKey: "shortcutToggleUserQueries",
    label: "",
    category: "outline",
  },
  onlyUserQueries: {
    labelKey: "shortcutOnlyUserQueries",
    label: "",
    category: "outline",
  },
  toggleBookmarks: {
    labelKey: "shortcutToggleBookmarks",
    label: "",
    category: "outline",
  },
  locateOutline: {
    labelKey: "shortcutLocateOutline",
    label: "",
    category: "outline",
  },
  searchOutline: {
    labelKey: "shortcutSearchOutline",
    label: "",
    category: "outline",
  },
  prevHeading: { labelKey: "shortcutPrevHeading", label: "", category: "outline" },
  nextHeading: { labelKey: "shortcutNextHeading", label: "", category: "outline" },
  refreshOutline: { labelKey: "shortcutRefreshOutline", label: "", category: "outline" },
  toggleOutlineExpand: {
    labelKey: "shortcutToggleOutlineExpand",
    label: "/",
    category: "outline",
  },
  expandLevel1: { labelKey: "shortcutExpandLevel1", label: " 1 ", category: "outline" },
  expandLevel2: { labelKey: "shortcutExpandLevel2", label: " 2 ", category: "outline" },
  expandLevel3: { labelKey: "shortcutExpandLevel3", label: " 3 ", category: "outline" },
  expandLevel4: { labelKey: "shortcutExpandLevel4", label: " 4 ", category: "outline" },
  expandLevel5: { labelKey: "shortcutExpandLevel5", label: " 5 ", category: "outline" },
  expandLevel6: { labelKey: "shortcutExpandLevel6", label: " 6 ", category: "outline" },

  // 
  newConversation: {
    labelKey: "shortcutNewConversation",
    label: "",
    category: "conversation",
  },
  refreshConversations: {
    labelKey: "shortcutRefreshConversations",
    label: "",
    category: "conversation",
  },
  locateConversation: {
    labelKey: "shortcutLocateConversation",
    label: "",
    category: "conversation",
  },
  prevConversation: {
    labelKey: "shortcutPrevConversation",
    label: "",
    category: "conversation",
  },
  nextConversation: {
    labelKey: "shortcutNextConversation",
    label: "",
    category: "conversation",
  },

  // 
  exportConversation: {
    labelKey: "shortcutExportConversation",
    label: "",
    category: "edit",
  },
  copyLatestReply: {
    labelKey: "shortcutCopyLatestReply",
    label: "",
    category: "edit",
  },
  copyLastCodeBlock: {
    labelKey: "shortcutCopyLastCodeBlock",
    label: "",
    category: "edit",
  },
  toggleScrollLock: {
    labelKey: "shortcutToggleScrollLock",
    label: "",
    category: "edit",
  },
  focusInput: {
    labelKey: "shortcutFocusInput",
    label: "",
    category: "edit",
  },
  openGlobalSearch: {
    labelKey: "navGlobalSearch",
    label: "",
    category: "edit",
  },
  stopGeneration: {
    labelKey: "shortcutStopGeneration",
    label: "",
    category: "edit",
  },
  togglePromptQueue: {
    labelKey: "shortcutTogglePromptQueue",
    label: "/",
    category: "edit",
  },
  showModelSelector: {
    labelKey: "shortcutShowModelSelector",
    label: "",
    category: "edit",
  },

  // 
  openSettings: { labelKey: "shortcutOpenSettings", label: "", category: "settings" },

  // 
  showShortcuts: {
    labelKey: "shortcutShowShortcuts",
    label: "",
    category: "settings",
  },

  openThemeSettings: {
    labelKey: "shortcutOpenThemeSettings",
    label: "",
    category: "settings",
  },

  openModelLockSettings: {
    labelKey: "shortcutOpenModelLockSettings",
    label: "",
    category: "settings",
  },

  openGeminiSettings: {
    labelKey: "shortcutOpenGeminiSettings",
    label: " Gemini ",
    category: "settings",
  },
  openClaudeSettings: {
    labelKey: "shortcutOpenClaudeSettings",
    label: " Claude ",
    category: "settings",
  },
  switchClaudeKey: {
    labelKey: "shortcutSwitchClaudeKey",
    label: " Claude Key",
    category: "settings",
  },
}

// 
export const SHORTCUT_CATEGORIES = {
  navigation: { labelKey: "shortcutCategoryNavigation", label: "" },
  panel: { labelKey: "shortcutCategoryPanel", label: "" },
  outline: { labelKey: "shortcutCategoryOutline", label: "" },
  conversation: { labelKey: "shortcutCategoryConversation", label: "" },
  edit: { labelKey: "shortcutCategoryEdit", label: "" },
  settings: { labelKey: "shortcutCategorySettings", label: "" },
}

// 
export const DEFAULT_KEYBINDINGS: Record<ShortcutActionId, ShortcutBinding> = {
  // 
  scrollTop: { key: "t", alt: true },
  scrollBottom: { key: "b", alt: true },
  goToAnchor: { key: "z", alt: true },

  // 
  togglePanel: { key: "p", alt: true },
  toggleTheme: { key: "d", alt: true },
  switchTab1: { key: "1", alt: true },
  switchTab2: { key: "2", alt: true },
  switchTab3: { key: "3", alt: true },

  // 
  refreshOutline: { key: "r", alt: true },
  toggleOutlineExpand: { key: "e", alt: true },
  expandLevel1: { key: "1", alt: true, shift: true },
  expandLevel2: { key: "2", alt: true, shift: true },
  expandLevel3: { key: "3", alt: true, shift: true },
  expandLevel4: { key: "4", alt: true, shift: true },
  expandLevel5: { key: "5", alt: true, shift: true },
  expandLevel6: { key: "6", alt: true, shift: true },
  toggleUserQueries: { key: "q", alt: true },
  toggleBookmarks: { key: "c", alt: true },
  onlyUserQueries: { key: "q", alt: true, shift: true },
  prevHeading: { key: "ArrowUp", alt: true },
  nextHeading: { key: "ArrowDown", alt: true },
  locateOutline: { key: "l", alt: true },
  searchOutline: { key: "f", alt: true },

  // 
  newConversation: { key: "o", ctrl: true, shift: true },
  refreshConversations: { key: "r", alt: true, shift: true },
  locateConversation: { key: "l", alt: true, shift: true },
  prevConversation: { key: "[", alt: true },
  nextConversation: { key: "]", alt: true },

  // 
  exportConversation: { key: "e", ctrl: true, shift: true },
  copyLatestReply: { key: "c", ctrl: true, shift: true },
  copyLastCodeBlock: { key: ";", alt: true },
  toggleScrollLock: { key: "s", alt: true },
  focusInput: { key: "i", alt: true },
  openGlobalSearch: { key: "k", ctrl: true },
  stopGeneration: { key: "k", alt: true },
  togglePromptQueue: { key: "j", alt: true },
  showModelSelector: { key: "/", alt: true },

  // 
  showShortcuts: { key: "\\", alt: true },
  openSettings: { key: ",", alt: true },
  openClaudeSettings: { key: "c", ctrl: true, alt: true },
  switchClaudeKey: { key: "s", ctrl: true, alt: true },
  openGeminiSettings: { key: "g", ctrl: true, alt: true },
  openThemeSettings: { key: "t", ctrl: true, alt: true },
  openModelLockSettings: { key: "l", ctrl: true, alt: true },
}

// 
export const DEFAULT_SHORTCUTS_SETTINGS: ShortcutsSettings = {
  enabled: true,
  globalUrl: "https://gemini.google.com",
  keybindings: DEFAULT_KEYBINDINGS,
}

/**
 * 
 */
export function formatShortcut(binding: ShortcutBinding, isMac = false): string {
  const parts: string[] = []

  if (binding.ctrl) {
    parts.push(isMac ? "⌘" : "Ctrl")
  }
  if (binding.meta && isMac) {
    parts.push("⌘")
  }
  if (binding.alt) {
    parts.push(isMac ? "⌥" : "Alt")
  }
  if (binding.shift) {
    parts.push(isMac ? "⇧" : "Shift")
  }

  // 
  const keyMap: Record<string, string> = {
    ArrowUp: "↑",
    ArrowDown: "↓",
    ArrowLeft: "←",
    ArrowRight: "→",
    ",": ",",
  }

  const displayKey = keyMap[binding.key] || binding.key.toUpperCase()
  parts.push(displayKey)

  return parts.join(isMac ? "" : "+")
}

/**
 *  Mac 
 */
export function isMacOS(): boolean {
  return typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform)
}
