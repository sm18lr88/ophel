import type { StateStorage } from "zustand/middleware"

declare const __PLATFORM__: "extension" | "userscript"

declare function GM_getValue<T>(key: string, defaultValue?: T): T
declare function GM_setValue(key: string, value: unknown): void
declare function GM_deleteValue(key: string): void

const userscriptStorageAdapter: StateStorage = {
  getItem: (name: string): string | null => {
    const value = GM_getValue(name)
    if (value === undefined || value === null) {
      return null
    }
    return typeof value === "string" ? value : JSON.stringify(value)
  },

  setItem: (name: string, value: string): void => {
    GM_setValue(name, value)
  },

  removeItem: (name: string): void => {
    GM_deleteValue(name)
  },
}

const extensionStorageAdapter: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return new Promise((resolve) => {
      chrome.storage.local.get(name, (result) => {
        const value = result[name]
        if (value === undefined) {
          resolve(null)
          return
        }

        if (typeof value === "string") {
          resolve(value)
        } else {
          resolve(JSON.stringify(value))
        }
      })
    })
  },

  setItem: async (name: string, value: string): Promise<void> => {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [name]: value }, () => {
        resolve()
      })
    })
  },

  removeItem: async (name: string): Promise<void> => {
    return new Promise((resolve) => {
      chrome.storage.local.remove(name, () => {
        resolve()
      })
    })
  },
}

export const chromeStorageAdapter: StateStorage =
  typeof __PLATFORM__ !== "undefined" && __PLATFORM__ === "userscript"
    ? userscriptStorageAdapter
    : extensionStorageAdapter
