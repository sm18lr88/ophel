/**
 * 
 * 
 */
import React, { useEffect, useRef, useState } from "react"

import {
  AboutIcon,
  AppearanceIcon,
  BackupIcon,
  ClearIcon,
  FeaturesIcon,
  GeneralIcon,
  KeyboardIcon,
  MaximizeIcon,
  PageContentIcon,
  PermissionsIcon,
  RestoreIcon,
  SearchIcon,
} from "~components/icons"
import { Tooltip } from "~components/ui/Tooltip"
import {
  NAV_IDS,
  SITE_IDS,
  resolveSettingsNavigateDetail,
  type SettingsNavigateDetail,
} from "~constants"
import { platform } from "~platform"
import { useSettingsHydrated, useSettingsStore } from "~stores/settings-store"
import { SidebarFooter } from "~tabs/options/components/SidebarFooter"
import AboutPage from "~tabs/options/pages/AboutPage"
import AppearancePage from "~tabs/options/pages/AppearancePage"
import BackupPage from "~tabs/options/pages/BackupPage"
import FeaturesPage from "~tabs/options/pages/FeaturesPage"
import GlobalSearchPage from "~tabs/options/pages/GlobalSearchPage"
import GeneralPage from "~tabs/options/pages/GeneralPage"
import PermissionsPage from "~tabs/options/pages/PermissionsPage"
import ShortcutsPage from "~tabs/options/pages/ShortcutsPage"
import SiteSettingsPage from "~tabs/options/pages/SiteSettingsPage"
import { APP_DISPLAY_NAME, APP_ICON_URL } from "~utils/config"
import { setLanguage, t } from "~utils/i18n"

const getLocalizedLabel = (labelKey: string, fallback: string): string => {
  const localized = t(labelKey)
  return localized === labelKey ? fallback : localized
}

