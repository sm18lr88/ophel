/**
 *
 */

import {
  DEFAULT_KEYBINDINGS,
  isMacOS,
  type ShortcutActionId,
  type ShortcutBinding,
  type ShortcutsSettings,
} from "~constants/shortcuts"

export type ShortcutHandler = () => void

export class ShortcutManager {
  private handlers: Map<ShortcutActionId, ShortcutHandler> = new Map()
  private settings: ShortcutsSettings | null = null
  private isMac: boolean = isMacOS()
  private isListening: boolean = false
  private processedEvents: WeakSet<KeyboardEvent> = new WeakSet()

  /**
   */
  updateSettings(settings: ShortcutsSettings | undefined) {
    this.settings = settings || null
  }

  /**
   */
  register(actionId: ShortcutActionId, handler: ShortcutHandler) {
    this.handlers.set(actionId, handler)
  }

  /**
   */
  registerAll(handlers: Partial<Record<ShortcutActionId, ShortcutHandler>>) {
    for (const [actionId, handler] of Object.entries(handlers)) {
      if (handler) {
        this.handlers.set(actionId as ShortcutActionId, handler)
      }
    }
  }

  /**
   */
  unregister(actionId: ShortcutActionId) {
    this.handlers.delete(actionId)
  }

  /**
   */
  clearAll() {
    this.handlers.clear()
  }

  /**
   */
  startListening() {
    if (this.isListening) return

    window.addEventListener("keydown", this.handleKeyDown, true)
    document.addEventListener("keydown", this.handleKeyDown, true)
    this.isListening = true
  }

  /**
   */
  stopListening() {
    if (!this.isListening) return

    window.removeEventListener("keydown", this.handleKeyDown, true)
    document.removeEventListener("keydown", this.handleKeyDown, true)
    this.isListening = false
  }

  /**
   */
  private shouldIgnoreEvent(e: KeyboardEvent): boolean {
    const target = e.target
    if (!target || !(target instanceof Element)) return false

    const isEditable =
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      (target as HTMLElement).isContentEditable ||
      target.getAttribute("contenteditable") === "true" ||
      target.classList.contains("ProseMirror")

    if (isEditable) {
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        return true
      }
    }

    return false
  }

  /**
   */
  private matchesBinding(e: KeyboardEvent, binding: ShortcutBinding): boolean {
    const eventKey = e.key.toLowerCase()
    const bindingKey = binding.key.toLowerCase()

    let keyMatches =
      eventKey === bindingKey ||
      (bindingKey === "arrowup" && eventKey === "arrowup") ||
      (bindingKey === "arrowdown" && eventKey === "arrowdown") ||
      (bindingKey === "arrowleft" && eventKey === "arrowleft") ||
      (bindingKey === "arrowright" && eventKey === "arrowright")

    if (!keyMatches && binding.shift && /^[0-9]$/.test(bindingKey)) {
      if (e.code === `Digit${bindingKey}`) {
        keyMatches = true
      }
    }

    if (!keyMatches) return false

    const altMatches = !!binding.alt === e.altKey
    const shiftMatches = !!binding.shift === e.shiftKey

    let ctrlMetaMatches: boolean
    if (this.isMac) {
      const expectedMeta = !!binding.ctrl || !!binding.meta
      ctrlMetaMatches = expectedMeta === e.metaKey && !e.ctrlKey
    } else {
      ctrlMetaMatches = !!binding.ctrl === e.ctrlKey
    }

    return altMatches && shiftMatches && ctrlMetaMatches
  }

  /**
   */
  private handleKeyDown = (e: KeyboardEvent) => {
    if (this.processedEvents.has(e)) return
    this.processedEvents.add(e)

    if (e.isTrusted === false) return

    if (!this.settings?.enabled) return

    if (this.shouldIgnoreEvent(e)) return

    const keybindings = { ...DEFAULT_KEYBINDINGS, ...this.settings.keybindings }

    for (const [actionId, binding] of Object.entries(keybindings)) {
      if (binding === null) continue

      if (this.matchesBinding(e, binding)) {
        const handler = this.handlers.get(actionId as ShortcutActionId)
        if (handler) {
          e.preventDefault()
          e.stopPropagation()
          handler()
          return
        }
      }
    }
  }

  /**
   */
  trigger(actionId: ShortcutActionId) {
    const handler = this.handlers.get(actionId)
    if (handler) {
      handler()
    }
  }

  /**
   */
  destroy() {
    this.stopListening()
    this.clearAll()
  }
}

let shortcutManagerInstance: ShortcutManager | null = null

/**
 */
export function getShortcutManager(): ShortcutManager {
  if (!shortcutManagerInstance) {
    shortcutManagerInstance = new ShortcutManager()
  }
  return shortcutManagerInstance
}
