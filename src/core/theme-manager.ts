/**
 */

import type { SiteAdapter } from "~adapters/base"
import { SITE_IDS } from "~constants/defaults"
import { DOMToolkit } from "~utils/dom-toolkit"
import type { CustomStyle } from "~utils/storage"
import {
  getPreset,
  themeVariablesToCSS,
  type ThemePreset,
  type ThemeVariables,
} from "~utils/themes"

export type ThemeMode = "light" | "dark"
export type ThemePreference = "light" | "dark" | "system"

declare global {
  interface ViewTransition {
    readonly ready: Promise<void>
    readonly finished: Promise<void>
  }

  interface Document {
    startViewTransition(callback?: () => void): ViewTransition
  }
}

export type ThemeModeChangeCallback = (mode: ThemeMode, preference: ThemePreference) => void

type Listener = () => void

export class ThemeManager {
  private mode: ThemeMode
  private preference: ThemePreference
  private lightPresetId: string
  private darkPresetId: string
  private cleanPresetId: string // Purely for debugging or tracking
  private themeObserver: MutationObserver | null = null
  private onModeChange?: ThemeModeChangeCallback
  private adapter?: SiteAdapter | null
  private customStyles: CustomStyle[] = []
  private skipNextDetection = false
  private listeners: Set<Listener> = new Set()
  private systemMediaQuery: MediaQueryList | null = null
  private handleSystemChange = (event: MediaQueryListEvent) => {
    if (this.preference !== "system") return
    const nextMode: ThemeMode = event.matches ? "dark" : "light"
    if (this.mode === nextMode) return
    this.mode = nextMode
    this.emitChange()
    this.syncPageTheme(nextMode, "system")
    if (this.onModeChange) {
      this.onModeChange(nextMode, this.preference)
    }
  }

  constructor(
    mode: ThemePreference | string,
    onModeChange?: ThemeModeChangeCallback,
    adapter?: SiteAdapter | null,
    lightPresetId: string = "google-gradient",
    darkPresetId: string = "classic-dark",
  ) {
    const normalizedPreference: ThemePreference =
      mode === "system" ? "system" : mode === "dark" ? "dark" : "light"
    this.preference = normalizedPreference
    this.mode = this.resolveMode(normalizedPreference)
    this.lightPresetId = lightPresetId
    this.darkPresetId = darkPresetId
    this.onModeChange = onModeChange
    this.adapter = adapter

    this.injectGlobalStyles()
    this.ensureSystemListener()
  }

  private ensureSystemListener() {
    if (this.systemMediaQuery || typeof window === "undefined" || !window.matchMedia) {
      return
    }
    this.systemMediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    if (typeof this.systemMediaQuery.addEventListener === "function") {
      this.systemMediaQuery.addEventListener("change", this.handleSystemChange)
    } else if (typeof this.systemMediaQuery.addListener === "function") {
      this.systemMediaQuery.addListener(this.handleSystemChange)
    }
  }

