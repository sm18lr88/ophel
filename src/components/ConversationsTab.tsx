/**
 *  Tab 
 *  geminiHelper.user.js 5874~6606 
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"

import type { Conversation, ConversationManager, Folder, Tag } from "~core/conversation-manager"
import { useSettingsStore } from "~stores/settings-store"
import { t } from "~utils/i18n"
import { showToast } from "~utils/toast"

import {
  ConfirmDialog,
  FolderDialog,
  FolderSelectDialog,
  RenameDialog,
  TagManagerDialog,
} from "./ConversationDialogs"
import { LoadingOverlay } from "./LoadingOverlay"
import { ConversationMenu, ExportMenu, FolderMenu } from "./ConversationMenus"

import "~styles/conversations.css"

import {
  ArrowDownIcon,
  ArrowUpIcon,
  BatchIcon,
  ClearIcon,
  CopyIcon,
  DeleteIcon,
  ExportIcon,
  FolderMoveIcon,
  FolderPlusIcon,
  HourglassIcon,
  LocateIcon,
  MoreHorizontalIcon,
  PinIcon,
  SyncIcon,
  TagIcon,
} from "~components/icons"
import { SelectDropdown, Tooltip } from "~components/ui"

// ====================  ====================

interface ConversationsTabProps {
  manager: ConversationManager
  onInteractionStateChange?: (isActive: boolean) => void
}

interface SearchResult {
  folderMatches: Set<string>
  conversationMatches: Set<string>
  conversationFolderMap: Map<string, string>
  totalCount: number
}

type DialogType =
  | { type: "confirm"; title: string; message: string; onConfirm: () => void; danger?: boolean }
  | {
      type: "folder"
      folder?: Folder
      returnToSelect?: { conv?: Conversation; convIds?: string[] }
    }
  | { type: "rename"; conv: Conversation }
  | {
      type: "folderSelect"
      conv?: Conversation
      convIds?: string[]
      activeFolderId?: string
    }
  | { type: "tagManager"; conv?: Conversation }
  | null

type MenuType =
  | { type: "folder"; folder: Folder; anchorEl: HTMLElement }
  | { type: "conversation"; conv: Conversation; anchorEl: HTMLElement }
  | { type: "export"; anchorEl: HTMLElement }
  | null

type LocateConversationWindow = Window & {
  __ophelPendingLocateConversation?: boolean
}

const getFolderDisplayName = (folder: Pick<Folder, "name" | "icon">): string => {
  const trimmedName = (folder.name || "").trim()
  const trimmedIcon = (folder.icon || "").trim()

  if (!trimmedIcon) {
    return trimmedName
  }

  if (trimmedName.startsWith(trimmedIcon)) {
    return trimmedName.slice(trimmedIcon.length).trim()
  }

  return trimmedName
}

// ====================  ====================

export const ConversationsTab: React.FC<ConversationsTabProps> = ({
  manager,
  onInteractionStateChange,
}) => {
  //  -  Zustand store
  const { settings } = useSettingsStore()

  // 
  const [folders, setFolders] = useState<Folder[]>([])
  const [conversations, setConversations] = useState<Record<string, Conversation>>({})
  const [tags, setTags] = useState<Tag[]>([])
  const [lastUsedFolderId, setLastUsedFolderId] = useState("inbox")

  // UI 
  const [expandedFolderId, setExpandedFolderId] = useState<string | null>(null)
  const [batchMode, setBatchMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [syncing, setSyncing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // 
  const [searchQuery, setSearchQuery] = useState("")
  const [filterPinned, setFilterPinned] = useState(false)
  const [filterTagIds, setFilterTagIds] = useState<Set<string>>(new Set())
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null)
  const [showTagFilterMenu, setShowTagFilterMenu] = useState(false)
  const [isFolderSelectOpen, setIsFolderSelectOpen] = useState(false)
  const [isNarrowLayout, setIsNarrowLayout] = useState(false)

  // 
  const [dialog, setDialog] = useState<DialogType>(null)
  const [menu, setMenu] = useState<MenuType>(null)

  // Refs
  const contentRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const tagFilterMenuRef = useRef<HTMLDivElement>(null)
  const tagFilterBtnRef = useRef<HTMLDivElement>(null)

  // 
  useEffect(() => {
    const el = contentRef.current
    if (!el || typeof ResizeObserver === "undefined") return

    const updateLayout = () => {
      setIsNarrowLayout(el.clientWidth <= 340)
    }

    updateLayout()

    const observer = new ResizeObserver(updateLayout)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  //  Zustand store 
  const loadData = useCallback(async () => {
    setFolders([...manager.getFolders()])
    setConversations({ ...manager.getAllConversations() })
    setTags([...manager.getTags()])
    setLastUsedFolderId(manager.getLastUsedFolderId())
  }, [manager])

  useEffect(() => {
    loadData()
  }, [loadData])

  //  ConversationManager 
  useEffect(() => {
    const unsubscribe = manager.onDataChange(() => {
      loadData()
    })
    return () => unsubscribe()
  }, [manager, loadData])

  // 
  const handleSearch = useCallback(
    (query: string) => {
      if (!query && !filterPinned && filterTagIds.size === 0) {
        setSearchResult(null)
        return
      }

      const folderMatches = new Set<string>()
      const conversationMatches = new Set<string>()
      const conversationFolderMap = new Map<string, string>()
      const lowerQuery = query.toLowerCase()

      folders.forEach((folder) => {
        if (query && getFolderDisplayName(folder).toLowerCase().includes(lowerQuery)) {
          folderMatches.add(folder.id)
        }
      })

      Object.values(conversations).forEach((conv) => {
        let matched = true
        if (query && !conv.title.toLowerCase().includes(lowerQuery)) matched = false
        if (filterPinned && !conv.pinned) matched = false
        if (filterTagIds.size > 0) {
          const hasTag = conv.tagIds?.some((tid) => filterTagIds.has(tid))
          if (!hasTag) matched = false
        }
        if (matched) {
          conversationMatches.add(conv.id)
          conversationFolderMap.set(conv.id, conv.folderId)
        }
      })

      setSearchResult({
        folderMatches,
        conversationMatches,
        conversationFolderMap,
        totalCount: conversationMatches.size,
      })
    },
    [folders, conversations, filterPinned, filterTagIds],
  )

  // 
  useEffect(() => {
    handleSearch(searchQuery)
  }, [filterPinned, filterTagIds, handleSearch, searchQuery])

  // 
  useEffect(() => {
    if (!showTagFilterMenu) return

    const handleClickOutside = (e: MouseEvent) => {
      //  composedPath()  Shadow DOM
      const path = e.composedPath()
      const clickedInMenu = tagFilterMenuRef.current && path.includes(tagFilterMenuRef.current)
      const clickedInBtn = tagFilterBtnRef.current && path.includes(tagFilterBtnRef.current)

      if (!clickedInMenu && !clickedInBtn) {
        setShowTagFilterMenu(false)
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
  }, [showTagFilterMenu])

  // 
  useEffect(() => {
    const isInteracting = !!(
      menu ||
      dialog ||
      showTagFilterMenu ||
      isFolderSelectOpen ||
      batchMode ||
      isDeleting
    )
    onInteractionStateChange?.(isInteracting)
  }, [
    menu,
    dialog,
    showTagFilterMenu,
    isFolderSelectOpen,
    batchMode,
    isDeleting,
    onInteractionStateChange,
  ])

  // 
  const handleSearchInput = (value: string) => {
    setSearchQuery(value)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(() => handleSearch(value), 150)
  }

  // 
  const handleSync = useCallback(async () => {
    setSyncing(true)
    try {
      await manager.siteAdapter?.loadAllConversations?.()
      const sidebarCount = manager.siteAdapter?.getConversationList?.()?.length || 0
      const { newCount, updatedCount } = await manager.syncConversations(lastUsedFolderId, false)
      loadData()
      if (sidebarCount === 0) {
        showToast(t("conversationsSyncNoSidebarItems"))
      } else {
        showToast(
          t("conversationsSyncResult")
            .replace("{scanned}", String(sidebarCount))
            .replace("{added}", String(newCount))
            .replace("{updated}", String(updatedCount)),
        )
      }
    } finally {
      setSyncing(false)
    }
  }, [manager, lastUsedFolderId, loadData])

  // 
  const handleLocate = useCallback(() => {
    // 
    if (manager.siteAdapter?.isSharePage?.() || manager.siteAdapter?.isNewConversation?.()) {
      return
    }

    const sessionId = manager.siteAdapter?.getSessionId?.()
    if (!sessionId || sessionId === "default" || sessionId === "app") return

    const conv = manager.getConversation(sessionId)
    if (!conv) {
      handleSync()
      return
    }

    setExpandedFolderId(conv.folderId)
    setTimeout(() => {
      //  contentRef Shadow DOM 
      const container = contentRef.current
      if (!container) return
      const item = container.querySelector(`.conversations-item[data-id="${sessionId}"]`)
      if (item) {
        item.scrollIntoView({ behavior: "smooth", block: "center" })
        item.classList.add("locate-highlight")
        setTimeout(() => item.classList.remove("locate-highlight"), 2000)
      }
    }, 100)
  }, [manager, handleSync])

  // 
  useEffect(() => {
    const locateWindow = window as LocateConversationWindow

    const handleLocateEvent = () => {
      // 
      locateWindow.__ophelPendingLocateConversation = false
      handleLocate()
    }

    // 
    if (locateWindow.__ophelPendingLocateConversation) {
      // 
      setTimeout(() => {
        handleLocateEvent()
      }, 100)
    }

    window.addEventListener("ophel:locateConversation", handleLocateEvent)
    return () => {
      window.removeEventListener("ophel:locateConversation", handleLocateEvent)
    }
  }, [handleLocate])

  // 
  useEffect(() => {
    const handleRefreshEvent = () => {
      handleSync()
    }

    window.addEventListener("ophel:refreshConversations", handleRefreshEvent)
    return () => {
      window.removeEventListener("ophel:refreshConversations", handleRefreshEvent)
    }
  }, [handleSync])

  // 
  const toggleBatchMode = () => {
    if (batchMode) {
      setSelectedIds(new Set())
    }
    setBatchMode(!batchMode)
  }

  const clearSelection = () => {
    setSelectedIds(new Set())
    setBatchMode(false)
  }

  // 
  const clearFilters = () => {
    setSearchQuery("")
    setFilterPinned(false)
    setFilterTagIds(new Set())
    setSearchResult(null)
  }

  const hasFilters = searchQuery || filterPinned || filterTagIds.size > 0

  // 
  const getConversationsInFolder = (folderId: string): Conversation[] => {
    let convs = Object.values(conversations).filter((c) => c.folderId === folderId)
    if (searchResult) {
      convs = convs.filter((c) => searchResult.conversationMatches.has(c.id))
    }
    const sidebarOrder = manager.getSidebarConversationOrder()
    convs.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1
      const indexA = sidebarOrder.indexOf(a.id)
      const indexB = sidebarOrder.indexOf(b.id)
      if (indexA === -1 && indexB === -1) return (b.updatedAt || 0) - (a.updatedAt || 0)
      if (indexA === -1) return 1
      if (indexB === -1) return -1
      return indexA - indexB
    })
    return convs
  }

  // 
  const getFolderCount = (folderId: string): number => {
    if (searchResult) {
      return Object.values(conversations).filter(
        (c) => c.folderId === folderId && searchResult.conversationMatches.has(c.id),
      ).length
    }
    return Object.values(conversations).filter((c) => c.folderId === folderId).length
  }

  // 
  const highlightText = (text: string, query: string): React.ReactNode => {
    if (!query) return text
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"))
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <span key={i} className="conversations-highlight">
          {part}
        </span>
      ) : (
        part
      ),
    )
  }

  // 
  const handleConversationClick = (conv: Conversation) => {
    if (batchMode) {
      const newSelected = new Set(selectedIds)
      if (newSelected.has(conv.id)) newSelected.delete(conv.id)
      else newSelected.add(conv.id)
      setSelectedIds(newSelected)
      return
    }

    //  navigateToConversation SPA 
    manager.siteAdapter?.navigateToConversation(conv.id, conv.url)
  }

  // /
  const handleFolderClick = (folderId: string) => {
    setExpandedFolderId(expandedFolderId === folderId ? null : folderId)
  }

  // 
  const handleFolderSelectAll = (folderId: string, checked: boolean) => {
    const convs = getConversationsInFolder(folderId)
    const newSelected = new Set(selectedIds)
    if (checked) convs.forEach((c) => newSelected.add(c.id))
    else convs.forEach((c) => newSelected.delete(c.id))
    setSelectedIds(newSelected)
  }

  const isFolderAllSelected = (folderId: string): boolean => {
    const convs = getConversationsInFolder(folderId)
    return convs.length > 0 && convs.every((c) => selectedIds.has(c.id))
  }

  const isFolderPartialSelected = (folderId: string): boolean => {
    const convs = getConversationsInFolder(folderId)
    const selected = convs.filter((c) => selectedIds.has(c.id))
    return selected.length > 0 && selected.length < convs.length
  }

  // 
  const shouldShowFolder = (folder: Folder): boolean => {
    if (!searchResult) return true
    const folderMatch = searchResult.folderMatches.has(folder.id)
    const hasChildren = Array.from(searchResult.conversationFolderMap.values()).includes(folder.id)
    return folderMatch || hasChildren
  }

  // 
  const shouldExpandFolder = (folderId: string): boolean => {
    if (searchResult) {
      return Array.from(searchResult.conversationFolderMap.values()).includes(folderId)
    }
    return expandedFolderId === folderId
  }

  const folderSelectOptions = useMemo(
    () =>
      folders.map((folder) => {
        const folderName = getFolderDisplayName(folder)
        const optionLabel = `${folder.icon ? `${folder.icon} ` : ""}${folderName}`.trim()

        return {
          value: folder.id,
          title: optionLabel,
          label: (
            <>
              {folder.icon && <span style={{ flexShrink: 0 }}>{folder.icon}</span>}
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                {folderName}
              </span>
            </>
          ),
        }
      }),
    [folders],
  )

  // ====================  ====================

  return (
    <>
      <LoadingOverlay isVisible={isDeleting} text={`${t("delete") || ""}...`} />
      <div
        ref={contentRef}
        className={`conversations-content ${isNarrowLayout ? "is-narrow" : ""}`}
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          overflow: "hidden",
        }}>
        {/*  */}
        <div className="conversations-toolbar">
          {/* 1.  */}
          <Tooltip
            content={t("conversationsSelectFolder") || ""}
            triggerStyle={{ flex: 1, minWidth: 0 }}>
            <SelectDropdown
              className="conversations-folder-select-dropdown"
              buttonClassName="conversations-folder-select"
              menuClassName="conversations-folder-select-menu"
              optionClassName="conversations-folder-select-option"
              options={folderSelectOptions}
              value={lastUsedFolderId}
              ariaLabel={t("conversationsSelectFolder") || ""}
              onOpenChange={setIsFolderSelectOpen}
              onChange={(selectedFolderId) => {
                setLastUsedFolderId(selectedFolderId)
                manager.setLastUsedFolder(selectedFolderId)
              }}
            />
          </Tooltip>

          {/* 2.  */}
          <Tooltip content={t("conversationsSync") || ""}>
            <button
              className="conversations-toolbar-btn sync"
              disabled={syncing}
              onClick={handleSync}>
              {syncing ? <HourglassIcon size={18} /> : <SyncIcon size={18} />}
            </button>
          </Tooltip>

          {/* 3.  */}
          <Tooltip content={t("conversationsLocate") || ""}>
            <button className="conversations-toolbar-btn locate" onClick={handleLocate}>
              <LocateIcon size={18} />
            </button>
          </Tooltip>

          {/* 4.  */}
          <Tooltip content={t("conversationsBatchMode") || ""}>
            <button
              className={`conversations-toolbar-btn batch-mode ${batchMode ? "active" : ""}`}
              onClick={toggleBatchMode}>
              <BatchIcon size={18} />
            </button>
          </Tooltip>

          {/* 5.  */}
          <Tooltip content={t("conversationsAddFolder") || ""}>
            <button
              className="conversations-toolbar-btn add-folder"
              onClick={() => {
                onInteractionStateChange?.(true)
                setDialog({ type: "folder" })
              }}>
              <FolderPlusIcon size={18} />
            </button>
          </Tooltip>
        </div>

        {/*  */}
        <div className="conversations-search-bar">
          <div className="conversations-search-wrapper" style={{ position: "relative" }}>
            <div className="conversations-search-input-group">
              <input
                ref={searchInputRef}
                type="text"
                className="conversations-search-input"
                placeholder={t("conversationsSearchPlaceholder") || "..."}
                value={searchQuery}
                onChange={(e) => handleSearchInput(e.target.value)}
              />
            </div>

            {/*  */}
            <Tooltip content={t("conversationsFilterPinned") || ""}>
              <div
                className={`conversations-pin-filter-btn ${filterPinned ? "active" : ""}`}
                style={{ userSelect: "none" }}
                onClick={() => setFilterPinned(!filterPinned)}>
                <PinIcon size={14} />
              </div>
            </Tooltip>

            {/*  */}
            <Tooltip content={t("conversationsFilterByTags") || ""}>
              <div
                ref={tagFilterBtnRef}
                className={`conversations-tag-search-btn ${filterTagIds.size > 0 ? "active" : ""}`}
                style={{ userSelect: "none" }}
                onClick={() => {
                  const newState = !showTagFilterMenu
                  if (newState) onInteractionStateChange?.(true)
                  setShowTagFilterMenu(newState)
                }}>
                <TagIcon size={14} />
              </div>
            </Tooltip>

            {/*  */}
            {showTagFilterMenu && (
              <div ref={tagFilterMenuRef} className="conversations-tag-filter-menu">
                <div
                  className="conversations-tag-filter-list"
                  style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
                  {tags.length === 0 ? (
                    <div
                      className="conversations-tag-filter-item"
                      style={{ color: "var(--gh-text-tertiary, #9ca3af)", cursor: "default" }}>
                      {t("conversationsNoTags") || ""}
                    </div>
                  ) : (
                    tags.map((tag) => (
                      <div
                        key={tag.id}
                        className={`conversations-tag-filter-item ${filterTagIds.has(tag.id) ? "selected" : ""}`}
                        onClick={() => {
                          const newTagIds = new Set(filterTagIds)
                          if (newTagIds.has(tag.id)) newTagIds.delete(tag.id)
                          else newTagIds.add(tag.id)
                          setFilterTagIds(newTagIds)
                        }}>
                        <span
                          className="conversations-tag-dot"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span>{tag.name}</span>
                      </div>
                    ))
                  )}
                </div>
                <div className="conversations-tag-filter-footer">
                  <div
                    className="conversations-tag-filter-item conversations-tag-filter-action"
                    onClick={() => {
                      setShowTagFilterMenu(false)
                      // 
                      onInteractionStateChange?.(true)
                      setDialog({ type: "tagManager", conv: undefined })
                    }}>
                    {t("conversationsManageTags") || ""}
                  </div>
                </div>
              </div>
            )}

            {/*  */}
            <Tooltip content={t("conversationsClearAll") || ""}>
              <div
                className={`conversations-search-clear ${!hasFilters ? "disabled" : ""}`}
                onClick={hasFilters ? clearFilters : undefined}>
                <ClearIcon size={14} />
              </div>
            </Tooltip>
          </div>

          {/*  */}
          {searchQuery && searchResult && (
            <div className="conversations-result-bar visible">
              {searchResult.totalCount} {t("conversationsSearchResult") || ""}
            </div>
          )}
        </div>

        {/*  */}
        <div className="conversations-folder-list">
          {folders.filter(shouldShowFolder).length === 0 ? (
            <div className="conversations-empty">
              {searchResult
                ? t("conversationsNoSearchResult") || ""
                : t("conversationsEmpty") || ""}
            </div>
          ) : (
            folders.filter(shouldShowFolder).map((folder, index) => {
              const isExpanded = shouldExpandFolder(folder.id)
              const count = getFolderCount(folder.id)
              const folderName = getFolderDisplayName(folder)

              //  - 
              // 
              // 
              const useRainbow = settings?.features?.conversations?.folderRainbow ?? false
              let bgVar = "transparent"
              if (folder.isDefault) {
                bgVar = "var(--gh-folder-bg-default)"
              } else if (useRainbow) {
                bgVar = `var(--gh-folder-bg-${index % 8})`
              } else if (isExpanded) {
                //  ( / )
                bgVar = "var(--gh-folder-bg-expanded, rgba(59, 130, 246, 0.08))"
              }

              return (
                <React.Fragment key={folder.id}>
                  {/*  */}
                  <div
                    className={`conversations-folder-item ${isExpanded ? "expanded" : ""} ${folder.isDefault ? "default" : ""}`}
                    data-folder-id={folder.id}
                    style={{ background: bgVar }}
                    onClick={() => handleFolderClick(folder.id)}>
                    <div className="conversations-folder-info">
                      {/*  */}
                      {batchMode && (
                        <input
                          type="checkbox"
                          className="conversations-folder-checkbox"
                          checked={isFolderAllSelected(folder.id)}
                          ref={(el) => {
                            if (el) el.indeterminate = isFolderPartialSelected(folder.id)
                          }}
                          onChange={(e) => handleFolderSelectAll(folder.id, e.target.checked)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}

                      <span className="conversations-folder-icon" style={{ userSelect: "none" }}>
                        {folder.icon}
                      </span>

                      <Tooltip content={folderName}>
                        <span className="conversations-folder-name">
                          {searchQuery && searchResult?.folderMatches.has(folder.id)
                            ? highlightText(folderName, searchQuery)
                            : folderName}
                        </span>
                      </Tooltip>

                      {/*  */}
                      {!folder.isDefault && (
                        <div
                          className="conversations-folder-order-btns"
                          style={{ userSelect: "none" }}>
                          <button
                            className="conversations-folder-order-btn"
                            title={t("moveUp") || ""}
                            disabled={index <= 1}
                            onClick={() => {
                              manager.moveFolder(folder.id, "up")
                              loadData()
                            }}>
                            <ArrowUpIcon size={12} />
                          </button>
                          <button
                            className="conversations-folder-order-btn"
                            title={t("moveDown") || ""}
                            disabled={index >= folders.length - 1}
                            onClick={() => {
                              manager.moveFolder(folder.id, "down")
                              loadData()
                            }}>
                            <ArrowDownIcon size={12} />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="conversations-folder-controls">
                      <span className="conversations-folder-count">({count})</span>
                      <button
                        className="conversations-folder-menu-btn"
                        style={{
                          userSelect: "none",
                          visibility: folder.isDefault ? "hidden" : "visible",
                          pointerEvents: folder.isDefault ? "none" : "auto",
                        }}
                        onClick={(e) => {
                          e.stopPropagation()
                          onInteractionStateChange?.(true)
                          setMenu({ type: "folder", folder, anchorEl: e.currentTarget })
                        }}>
                        <MoreHorizontalIcon size={16} />
                      </button>
                    </div>
                  </div>

                  {/*  */}
                  {isExpanded && (
                    <div className="conversations-list" data-folder-id={folder.id}>
                      {getConversationsInFolder(folder.id).length === 0 ? (
                        <div className="conversations-list-empty">
                          {t("conversationsEmpty") || ""}
                        </div>
                      ) : (
                        getConversationsInFolder(folder.id).map((conv) => (
                          <div
                            key={conv.id}
                            className="conversations-item"
                            data-id={conv.id}
                            onClick={() => handleConversationClick(conv)}>
                            {batchMode && (
                              <input
                                type="checkbox"
                                className="conversations-item-checkbox"
                                checked={selectedIds.has(conv.id)}
                                onChange={() => {}}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  // 
                                  const newSelected = new Set(selectedIds)
                                  if (newSelected.has(conv.id)) {
                                    newSelected.delete(conv.id)
                                  } else {
                                    newSelected.add(conv.id)
                                  }
                                  setSelectedIds(newSelected)
                                }}
                              />
                            )}
                            {(() => {
                              const tagIds = conv.tagIds || []
                              const maxVisibleTags = isNarrowLayout ? 1 : 2
                              const resolvedTags = tagIds
                                .map((tagId) => tags.find((t) => t.id === tagId))
                                .filter((tag): tag is Tag => !!tag)
                              const visibleTags = resolvedTags.slice(0, maxVisibleTags)
                              const hiddenTags = resolvedTags.slice(maxVisibleTags)
                              const hiddenTagCount = hiddenTags.length

                              return (
                                <div className="conversations-item-main">
                                  <div className="conversations-item-headline">
                                    <Tooltip
                                      content={conv.title}
                                      triggerStyle={{
                                        flex: 1,
                                        minWidth: 0,
                                        overflow: "hidden",
                                        display: "block",
                                      }}>
                                      <span
                                        className="conversations-item-title"
                                        style={{ userSelect: "none" }}>
                                        {conv.pinned && (
                                          <PinIcon
                                            size={12}
                                            filled
                                            style={{
                                              display: "inline-block",
                                              marginRight: "4px",
                                              verticalAlign: "middle",
                                            }}
                                          />
                                        )}
                                        {searchQuery &&
                                        searchResult?.conversationMatches.has(conv.id)
                                          ? highlightText(conv.title || "", searchQuery)
                                          : conv.title || ""}
                                      </span>
                                    </Tooltip>

                                    {tagIds.length > 0 && (
                                      <div className="conversations-tag-list">
                                        {visibleTags.map((tag) => {
                                          return (
                                            <span
                                              key={tag.id}
                                              className="conversations-tag"
                                              style={{ backgroundColor: tag.color }}>
                                              {tag.name}
                                            </span>
                                          )
                                        })}
                                        {hiddenTagCount > 0 && (
                                          <Tooltip
                                            content={
                                              <div className="conversations-hidden-tags-tooltip">
                                                {resolvedTags.map((tag) => (
                                                  <div
                                                    key={tag.id}
                                                    className="conversations-hidden-tag-item">
                                                    <span
                                                      className="conversations-hidden-tag-dot"
                                                      style={{ backgroundColor: tag.color }}
                                                    />
                                                    <span>{tag.name}</span>
                                                  </div>
                                                ))}
                                              </div>
                                            }
                                            delay={120}
                                            triggerStyle={{ display: "inline-flex" }}>
                                            <span className="conversations-tag conversations-tag-more">
                                              +{hiddenTagCount}
                                            </span>
                                          </Tooltip>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )
                            })()}

                            <div className="conversations-item-meta">
                              <button
                                className="conversations-item-menu-btn"
                                title={t("more") || ""}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onInteractionStateChange?.(true)
                                  setMenu({ type: "conversation", conv, anchorEl: e.currentTarget })
                                }}>
                                <MoreHorizontalIcon size={16} />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </React.Fragment>
              )
            })
          )}
        </div>

        {/*  */}
        {batchMode && selectedIds.size > 0 && (
          <div className="conversations-batch-bar">
            <span className="conversations-batch-info">
              {(t("batchSelected") || " {n} ").replace("{n}", String(selectedIds.size))}
            </span>
            <div className="conversations-batch-btns">
              <Tooltip content={t("exportToClipboard") || " Markdown"}>
                <button
                  className="conversations-batch-btn"
                  style={{ padding: "4px 6px", minWidth: "auto", marginLeft: "4px" }}
                  onClick={async () => {
                    const convId = Array.from(selectedIds)[0]
                    await manager.exportConversation(convId, "clipboard")
                  }}>
                  <CopyIcon size={16} />
                </button>
              </Tooltip>
              <Tooltip content={t("batchExport") || ""}>
                <button
                  className="conversations-batch-btn"
                  style={{ padding: "4px 6px", minWidth: "auto", marginLeft: "4px" }}
                  onClick={(e) => {
                    onInteractionStateChange?.(true)
                    setMenu({ type: "export", anchorEl: e.currentTarget })
                  }}>
                  <ExportIcon size={16} />
                </button>
              </Tooltip>
              <Tooltip content={t("batchMove") || ""}>
                <button
                  className="conversations-batch-btn"
                  style={{ padding: "4px 6px", minWidth: "auto", marginLeft: "4px" }}
                  onClick={() => {
                    onInteractionStateChange?.(true)
                    setDialog({ type: "folderSelect", convIds: Array.from(selectedIds) })
                  }}>
                  <FolderMoveIcon size={16} />
                </button>
              </Tooltip>
              <Tooltip content={t("batchDelete") || ""}>
                <button
                  className="conversations-batch-btn danger"
                  style={{ padding: "4px 6px", minWidth: "auto", marginLeft: "4px" }}
                  onClick={() => {
                    onInteractionStateChange?.(true)
                    setDialog({
                      type: "confirm",
                      title: t("batchDelete") || "",
                      message: ` ${selectedIds.size} `,
                      danger: true,
                      onConfirm: async () => {
                        if (isDeleting) return
                        setDialog(null)
                        setIsDeleting(true)
                        await new Promise((resolve) => setTimeout(resolve, 0))
                        try {
                          const result = await manager.deleteConversations(Array.from(selectedIds))
                          if (result.localDeletedCount === 0) {
                            showToast(t("deleteError") || "")
                            return
                          }
                          if (result.remoteAttemptedCount > 0 && result.remoteFailedCount > 0) {
                            showToast(
                              ` ${result.localDeletedCount}  ${result.remoteFailedCount} `,
                            )
                          }
                          clearSelection()
                          await loadData()
                        } finally {
                          setIsDeleting(false)
                        }
                      },
                    })
                  }}>
                  <DeleteIcon size={16} />
                </button>
              </Tooltip>
              <Tooltip content={t("batchExit") || ""}>
                <button
                  className="conversations-batch-btn cancel"
                  style={{ padding: "4px 6px", minWidth: "auto", marginLeft: "4px" }}
                  onClick={clearSelection}>
                  <ClearIcon size={16} />
                </button>
              </Tooltip>
            </div>
          </div>
        )}
      </div>

      {/*  */}
      {dialog?.type === "confirm" && (
        <ConfirmDialog
          title={dialog.title}
          message={dialog.message}
          danger={dialog.danger}
          onConfirm={dialog.onConfirm}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.type === "folder" && (
        <FolderDialog
          folder={dialog.folder}
          onConfirm={async (name, icon) => {
            let newFolderId: string | null = null
            if (dialog.folder) {
              // 
              await manager.updateFolder(dialog.folder.id, { name, icon })
            } else {
              //  createFolder  ID ( manager  void )
              //  createFolder  void manager 
              //  manager.createFolder  async  manager  ID
              // 
              const folder = await manager.createFolder(name, icon)
              if (folder) newFolderId = folder.id
            }
            loadData()

            // "..."
            if (dialog.returnToSelect) {
              setDialog({
                type: "folderSelect",
                conv: dialog.returnToSelect.conv,
                convIds: dialog.returnToSelect.convIds,
                activeFolderId: newFolderId || undefined,
              })
            } else {
              setDialog(null)
            }
          }}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.type === "rename" && (
        <RenameDialog
          title={t("conversationsRename") || ""}
          currentValue={dialog.conv.title}
          onConfirm={async (newTitle) => {
            await manager.renameConversation(dialog.conv.id, newTitle)
            loadData()
            setDialog(null)
          }}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.type === "folderSelect" && (
        <FolderSelectDialog
          folders={folders}
          excludeFolderId={dialog.conv?.folderId}
          activeFolderId={dialog.activeFolderId}
          onSelect={async (folderId) => {
            if (dialog.conv) {
              await manager.moveConversation(dialog.conv.id, folderId)
            } else if (dialog.convIds) {
              for (const id of dialog.convIds) {
                await manager.moveConversation(id, folderId)
              }
              clearSelection()
            }
            loadData()
            setDialog(null)
          }}
          onCancel={() => setDialog(null)}
          onCreateFolder={() =>
            setDialog({
              type: "folder",
              returnToSelect: { conv: dialog.conv, convIds: dialog.convIds },
            })
          }
        />
      )}
      {dialog?.type === "tagManager" && (
        <TagManagerDialog
          tags={tags}
          conv={dialog.conv}
          onCancel={() => setDialog(null)}
          onCreateTag={async (name, color) => manager.createTag(name, color)}
          onUpdateTag={async (tagId, name, color) => manager.updateTag(tagId, name, color)}
          onDeleteTag={async (tagId) => manager.deleteTag(tagId)}
          onSetConversationTags={async (convId, tagIds) =>
            manager.setConversationTags(convId, tagIds)
          }
          onRefresh={() => loadData()}
        />
      )}

      {/*  */}
      {menu?.type === "folder" && (
        <FolderMenu
          folder={menu.folder}
          anchorEl={menu.anchorEl}
          onClose={() => setMenu(null)}
          onRename={() => {
            setMenu(null)
            setDialog({ type: "folder", folder: menu.folder })
          }}
          onDelete={() => {
            setMenu(null)
            setDialog({
              type: "confirm",
              title: t("conversationsDelete") || "",
              message: ` "${getFolderDisplayName(menu.folder)}" `,
              danger: true,
              onConfirm: async () => {
                await manager.deleteFolder(menu.folder.id)
                loadData()
                setDialog(null)
              },
            })
          }}
        />
      )}
      {menu?.type === "conversation" && (
        <ConversationMenu
          conversation={menu.conv}
          anchorEl={menu.anchorEl}
          onClose={() => setMenu(null)}
          onRename={() => {
            setMenu(null)
            setDialog({ type: "rename", conv: menu.conv })
          }}
          onTogglePin={async () => {
            setMenu(null)
            await manager.togglePin(menu.conv.id)
            loadData()
          }}
          onSetTags={() => {
            setMenu(null)
            setDialog({ type: "tagManager", conv: menu.conv })
          }}
          onMoveTo={() => {
            setMenu(null)
            setDialog({ type: "folderSelect", conv: menu.conv })
          }}
          onDelete={() => {
            setMenu(null)
            setDialog({
              type: "confirm",
              title: t("conversationsDelete") || "",
              message: ` "${menu.conv.title}" `,
              danger: true,
              onConfirm: async () => {
                if (isDeleting) return
                setDialog(null)
                setIsDeleting(true)
                await new Promise((resolve) => setTimeout(resolve, 0))
                try {
                  const result = await manager.deleteConversation(menu.conv.id)
                  if (!result.localDeleted) {
                    showToast(t("deleteError") || "")
                    return
                  }
                  if (result.remoteAttempted && !result.remoteSuccess) {
                    showToast("")
                  }
                  await loadData()
                } finally {
                  setIsDeleting(false)
                }
              },
            })
          }}
        />
      )}
      {menu?.type === "export" && (
        <ExportMenu
          anchorEl={menu.anchorEl}
          onClose={() => setMenu(null)}
          onExportMarkdown={async () => {
            setMenu(null)
            const convId =
              selectedIds.size > 0 ? Array.from(selectedIds)[0] : manager.siteAdapter.getSessionId()
            await manager.exportConversation(convId, "markdown")
          }}
          onExportJSON={async () => {
            setMenu(null)
            const convId =
              selectedIds.size > 0 ? Array.from(selectedIds)[0] : manager.siteAdapter.getSessionId()
            await manager.exportConversation(convId, "json")
          }}
          onExportTXT={async () => {
            setMenu(null)
            const convId =
              selectedIds.size > 0 ? Array.from(selectedIds)[0] : manager.siteAdapter.getSessionId()
            await manager.exportConversation(convId, "txt")
          }}
        />
      )}
    </>
  )
}
