/**
 *
 */

import type { SiteAdapter } from "~adapters/base"
import { SITE_IDS } from "~constants"
import { CopyManager } from "~core/copy-manager"
import { LayoutManager } from "~core/layout-manager"
import { MarkdownFixer } from "~core/markdown-fixer"
import { ModelLocker } from "~core/model-locker"
import { PolicyRetryManager } from "~core/policy-retry-manager"
import { ReadingHistoryManager } from "~core/reading-history"
import { ScrollLockManager } from "~core/scroll-lock-manager"
import { TabManager } from "~core/tab-manager"
import { ThemeManager } from "~core/theme-manager"
import { UserQueryMarkdownRenderer } from "~core/user-query-markdown"
import { WatermarkRemover } from "~core/watermark-remover"
import { getSettingsState, subscribeSettings } from "~stores/settings-store"
import {
  getSiteModelLock,
  getSitePageWidth,
  getSiteTheme,
  getSiteUserQueryWidth,
  getSiteZenMode,
  consumeClearAllFlag,
  CLEAR_ALL_FLAG_TTL_MS,
  type Settings,
} from "~utils/storage"

/**
 */
export interface ModulesContext {
  adapter: SiteAdapter
  settings: Settings
  siteId: string
}

/**
 */
export interface ModuleInstances {
  themeManager: ThemeManager | null
  copyManager: CopyManager | null
  layoutManager: LayoutManager | null
  markdownFixer: MarkdownFixer | null
  tabManager: TabManager | null
  watermarkRemover: WatermarkRemover | null
  readingHistoryManager: ReadingHistoryManager | null
  modelLocker: ModelLocker | null
  scrollLockManager: ScrollLockManager | null
  userQueryMarkdownRenderer: UserQueryMarkdownRenderer | null
  policyRetryManager: PolicyRetryManager | null
}

let modules: ModuleInstances = {
  themeManager: null,
  copyManager: null,
  layoutManager: null,
  markdownFixer: null,
  tabManager: null,
  watermarkRemover: null,
  readingHistoryManager: null,
  modelLocker: null,
  scrollLockManager: null,
  userQueryMarkdownRenderer: null,
  policyRetryManager: null,
}

let readingHistoryAutoStartTimer: NodeJS.Timeout | null = null

/**
 */
export function initThemeManager(ctx: ModulesContext): ThemeManager {
  const { adapter, settings, siteId } = ctx
  const siteTheme = getSiteTheme(settings, siteId)

  const themeManager = new ThemeManager(
    siteTheme.mode,
    undefined,
    adapter,
    siteTheme.lightStyleId || "google-gradient",
    siteTheme.darkStyleId || "classic-dark",
  )
  themeManager.apply()

  window.__ophelThemeManager = themeManager
  modules.themeManager = themeManager

  return themeManager
}

/**
 */
export async function syncPageTheme(ctx: ModulesContext): Promise<void> {
  const { adapter, settings, siteId } = ctx
  const siteTheme = getSiteTheme(settings, siteId)
  if (siteTheme.mode === "system" && modules.themeManager) {
    await modules.themeManager.setMode("system")
    return
  }
  const targetTheme =
    siteTheme.mode === "system"
      ? window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : siteTheme.mode === "dark"
        ? "dark"
        : "light"

  const htmlClass = document.documentElement.className
  const htmlHasDark = /\bdark\b/i.test(htmlClass)
  const htmlHasLight = /\blight\b/i.test(htmlClass)
  const bodyClass = document.body.className
  const bodyHasDarkTheme = /\bdark-theme\b/i.test(bodyClass)
  const pageColorScheme = document.body.style.colorScheme

  let actualPageTheme: "light" | "dark" = "light"
  if (htmlHasDark || bodyHasDarkTheme || pageColorScheme === "dark") {
    actualPageTheme = "dark"
  } else if (htmlHasLight) {
    actualPageTheme = "light"
  }

  if (actualPageTheme !== targetTheme) {
    if (modules.themeManager) {
      modules.themeManager.apply(targetTheme)
    }
    if (adapter && typeof adapter.toggleTheme === "function") {
      await adapter.toggleTheme(targetTheme)
    }
  }
}

/**
 */
function getSiteMarkdownFix(settings: Settings, siteId: string): boolean {
  switch (siteId) {
    case SITE_IDS.GEMINI:
      return settings.content?.markdownFix ?? false
    case SITE_IDS.AISTUDIO:
      return settings.aistudio?.markdownFix ?? false
    case SITE_IDS.CHATGPT:
      return settings.chatgpt?.markdownFix ?? false
    default:
      return false
  }
}

