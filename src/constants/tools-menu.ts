/**
 * 
 *
 * 
 */

import React from "react"

import {
  CleanupIcon,
  CopyIcon,
  ExportIcon,
  FolderMoveIcon,
  ModelLockIcon,
  ScrollLockIcon,
  SettingsIcon,
  TagIcon,
} from "~components/icons"

/**
 * 
 */
export interface ToolsMenuItem {
  /**  */
  id: string
  /**  */
  labelKey: string
  /**  ( fallback) */
  defaultLabel: string
  /**  */
  IconComponent: React.ComponentType<{ size?: number }>
  /**  ( active ) */
  isToggle?: boolean
  /**  () */
  isDanger?: boolean
  /**  () */
  isSystem?: boolean
  /**  */
  defaultVisible?: boolean
}

/**
 *  ID 
 */
export const TOOLS_MENU_IDS = {
  EXPORT: "export",
  COPY_MARKDOWN: "copyMarkdown",
  MOVE: "move",
  SET_TAG: "setTag",
  SCROLL_LOCK: "scrollLock",
  MODEL_LOCK: "modelLock",
  CLEANUP: "cleanup",
  SETTINGS: "settings",
} as const

export type ToolsMenuId = (typeof TOOLS_MENU_IDS)[keyof typeof TOOLS_MENU_IDS]

/**
 *  ()
 *
 * Settings 
 */
export const TOOLS_MENU_ITEMS: ToolsMenuItem[] = [
  {
    id: TOOLS_MENU_IDS.EXPORT,
    labelKey: "export",
    defaultLabel: "Export",
    IconComponent: ExportIcon,
    defaultVisible: true,
  },
  {
    id: TOOLS_MENU_IDS.COPY_MARKDOWN,
    labelKey: "exportToClipboard",
    defaultLabel: "Copy Markdown",
    IconComponent: CopyIcon,
    defaultVisible: true,
  },
  {
    id: TOOLS_MENU_IDS.MOVE,
    labelKey: "conversationsMoveTo",
    defaultLabel: "Move",
    IconComponent: FolderMoveIcon,
    defaultVisible: true,
  },
  {
    id: TOOLS_MENU_IDS.SET_TAG,
    labelKey: "conversationsSetTag",
    defaultLabel: "Set Tag",
    IconComponent: TagIcon,
    defaultVisible: true,
  },
  {
    id: TOOLS_MENU_IDS.SCROLL_LOCK,
    labelKey: "shortcutToggleScrollLock",
    defaultLabel: "Scroll Lock",
    IconComponent: ScrollLockIcon,
    isToggle: true,
    defaultVisible: true,
  },
  {
    id: TOOLS_MENU_IDS.MODEL_LOCK,
    labelKey: "modelLockTitle",
    defaultLabel: "Model Lock",
    IconComponent: ModelLockIcon,
    isToggle: true,
    defaultVisible: true,
  },
  {
    id: TOOLS_MENU_IDS.CLEANUP,
    labelKey: "cleanup",
    defaultLabel: "Cleanup",
    IconComponent: CleanupIcon,
    isDanger: true,
    defaultVisible: true,
  },
  {
    id: TOOLS_MENU_IDS.SETTINGS,
    labelKey: "tabSettings",
    defaultLabel: "Settings",
    IconComponent: SettingsIcon,
    isSystem: true,
    defaultVisible: true, // 
  },
]

/**
 *  ID 
 */
export function getDefaultToolsMenuIds(): ToolsMenuId[] {
  return TOOLS_MENU_ITEMS.filter((item) => item.defaultVisible).map(
    (item) => item.id as ToolsMenuId,
  )
}
