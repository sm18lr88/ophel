import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import type { Tag } from "~utils/storage"

import { chromeStorageAdapter } from "./chrome-adapter"

interface TagsState {
  tags: Tag[]
  _hasHydrated: boolean

  // Actions
  addTag: (name: string, color: string) => Tag | null
  updateTag: (tagId: string, name: string, color: string) => Tag | null
  deleteTag: (tagId: string) => void
  setHasHydrated: (state: boolean) => void
}

export const useTagsStore = create<TagsState>()(
  persist(
    (set, get) => ({
      tags: [],
      _hasHydrated: false,

      addTag: (name, color) => {
        const state = get()
        const exists = state.tags.some((t) => t.name.toLowerCase() === name.toLowerCase())
        if (exists) return null

        const newTag: Tag = {
          id: "tag_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
          name,
          color,
        }
        set((s) => ({
          tags: [...s.tags, newTag],
        }))
        return newTag
      },

      updateTag: (tagId, name, color) => {
        const state = get()
        const exists = state.tags.some(
          (t) => t.id !== tagId && t.name.toLowerCase() === name.toLowerCase(),
        )
        if (exists) return null

        let updatedTag: Tag | null = null
        set((s) => ({
          tags: s.tags.map((t) => {
            if (t.id === tagId) {
              updatedTag = { ...t, name, color }
              return updatedTag
            }
            return t
          }),
        }))
        return updatedTag
      },

      deleteTag: (tagId) =>
        set((state) => ({
          tags: state.tags.filter((t) => t.id !== tagId),
        })),

      setHasHydrated: (state) => set({ _hasHydrated: state }),
    }),
    {
      name: "tags", // chrome.storage key
      storage: createJSONStorage(() => chromeStorageAdapter),
      partialize: (state) => ({ tags: state.tags }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    },
  ),
)

export const useTagsHydrated = () => useTagsStore((state) => state._hasHydrated)
export const useTags = () => useTagsStore((state) => state.tags)

export const getTagsState = () => useTagsStore.getState().tags
export const getTagsStore = () => useTagsStore.getState()