/**
 */
export function initMarkdownFixer(ctx: ModulesContext): void {
  const { adapter, settings, siteId } = ctx
  const config = adapter.getMarkdownFixerConfig()
  const enabled = getSiteMarkdownFix(settings, siteId)

  if (config && enabled) {
    modules.markdownFixer = new MarkdownFixer(config)
    modules.markdownFixer.start()
    console.warn(`[Ophel] MarkdownFixer started for ${adapter.getName()}`)
  }
}

/**
 */
export function initLayoutManager(ctx: ModulesContext): void {
  const { adapter, settings, siteId } = ctx
  const sitePageWidth = getSitePageWidth(settings, siteId)
  const siteUserQueryWidth = getSiteUserQueryWidth(settings, siteId)
  const siteZenMode = getSiteZenMode(settings, siteId)
  const zenModeEnabled = siteZenMode.enabled

  if (sitePageWidth?.enabled || siteUserQueryWidth?.enabled || zenModeEnabled) {
    modules.layoutManager = new LayoutManager(adapter, sitePageWidth)
    if (sitePageWidth?.enabled) modules.layoutManager.apply()
    if (siteUserQueryWidth?.enabled) modules.layoutManager.updateUserQueryConfig(siteUserQueryWidth)
    if (zenModeEnabled) modules.layoutManager.updateZenMode(true)
  }
}

/**
 */
export function initCopyManager(ctx: ModulesContext): void {
  const { adapter, settings } = ctx

  if (settings.content) {
    modules.copyManager = new CopyManager(settings.content, adapter)
    if (settings.content.formulaCopy) {
      modules.copyManager.initFormulaCopy()
    }
    if (settings.content.tableCopy) {
      modules.copyManager.initTableCopy()
    }
  }
}

/**
 */
export function initTabManager(ctx: ModulesContext): void {
  const { adapter, settings } = ctx

  if (settings.tab) {
    modules.tabManager = new TabManager(adapter, settings.tab)
    modules.tabManager.start()
  }
}

/**
 */
export function initWatermarkRemover(ctx: ModulesContext): void {
  const { settings, siteId } = ctx

  if (
    (siteId === SITE_IDS.GEMINI || siteId === SITE_IDS.GEMINI_ENTERPRISE) &&
    settings.content?.watermarkRemoval
  ) {
    modules.watermarkRemover = new WatermarkRemover()
    modules.watermarkRemover.start()
  }
}

/**
 */
export async function initReadingHistoryManager(ctx: ModulesContext): Promise<void> {
  const { adapter, settings } = ctx

  if (settings.readingHistory?.persistence) {
    if (readingHistoryAutoStartTimer) {
      clearTimeout(readingHistoryAutoStartTimer)
      readingHistoryAutoStartTimer = null
    }

    const startRecording = (currentSettings: Settings) => {
      if (modules.readingHistoryManager) return
      modules.readingHistoryManager = new ReadingHistoryManager(
        adapter,
        currentSettings.readingHistory,
      )
      modules.readingHistoryManager.startRecording()
      modules.readingHistoryManager.cleanup()
    }

    const skipAutoRestore = await consumeClearAllFlag()
    if (skipAutoRestore) {
      readingHistoryAutoStartTimer = setTimeout(() => {
        readingHistoryAutoStartTimer = null
        const currentSettings = getSettingsState()
        if (currentSettings.readingHistory?.persistence && !modules.readingHistoryManager) {
          startRecording(currentSettings)
        }
      }, CLEAR_ALL_FLAG_TTL_MS)
      return
    }

    startRecording(settings)

    if (settings.readingHistory.autoRestore) {
      const { showToast } = await import("~utils/toast")
      modules.readingHistoryManager
        .restoreProgress((msg) => showToast(msg, 3000))
        .then((restored) => {
          if (restored) {
            showToast("Reading progress restored", 2000)
          }
        })
    }

    modules.readingHistoryManager.cleanup()
  }
}

/**
 */
export function initModelLocker(ctx: ModulesContext): void {
  const { adapter, settings, siteId } = ctx
  const siteModelConfig = getSiteModelLock(settings, siteId)

  modules.modelLocker = new ModelLocker(adapter, siteModelConfig)
  if (siteModelConfig.enabled && siteModelConfig.keyword) {
    modules.modelLocker.start()
  }
}

