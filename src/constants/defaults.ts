/**
 * Default value constants.
 */

import { t } from "~utils/i18n"
import type { Prompt } from "~utils/storage"

// Zustand store keys used when exporting or importing persisted state.
export const ZUSTAND_KEYS: string[] = [
  "settings",
  "prompts",
  "folders",
  "tags",
  "conversations",
  "readingHistory",
]

// Stores whose persisted state contains multiple top-level properties.
export const MULTI_PROP_STORES: string[] = ["conversations", "readingHistory"]

// Default prompts.
export const getDefaultPrompts = (): Prompt[] => [
  {
    id: "default_1",
    title: t("defaultPromptCodeOptTitle") || "Code Optimization",
    content:
      t("defaultPromptCodeOptContent") ||
      "Please help me improve the following code for performance and readability:\n\n",
    category: t("defaultPromptCodeOptCategory") || "Coding",
  },
  {
    id: "default_2",
    title: t("defaultPromptTranslateTitle") || "Writing Assistant",
    content:
      t("defaultPromptTranslateContent") ||
      "Please rewrite the following content into clear, concise professional English while preserving meaning and technical accuracy:\n\n",
    category: t("defaultPromptTranslateCategory") || "Writing",
  },
]

// Default folders.
export interface Folder {
  id: string
  name: string
  icon: string
  isDefault?: boolean
  color?: string
}

export const DEFAULT_FOLDERS: Folder[] = [
  { id: "inbox", name: "Inbox", icon: "📥", isDefault: true },
]

// ====================  ====================
export const LAYOUT_CONFIG = {
  PAGE_WIDTH: {
    DEFAULT_PX: "1280",
    DEFAULT_PERCENT: "81",
    MIN_PERCENT: 40,
    MAX_PERCENT: 100,
    MIN_PX: 1200,
  },
  USER_QUERY_WIDTH: {
    DEFAULT_PX: "600",
    DEFAULT_PERCENT: "81",
    MIN_PERCENT: 40,
    MAX_PERCENT: 100,
    MIN_PX: 600,
  },
} as const

// ====================  ====================
export const VALIDATION_PATTERNS = {
  // Claude Session Key sk-ant-sidXX-
  CLAUDE_KEY: /^sk-ant-sid\d{2}-/,
} as const

// ====================  ====================
export const BATCH_TEST_CONFIG = {
  INTERVAL_MS: 500, // 
} as const

// ====================  ID ====================
export const SITE_IDS = {
  CLAUDE: "claude",
  GEMINI: "gemini",
  CHATGPT: "chatgpt",
  GEMINI_ENTERPRISE: "gemini-enterprise",
  GROK: "grok",
  AISTUDIO: "aistudio",
} as const
