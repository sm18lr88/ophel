import { create } from "zustand"

export interface QueueItem {
  id: string
  content: string
  createdAt: number
  status: "pending" | "sending" | "sent" | "failed"
  type?: "prompt" | "bookmark" | "shortcut"
}

interface QueueState {
  items: QueueItem[]
  isProcessing: boolean
  isPaused: boolean

  // Actions
  enqueue: (content: string) => QueueItem
  dequeue: () => QueueItem | null
  remove: (id: string) => void
  updateContent: (id: string, content: string) => void
  updateStatus: (id: string, status: QueueItem["status"]) => void
  clear: () => void
  pause: () => void
  resume: () => void
}

export const useQueueStore = create<QueueState>()((set, get) => ({
  items: [],
  isProcessing: false,
  isPaused: false,

  enqueue: (content) => {
    const item: QueueItem = {
      id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      content,
      createdAt: Date.now(),
      status: "pending",
      type: "prompt",
    }
    set((state) => ({
      items: [...state.items, item],
    }))
    return item
  },

  dequeue: () => {
    const { items } = get()
    const next = items.find((item) => item.status === "pending")
    if (!next) return null
    set((state) => ({
      items: state.items.map((item) =>
        item.id === next.id ? { ...item, status: "sending" as const } : item,
      ),
      isProcessing: true,
    }))
    return next
  },

  remove: (id) =>
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
    })),

  updateContent: (id, content) =>
    set((state) => ({
      items: state.items.map((item) => (item.id === id ? { ...item, content } : item)),
    })),

  updateStatus: (id, status) =>
    set((state) => {
      const newItems = state.items.map((item) => (item.id === id ? { ...item, status } : item))
      const hasActive = newItems.some(
        (item) => item.status === "pending" || item.status === "sending",
      )
      return { items: newItems, isProcessing: hasActive }
    }),

  clear: () => set({ items: [], isProcessing: false }),

  pause: () => set({ isPaused: true }),

  resume: () => set({ isPaused: false }),
}))

export const useQueueItems = () => useQueueStore((state) => state.items)
export const usePendingCount = () =>
  useQueueStore((state) => state.items.filter((i) => i.status === "pending").length)
export const useQueueProcessing = () => useQueueStore((state) => state.isProcessing)

export const getQueueState = () => useQueueStore.getState()
export const getQueueStore = () => useQueueStore.getState()
