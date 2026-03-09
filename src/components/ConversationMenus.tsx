import React, { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

import { CopyIcon, PageContentIcon } from "~components/icons"
import type { Conversation, Folder } from "~core/conversation-manager"
import { t } from "~utils/i18n"

// ====================   ====================

const MENU_STYLES = `
  .conversations-folder-menu {
    background: var(--gh-bg, white);
    border: 1px solid var(--gh-border, #e5e7eb);
    border-radius: 6px;
    box-shadow: var(--gh-shadow, 0 4px 12px rgba(0,0,0,0.15));
    z-index: 10000000;
    padding: 3px;
    min-width: 80px;
  }
  .conversations-folder-menu button {
    display: block;
    width: 100%;
    padding: 6px 10px;
    border: none;
    background: none;
    text-align: left;
    font-size: 12px;
    color: var(--gh-text, #374151);
    cursor: pointer;
    border-radius: 4px;
    white-space: nowrap;
  }
  .conversations-folder-menu button:hover {
    background: var(--gh-hover, #f3f4f6);
  }
`

// 
let menuStyleInjected = false

const injectMenuStyles = () => {
  if (menuStyleInjected) return
  const style = document.createElement("style")
  style.id = "gh-menu-styles"
  style.textContent = MENU_STYLES
  document.head.appendChild(style)
  menuStyleInjected = true
}

// ====================  ====================

interface MenuProps {
  anchorEl: HTMLElement | null
  onClose: () => void
  children: React.ReactNode
}
/**
 *  -  Portal  document.body
 *  MainPanel  transform  fixed 
 */
export const ContextMenu: React.FC<MenuProps> = ({ anchorEl, onClose, children }) => {
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuPosition, setMenuPosition] = useState<{ left: number; top: number } | null>(null)

  useEffect(() => {
    // 
    injectMenuStyles()

    if (!anchorEl) return

    const handleClickOutside = (e: MouseEvent) => {
      //  composedPath  Shadow DOM
      const path = e.composedPath()
      const clickedInMenu = menuRef.current && path.includes(menuRef.current)
      const clickedOnAnchor = path.includes(anchorEl)

      if (!clickedInMenu && !clickedOnAnchor) {
        onClose()
      }
    }

    // 
    const timer = setTimeout(() => {
      document.addEventListener("click", handleClickOutside, true) // 
    }, 0)

    return () => {
      clearTimeout(timer)
      document.removeEventListener("click", handleClickOutside, true)
    }
  }, [anchorEl, onClose])

  // 
  useEffect(() => {
    if (!anchorEl || !menuRef.current) return

    const rect = anchorEl.getBoundingClientRect()
    const menuRect = menuRef.current.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const menuWidth = menuRect.width || 150 // 
    const menuHeight = menuRect.height || 200 // 

    let left = rect.left
    let top = rect.bottom + 4

    // 
    if (left + menuWidth > viewportWidth - 10) {
      left = rect.right - menuWidth
    }

    // 
    if (left < 10) {
      left = 10
    }

    // 
    if (top + menuHeight > viewportHeight - 10) {
      top = rect.top - menuHeight - 4
    }

    // 
    if (top < 10) {
      top = 10
    }

    setMenuPosition({ left, top })
  }, [anchorEl])

  if (!anchorEl) return null

  //  Portal  document.body transform  fixed 
  const menuContent = (
    <div
      ref={menuRef}
      className="conversations-folder-menu"
      style={{
        position: "fixed",
        top: menuPosition ? `${menuPosition.top}px` : "-9999px",
        left: menuPosition ? `${menuPosition.left}px` : "-9999px",
        zIndex: 2147483647, //  z-index 
        pointerEvents: "auto",
      }}>
      {children}
    </div>
  )

  return createPortal(menuContent, document.body)
}

// ====================  ====================

interface MenuButtonProps {
  onClick: () => void
  danger?: boolean
  children: React.ReactNode
}

export const MenuButton: React.FC<MenuButtonProps> = ({ onClick, danger, children }) => (
  <button
    onClick={onClick}
    style={danger ? { color: "var(--gh-text-danger, #ef4444)" } : undefined}>
    {children}
  </button>
)

// ====================  ====================

interface FolderMenuProps {
  folder: Folder
  anchorEl: HTMLElement | null
  onClose: () => void
  onRename: () => void
  onDelete: () => void
}

export const FolderMenu: React.FC<FolderMenuProps> = ({
  folder: _folder,
  anchorEl,
  onClose,
  onRename,
  onDelete,
}) => {
  return (
    <ContextMenu anchorEl={anchorEl} onClose={onClose}>
      <MenuButton
        onClick={() => {
          onClose()
          onRename()
        }}>
        {t("conversationsRename") || ""}
      </MenuButton>
      <MenuButton
        danger
        onClick={() => {
          onClose()
          onDelete()
        }}>
        {t("conversationsDelete") || ""}
      </MenuButton>
    </ContextMenu>
  )
}

// ====================  ====================

interface ConversationMenuProps {
  conversation: Conversation
  anchorEl: HTMLElement | null
  onClose: () => void
  onRename: () => void
  onTogglePin: () => void
  onSetTags: () => void
  onMoveTo: () => void
  onDelete: () => void
}

export const ConversationMenu: React.FC<ConversationMenuProps> = ({
  conversation,
  anchorEl,
  onClose,
  onRename,
  onTogglePin,
  onSetTags,
  onMoveTo,
  onDelete,
}) => {
  return (
    <ContextMenu anchorEl={anchorEl} onClose={onClose}>
      <MenuButton
        onClick={() => {
          onClose()
          onRename()
        }}>
        {t("conversationsRename") || ""}
      </MenuButton>
      <MenuButton
        onClick={() => {
          onClose()
          onTogglePin()
        }}>
        {conversation.pinned
          ? t("conversationsUnpin") || ""
          : t("conversationsPin") || ""}
      </MenuButton>
      <MenuButton
        onClick={() => {
          onClose()
          onSetTags()
        }}>
        {t("conversationsSetTags") || ""}
      </MenuButton>
      <MenuButton
        onClick={() => {
          onClose()
          onMoveTo()
        }}>
        {t("conversationsMoveTo") || "..."}
      </MenuButton>
      <MenuButton
        danger
        onClick={() => {
          onClose()
          onDelete()
        }}>
        {t("conversationsDelete") || ""}
      </MenuButton>
    </ContextMenu>
  )
}

// ====================  ====================

interface ExportMenuProps {
  anchorEl: HTMLElement | null
  onClose: () => void
  onExportMarkdown: () => void
  onExportJSON: () => void
  onExportTXT: () => void
}

export const ExportMenu: React.FC<ExportMenuProps> = ({
  anchorEl,
  onClose,
  onExportMarkdown,
  onExportJSON,
  onExportTXT,
}) => {
  return (
    <ContextMenu anchorEl={anchorEl} onClose={onClose}>
      <MenuButton
        onClick={() => {
          onClose()
          onExportMarkdown()
        }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <PageContentIcon size={14} />
          <span>{t("exportToMarkdown") || "Markdown"}</span>
        </div>
      </MenuButton>
      <MenuButton
        onClick={() => {
          onClose()
          onExportJSON()
        }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <CopyIcon size={14} />
          <span>{t("exportToJSON") || "JSON"}</span>
        </div>
      </MenuButton>
      <MenuButton
        onClick={() => {
          onClose()
          onExportTXT()
        }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <PageContentIcon size={14} />
          <span>{t("exportToTXT") || "TXT"}</span>
        </div>
      </MenuButton>
    </ContextMenu>
  )
}
