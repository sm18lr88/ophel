import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import { chromeStorageAdapter } from "./chrome-adapter"
import type { OutlineItem } from "~adapters/base"

export interface Bookmark {
  id: string
  sessionId: string
  siteId: string
  cid: string
  title: string
  level: number
  signature: string
  scrollTop: number
  timestamp: number
}

interface BookmarkStore {
  bookmarks: Bookmark[]

  // Actions
  addBookmark: (
    sessionId: string,
    siteId: string,
    cid: string,
    node: OutlineItem,
    signature: string,
    scrollTop: number,
  ) => void
  removeBookmark: (id: string) => void
  toggleBookmark: (
    sessionId: string,
    siteId: string,
    cid: string,
    node: OutlineItem,
    signature: string,
    scrollTop: number,
  ) => void
  updateBookmark: (id: string, updates: Partial<Omit<Bookmark, "id">>) => void
  getBookmarksBySession: (sessionId: string) => Bookmark[]
  getBookmarkId: (sessionId: string, signature: string) => string | null
  clearSessionBookmarks: (sessionId: string) => void
  clearAllBookmarks: () => void
}

const flatBookmarkStorage = {
  getItem: async (_name: string) => {
    const data = await chromeStorageAdapter.getItem("bookmarks")
    if (data) {
      return JSON.stringify({ state: { bookmarks: JSON.parse(data) }, version: 0 })
    }
    return null
  },
  setItem: async (_name: string, value: string) => {
    const parsed = JSON.parse(value)
    const bookmarks = parsed.state?.bookmarks || []
    await chromeStorageAdapter.setItem("bookmarks", JSON.stringify(bookmarks))
  },
  removeItem: async (_name: string) => {
    await chromeStorageAdapter.removeItem("bookmarks")
  },
}

export const useBookmarkStore = create<BookmarkStore>()(
  persist(
    (set, get) => ({
      bookmarks: [],

      addBookmark: (sessionId, siteId, cid, node, signature, scrollTop) => {
        const newBookmark: Bookmark = {
          id: crypto.randomUUID(),
          sessionId,
          siteId,
          cid,
          title: node.text,
          level: node.level,
          signature,
          scrollTop,
          timestamp: Date.now(),
        }

        set((state) => ({
          bookmarks: [...state.bookmarks, newBookmark],
        }))
      },

      removeBookmark: (id) => {
        set((state) => ({
          bookmarks: state.bookmarks.filter((b) => b.id !== id),
        }))
      },

      updateBookmark: (id, updates) => {
        set((state) => ({
          bookmarks: state.bookmarks.map((b) => (b.id === id ? { ...b, ...updates } : b)),
        }))
      },

      toggleBookmark: (sessionId, siteId, cid, node, signature, scrollTop) => {
        const state = get()
        const existingId = state.getBookmarkId(sessionId, signature)

        if (existingId) {
          state.removeBookmark(existingId)
        } else {
          state.addBookmark(sessionId, siteId, cid, node, signature, scrollTop)
        }
      },

      getBookmarksBySession: (sessionId) => {
        return get().bookmarks.filter((b) => b.sessionId === sessionId)
      },

      getBookmarkId: (sessionId, signature) => {
        const found = get().bookmarks.find(
          (b) => b.sessionId === sessionId && b.signature === signature,
        )
        return found ? found.id : null
      },

      clearSessionBookmarks: (sessionId) => {
        set((state) => ({
          bookmarks: state.bookmarks.filter((b) => b.sessionId !== sessionId),
        }))
      },

      clearAllBookmarks: () => {
        set({ bookmarks: [] })
      },
    }),
    {
      name: "bookmarks",
      storage: createJSONStorage(() => flatBookmarkStorage),
    },
  ),
)