  private getSystemMode(): ThemeMode {
    if (typeof window === "undefined" || !window.matchMedia) {
      return "light"
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  }

  private resolveMode(preference: ThemePreference): ThemeMode {
    if (preference === "system") {
      return this.getSystemMode()
    }
    return preference
  }

  private syncPageTheme(targetMode: ThemeMode, preference: ThemePreference = targetMode) {
    if (preference === "system") {
      const handled = this.applySystemPreference(targetMode)
      if (!handled && this.adapter && typeof this.adapter.toggleTheme === "function") {
        this.adapter.toggleTheme(targetMode).catch(() => {})
      }
    } else if (this.adapter && typeof this.adapter.toggleTheme === "function") {
      this.adapter.toggleTheme(preference).catch(() => {})
    }
    this.apply(targetMode)
  }

  private applySystemPreference(targetMode: ThemeMode): boolean {
    if (!this.adapter) return false
    const siteId = this.adapter.getSiteId()
    try {
      switch (siteId) {
        case SITE_IDS.CHATGPT: {
          localStorage.setItem("theme", "system")
          document.documentElement.className = targetMode
          window.dispatchEvent(
            new StorageEvent("storage", {
              key: "theme",
              newValue: "system",
              storageArea: localStorage,
            }),
          )
          return true
        }
        case SITE_IDS.GROK: {
          localStorage.setItem("theme", "system")
          document.documentElement.classList.remove("light", "dark")
          document.documentElement.classList.add(targetMode)
          document.documentElement.style.colorScheme = targetMode
          window.dispatchEvent(
            new StorageEvent("storage", {
              key: "theme",
              newValue: "system",
              storageArea: localStorage,
            }),
          )
          return true
        }
        case SITE_IDS.AISTUDIO: {
          const prefStr = localStorage.getItem("aiStudioUserPreference") || "{}"
          let pref: Record<string, unknown> = {}
          try {
            pref = JSON.parse(prefStr)
          } catch {
            pref = {}
          }
          pref.theme = "system"
          const nextValue = JSON.stringify(pref)
          localStorage.setItem("aiStudioUserPreference", nextValue)

          const body = document.body
          if (targetMode === "dark") {
            body.classList.add("dark-theme")
            body.classList.remove("light-theme")
          } else {
            body.classList.remove("dark-theme")
            body.classList.add("light-theme")
          }
          body.style.colorScheme = targetMode

          window.dispatchEvent(
            new StorageEvent("storage", {
              key: "aiStudioUserPreference",
              newValue: nextValue,
              storageArea: localStorage,
            }),
          )

          const appRoot = document.querySelector("app-root, ms-app, body")
          if (appRoot) {
            appRoot.dispatchEvent(new CustomEvent("themechange", { detail: { theme: targetMode } }))
          }
          return true
        }
        case SITE_IDS.GEMINI: {
          localStorage.removeItem("Bard-Color-Theme")
          if (targetMode === "dark") {
            document.body.classList.add("dark-theme")
            document.body.classList.remove("light-theme")
          } else {
            document.body.classList.remove("dark-theme")
            document.body.classList.add("light-theme")
          }
          document.body.style.colorScheme = targetMode
          window.dispatchEvent(
            new StorageEvent("storage", {
              key: "Bard-Color-Theme",
              newValue: null,
              storageArea: localStorage,
            }),
          )
          return true
        }
        case SITE_IDS.CLAUDE: {
          const themeData = {
            value: "auto",
            tabId: crypto.randomUUID(),
            timestamp: Date.now(),
          }
          const nextValue = JSON.stringify(themeData)
          localStorage.setItem("LSS-userThemeMode", nextValue)
          window.dispatchEvent(
            new StorageEvent("storage", {
              key: "LSS-userThemeMode",
              newValue: nextValue,
            }),
          )
          return true
        }
        case SITE_IDS.GEMINI_ENTERPRISE: {
          if (this.adapter && typeof this.adapter.toggleTheme === "function") {
            ;(
              this.adapter as SiteAdapter & {
                toggleTheme: (targetMode: "light" | "dark" | "system") => Promise<boolean>
              }
            )
              .toggleTheme("system")
              .catch(() => {})
            return true
          }
          return false
        }
        default:
          return false
      }
    } catch {
      return false
    }
  }

  /**
   */
  private injectGlobalStyles() {
    if (document.getElementById("gh-global-styles")) return

    const style = document.createElement("style")
    style.id = "gh-global-styles"
    style.textContent = `
      ::view-transition-old(root),
      ::view-transition-new(root) {
        animation: none;
        mix-blend-mode: normal;
      }
      
      ::view-transition-new(root) {
        clip-path: circle(0px at var(--theme-x, 50%) var(--theme-y, 50%));
      }
    `
    document.head.appendChild(style)
  }

  /**
   */
  setAdapter(adapter: SiteAdapter | null) {
    this.adapter = adapter
  }

  /**
   */
  setOnModeChange(callback: ThemeModeChangeCallback | undefined) {
    this.onModeChange = callback
  }

  /**
   */
  updateMode(mode: ThemePreference | string) {
    const normalizedPreference: ThemePreference =
      mode === "system" ? "system" : mode === "dark" ? "dark" : "light"
    this.preference = normalizedPreference
    this.mode = this.resolveMode(normalizedPreference)
    this.emitChange()
    if (this.preference === "system") {
      this.syncPageTheme(this.mode, "system")
      return
    }
    this.apply(this.mode)
  }

  /**
   */
  private detectCurrentTheme(): ThemeMode {
    const htmlClass = document.documentElement.className
    if (/\bdark\b/i.test(htmlClass)) {
      return "dark"
    } else if (/\blight\b/i.test(htmlClass)) {
      return "light"
    }

    const bodyClass = document.body.className
    if (/\bdark-theme\b/i.test(bodyClass)) {
      return "dark"
    } else if (/\blight-theme\b/i.test(bodyClass)) {
      return "light"
    }

    const dataTheme = document.body.dataset.theme || document.documentElement.dataset.theme
    if (dataTheme === "dark") {
      return "dark"
    } else if (dataTheme === "light") {
      return "light"
    }

    if (document.body.style.colorScheme === "dark") {
      return "dark"
    }

    return "light"
  }

  private detectThemePreference(): ThemePreference | null {
    if (!this.adapter) return null
    const siteId = this.adapter.getSiteId()
    try {
      switch (siteId) {
        case SITE_IDS.CHATGPT:
        case SITE_IDS.GROK: {
          const storedTheme = localStorage.getItem("theme")
          if (storedTheme === "light" || storedTheme === "dark" || storedTheme === "system") {
            return storedTheme
          }
          return null
        }
        case SITE_IDS.AISTUDIO: {
          const prefStr = localStorage.getItem("aiStudioUserPreference")
          if (!prefStr) return null
          let pref: Record<string, unknown> = {}
          try {
            pref = JSON.parse(prefStr)
          } catch {
            pref = {}
          }
          const theme = pref.theme
          if (theme === "light" || theme === "dark" || theme === "system") {
            return theme
          }
          return null
        }
        case SITE_IDS.GEMINI: {
          const storedTheme = localStorage.getItem("Bard-Color-Theme")
          if (!storedTheme) return "system"
          if (/dark/i.test(storedTheme)) return "dark"
          if (/light/i.test(storedTheme)) return "light"
          return null
        }
        case SITE_IDS.CLAUDE: {
          const raw = localStorage.getItem("LSS-userThemeMode")
          if (!raw) return null
          let data: Record<string, unknown> = {}
          try {
            data = JSON.parse(raw)
          } catch {
            data = {}
          }
          const value = data.value
          if (value === "auto" || value === "system") return "system"
          if (value === "dark" || value === "light") return value
          return null
        }
        case SITE_IDS.GEMINI_ENTERPRISE: {
          const tabs = DOMToolkit.query("md-primary-tab", { all: true, shadow: true }) as Element[]
          if (!tabs || tabs.length === 0) return null
          type Candidate = { icon: "computer" | "light_mode" | "dark_mode"; selected: boolean }
          const candidates: Candidate[] = []
          for (const tab of tabs) {
            let iconEl = tab.querySelector("md-icon")
            if (!iconEl) {
              iconEl = DOMToolkit.query("md-icon", { parent: tab, shadow: true }) as Element | null
            }
            const icon = iconEl?.textContent?.trim()
            if (icon !== "computer" && icon !== "light_mode" && icon !== "dark_mode") {
              continue
            }
            const tabElement = tab as HTMLElement & { selected?: boolean; active?: boolean }
            const selected = Boolean(
              tabElement.selected || tabElement.active || tabElement.tabIndex === 0,
            )
            candidates.push({ icon, selected } as Candidate)
          }
          const selected = candidates.find((item) => item.selected)
          if (!selected) return null
          if (selected.icon === "computer") return "system"
          if (selected.icon === "dark_mode") return "dark"
          return "light"
        }
        default:
          return null
      }
    } catch {
      return null
    }
  }

  /**
   */
  apply(targetMode?: ThemeMode) {
    const mode = targetMode || this.mode
    const isGeminiStandard = this.adapter.getSiteId() === SITE_IDS.GEMINI

    if (mode === "dark") {
      document.body.classList.add("dark-theme")
      document.body.classList.remove("light-theme")
      document.body.style.colorScheme = "dark"
    } else {
      document.body.classList.remove("dark-theme")
      document.body.style.colorScheme = "light"
      if (isGeminiStandard) {
        document.body.classList.add("light-theme")
      }
    }

    this.syncPluginUITheme(mode)
  }

  /**
   */
  private getCurrentPreset(): ThemePreset {
    const presetId = this.mode === "dark" ? this.darkPresetId : this.lightPresetId
    return getPreset(presetId, this.mode)
  }

  /**
   */
  setPresets(lightPresetId: string, darkPresetId: string) {
    this.lightPresetId = lightPresetId
    this.darkPresetId = darkPresetId
    this.syncPluginUITheme()
  }

  /**
   */
  setCustomStyles(styles: CustomStyle[]) {
    this.customStyles = styles || []
    const currentId = this.mode === "dark" ? this.darkPresetId : this.lightPresetId
    const isUsingCustom = this.customStyles.some((s) => s.id === currentId)
    if (isUsingCustom) {
      this.syncPluginUITheme()
    }
  }

  /**
   */
  private syncPluginUITheme(mode?: ThemeMode) {
    const currentMode = mode || this.mode
    const root = document.documentElement

    const presetId = currentMode === "dark" ? this.darkPresetId : this.lightPresetId

    const customStyle = this.customStyles.find((s) => s.id === presetId)

    let vars: ThemeVariables | null = null

    if (customStyle) {
    } else {
      try {
        const preset = getPreset(presetId, currentMode)
        vars = preset.variables
      } catch (e) {
        console.error("[ThemeManager] getPreset FAILED:", e)
        return
      }
    }

    const wasObserving = this.themeObserver !== null
    if (wasObserving) {
      this.themeObserver?.disconnect()
    }

    if (currentMode === "dark") {
      document.body.dataset.ghMode = "dark"
      document.body.style.colorScheme = "dark"
    } else {
      delete document.body.dataset.ghMode
      document.body.style.colorScheme = "light"
    }

    if (vars) {
      for (const [key, value] of Object.entries(vars)) {
        root.style.setProperty(key, value)
      }
    }

    const shadowHosts = document.querySelectorAll("plasmo-csui, #ophel-userscript-root")

    shadowHosts.forEach((host) => {
      const shadowRoot = host.shadowRoot
      if (shadowRoot) {
        let styleEl = shadowRoot.querySelector("#gh-theme-vars") as HTMLStyleElement
        if (!styleEl) {
          styleEl = document.createElement("style")
          styleEl.id = "gh-theme-vars"
        }

        if (customStyle) {
          styleEl.textContent = customStyle.css
        } else if (vars) {
          const cssVars = themeVariablesToCSS(vars)

          styleEl.textContent = `:host {
${cssVars}
color-scheme: ${currentMode};
}

:host([data-theme="dark"]),
:host .gh-root[data-theme="dark"] {
${cssVars}
}
`
        }
        ;(host as HTMLElement).dataset.theme = currentMode

        shadowRoot.append(styleEl)
      }
    })

    if (wasObserving && this.themeObserver) {
      this.themeObserver.observe(document.body, {
        attributes: true,
        attributeFilter: ["class", "data-theme", "style"],
      })
      this.themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class", "data-theme"],
      })
    }
  }

  /**
   */
  monitorTheme() {
    const checkTheme = () => {
      if (this.skipNextDetection) {
        this.skipNextDetection = false
        return
      }

      const detectedMode = this.detectCurrentTheme()
      const detectedPreference = this.detectThemePreference()
      const nextPreference: ThemePreference = detectedPreference ?? detectedMode
      const nextMode: ThemeMode =
        nextPreference === "system" ? this.getSystemMode() : nextPreference

      if (nextPreference === "system") {
        this.ensureSystemListener()
        if (detectedMode !== nextMode) {
          this.syncPageTheme(nextMode, "system")
        } else {
          this.syncPluginUITheme(nextMode)
        }
      } else {
        this.syncPluginUITheme(nextMode)
      }

      if (this.mode !== nextMode || this.preference !== nextPreference) {
        this.mode = nextMode
        this.preference = nextPreference
        this.emitChange()
        if (this.onModeChange) {
          this.onModeChange(nextMode, nextPreference)
        }
      }
    }

    checkTheme()

    if (!this.themeObserver) {
      this.themeObserver = new MutationObserver(() => {
        checkTheme()
      })

      this.themeObserver.observe(document.body, {
        attributes: true,
        attributeFilter: ["class", "data-theme", "style"],
      })

      this.themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class", "data-theme"],
      })
    }
  }

  /**
   */
  stopMonitoring() {
    if (this.themeObserver) {
      this.themeObserver.disconnect()
      this.themeObserver = null
    }
  }

  private getTransitionOrigin(event?: MouseEvent) {
    let x = 95
    let y = 5
    if (event && event.clientX !== undefined) {
      x = (event.clientX / window.innerWidth) * 100
      y = (event.clientY / window.innerHeight) * 100
      return { x, y }
    }

    const themeBtn =
      document.getElementById("theme-toggle-btn") || document.getElementById("quick-theme-btn")
    if (themeBtn) {
      const rect = themeBtn.getBoundingClientRect()
      x = ((rect.left + rect.width / 2) / window.innerWidth) * 100
      y = ((rect.top + rect.height / 2) / window.innerHeight) * 100
    }
    return { x, y }
  }

  private async applyWithTransition(action: () => void, event?: MouseEvent): Promise<boolean> {
    const { x, y } = this.getTransitionOrigin(event)

    document.documentElement.style.setProperty("--theme-x", `${x}%`)
    document.documentElement.style.setProperty("--theme-y", `${y}%`)

    this.stopMonitoring()

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (!document.startViewTransition || prefersReducedMotion) {
      try {
        action()
      } finally {
        this.monitorTheme()
      }
      return false
    }

    try {
      const transition = document.startViewTransition(() => {
        action()
      })

      transition.ready.then(() => {
        const right = window.innerWidth - (x / 100) * window.innerWidth
        const bottom = window.innerHeight - (y / 100) * window.innerHeight
        const maxRadius = Math.hypot(
          Math.max((x / 100) * window.innerWidth, right),
          Math.max((y / 100) * window.innerHeight, bottom),
        )

        const clipPath = [`circle(0px at ${x}% ${y}%)`, `circle(${maxRadius}px at ${x}% ${y}%)`]

        document.documentElement.animate(
          {
            clipPath: clipPath,
          },
          {
            duration: 500,
            easing: "ease-in",
            pseudoElement: "::view-transition-new(root)",
            fill: "forwards",
          },
        )
      })

      await transition.finished.catch(() => {})
    } catch {
      action()
      this.monitorTheme()
      return false
    }

    this.skipNextDetection = true
    this.monitorTheme()
    return true
  }

  /**
   */
  async toggle(event?: MouseEvent): Promise<ThemeMode> {
    const currentMode = this.preference === "system" ? this.mode : this.detectCurrentTheme()
    const nextMode: ThemeMode = currentMode === "dark" ? "light" : "dark"
    this.preference = nextMode

    let x = 95
    let y = 5
    if (event && event.clientX !== undefined) {
      x = (event.clientX / window.innerWidth) * 100
      y = (event.clientY / window.innerHeight) * 100
    } else {
      const themeBtn =
        document.getElementById("theme-toggle-btn") || document.getElementById("quick-theme-btn")
      if (themeBtn) {
        const rect = themeBtn.getBoundingClientRect()
        x = ((rect.left + rect.width / 2) / window.innerWidth) * 100
        y = ((rect.top + rect.height / 2) / window.innerHeight) * 100
      }
    }

    document.documentElement.style.setProperty("--theme-x", `${x}%`)
    document.documentElement.style.setProperty("--theme-y", `${y}%`)

    this.stopMonitoring()

    const doToggle = () => {
      if (this.adapter && typeof this.adapter.toggleTheme === "function") {
        this.adapter.toggleTheme(nextMode).catch(() => {})
      }
      this.apply(nextMode)
    }

    if (
      !document.startViewTransition ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      doToggle()
      this.mode = nextMode
      this.emitChange()
      this.monitorTheme()
      return nextMode
    }

    const transition = document.startViewTransition(() => {
      doToggle()
    })

    transition.ready.then(() => {
      const right = window.innerWidth - (x / 100) * window.innerWidth
      const bottom = window.innerHeight - (y / 100) * window.innerHeight
      const maxRadius = Math.hypot(
        Math.max((x / 100) * window.innerWidth, right),
        Math.max((y / 100) * window.innerHeight, bottom),
      )

      const clipPath = [`circle(0px at ${x}% ${y}%)`, `circle(${maxRadius}px at ${x}% ${y}%)`]

      document.documentElement.animate(
        {
          clipPath: clipPath,
        },
        {
          duration: 500,
          easing: "ease-in",
          pseudoElement: "::view-transition-new(root)",
          fill: "forwards",
        },
      )
    })

    await transition.finished.catch(() => {})

    this.skipNextDetection = true
    if (this.onModeChange) {
      this.onModeChange(nextMode, this.preference)
    }
    this.monitorTheme()

    this.mode = nextMode
    this.emitChange()
    return nextMode
  }

  /**
   */
  async setMode(
    targetMode: ThemePreference,
    event?: MouseEvent,
  ): Promise<{ mode: ThemeMode; animated: boolean }> {
    const normalizedPreference: ThemePreference =
      targetMode === "system" ? "system" : targetMode === "dark" ? "dark" : "light"

    if (normalizedPreference === "system") {
      this.preference = "system"
      this.ensureSystemListener()
      const resolved = this.getSystemMode()
      const modeChanged = this.mode !== resolved
      const shouldAnimate = Boolean(event) && modeChanged
      let animated = false
      if (shouldAnimate) {
        animated = await this.applyWithTransition(() => {
          this.syncPageTheme(resolved, "system")
        }, event)
      } else {
        this.syncPageTheme(resolved, "system")
      }
      if (modeChanged) {
        this.mode = resolved
        this.emitChange()
      }
      if (this.onModeChange) {
        this.onModeChange(resolved, this.preference)
      }
      return { mode: resolved, animated }
    }

    const currentMode = this.detectCurrentTheme()

    if (currentMode === normalizedPreference) {
      this.preference = normalizedPreference
      this.syncPageTheme(normalizedPreference, normalizedPreference)
      if (this.onModeChange) {
        this.onModeChange(normalizedPreference, this.preference)
      }
      return { mode: normalizedPreference, animated: false }
    }

    const resultMode = await this.toggle(event)
    return { mode: resultMode, animated: true }
  }

  /**
   */
  getMode(): ThemeMode {
    return this.mode
  }

  /**
   */
  getSnapshot = (): ThemeMode => {
    return this.mode
  }

  /**
   */
  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   */
  private emitChange() {
    for (const listener of this.listeners) {
      listener()
    }
  }

  /**
   */
  destroy() {
    this.stopMonitoring()
    this.listeners.clear()
  }
}
