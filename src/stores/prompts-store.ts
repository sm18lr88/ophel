import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import { getDefaultPrompts, VIRTUAL_CATEGORY } from "~constants"
import type { Prompt } from "~utils/storage"

import { chromeStorageAdapter } from "./chrome-adapter"

interface PromptsState {
  prompts: Prompt[]
  _hasHydrated: boolean

  // Actions
  addPrompt: (data: Omit<Prompt, "id">) => Prompt
  updatePrompt: (id: string, data: Partial<Omit<Prompt, "id">>) => void
  deletePrompt: (id: string) => void
  renameCategory: (oldName: string, newName: string) => void
  deleteCategory: (name: string, defaultCategory?: string) => void
  updateOrder: (newOrderIds: string[]) => void
  togglePin: (id: string) => void
  updateLastUsed: (id: string) => void
  setPrompts: (prompts: Prompt[]) => void
  setHasHydrated: (state: boolean) => void
}

export const usePromptsStore = create<PromptsState>()(
  persist(
    (set, _get) => ({
      prompts: getDefaultPrompts(),
      _hasHydrated: false,

      addPrompt: (data) => {
        const newPrompt: Prompt = {
          id: "custom_" + Date.now(),
          ...data,
        }
        set((state) => ({
          prompts: [...state.prompts, newPrompt],
        }))
        return newPrompt
      },

      updatePrompt: (id, data) =>
        set((state) => ({
          prompts: state.prompts.map((p) => (p.id === id ? { ...p, ...data } : p)),
        })),

      deletePrompt: (id) =>
        set((state) => ({
          prompts: state.prompts.filter((p) => p.id !== id),
        })),

      renameCategory: (oldName, newName) =>
        set((state) => ({
          prompts: state.prompts.map((p) =>
            p.category === oldName ? { ...p, category: newName } : p,
          ),
        })),

      deleteCategory: (name, defaultCategory = "Uncategorized") =>
        set((state) => ({
          prompts: state.prompts.map((p) =>
            p.category === name ? { ...p, category: defaultCategory } : p,
          ),
        })),

      updateOrder: (newOrderIds) =>
        set((state) => {
          const ordered: Prompt[] = []
          newOrderIds.forEach((id) => {
            const p = state.prompts.find((x) => x.id === id)
            if (p) ordered.push(p)
          })
          state.prompts.forEach((p) => {
            if (!ordered.find((x) => x.id === p.id)) ordered.push(p)
          })
          return { prompts: ordered }
        }),

      setHasHydrated: (state) => set({ _hasHydrated: state }),

      togglePin: (id) =>
        set((state) => ({
          prompts: state.prompts.map((p) => (p.id === id ? { ...p, pinned: !p.pinned } : p)),
        })),

      updateLastUsed: (id) =>
        set((state) => ({
          prompts: state.prompts.map((p) => (p.id === id ? { ...p, lastUsedAt: Date.now() } : p)),
        })),

      setPrompts: (prompts) => set({ prompts }),
    }),
    {
      name: "prompts", // chrome.storage key
      storage: createJSONStorage(() => chromeStorageAdapter),
      partialize: (state) => ({ prompts: state.prompts }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    },
  ),
)

export const usePromptsHydrated = () => usePromptsStore((state) => state._hasHydrated)
export const usePrompts = () => usePromptsStore((state) => state.prompts)

export const getPromptsState = () => usePromptsStore.getState().prompts
export const getPromptsStore = () => usePromptsStore.getState()

export const getCategories = (): string[] => {
  const prompts = getPromptsState()
  const categories = new Set<string>()
  prompts.forEach((p) => {
    if (p.category) categories.add(p.category)
  })
  return Array.from(categories)
}

export const filterPrompts = (
  filter: string = "",
  category: string = VIRTUAL_CATEGORY.ALL,
): Prompt[] => {
  let filtered = getPromptsState()
  if (category !== VIRTUAL_CATEGORY.ALL && category !== VIRTUAL_CATEGORY.RECENT) {
    filtered = filtered.filter((p) => p.category === category)
  }
  if (filter) {
    const lowerFilter = filter.toLowerCase()
    filtered = filtered.filter(
      (p) =>
        p.title.toLowerCase().includes(lowerFilter) ||
        p.content.toLowerCase().includes(lowerFilter),
    )
  }
  return filtered
}
