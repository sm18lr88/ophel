import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import { DEFAULT_FOLDERS, type Folder } from "~constants"

import { chromeStorageAdapter } from "./chrome-adapter"

const normalizeFolderName = (name: string, icon: string): string => {
  const trimmedName = (name || "").trim()
  const trimmedIcon = (icon || "").trim()

  if (!trimmedIcon) {
    return trimmedName
  }

  if (trimmedName.startsWith(trimmedIcon)) {
    return trimmedName.slice(trimmedIcon.length).trim()
  }

  return trimmedName
}

const normalizeFolder = (folder: Folder): Folder => ({
  ...folder,
  name: normalizeFolderName(folder.name, folder.icon),
})

const normalizeFolders = (folders: Folder[]): Folder[] => folders.map(normalizeFolder)

interface FoldersState {
  folders: Folder[]
  _hasHydrated: boolean

  // Actions
  addFolder: (name: string, icon: string) => Folder
  updateFolder: (id: string, updates: Partial<Folder>) => void
  deleteFolder: (id: string) => void
  moveFolder: (id: string, direction: "up" | "down") => void
  setHasHydrated: (state: boolean) => void
}

export const useFoldersStore = create<FoldersState>()(
  persist(
    (set, _get) => ({
      folders: DEFAULT_FOLDERS,
      _hasHydrated: false,

      addFolder: (name, icon) => {
        const newFolder: Folder = {
          id: "folder_" + Date.now(),
          name: normalizeFolderName(name, icon),
          icon,
        }
        set((state) => ({
          folders: [...state.folders, newFolder],
        }))
        return newFolder
      },

      updateFolder: (id, updates) =>
        set((state) => ({
          folders: state.folders.map((folder) => {
            if (folder.id !== id) {
              return folder
            }

            const nextFolder = { ...folder, ...updates }
            return {
              ...nextFolder,
              name: normalizeFolderName(nextFolder.name, nextFolder.icon),
            }
          }),
        })),

      deleteFolder: (id) => {
        if (id === "inbox") return
        set((state) => ({
          folders: state.folders.filter((f) => f.id !== id),
        }))
      },

      moveFolder: (id, direction) =>
        set((state) => {
          const index = state.folders.findIndex((f) => f.id === id)
          if (index === -1 || index === 0) return state

          const newIndex = direction === "up" ? index - 1 : index + 1
          if (newIndex <= 0 || newIndex >= state.folders.length) return state

          const newFolders = [...state.folders]
          ;[newFolders[index], newFolders[newIndex]] = [newFolders[newIndex], newFolders[index]]
          return { folders: newFolders }
        }),

      setHasHydrated: (state) => set({ _hasHydrated: state }),
    }),
    {
      name: "folders", // chrome.storage key
      storage: createJSONStorage(() => chromeStorageAdapter),
      partialize: (state) => ({ folders: state.folders }),
      merge: (persistedState, currentState) => {
        const typedState = persistedState as Partial<FoldersState> | undefined

        if (!typedState?.folders) {
          return currentState
        }

        return {
          ...currentState,
          ...typedState,
          folders: normalizeFolders(typedState.folders),
        }
      },
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    },
  ),
)

export const useFoldersHydrated = () => useFoldersStore((state) => state._hasHydrated)
export const useFolders = () => useFoldersStore((state) => state.folders)

export const getFoldersState = () => useFoldersStore.getState().folders
export const getFoldersStore = () => useFoldersStore.getState()
