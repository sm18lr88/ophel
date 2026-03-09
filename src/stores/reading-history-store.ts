import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import { chromeStorageAdapter } from "./chrome-adapter"

export interface ReadingPosition {
  top: number
  ts: number
  type?: "selector" | "index"
  selector?: string
  textSignature?: string
  index?: number
  offset?: number
  scrollHeight?: number
}

interface ReadingHistoryState {
  history: Record<string, ReadingPosition>
  lastCleanupRun: number
  _hasHydrated: boolean

  // Actions
  savePosition: (key: string, position: ReadingPosition) => void
  getPosition: (key: string) => ReadingPosition | undefined
  cleanup: (days: number) => void
  setHasHydrated: (state: boolean) => void
}

export const useReadingHistoryStore = create<ReadingHistoryState>()(
  persist(
    (set, get) => ({
      history: {},
      lastCleanupRun: 0,
      _hasHydrated: false,

      savePosition: (key, position) =>
        set((state) => ({
          history: { ...state.history, [key]: position },
        })),

      getPosition: (key) => {
        return get().history[key]
      },

      cleanup: (days) => {
        if (days === -1) return

        const now = Date.now()
        const state = get()

        if (now - state.lastCleanupRun < 24 * 60 * 60 * 1000) return

        const expireTime = days * 24 * 60 * 60 * 1000
        const newHistory: Record<string, ReadingPosition> = {}
        let changed = false

        for (const [key, pos] of Object.entries(state.history)) {
          if (now - pos.ts <= expireTime) {
            newHistory[key] = pos
          } else {
            changed = true
          }
        }

        if (changed) {
          set({ history: newHistory, lastCleanupRun: now })
        } else {
          set({ lastCleanupRun: now })
        }
      },

      setHasHydrated: (state) => set({ _hasHydrated: state }),
    }),
    {
      name: "readingHistory", // chrome.storage key
      storage: createJSONStorage(() => chromeStorageAdapter),
      partialize: (state) => ({
        history: state.history,
        lastCleanupRun: state.lastCleanupRun,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    },
  ),
)

export const useReadingHistoryHydrated = () => useReadingHistoryStore((state) => state._hasHydrated)

export const getReadingHistoryStore = () => useReadingHistoryStore.getState()
