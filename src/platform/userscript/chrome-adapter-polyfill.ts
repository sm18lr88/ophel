import type { StateStorage } from "zustand/middleware"

declare function GM_getValue<T>(key: string, defaultValue?: T): T
declare function GM_setValue(key: string, value: unknown): void
declare function GM_deleteValue(key: string): void

export const chromeStorageAdapter: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    const value = GM_getValue(name)
    if (value === undefined || value === null) {
      return null
    }
    const result = typeof value === "string" ? value : JSON.stringify(value)
    return result
  },

  setItem: async (name: string, value: string): Promise<void> => {
    GM_setValue(name, value)
  },

  removeItem: async (name: string): Promise<void> => {
    GM_deleteValue(name)
  },
}
