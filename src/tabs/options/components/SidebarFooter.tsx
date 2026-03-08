import React, { useSyncExternalStore } from "react"

import { ThemeDarkIcon, ThemeLightIcon } from "~components/icons"
import { Tooltip } from "~components/ui/Tooltip"
import type { ThemeManager } from "~core/theme-manager"
import { useSettingsStore } from "~stores/settings-store"
import { t } from "~utils/i18n"

export const SidebarFooter = ({ siteId = "_default" }: { siteId?: string }) => {
  const { settings, setSettings } = useSettingsStore()

  // 检测是否在独立 Options 页面（非 content script 环境）
  // 如果是独立页面，不显示主题切换（因为主题是按站点配置的）
  const isStandalonePage = !(window as any).__ophelThemeManager

  // 从全局 ThemeManager 订阅当前主题模式（Single Source of Truth）
  const themeManager = (window as any).__ophelThemeManager as ThemeManager | undefined
  const currentThemeMode = useSyncExternalStore(
    themeManager?.subscribe ?? (() => () => {}),
    themeManager?.getSnapshot ?? (() => "light" as const),
  )
  const themeSites = settings?.theme?.sites
  const siteTheme =
    themeSites && siteId in themeSites
      ? themeSites[siteId as keyof typeof themeSites]
      : themeSites?._default
  const currentThemePreference = siteTheme?.mode || "light"

  // 切换主题模式
  const handleThemeModeToggle = async (
    mode: "light" | "dark" | "system",
    event?: React.MouseEvent<HTMLButtonElement>,
  ) => {
    if (currentThemePreference === mode) return

    const themeManager = (window as any).__ophelThemeManager
    if (themeManager?.setMode) {
      await themeManager.setMode(mode, event?.nativeEvent)
    } else {
      // 尝试调用 themeManager，如果失败则手动更新 settings
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
      {/* 主题切换 - 仅在 content script 环境显示（站点内） */}
      {!isStandalonePage && (
        <div
          ref={themeSegmentRef}
          className={`settings-theme-segmented ${themeSegmentState === "compact" ? "is-compact" : ""} ${themeSegmentState === "icon" ? "is-icon" : ""}`}>
          <Tooltip content={t("themeLight") || "浅色"} triggerStyle={{ flex: 1 }}>
            <button
              className={`settings-theme-segment ${currentThemePreference === "light" ? "active" : ""}`}
              onClick={(event) => handleThemeModeToggle("light", event)}>
              <span className="segment-icon">
                <ThemeLightIcon size={16} />
              </span>
              <span className="segment-label">{t("themeLight") || "浅色"}</span>
            </button>
          </Tooltip>
          <Tooltip content={t("themeDark") || "深色"} triggerStyle={{ flex: 1 }}>
            <button
              className={`settings-theme-segment ${currentThemePreference === "dark" ? "active" : ""}`}
              onClick={(event) => handleThemeModeToggle("dark", event)}>
              <span className="segment-icon">
                <ThemeDarkIcon size={16} />
              </span>
              <span className="segment-label">{t("themeDark") || "深色"}</span>
            </button>
          </Tooltip>
          <Tooltip content={t("themeSystem") || "系统"} triggerStyle={{ flex: 1 }}>
            <button
              className={`settings-theme-segment ${currentThemePreference === "system" ? "active" : ""}`}
              onClick={(event) => handleThemeModeToggle("system", event)}>
              <span className="segment-icon">A</span>
              <span className="segment-label">{t("themeSystem") || "系统"}</span>
            </button>
          </Tooltip>
        </div>
      )}

      <style>{`
      `}</style>
    </div>
  )
}
