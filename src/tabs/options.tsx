/**
 * Options Page 
 *  chrome.windows.create 
 */
import React, { useEffect, useRef, useState } from "react"

import {
  AboutIcon,
  AppearanceIcon,
  BackupIcon,
  FeaturesIcon,
  GeneralIcon,
  PageContentIcon,
  PermissionsIcon,
} from "~components/icons"
import { resolveSettingsNavigateDetail } from "~constants"
import { platform } from "~platform"
import { useSettingsHydrated, useSettingsStore } from "~stores/settings-store"
import { APP_DISPLAY_NAME, APP_ICON_URL } from "~utils/config"
import { setLanguage, t } from "~utils/i18n"

import AboutPage from "./options/pages/AboutPage"
import AppearancePage from "./options/pages/AppearancePage"
import BackupPage from "./options/pages/BackupPage"
import FeaturesPage from "./options/pages/FeaturesPage"
// 
import GeneralPage from "./options/pages/GeneralPage"
import PermissionsPage from "./options/pages/PermissionsPage"
import SiteSettingsPage from "./options/pages/SiteSettingsPage"
// 
import "./options.css"

import { SidebarFooter } from "./options/components/SidebarFooter"

// 

// 
const NAV_ITEMS = [
  // 
  {
    id: "general",
    Icon: GeneralIcon,
    labelKey: "navGeneral",
    label: "",
  },
  { id: "features", Icon: FeaturesIcon, labelKey: "navFeatures", label: "" },
  {
    id: "siteSettings",
    Icon: PageContentIcon,
    labelKey: "navSiteSettings",
    label: "",
  },
  {
    id: "appearance",
    Icon: AppearanceIcon,
    labelKey: "navAppearance",
    label: "",
  },
  { id: "backup", Icon: BackupIcon, labelKey: "navBackup", label: "" },
  {
    id: "permissions",
    Icon: PermissionsIcon,
    labelKey: "navPermissions",
    label: "",
  },
  { id: "about", Icon: AboutIcon, labelKey: "navAbout", label: "" },
]

const OptionsPage = () => {
  const [activePage, setActivePage] = useState("general")
  const [initialSubTab, setInitialSubTab] = useState<string | undefined>(undefined)
  const [locateRequest, setLocateRequest] = useState<{ settingId: string; token: number } | null>(
    null,
  )
  const contentRef = useRef<HTMLElement>(null)
  const highlightTimerRef = useRef<number | undefined>(undefined)
  const highlightedElementRef = useRef<HTMLElement | null>(null)

  //  URL search params
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      const resolved = resolveSettingsNavigateDetail({
        page: params.get("page") || undefined,
        subTab: params.get("subTab") || undefined,
        settingId: params.get("settingId") || undefined,
      })

      if (resolved.page && NAV_ITEMS.some((item) => item.id === resolved.page)) {
        setActivePage(resolved.page)
      }

      setInitialSubTab(resolved.subTab)

      if (resolved.settingId) {
        setLocateRequest({ settingId: resolved.settingId, token: Date.now() })
      }
    }
  }, [])

  // URL 
  useEffect(() => {
    if (!locateRequest?.settingId) return

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
        console.warn(`[Ophel] Failed to locate setting in options page: ${locateRequest.settingId}`)
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
  }, [activePage, initialSubTab, locateRequest])

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
  const { settings } = useSettingsStore()
  const isHydrated = useSettingsHydrated()

  // 
  // 
  const [languageReady, setLanguageReady] = useState(false)

  //  i18n 
  //  settings  settings.language 
  useEffect(() => {
    if (isHydrated && settings?.language) {
      setLanguage(settings.language)
      setLanguageReady(true)
    }
  }, [isHydrated, settings?.language])

  //  IDOptions  _default
  const siteId = "_default"

  //  hydration 
  if (!settings || !isHydrated || !languageReady) {
    return (
      <div className="settings-layout">
        <div style={{ padding: 40, textAlign: "center" }}>{t("loading") || "..."}</div>
      </div>
    )
  }

  // 
  const renderPage = () => {
    switch (activePage) {
      case "general":
        return <GeneralPage siteId={siteId} initialTab={initialSubTab} />
      case "appearance":
        return <AppearancePage siteId={siteId} initialTab={initialSubTab} />
      case "siteSettings":
        return <SiteSettingsPage siteId={siteId} initialTab={initialSubTab} />
      case "features":
        return <FeaturesPage siteId={siteId} initialTab={initialSubTab} />
      case "permissions":
        return <PermissionsPage siteId={siteId} />
      case "backup":
        return <BackupPage siteId={siteId} onNavigate={setActivePage} />
      case "about":
        return <AboutPage />
      default:
        return <GeneralPage siteId={siteId} initialTab={initialSubTab} />
    }
  }

  //  Options  content script 
  // 
  const isStandalonePage = !window.__ophelThemeManager

  //  appearance 
  //  permissions  API
  const filteredNavItems = NAV_ITEMS.filter((item) => {
    if (isStandalonePage && item.id === "appearance") return false
    if (!platform.hasCapability("permissions") && item.id === "permissions") return false
    return true
  })

  return (
    <div className="settings-layout">
      {/*  */}
      <aside className="settings-sidebar">
        <div className="settings-sidebar-header">
          <div className="settings-sidebar-logo">
            <img src={APP_ICON_URL} alt={APP_DISPLAY_NAME} />
            <span>{APP_DISPLAY_NAME}</span>
          </div>
        </div>
        <nav className="settings-sidebar-nav">
          {filteredNavItems.map((item) => (
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
              <span>{t(item.labelKey) || item.label}</span>
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
  )
}

export default OptionsPage
