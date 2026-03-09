type Listener = () => void

let anchorPosition: number | null = null
const listeners = new Set<Listener>()

export const anchorStore = {
  get: (): number | null => anchorPosition,

  set: (position: number): void => {
    anchorPosition = position
    listeners.forEach((fn) => fn())
  },

  clear: (): void => {
    anchorPosition = null
    listeners.forEach((fn) => fn())
  },

  subscribe: (listener: Listener): (() => void) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },

  getSnapshot: (): number | null => anchorPosition,
}

export const hasAnchor = (): boolean => anchorPosition !== null
