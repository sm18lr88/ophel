import type { OutlineItem, SiteAdapter } from "~adapters/base"
import type { Settings } from "~utils/storage"
import { useBookmarkStore } from "~stores/bookmarks-store"
import { useSettingsStore } from "~stores/settings-store"
import { showToast } from "~utils/toast"
import { t } from "~utils/i18n"

type ExtendedOutlineItem = OutlineItem & {
  isBookmarked?: boolean
  isGhost?: boolean
  bookmarkId?: string
  scrollTop?: number
}

export interface OutlineNode extends OutlineItem {
  children: OutlineNode[]
  relativeLevel: number
  index: number
  collapsed: boolean
  forceExpanded?: boolean
  forceVisible?: boolean
  isMatch?: boolean
  hasMatchedDescendant?: boolean
  queryIndex?: number
  // Bookmark props
  isBookmarked?: boolean
  isGhost?: boolean
  bookmarkId?: string
  scrollTop?: number
  scrollHeight?: number
}

interface TreeState {
  collapsed: boolean
  forceExpanded?: boolean
  hadChildren: boolean
}

export class OutlineManager {
  private siteAdapter: SiteAdapter
  private settings: Settings["features"]["outline"]

  private tree: OutlineNode[] = []
  private flatItems: OutlineItem[] = []
  private flatNodes: OutlineNode[] = []
  private scrollNodes: OutlineNode[] = []
  private scrollPositions: number[] = []
  private scrollHeights: number[] = []
  private scrollPositionsStale: boolean = true

  // State
  private minLevel: number = 1
  private treeKey: string = ""
  private listeners: (() => void)[] = []
  private updateIntervalId: NodeJS.Timeout | null = null
  private isAutoUpdating = false

  // UI State
  private expandLevel: number = 6
  private levelCounts: Record<number, number> = {}
  private isAllExpanded: boolean = false

  // Search State
  private searchQuery: string = ""
  private preSearchState: Record<string, TreeState> | null = null
  private preSearchExpandLevel: number | null = null
  private searchLevelManual: boolean = false
  private matchCount: number = 0

  // Bookmark Filter Mode
  private bookmarkMode: boolean = false
  private preBookmarkModeState: Record<string, boolean> | null = null
  private ghostBookmarkIds: Set<string> = new Set()

  private wasGenerating: boolean = false
  private postGenerationScheduled: boolean = false

  private lastTreeChangeTime: number = 0
  private fallbackRefreshTimer: NodeJS.Timeout | null = null
  private static readonly FALLBACK_DELAY = 3000

  private isActive: boolean = false

  private isRefreshing: boolean = false

  // Bookmark store subscription
  private unsubscribeBookmarks: (() => void) | null = null

  private onExpandLevelChange?: (level: number) => void
  private onShowUserQueriesChange?: (show: boolean) => void

  constructor(
    adapter: SiteAdapter,
    settings: Settings["features"]["outline"],
    onExpandLevelChange?: (level: number) => void,
    onShowUserQueriesChange?: (show: boolean) => void,
  ) {
    this.siteAdapter = adapter
    this.settings = settings
    this.onExpandLevelChange = onExpandLevelChange
    this.onShowUserQueriesChange = onShowUserQueriesChange

    this.expandLevel = settings.expandLevel ?? 6

    // Listen to monitor messages
    window.addEventListener("message", this.handleMessage.bind(this))

    this.unsubscribeBookmarks = useBookmarkStore.subscribe(() => {
      if (this.isActive) {
        this.refresh()
      }
    })
  }

  setActive(active: boolean) {
    this.isActive = active
    this.updateAutoUpdateState()
  }

  private updateAutoUpdateState() {
    const shouldEnable = this.settings.enabled && this.settings.autoUpdate && this.isActive

    if (shouldEnable && !this.isAutoUpdating) {
      this.startAutoUpdate()
    } else if (!shouldEnable && this.isAutoUpdating) {
      this.stopAutoUpdate()
    }
  }

  updateSettings(newSettings: Settings["features"]["outline"]) {
    this.settings = newSettings
    if (newSettings.expandLevel !== undefined) {
      this.expandLevel = newSettings.expandLevel
    }
    this.refresh()
    this.updateAutoUpdateState()
  }