/**
 */
export function initScrollLockManager(ctx: ModulesContext): void {
  const { adapter, settings } = ctx
  modules.scrollLockManager = new ScrollLockManager(adapter, settings)
}

/**
 */
export function initUserQueryMarkdownRenderer(ctx: ModulesContext): void {
  const { adapter, settings } = ctx
  modules.userQueryMarkdownRenderer = new UserQueryMarkdownRenderer(
    adapter,
    settings.content?.userQueryMarkdown ?? false,
  )
}

/**
 */
export async function initCoreModules(ctx: ModulesContext): Promise<ModuleInstances> {
  initThemeManager(ctx)

  setTimeout(() => syncPageTheme(ctx), 1000)

  initMarkdownFixer(ctx)

  initLayoutManager(ctx)

  initCopyManager(ctx)

  initTabManager(ctx)

  initWatermarkRemover(ctx)

  await initReadingHistoryManager(ctx)

  initModelLocker(ctx)

  initScrollLockManager(ctx)

  initUserQueryMarkdownRenderer(ctx)

  // 11. Policy Retry Manager
  initPolicyRetryManager(ctx)

  return modules
}

/**
 */
export function initPolicyRetryManager(ctx: ModulesContext): void {
  const { adapter, settings, siteId } = ctx
  if (siteId === SITE_IDS.GEMINI_ENTERPRISE) {
    modules.policyRetryManager = new PolicyRetryManager(
      adapter,
      settings.geminiEnterprise?.policyRetry || { enabled: false, maxRetries: 3 },
    )
  }
}

/**
 */
export function subscribeModuleUpdates(ctx: ModulesContext): void {
  const { adapter, siteId } = ctx

  subscribeSettings((newSettings: Settings) => {
    const newSiteTheme = getSiteTheme(newSettings, siteId)
    if (newSiteTheme && modules.themeManager) {
      modules.themeManager.setPresets(
        newSiteTheme.lightStyleId || "google-gradient",
        newSiteTheme.darkStyleId || "classic-dark",
      )
    }

    // 2. Model Locker update
    const newModelConfig = getSiteModelLock(newSettings, siteId)
    if (newModelConfig && modules.modelLocker) {
      modules.modelLocker.updateConfig(newModelConfig)
    }

    // 3. Scroll Lock update
    if (newSettings && modules.scrollLockManager) {
      modules.scrollLockManager.updateSettings(newSettings)
    }

    // 4. Markdown Fix update
    const config = adapter.getMarkdownFixerConfig()
    const markdownFixEnabled = getSiteMarkdownFix(newSettings, siteId)

    if (config && markdownFixEnabled) {
      if (!modules.markdownFixer) {
        modules.markdownFixer = new MarkdownFixer(config)
      }
      modules.markdownFixer.start()
    } else {
      modules.markdownFixer?.stop()
    }

    // 5. Layout Manager update
    const newSitePageWidth = getSitePageWidth(newSettings, siteId)
    const newUserQueryWidth = getSiteUserQueryWidth(newSettings, siteId)
    const newSiteZenMode = getSiteZenMode(newSettings, siteId)
    const newZenModeEnabled = newSiteZenMode.enabled

    if (modules.layoutManager) {
      modules.layoutManager.updateConfig(newSitePageWidth)
      modules.layoutManager.updateUserQueryConfig(newUserQueryWidth)
      modules.layoutManager.updateZenMode(newZenModeEnabled)
    } else if (newSitePageWidth?.enabled || newUserQueryWidth?.enabled || newZenModeEnabled) {
      modules.layoutManager = new LayoutManager(adapter, newSitePageWidth)
      if (newSitePageWidth?.enabled) modules.layoutManager.apply()
      if (newUserQueryWidth?.enabled) modules.layoutManager.updateUserQueryConfig(newUserQueryWidth)
      if (newZenModeEnabled) modules.layoutManager.updateZenMode(true)
    }

    // 6. Watermark Remover update
    if (newSettings && (siteId === SITE_IDS.GEMINI || siteId === SITE_IDS.GEMINI_ENTERPRISE)) {
      if (newSettings.content?.watermarkRemoval) {
        if (!modules.watermarkRemover) {
          modules.watermarkRemover = new WatermarkRemover()
        }
        modules.watermarkRemover.start()
      } else {
        modules.watermarkRemover?.stop()
      }
    }

    // 7. Tab Manager update
    if (newSettings?.tab) {
      if (modules.tabManager) {
        modules.tabManager.updateSettings(newSettings.tab)
      } else {
        modules.tabManager = new TabManager(adapter, newSettings.tab)
        modules.tabManager.start()
      }
    }

    // 8. Reading History update
    if (newSettings?.readingHistory) {
      if (modules.readingHistoryManager) {
        modules.readingHistoryManager.updateSettings(newSettings.readingHistory)
      } else if (newSettings.readingHistory.persistence) {
        modules.readingHistoryManager = new ReadingHistoryManager(
          adapter,
          newSettings.readingHistory,
        )
        modules.readingHistoryManager.startRecording()
      }
    }

    // 9. Copy Manager update
    if (newSettings?.content) {
      if (modules.copyManager) {
        modules.copyManager.updateSettings(newSettings.content)
      } else {
        modules.copyManager = new CopyManager(newSettings.content)
        if (newSettings.content.formulaCopy) modules.copyManager.initFormulaCopy()
        if (newSettings.content.tableCopy) modules.copyManager.initTableCopy()
      }

      // 10. User Query Markdown Renderer update
      if (newSettings.content.userQueryMarkdown) {
        if (modules.userQueryMarkdownRenderer) {
          modules.userQueryMarkdownRenderer.updateSettings(true)
        } else {
          modules.userQueryMarkdownRenderer = new UserQueryMarkdownRenderer(adapter, true)
        }
      } else {
        modules.userQueryMarkdownRenderer?.updateSettings(false)
      }
    }

    // 11. Policy Retry Manager update
    if (
      newSettings?.geminiEnterprise &&
      siteId === SITE_IDS.GEMINI_ENTERPRISE &&
      modules.policyRetryManager
    ) {
      modules.policyRetryManager.updateSettings(
        newSettings.geminiEnterprise?.policyRetry || { enabled: false, maxRetries: 3 },
      )
    }
  })
}

