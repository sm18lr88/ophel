import React, { useSyncExternalStore } from "react"

import { ThemeDarkIcon, ThemeLightIcon } from "~components/icons"
import { Tooltip } from "~components/ui/Tooltip"
import type { ThemeManager } from "~core/theme-manager"
import { useSettingsStore } from "~stores/settings-store"
import { t } from "~utils/i18n"

export const SidebarFooter = ({ siteId = "_default" }: { siteId?: string }) => {
  const { settings, setSettings } = useSettingsStore()

  //  Options  content script 
  // 
  const isStandalonePage = !window.__ophelThemeManager

  //  ThemeManager Single Source of Truth
  const themeManager = window.__ophelThemeManager as ThemeManager | undefined
  useSyncExternalStore(
    themeManager?.subscribe ?? (() => () => {}),
    themeManager?.getSnapshot ?? (() => "light" as const),
  )
  const themeSites = settings?.theme?.sites
  const siteTheme =
    themeSites && siteId in themeSites
      ? themeSites[siteId as keyof typeof themeSites]
      : themeSites?._default
  const currentThemePreference = siteTheme?.mode || "light"

  // 
  const handleThemeModeToggle = async (
    mode: "light" | "dark" | "system",
    event?: React.MouseEvent<HTMLButtonElement>,
  ) => {
    if (currentThemePreference === mode) return

    const runtimeThemeManager = window.__ophelThemeManager
    if (runtimeThemeManager?.setMode) {
      await runtimeThemeManager.setMode(mode, event?.nativeEvent)
    } else {
      //  themeManager settings
      const sites = settings?.theme?.sites || {}
      const currentSite = sites[siteId as keyof typeof sites] || sites._default || {}

      setSettings({
        theme: {
          ...settings?.theme,
          sites: {
            ...sites,
            [siteId]: {
              lightStyleId: "google-gradient",
              darkStyleId: "classic-dark",
              ...currentSite,
              mode,
            },
          },
        },
      })
    }
  }

  const themeSegmentRef = React.useRef<HTMLDivElement>(null)
  const [themeSegmentState, setThemeSegmentState] = React.useState<"normal" | "compact" | "icon">(
    "normal",
  )
  const themeSegmentStateRef = React.useRef<"normal" | "compact" | "icon">("normal")

  React.useEffect(() => {
    themeSegmentStateRef.current = themeSegmentState
  }, [themeSegmentState])

  React.useEffect(() => {
    const container = themeSegmentRef.current
    if (!container) return

    const applyStateClass = (state: "normal" | "compact" | "icon") => {
      container.classList.toggle("is-compact", state === "compact")
      container.classList.toggle("is-icon", state === "icon")
    }

    const fitsContainer = (state: "normal" | "compact" | "icon") => {
      applyStateClass(state)
      return container.scrollWidth <= container.clientWidth + 1
    }

    const measureState = () => {
      const prevState = themeSegmentStateRef.current

      const normalFits = fitsContainer("normal")
      let nextState: "normal" | "compact" | "icon" = "normal"
      if (!normalFits) {
        const compactFits = fitsContainer("compact")
        nextState = compactFits ? "compact" : "icon"
      }

      applyStateClass(prevState)
      if (nextState !== themeSegmentStateRef.current) {
        setThemeSegmentState(nextState)
      }
    }

    const scheduleMeasure = () => {
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(measureState)
        return
      }
      measureState()
    }

    scheduleMeasure()

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(() => scheduleMeasure())
      observer.observe(container)
      return () => observer.disconnect()
    }

    window.addEventListener("resize", scheduleMeasure)
    return () => window.removeEventListener("resize", scheduleMeasure)
  }, [])

  return (
    <div className="settings-sidebar-footer">
      {/*  -  content script  */}
      {!isStandalonePage && (
        <div
          ref={themeSegmentRef}
          className={`settings-theme-segmented ${themeSegmentState === "compact" ? "is-compact" : ""} ${themeSegmentState === "icon" ? "is-icon" : ""}`}>
          <Tooltip content={t("themeLight") || ""} triggerStyle={{ flex: 1 }}>
            <button
              className={`settings-theme-segment ${currentThemePreference === "light" ? "active" : ""}`}
              onClick={(event) => handleThemeModeToggle("light", event)}>
              <span className="segment-icon">
                <ThemeLightIcon size={16} />
              </span>
              <span className="segment-label">{t("themeLight") || ""}</span>
            </button>
          </Tooltip>
          <Tooltip content={t("themeDark") || ""} triggerStyle={{ flex: 1 }}>
            <button
              className={`settings-theme-segment ${currentThemePreference === "dark" ? "active" : ""}`}
              onClick={(event) => handleThemeModeToggle("dark", event)}>
              <span className="segment-icon">
                <ThemeDarkIcon size={16} />
              </span>
              <span className="segment-label">{t("themeDark") || ""}</span>
            </button>
          </Tooltip>
          <Tooltip content={t("themeSystem") || ""} triggerStyle={{ flex: 1 }}>
            <button
              className={`settings-theme-segment ${currentThemePreference === "system" ? "active" : ""}`}
              onClick={(event) => handleThemeModeToggle("system", event)}>
              <span className="segment-icon">A</span>
              <span className="segment-label">{t("themeSystem") || ""}</span>
            </button>
          </Tooltip>
        </div>
      )}

      <style>{`
      `}</style>
    </div>
  )
}