// 
const NAV_ITEMS = [
  {
    id: NAV_IDS.GENERAL,
    Icon: GeneralIcon,
    labelKey: "navGeneral",
    label: "",
  },
  {
    id: NAV_IDS.APPEARANCE,
    Icon: AppearanceIcon,
    labelKey: "navAppearance",
    label: "",
  },
  { id: NAV_IDS.FEATURES, Icon: FeaturesIcon, labelKey: "navFeatures", label: "" },
  {
    id: NAV_IDS.SITE_SETTINGS,
    Icon: PageContentIcon,
    labelKey: "navSiteSettings",
    label: "",
  },
  {
    id: NAV_IDS.GLOBAL_SEARCH,
    Icon: SearchIcon,
    labelKey: "navGlobalSearch",
    label: "",
  },
  { id: NAV_IDS.SHORTCUTS, Icon: KeyboardIcon, labelKey: "navShortcuts", label: "" },
  { id: NAV_IDS.BACKUP, Icon: BackupIcon, labelKey: "navBackup", label: "" },
  {
    id: NAV_IDS.PERMISSIONS,
    Icon: PermissionsIcon,
    labelKey: "navPermissions",
    label: "",
  },
  { id: NAV_IDS.ABOUT, Icon: AboutIcon, labelKey: "navAbout", label: "" },
]

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  siteId: string
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, siteId }) => {
  const [activePage, setActivePage] = useState<string>(NAV_IDS.GENERAL)
  const [initialSubTab, setInitialSubTab] = useState<string | undefined>(undefined)
  const [locateRequest, setLocateRequest] = useState<{ settingId: string; token: number } | null>(
    null,
  )
  const [isMaximized, setIsMaximized] = useState(false)
  const { settings } = useSettingsStore()
  const isHydrated = useSettingsHydrated()
  const contentRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null) // 
  const highlightTimerRef = useRef<number | undefined>(undefined)
  const highlightedElementRef = useRef<HTMLElement | null>(null)

  // 
  useEffect(() => {
    if (isHydrated && settings?.language) {
      setLanguage(settings.language)
    }
  }, [isHydrated, settings?.language])

  //  Tab 
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0
    }
  }, [activePage])

  //  ESC 
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  // 
  useEffect(() => {
    const handleNavigate = (e: CustomEvent<SettingsNavigateDetail>) => {
      const resolved = resolveSettingsNavigateDetail(e.detail || {})

      if (resolved.page && NAV_ITEMS.some((item) => item.id === resolved.page)) {
        setActivePage(resolved.page)
      }

      setInitialSubTab(resolved.subTab)

      if (resolved.settingId) {
        setLocateRequest({ settingId: resolved.settingId, token: Date.now() })
      } else {
        setLocateRequest(null)
      }
    }
    window.addEventListener("ophel:navigateSettingsPage", handleNavigate as EventListener)
    return () =>
      window.removeEventListener("ophel:navigateSettingsPage", handleNavigate as EventListener)
  }, [])

  // 
  useEffect(() => {
    if (!isOpen || !locateRequest?.settingId) return

    let cancelled = false
    let retryTimer: number | undefined
    let rafId: number | undefined

    const escapedSettingId =
      typeof CSS !== "undefined" && typeof CSS.escape === "function"
        ? CSS.escape(locateRequest.settingId)
        : JSON.stringify(locateRequest.settingId).slice(1, -1)
    const selector = `[data-setting-id="${escapedSettingId}"]`

    const tryLocate = (attempt: number) => {
      if (cancelled) return

      const target = contentRef.current?.querySelector<HTMLElement>(selector)
      if (target) {
        if (highlightTimerRef.current !== undefined) {
          window.clearTimeout(highlightTimerRef.current)
          highlightTimerRef.current = undefined
        }

        if (highlightedElementRef.current && highlightedElementRef.current !== target) {
          highlightedElementRef.current.classList.remove("setting-locate-highlight")
        }

        target.scrollIntoView({ behavior: "smooth", block: "center" })
        target.classList.remove("setting-locate-highlight")
        void target.offsetWidth
        target.classList.add("setting-locate-highlight")

        highlightedElementRef.current = target

        highlightTimerRef.current = window.setTimeout(() => {
          target.classList.remove("setting-locate-highlight")
          if (highlightedElementRef.current === target) {
            highlightedElementRef.current = null
          }
          highlightTimerRef.current = undefined
        }, 2200)

        setLocateRequest(null)
        return
      }

      if (attempt >= 12) {
        console.warn(`[Ophel] Failed to locate setting: ${locateRequest.settingId}`)
        setLocateRequest(null)
        return
      }

      retryTimer = window.setTimeout(() => tryLocate(attempt + 1), 100)
    }

    rafId = window.requestAnimationFrame(() => tryLocate(0))

    return () => {
      cancelled = true

      if (rafId !== undefined) {
        window.cancelAnimationFrame(rafId)
      }

      if (retryTimer !== undefined) {
        window.clearTimeout(retryTimer)
      }
    }
  }, [isOpen, activePage, initialSubTab, locateRequest])

  // 
  useEffect(() => {
    return () => {
      if (highlightTimerRef.current !== undefined) {
        window.clearTimeout(highlightTimerRef.current)
      }

      if (highlightedElementRef.current) {
        highlightedElementRef.current.classList.remove("setting-locate-highlight")
        highlightedElementRef.current = null
      }
    }
  }, [])

  //  Grok  Claude  keydown 
  useEffect(() => {
    if (isOpen && (siteId === SITE_IDS.GROK || siteId === SITE_IDS.CLAUDE)) {
      const container = containerRef.current
      if (!container) {
        return
      }

      // 
      const handleKeyDown = (e: KeyboardEvent) => {
        const target = e.target as HTMLElement

        const isInputElement =
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.getAttribute("contenteditable") === "true"

        if (!isInputElement) return

        //  Grok 
        e.stopPropagation()
        e.stopImmediatePropagation()
      }

      //  document
      container.addEventListener("keydown", handleKeyDown, true)
      container.addEventListener("keypress", handleKeyDown, true)

      return () => {
        container.removeEventListener("keydown", handleKeyDown, true)
        container.removeEventListener("keypress", handleKeyDown, true)
      }
    }
  }, [isOpen, siteId])

  // 
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"

      return () => {
        document.body.style.overflow = ""
      }
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [isOpen])

  if (!isOpen) return null

  // 
  const renderPage = () => {
    if (!settings || !isHydrated) {
      return <div style={{ padding: 40, textAlign: "center" }}>{t("loading") || "..."}</div>
    }

    switch (activePage) {
      case NAV_IDS.GENERAL:
        return <GeneralPage siteId={siteId} initialTab={initialSubTab} />
      case NAV_IDS.SITE_SETTINGS:
        return <SiteSettingsPage siteId={siteId} initialTab={initialSubTab} />
      case NAV_IDS.APPEARANCE:
        return <AppearancePage siteId={siteId} initialTab={initialSubTab} />
      case NAV_IDS.FEATURES:
        return <FeaturesPage siteId={siteId} initialTab={initialSubTab} />
      case NAV_IDS.GLOBAL_SEARCH:
        return <GlobalSearchPage siteId={siteId} />
      case NAV_IDS.SHORTCUTS:
        return <ShortcutsPage siteId={siteId} />
      case NAV_IDS.PERMISSIONS:
        return <PermissionsPage siteId={siteId} />
      case NAV_IDS.BACKUP:
        return <BackupPage siteId={siteId} onNavigate={setActivePage} />
      case NAV_IDS.ABOUT:
        return <AboutPage />
      default:
        return <GeneralPage siteId={siteId} initialTab={initialSubTab} />
    }
  }

  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div
        ref={containerRef}
        className={`settings-modal-container ${isMaximized ? "maximized" : ""}`}
        onClick={(e) => e.stopPropagation()}>
        {/*  */}
        <div className="settings-modal-actions">
          <Tooltip content={isMaximized ? t("restore") || "" : t("maximize") || ""}>
            <button
              className="settings-modal-action-btn"
              onClick={() => setIsMaximized(!isMaximized)}>
              {isMaximized ? <RestoreIcon size={16} /> : <MaximizeIcon size={16} />}
            </button>
          </Tooltip>
          <Tooltip content={t("close") || ""}>
            <button className="settings-modal-action-btn close" onClick={onClose}>
              <ClearIcon size={16} />
            </button>
          </Tooltip>
        </div>

        {/*  */}
        <aside className="settings-sidebar">
          <div className="settings-sidebar-header">
            <div className="settings-sidebar-logo">
              <img src={APP_ICON_URL} alt={APP_DISPLAY_NAME} />
              <span>{APP_DISPLAY_NAME}</span>
            </div>
          </div>
          <nav className="settings-sidebar-nav">
            {NAV_ITEMS.filter((item) => {
              //  permissions 
              if (!platform.hasCapability("permissions") && item.id === NAV_IDS.PERMISSIONS)
                return false
              return true
            }).map((item) => (
              <button
                key={item.id}
                className={`settings-nav-item ${activePage === item.id ? "active" : ""}`}
                onClick={() => {
                  setActivePage(item.id)
                  setInitialSubTab(undefined)
                  setLocateRequest(null)
                }}>
                <span className="settings-nav-item-icon">
                  <item.Icon size={22} />
                </span>
                <span>{getLocalizedLabel(item.labelKey, item.label)}</span>
              </button>
            ))}
          </nav>

          {/*  */}
          <SidebarFooter siteId={siteId} />
        </aside>

        {/*  */}
        <main className="settings-content" ref={contentRef}>
          {renderPage()}
        </main>
      </div>
    </div>
  )
}

export default SettingsModal