/**
 */
export function initUrlChangeObserver(ctx: ModulesContext): void {
  const { adapter } = ctx

  let lastPathname = window.location.pathname
  let readingHistoryRestoreTimeoutId: ReturnType<typeof setTimeout> | null = null

  const handleUrlChange = async () => {
    const currentPathname = window.location.pathname
    if (currentPathname !== lastPathname) {
      lastPathname = currentPathname
      console.warn("[Ophel] URL changed, reinitializing modules...")

      if (readingHistoryRestoreTimeoutId) {
        clearTimeout(readingHistoryRestoreTimeoutId)
        readingHistoryRestoreTimeoutId = null
      }

      if (modules.readingHistoryManager) {
        modules.readingHistoryManager.stopRecording()
        readingHistoryRestoreTimeoutId = setTimeout(async () => {
          readingHistoryRestoreTimeoutId = null
          const { showToast } = await import("~utils/toast")
          const restored = await modules.readingHistoryManager?.restoreProgress((msg) =>
            showToast(msg, 3000),
          )
          if (restored) {
            showToast("Reading progress restored", 2000)
          }
          modules.readingHistoryManager?.startRecording()
        }, 1500)
      }

      window.dispatchEvent(new Event("gh-url-change"))

      if (modules.tabManager) {
        modules.tabManager.resetSessionCache()
        ;[300, 800, 1500].forEach((delay) =>
          setTimeout(() => modules.tabManager?.updateTabName(true), delay),
        )
      }

      adapter.findTextarea()

      modules.modelLocker?.relock(300)
    }
  }

  window.addEventListener("popstate", handleUrlChange)

  // Monkey-patch pushState / replaceState
  const originalPushState = history.pushState
  const originalReplaceState = history.replaceState
  history.pushState = function (...args: Parameters<History["pushState"]>) {
    originalPushState.apply(this, args)
    handleUrlChange()
  }
  history.replaceState = function (...args: Parameters<History["replaceState"]>) {
    originalReplaceState.apply(this, args)
    handleUrlChange()
  }

  setInterval(handleUrlChange, 1000)
}

/**
 */
export function handleClearAllData(): void {
  if (readingHistoryAutoStartTimer) {
    clearTimeout(readingHistoryAutoStartTimer)
    readingHistoryAutoStartTimer = null
  }
  if (modules.readingHistoryManager) {
    modules.readingHistoryManager.stopRecording()
    modules.readingHistoryManager = null
  }
}

/**
 */
export function getModuleInstances(): ModuleInstances {
  return modules
}
