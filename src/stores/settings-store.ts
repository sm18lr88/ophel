import { create } from "zustand"
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware"

import { DEFAULT_SETTINGS, type Settings } from "~utils/storage"

import { chromeStorageAdapter } from "./chrome-adapter"

let isUpdatingFromStorage = false

const storageAdapter: StateStorage = {
  ...chromeStorageAdapter,
  setItem: async (name, value) => {
    if (isUpdatingFromStorage) {
      return
    }
    return chromeStorageAdapter.setItem(name, value)
  },
}

interface SettingsState {
  settings: Settings
  _hasHydrated: boolean
  _syncVersion: number

  // Actions
  setSettings: (settings: Partial<Settings>) => void
  updateNestedSetting: <K extends keyof Settings, P extends keyof NonNullable<Settings[K]>>(
    section: K,
    key: P,
    value: NonNullable<Settings[K]>[P],
  ) => void
  updateDeepSetting: (
    section: keyof Settings,
    subsection: string,
    key: string,
    value: unknown,
  ) => void
  replaceSettings: (settings: Settings) => void
  resetSettings: () => void
  setHasHydrated: (state: boolean) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, _get) => ({
      settings: DEFAULT_SETTINGS,
      _hasHydrated: false,
      _syncVersion: 0,

      setSettings: (newSettings) =>
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        })),

      updateNestedSetting: (section, key, value) =>
        set((state) => ({
          settings: {
            ...state.settings,
            [section]: {
              ...(state.settings[section] as object),
              [key]: value,
            },
          },
        })),

      updateDeepSetting: (section, subsection, key, value) =>
        set((state) => {
          const sectionObj = state.settings[section] as Record<string, unknown>
          const subsectionObj = (sectionObj?.[subsection] || {}) as Record<string, unknown>
          return {
            settings: {
              ...state.settings,
              [section]: {
                ...sectionObj,
                [subsection]: {
                  ...subsectionObj,
                  [key]: value,
                },
              },
            },
          }
        }),

      replaceSettings: (settings) =>
        set({
          settings: { ...DEFAULT_SETTINGS, ...settings },
        }),

      resetSettings: () =>
        set({
          settings: DEFAULT_SETTINGS,
        }),

      setHasHydrated: (state) => set({ _hasHydrated: state }),
    }),
    {
      name: "settings", // chrome.storage key
      storage: createJSONStorage(() => storageAdapter),
      partialize: (state) => ({ settings: state.settings }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    },
  ),
)

export const useSettingsHydrated = () => useSettingsStore((state) => state._hasHydrated)

export const useSettings = () => useSettingsStore((state) => state.settings)

export const getSettingsState = () => useSettingsStore.getState().settings

export const setSettingsState = (settings: Partial<Settings>) =>
  useSettingsStore.getState().setSettings(settings)

export const subscribeSettings = (listener: (settings: Settings) => void) =>
  useSettingsStore.subscribe((state) => listener(state.settings))

declare const __PLATFORM__: "extension" | "userscript"

const isExtension =
  (typeof __PLATFORM__ === "undefined" || __PLATFORM__ !== "userscript") &&
  typeof chrome !== "undefined" &&
  chrome.storage?.onChanged

if (isExtension) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return
    if (!changes.settings) return

    const newValue = changes.settings.newValue
    if (!newValue) return

    try {
      const parsed = typeof newValue === "string" ? JSON.parse(newValue) : newValue
      const newSettings = parsed?.state?.settings

      if (newSettings) {
        const currentState = useSettingsStore.getState()
        const currentSettings = currentState.settings
        const sortedStringify = (obj: unknown): string => {
          if (typeof obj !== "object" || obj === null) return JSON.stringify(obj)
          if (Array.isArray(obj)) return JSON.stringify(obj.map(sortedStringify))
          return JSON.stringify(
            Object.keys(obj)
              .sort()
              .reduce<Record<string, string>>((result, key) => {
                const objectValue = obj as Record<string, unknown>
                result[key] = sortedStringify(objectValue[key])
                return result
              }, {}),
          )
        }

        if (sortedStringify(currentSettings) !== sortedStringify(newSettings)) {
          isUpdatingFromStorage = true

          try {
            useSettingsStore.setState({
              settings: newSettings,
              _syncVersion: currentState._syncVersion + 1,
            })
          } finally {
            setTimeout(() => {
              isUpdatingFromStorage = false
            }, 100)
          }

          if (newSettings.language && newSettings.language !== currentSettings.language) {
            import("~utils/i18n")
              .then(({ setLanguage }) => {
                setLanguage(newSettings.language)
              })
              .catch(() => {
                // ignore
              })
          }
        }
      }
    } catch (err) {
      console.error("[SettingsStore] Failed to parse cross-context settings change:", err)
    }
  })
}