  // State for Auto Update
  private observer: MutationObserver | null = null
  private updateDebounceTimer: NodeJS.Timeout | null = null

  private handleMessage(event: MessageEvent) {
    if (event.source !== window) return
    if (event.origin !== window.location.origin) return

    const data = event.data
    if (!data || typeof data !== "object") return
    const { type } = data

    if (type === "GH_MONITOR_START" /* EVENT_MONITOR_START */) {
      if (this.settings.autoUpdate) {
        this.startAutoUpdate()
      }
    } else if (type === "GH_MONITOR_COMPLETE" /* EVENT_MONITOR_COMPLETE */) {
      this.stopAutoUpdate()
      // Final refresh
      this.refresh()
    }
  }

  private startAutoUpdate() {
    if (this.observer) return

    this.isAutoUpdating = true

    this.observer = new MutationObserver(() => {
      this.triggerAutoUpdate()
    })

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    })
  }

  private stopAutoUpdate() {
    if (this.observer) {
      this.observer.disconnect()
      this.observer = null
    }
    if (this.updateDebounceTimer) {
      clearTimeout(this.updateDebounceTimer)
      this.updateDebounceTimer = null
    }
    this.isAutoUpdating = false
  }

  private triggerAutoUpdate() {
    const interval = (this.settings.updateInterval || 2) * 1000

    // Debounce logic: wait for interval before updating
    if (!this.updateDebounceTimer) {
      this.updateDebounceTimer = setTimeout(() => {
        this.executeAutoUpdate()
      }, interval)
    }
  }

  private executeAutoUpdate() {
    if (this.updateDebounceTimer) {
      clearTimeout(this.updateDebounceTimer)
      this.updateDebounceTimer = null
    }

    const isGenerating = this.siteAdapter.isGenerating()

    if (this.wasGenerating && !isGenerating && !this.postGenerationScheduled) {
      this.postGenerationScheduled = true
      setTimeout(() => {
        this.postGenerationScheduled = false
        this.treeKey = ""
        this.refresh()
      }, 500)
    }

    this.wasGenerating = isGenerating

    const oldTreeKey = this.treeKey
    this.refresh()

    if (this.treeKey !== oldTreeKey) {
      this.lastTreeChangeTime = Date.now()
      if (this.fallbackRefreshTimer) {
        clearTimeout(this.fallbackRefreshTimer)
      }
      this.fallbackRefreshTimer = setTimeout(() => {
        this.fallbackRefreshTimer = null
        if (Date.now() - this.lastTreeChangeTime >= OutlineManager.FALLBACK_DELAY - 100) {
          this.treeKey = ""
          this.refresh()
        }
      }, OutlineManager.FALLBACK_DELAY)
    }
  }

  subscribe(listener: () => void) {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  private notify() {
    this.listeners.forEach((l) => l())
  }

  getTree(): OutlineNode[] {
    return this.tree
  }

  /**
   */
  getFlatItems(): OutlineItem[] {
    return this.flatItems
  }

  /**
   */
  getSignature(item: OutlineItem): string {
    return this.generateSignature(item)
  }

  getSearchQuery() {
    return this.searchQuery
  }

  getScrollContainer(): HTMLElement | null {
    return this.siteAdapter.getScrollContainer()
  }

  markScrollPositionsStale() {
    this.scrollPositionsStale = true
  }

  setBookmarkMode(enabled: boolean) {
    if (enabled && !this.bookmarkMode) {
      this.preBookmarkModeState = this.saveTreeCollapsedState(this.tree)
      this.collapseAllExpandedState(this.tree)
      this.expandBookmarkPaths(this.tree)
    } else if (!enabled && this.bookmarkMode) {
      if (this.preBookmarkModeState) {
        this.restoreTreeCollapsedState(this.tree, this.preBookmarkModeState)
        this.preBookmarkModeState = null
      }
    }
    this.bookmarkMode = enabled

    if (this.searchQuery) {
      this.performSearch(this.searchQuery)
    }

    this.notify()
  }

  toggleBookmarkMode() {
    this.setBookmarkMode(!this.bookmarkMode)
  }

  getBookmarkMode() {
    return this.bookmarkMode
  }

  /**
   */
  private saveTreeCollapsedState(nodes: OutlineNode[]): Record<string, boolean> {
    const state: Record<string, boolean> = {}
    const saveNode = (node: OutlineNode, path: string) => {
      const key = `${path}/${node.level}-${node.text}`
      state[key] = node.collapsed
      node.children.forEach((child, idx) => saveNode(child, `${key}/${idx}`))
    }
    nodes.forEach((n, idx) => saveNode(n, `root/${idx}`))
    return state
  }

  /**
   */
  private restoreTreeCollapsedState(nodes: OutlineNode[], state: Record<string, boolean>) {
    const restoreNode = (node: OutlineNode, path: string) => {
      const key = `${path}/${node.level}-${node.text}`
      if (key in state) {
        node.collapsed = state[key]
      }
      node.children.forEach((child, idx) => restoreNode(child, `${key}/${idx}`))
    }
    nodes.forEach((n, idx) => restoreNode(n, `root/${idx}`))
  }

  /**
   */
  private collapseAllExpandedState(nodes: OutlineNode[]) {
    nodes.forEach((node) => {
      node.collapsed = true
      if (node.children.length > 0) {
        this.collapseAllExpandedState(node.children)
      }
    })
  }

  /**
   */
  private expandBookmarkPaths(nodes: OutlineNode[]): boolean {
    let hasBookmark = false
    nodes.forEach((node) => {
      let childHasBookmark = false
      if (node.children.length > 0) {
        childHasBookmark = this.expandBookmarkPaths(node.children)
      }

      if (childHasBookmark) {
        node.collapsed = false
      }

      if (node.isBookmarked || childHasBookmark) {
        hasBookmark = true
      }
    })
    return hasBookmark
  }

  extractUserQueryText(element: Element): string {
    return this.siteAdapter.extractUserQueryText(element)
  }

  /**
   */
  findElementByHeading(level: number, text: string): Element | null {
    return this.siteAdapter.findElementByHeading(level, text)
  }

  /**
   */
  findUserQueryElement(queryIndex: number, text: string): Element | null {
    return this.siteAdapter.findUserQueryElement(queryIndex, text)
  }

  getState() {
    const minRelativeLevel = this.settings.showUserQueries ? 0 : 1

    let displayLevel: number
    if (this.searchQuery && !this.searchLevelManual) {
      displayLevel = 100
    } else {
      displayLevel = this.expandLevel ?? 6
    }
    const minDisplayLevel = this.settings.showUserQueries ? 0 : 1
    if (displayLevel < minDisplayLevel) {
      displayLevel = minDisplayLevel
    }

    return {
      tree: this.tree,
      expandLevel: this.expandLevel,
      levelCounts: this.levelCounts,
      isAllExpanded: this.isAllExpanded,
      includeUserQueries: this.settings.showUserQueries,
      minRelativeLevel,
      displayLevel,
      searchLevelManual: this.searchLevelManual,
      matchCount: this.matchCount,
      bookmarkMode: this.bookmarkMode,
    }
  }

  getGhostBookmarkIds(): string[] {
    return Array.from(this.ghostBookmarkIds)
  }

  clearGhostBookmarks(): number {
    const ids = this.getGhostBookmarkIds()
    if (ids.length === 0) return 0
    const store = useBookmarkStore.getState()
    ids.forEach((id) => store.removeBookmark(id))
    this.ghostBookmarkIds.clear()
    this.refresh()
    return ids.length
  }

  // --- Bookmark Logic ---

  private generateSignature(item: OutlineItem): string {
    if (item.id) {
      return item.id
    }

    let context = ""

    if (item.context) {
      context = item.context
    } else {
      try {
        if (item.element?.nextElementSibling) {
          context = (item.element.nextElementSibling.textContent || "").trim().substring(0, 50)
        }
      } catch {
        // Ignore
      }
    }

    return `${item.text}::${context}`
  }

  // Helper public method for UI
  toggleBookmark(node: OutlineNode) {
    const sessionId = this.siteAdapter.getSessionId()
    const siteId = this.siteAdapter.getSiteId()
    const cid = this.siteAdapter.getCurrentCid() || ""
    const signature = this.generateSignature(node)
    // Use node.element.offsetTop if available, or current scroll position?
    // Best is element.offsetTop usually.
    let scrollTop = 0
    if (node.element instanceof HTMLElement) {
      scrollTop = node.element.offsetTop
    } else if (node.scrollTop !== undefined) {
      scrollTop = node.scrollTop // If it's a ghost node or already has it
    }

    const store = useBookmarkStore.getState()
    const existingId = store.getBookmarkId(sessionId, signature)

    if (existingId) {
      store.removeBookmark(existingId)
      node.isBookmarked = false
      node.bookmarkId = undefined
    } else {
      store.addBookmark(sessionId, siteId, cid, node, signature, scrollTop)
      node.isBookmarked = true
      node.bookmarkId = store.getBookmarkId(sessionId, signature) || undefined
    }

    this.notify()
  }

  // Adjusted refresh signature
  refresh(overrideLevel?: number) {
    if (!this.settings.enabled || this.isRefreshing) return

    this.isRefreshing = true
    try {
      this._doRefresh(overrideLevel)
    } finally {
      this.isRefreshing = false
    }
  }

  private _doRefresh(overrideLevel?: number) {
    // Read showWordCount from live settings store to pick up changes without page refresh
    const liveSettings = useSettingsStore.getState().settings
    const showWordCount = liveSettings?.features?.outline?.showWordCount ?? false

    let outlineData = this.siteAdapter.extractOutline(
      this.settings.maxLevel,
      this.settings.showUserQueries,
      showWordCount,
    )

    // --- Merge Bookmarks ---
    const sessionId = this.siteAdapter.getSessionId()
    const bookmarks = useBookmarkStore.getState().getBookmarksBySession(sessionId)
    this.ghostBookmarkIds = new Set()

    if (bookmarks.length > 0) {
      // 1. Mark matched nodes
      // Create a map for fast lookup? No, signature might collision if simple.
      // Signatures are unique enough.

      const unmatchedBookmarkIds = new Set(bookmarks.map((b) => b.id))

      outlineData.forEach((item) => {
        const signature = this.generateSignature(item)
        // Find matching bookmark
        const bookmark = bookmarks.find((b) => b.signature === signature && b.title === item.text)

        if (bookmark) {
          ;(item as OutlineNode).isBookmarked = true
          ;(item as OutlineNode).bookmarkId = bookmark.id
          unmatchedBookmarkIds.delete(bookmark.id)
        }
      })

      const ghostCandidates: Record<string, string[]> = {} // text -> [bookmarkId]
      const targetCandidates: Record<string, OutlineItem[]> = {} // text -> [Item]

      unmatchedBookmarkIds.forEach((bid) => {
        const bookmark = bookmarks.find((b) => b.id === bid)
        if (bookmark) {
          if (!ghostCandidates[bookmark.title]) ghostCandidates[bookmark.title] = []
          ghostCandidates[bookmark.title].push(bookmark.id)
        }
      })

      outlineData.forEach((item) => {
        if (!(item as OutlineNode).isBookmarked) {
          if (!targetCandidates[item.text]) targetCandidates[item.text] = []
          targetCandidates[item.text].push(item)
        }
      })

      const store = useBookmarkStore.getState()

      Object.keys(ghostCandidates).forEach((text) => {
        const ghosts = ghostCandidates[text]
        const targets = targetCandidates[text]

        if (ghosts && targets && ghosts.length === 1 && targets.length === 1) {
          const bookmarkId = ghosts[0]
          const targetItem = targets[0]

          const newSignature = this.generateSignature(targetItem)

          store.updateBookmark(bookmarkId, { signature: newSignature })
          ;(targetItem as OutlineNode).isBookmarked = true
          ;(targetItem as OutlineNode).bookmarkId = bookmarkId

          unmatchedBookmarkIds.delete(bookmarkId)
        }
      })
      // -----------------------------------
      this.ghostBookmarkIds = new Set(unmatchedBookmarkIds)

      // 2. Insert Ghost Nodes
      const ghosts: OutlineItem[] = []
      unmatchedBookmarkIds.forEach((bid) => {
        const bookmark = bookmarks.find((b) => b.id === bid)
        if (bookmark) {
          if (bookmark.level === 0 && !this.settings.showUserQueries) {
            return
          }
          ghosts.push({
            level: bookmark.level,
            text: bookmark.title,
            element: null, // Ghost nodes have no element
            isUserQuery: bookmark.level === 0,
            // Custom props
            isBookmarked: true,
            isGhost: true,
            bookmarkId: bookmark.id,
            // Helper for sorting
            scrollTop: bookmark.scrollTop,
          } as ExtendedOutlineItem)
        }
      })

      if (ghosts.length > 0) {
        // Calculate offsets for real items to sort
        const getTop = (item: ExtendedOutlineItem) => {
          if (item.isGhost) return item.scrollTop
          if (item.element instanceof HTMLElement) return item.element.offsetTop
          return 0
        }

        // Merge and sort
        outlineData = [...outlineData, ...ghosts].sort((a, b) => getTop(a) - getTop(b))
      }
    }

    if (outlineData.length === 0) {
      // ... existing clear logic
      if (this.tree.length > 0) {
        this.tree = []
        this.flatNodes = []
        this.scrollNodes = []
        this.scrollPositions = []
        this.scrollHeights = []
        this.scrollPositionsStale = true
        this.notify()
      }
      return
    }

    // Calculate level counts
    this.levelCounts = {}
    outlineData.forEach((item) => {
      this.levelCounts[item.level] = (this.levelCounts[item.level] || 0) + 1
    })

    // Calculate minLevel (smart indentation)
    const headingLevels = outlineData.filter((item) => !item.isUserQuery).map((item) => item.level)
    this.minLevel = headingLevels.length > 0 ? Math.min(...headingLevels) : 1

    // Check if tree changed
    const showWordCountFlag = showWordCount ? "wc:1" : "wc:0"
    const sessionIdForKey = this.siteAdapter.getSessionId() || "no-session"
    const pathname = typeof window !== "undefined" ? window.location.pathname : ""
    const sessionScopeKey = `${this.siteAdapter.getSiteId()}:${sessionIdForKey}:${pathname}`
    const outlineKey =
      sessionScopeKey +
      "|" +
      showWordCountFlag +
      "|" +
      outlineData.map((i) => `${i.text}:${(i as ExtendedOutlineItem).isBookmarked}`).join("|")
    const currentStateMap: Record<string, TreeState> = {}
    if (this.tree.length > 0) {
      this.captureTreeState(this.tree, currentStateMap)
    }

    // Always rebuild if overrideLevel is provided to ensure state is reset
    if (this.treeKey !== outlineKey || this.tree.length === 0 || overrideLevel !== undefined) {
      this.tree = this.buildTree(outlineData, this.minLevel)
      this.treeKey = outlineKey
      this.flatItems = outlineData
      this.flatNodes = this.flattenTree(this.tree)
      this.updateScrollPositions()
    } else {
      this.scrollPositionsStale = true
      return
    }

    // Restore state
    const displayLevel = overrideLevel !== undefined ? overrideLevel : this.expandLevel ?? 6
    this.expandLevel = displayLevel

    const minDisplayLevel = this.settings.showUserQueries ? 0 : 1
    const effectiveDisplayLevel = displayLevel < minDisplayLevel ? minDisplayLevel : displayLevel

    // 1. Initialize logic
    this.initializeCollapsedState(this.tree, effectiveDisplayLevel)

    // 2. Restore user state (ONLY if not overriding)
    if (overrideLevel === undefined && Object.keys(currentStateMap).length > 0) {
      this.restoreTreeState(this.tree, currentStateMap)
    }

    // Re-apply search if needed
    if (this.searchQuery) {
      this.performSearch(this.searchQuery)
    }

    if (this.bookmarkMode) {
      // this.collapseAllExpandedState(this.tree)

      this.expandBookmarkPaths(this.tree)
    }

    const maxActualLevel = Math.max(...Object.keys(this.levelCounts).map(Number), 1)
    this.isAllExpanded = this.expandLevel >= maxActualLevel

    this.notify()
  }

  // Build tree from flat list
  private buildTree(outline: OutlineItem[], minLevel: number): OutlineNode[] {
    const tree: OutlineNode[] = []
    const stack: OutlineNode[] = []
    let queryCount = 0

    outline.forEach((item, index) => {
      const relativeLevel = item.isUserQuery ? 0 : item.level - minLevel + 1

      let queryIndex: number | undefined
      if (item.isUserQuery) {
        queryCount++
        queryIndex = queryCount
      }

      const node: OutlineNode = {
        ...item,
        relativeLevel,
        index, // This index is from the flat list returned by extractOutline
        queryIndex,
        children: [],
        collapsed: false,
      }
      // Inherit bookmark props from merged item
      // Inherit bookmark props from merged item
      const extItem = item as ExtendedOutlineItem
      if (extItem.isBookmarked) node.isBookmarked = true
      if (extItem.isGhost) node.isGhost = true
      if (extItem.bookmarkId) node.bookmarkId = extItem.bookmarkId

      while (stack.length > 0 && stack[stack.length - 1].relativeLevel >= relativeLevel) {
        stack.pop()
      }

      if (stack.length === 0) {
        tree.push(node)
      } else {
        stack[stack.length - 1].children.push(node)
      }
      stack.push(node)
    })

    return tree
  }

  // Flatten tree in pre-order to match outline order
  private flattenTree(nodes: OutlineNode[]): OutlineNode[] {
    const res: OutlineNode[] = []
    const traverse = (list: OutlineNode[]) => {
      list.forEach((n) => {
        res.push(n)
        if (n.children.length > 0) {
          traverse(n.children)
        }
      })
    }
    traverse(nodes)
    return res
  }

  // Update cached scroll positions for fast highlight lookup
  updateScrollPositions() {
    this.scrollNodes = []
    this.scrollPositions = []
    this.scrollHeights = []

    const container = this.getScrollContainer()
    if (!container || this.flatNodes.length === 0) return

    const containerRect = container.getBoundingClientRect()
    const containerTop = containerRect.top
    const containerScrollTop = container.scrollTop
    const entries: Array<{ node: OutlineNode; top: number; height: number; order: number }> = []
    let order = 0

    this.flatNodes.forEach((node) => {
      if (node.isGhost) return

      let element = node.element
      if (!element || !element.isConnected) {
        if (node.isUserQuery && node.level === 0 && node.queryIndex !== undefined) {
          element = this.findUserQueryElement(node.queryIndex, node.text) as HTMLElement
        } else {
          element = this.findElementByHeading(node.level, node.text) as HTMLElement
        }
        if (element) {
          node.element = element
        }
      }

      if (!element || !element.isConnected) return

      const clientRects = element.getClientRects()
      if (clientRects.length === 0) return

      const rect = element.getBoundingClientRect()
      const top = rect.top - containerTop + containerScrollTop
      const height = rect.height || clientRects[0]?.height || 0
      node.scrollTop = top
      node.scrollHeight = height

      entries.push({ node, top, height, order })
      order += 1
    })

    if (entries.length === 0) {
      this.scrollPositionsStale = false
      return
    }

    let isSorted = true
    for (let i = 1; i < entries.length; i += 1) {
      if (entries[i].top < entries[i - 1].top) {
        isSorted = false
        break
      }
    }

    if (!isSorted) {
      entries.sort((a, b) => {
        if (a.top === b.top) return a.order - b.order
        return a.top - b.top
      })
    }

    entries.forEach((entry) => {
      this.scrollNodes.push(entry.node)
      this.scrollPositions.push(entry.top)
      this.scrollHeights.push(entry.height)
    })

    this.scrollPositionsStale = false
  }

  // State Management
  private captureTreeState(nodes: OutlineNode[], stateMap: Record<string, TreeState>) {
    nodes.forEach((node) => {
      const key = `${node.level}_${node.text}`
      const hasChildren = node.children && node.children.length > 0
      stateMap[key] = {
        collapsed: node.collapsed,
        forceExpanded: node.forceExpanded,
        hadChildren: hasChildren,
      }
      if (hasChildren) {
        this.captureTreeState(node.children, stateMap)
      }
    })
  }

  private restoreTreeState(nodes: OutlineNode[], stateMap: Record<string, TreeState>) {
    nodes.forEach((node) => {
      const key = `${node.level}_${node.text}`
      const state = stateMap[key]
      if (state) {
        const hasChildrenNow = node.children && node.children.length > 0
        const hadChildrenBefore = state.hadChildren

        // Only restore collapsed state if we didn't go from no-children to children
        if (hadChildrenBefore || !hasChildrenNow) {
          node.collapsed = state.collapsed
        }

        if (state.forceExpanded !== undefined) {
          node.forceExpanded = state.forceExpanded
        }
      }
      if (node.children.length > 0) {
        this.restoreTreeState(node.children, stateMap)
      }
    })
  }

  private initializeCollapsedState(nodes: OutlineNode[], displayLevel: number) {
    nodes.forEach((node) => {
      if (node.children && node.children.length > 0) {
        // Legacy: child.level > displayLevel
        const allChildrenHidden = node.children.every((child) => child.level > displayLevel)
        node.collapsed = allChildrenHidden
        this.initializeCollapsedState(node.children, displayLevel)
      } else {
        node.collapsed = false
      }
    })
  }

  private clearForceExpandedState(nodes: OutlineNode[], displayLevel: number) {
    nodes.forEach((node) => {
      node.forceExpanded = false
      if (node.children && node.children.length > 0) {
        // Legacy: child.level > displayLevel
        const allChildrenHidden = node.children.every((child) => child.level > displayLevel)
        node.collapsed = allChildrenHidden
        this.clearForceExpandedState(node.children, displayLevel)
      } else {
        node.collapsed = false
      }
    })
  }

  // Actions
  toggleNode(node: OutlineNode) {
    node.collapsed = !node.collapsed
    if (!node.collapsed) {
      node.forceExpanded = true
    }
    this.notify()
  }

  collapseAll() {
    // Legacy: collapse to minLevel or 0 if showing user queries
    const targetLevel = this.settings.showUserQueries ? 0 : this.minLevel || 1
    this.setLevel(targetLevel)
  }

  expandAll() {
    // Legacy: expand to maxActualLevel
    const maxActualLevel = Math.max(...Object.keys(this.levelCounts).map(Number), 1)
    this.setLevel(maxActualLevel)
  }

  setLevel(level: number) {
    if (this.bookmarkMode) {
      showToast(t("bookmarkModeDisableLevel"))
      return
    }

    this.expandLevel = level

    if (this.tree.length > 0) {
      this.clearForceExpandedState(this.tree, level)
    }

    // Update isAllExpanded based on level vs maxActualLevel
    const maxActualLevel = Math.max(...Object.keys(this.levelCounts).map(Number), 1)
    this.isAllExpanded = level >= maxActualLevel

    if (this.searchQuery) {
      this.searchLevelManual = true
    }

    if (this.onExpandLevelChange) {
      this.onExpandLevelChange(level)
    }

    this.notify()
  }

  setShowUserQueries(show: boolean) {
    this.settings.showUserQueries = show

    this.refresh()

    this.notify()

    if (this.onShowUserQueriesChange) {
      this.onShowUserQueriesChange(show)
    }
  }

  toggleGroupMode() {
    this.setShowUserQueries(!this.settings.showUserQueries)
  }

  revealNode(index: number) {
    const clearForceVisible = (nodes: OutlineNode[]) => {
      nodes.forEach((node) => {
        node.forceVisible = false
        if (node.children && node.children.length > 0) {
          clearForceVisible(node.children)
        }
      })
    }
    clearForceVisible(this.tree)

    const markPath = (
      items: OutlineNode[],
      targetIndex: number,
      parents: OutlineNode[] = [],
    ): boolean => {
      for (const item of items) {
        if (item.index === targetIndex) {
          parents.forEach((p) => {
            p.collapsed = false
            p.forceExpanded = true
            p.forceVisible = true
          })
          item.forceVisible = true
          return true
        }
        if (item.children && item.children.length > 0) {
          if (markPath(item.children, targetIndex, [...parents, item])) {
            return true
          }
        }
      }
      return false
    }

    if (markPath(this.tree, index)) {
      this.notify()
    }
  }

  clearForceVisible() {
    const clear = (nodes: OutlineNode[]) => {
      nodes.forEach((node) => {
        if (node.forceVisible) {
          node.forceVisible = false
          node.forceExpanded = false
          if (node.children && node.children.length > 0) {
            const hasChildBeyondLevel = node.children.every(
              (child) => child.relativeLevel > this.expandLevel,
            )
            node.collapsed = hasChildBeyondLevel
          }
        }
        if (node.children && node.children.length > 0) {
          clear(node.children)
        }
      })
    }
    clear(this.tree)

    this.notify()
  }

  setSearchQuery(query: string) {
    if (!query) {
      this.searchQuery = ""
      this.searchLevelManual = false

      if (this.tree.length > 0) {
        if (this.preSearchExpandLevel !== null) {
          this.expandLevel = this.preSearchExpandLevel
          this.preSearchExpandLevel = null
        }

        const displayLevel = this.expandLevel ?? 6
        this.clearForceExpandedState(this.tree, displayLevel)

        if (this.preSearchState) {
          this.restoreTreeState(this.tree, this.preSearchState)
          this.preSearchState = null
        }
      }
    } else {
      if (!this.searchQuery && this.tree.length > 0) {
        this.preSearchState = {}
        this.captureTreeState(this.tree, this.preSearchState)
        this.preSearchExpandLevel = this.expandLevel
      }

      if (this.tree.length > 0) {
        this.clearForceExpandedState(this.tree, 0)
      }

      this.searchQuery = query
      this.searchLevelManual = false
      this.performSearch(query)
    }
    this.notify()
  }

  private performSearch(query: string) {
    const normalize = (str: string) => str.toLowerCase()
    const normalizedQuery = normalize(query)
    let matchCount = 0

    const traverse = (nodes: OutlineNode[]): boolean => {
      let hasAnyMatch = false
      nodes.forEach((node) => {
        const isMatch = normalize(node.text).includes(normalizedQuery)
        // Ensure bookmarks are also searchable
        node.isMatch = isMatch

        if (isMatch) {
          if (this.bookmarkMode) {
            const hasBookmarkDescendant = (n: OutlineNode): boolean => {
              if (n.isBookmarked) return true
              return n.children?.some(hasBookmarkDescendant) || false
            }

            if (node.isBookmarked || hasBookmarkDescendant(node)) {
              matchCount++
            }
          } else {
            matchCount++
          }
        }

        if (node.children.length > 0) {
          let shouldTraverseChildren = true

          if (this.bookmarkMode) {
            const hasBookmarkDescendant = (n: OutlineNode): boolean => {
              if (n.isBookmarked) return true
              return n.children?.some(hasBookmarkDescendant) || false
            }

            if (node.isBookmarked && !node.children.some(hasBookmarkDescendant)) {
              shouldTraverseChildren = false
            }
          }

          if (shouldTraverseChildren) {
            node.hasMatchedDescendant = traverse(node.children)
          } else {
            node.hasMatchedDescendant = false
          }
        } else {
          node.hasMatchedDescendant = false
        }

        if (node.hasMatchedDescendant) {
          node.collapsed = false
        }

        if (isMatch || node.hasMatchedDescendant) {
          hasAnyMatch = true
        }
      })
      return hasAnyMatch
    }

    traverse(this.tree)
    this.matchCount = matchCount
  }

  // Sync Scroll Helper
  // Returns index of the item that should be highlighted

  findVisibleItemIndex(scrollTop: number, viewportHeight: number): number | null {
    // Only active when followMode === "current"
    if (this.settings.followMode !== "current") return null

    if (this.scrollPositionsStale) {
      this.updateScrollPositions()
    }

    const count = this.scrollNodes.length
    if (count === 0) return null

    const top = scrollTop
    const bottom = scrollTop + viewportHeight

    // Binary search: last item with top <= viewportTop
    let lo = 0
    let hi = count - 1
    let idx = -1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (this.scrollPositions[mid] <= top) {
        idx = mid
        lo = mid + 1
      } else {
        hi = mid - 1
      }
    }

    if (idx >= 0) {
      const itemTop = this.scrollPositions[idx]
      const itemHeight = this.scrollHeights[idx] || 0
      if (itemTop < bottom && (itemHeight === 0 || itemTop + itemHeight > top)) {
        return this.scrollNodes[idx].index
      }
      if (idx + 1 < count && this.scrollPositions[idx + 1] < bottom) {
        return this.scrollNodes[idx + 1].index
      }
      return null
    }

    if (this.scrollPositions[0] < bottom) {
      return this.scrollNodes[0].index
    }

    return null
  }
}
