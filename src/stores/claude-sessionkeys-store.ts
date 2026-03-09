import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import type { ClaudeSessionKey, ClaudeSessionKeysState } from "~utils/storage"

import { chromeStorageAdapter } from "./chrome-adapter"

interface SessionKeysStore extends ClaudeSessionKeysState {
  _hasHydrated: boolean

  // Actions
  addKey: (data: Omit<ClaudeSessionKey, "id" | "createdAt">) => ClaudeSessionKey
  updateKey: (id: string, data: Partial<Omit<ClaudeSessionKey, "id">>) => void
  deleteKey: (id: string) => void
  setCurrentKey: (id: string) => void
  testKey: (id: string, result: { isValid: boolean; accountType?: string }) => void
  setKeys: (keys: ClaudeSessionKey[]) => void
  setHasHydrated: (state: boolean) => void
}

export const useClaudeSessionKeysStore = create<SessionKeysStore>()(
  persist(
    (set, _get) => ({
      keys: [],
      currentKeyId: "",
      _hasHydrated: false,

      addKey: (data) => {
        const newKey: ClaudeSessionKey = {
          id: crypto.randomUUID(),
          ...data,
          createdAt: Date.now(),
        }
        set((state) => ({
          keys: [...state.keys, newKey],
        }))
        return newKey
      },

      updateKey: (id, data) =>
        set((state) => ({
          keys: state.keys.map((k) => (k.id === id ? { ...k, ...data } : k)),
        })),

      deleteKey: (id) =>
        set((state) => ({
          keys: state.keys.filter((k) => k.id !== id),
          currentKeyId: state.currentKeyId === id ? "" : state.currentKeyId,
        })),

      setCurrentKey: (id) => set({ currentKeyId: id }),

      testKey: (id, result) =>
        set((state) => ({
          keys: state.keys.map((k) =>
            k.id === id
              ? {
                  ...k,
                  isValid: result.isValid,
                  accountType: result.accountType as ClaudeSessionKey["accountType"],
                  testedAt: Date.now(),
                }
              : k,
          ),
        })),

      setKeys: (keys) => set({ keys }),

      setHasHydrated: (state) => set({ _hasHydrated: state }),
    }),
    {
      name: "claudeSessionKeys", // chrome.storage key
      storage: createJSONStorage(() => chromeStorageAdapter),
      partialize: (state) => ({
        keys: state.keys,
        currentKeyId: state.currentKeyId,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    },
  ),
)

export const useSessionKeysHydrated = () => useClaudeSessionKeysStore((state) => state._hasHydrated)
export const useSessionKeys = () => useClaudeSessionKeysStore((state) => state.keys)
export const useCurrentKeyId = () => useClaudeSessionKeysStore((state) => state.currentKeyId)

export const getSessionKeysState = () => useClaudeSessionKeysStore.getState()
export const getCurrentKey = (): ClaudeSessionKey | null => {
  const { keys, currentKeyId } = getSessionKeysState()
  if (!currentKeyId) return null
  return keys.find((k) => k.id === currentKeyId) || null
}
