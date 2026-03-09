/**
 * 
 *  | 
 */
import hljs from "highlight.js/lib/core"
import css from "highlight.js/lib/languages/css"
import React, { useEffect, useState } from "react"

import { AppearanceIcon } from "~components/icons"
import { APPEARANCE_TAB_IDS } from "~constants"
import { useSettingsStore } from "~stores/settings-store"
import { t } from "~utils/i18n"
import type { CustomStyle } from "~utils/storage"
import {
  darkPresets,
  lightPresets,
  parseThemeVariablesFromCSS,
  type ThemePreset,
  type ThemeVariables,
} from "~utils/themes"
import { showToast as showDomToast } from "~utils/toast"
import { createSafeHTML } from "~utils/trusted-types"

import { PageTitle, SettingCard, TabGroup } from "../components"
import { SafeCodeEditor } from "../components/SafeCodeEditor"
import { ThemePreview } from "../components/ThemePreview"

hljs.registerLanguage("css", css)

interface AppearancePageProps {
  siteId: string
  initialTab?: string
}

// CSS 
const CSS_TEMPLATE = `/* 🎨 Custom CSS Cheat Sheet
 *  CSS 
 */

/* ===  === */
/*
:host {
  --gh-bg: #ffffff;
  --gh-text: #1f2937;
  --gh-primary: #4285f4;
}
*/

/* ===  === */
/*
.gh-main-panel { }
.gh-panel-header { }
.gh-panel-content { }
*/
`

// 
const ThemeCard: React.FC<{
  preset: ThemePreset
  isActive: boolean
  onClick: () => void
}> = ({ preset, isActive, onClick }) => {
  const key = `themePreset_${preset.id}`
  const translation = t(key)
  const displayName = translation && translation !== key ? translation : preset.name

  return (
    <div className={`settings-theme-card ${isActive ? "active" : ""}`} onClick={onClick}>
      <ThemePreview preset={preset} />
      <div className="settings-theme-name">{displayName}</div>
    </div>
  )
}

const AppearancePage: React.FC<AppearancePageProps> = ({ siteId, initialTab }) => {
  const [activeTab, setActiveTab] = useState(initialTab || APPEARANCE_TAB_IDS.PRESETS)
  const { settings, setSettings } = useSettingsStore()

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab)
    }
  }, [initialTab])

  // 
  const [showStyleEditor, setShowStyleEditor] = useState(false)
  const [editingStyle, setEditingStyle] = useState<CustomStyle | null>(null)

  // 
  const currentTheme =
    settings?.theme?.sites?.[siteId as keyof typeof settings.theme.sites] ||
    settings?.theme?.sites?._default

  if (!settings) return null

  const tabs = [
    { id: APPEARANCE_TAB_IDS.PRESETS, label: t("themePresetsTab") || "" },
    { id: APPEARANCE_TAB_IDS.CUSTOM, label: t("customStylesTab") || "" },
  ]

  // 
  const selectLightPreset = async (presetId: string) => {
    const themeManager = window.__ophelThemeManager
    const isSystemMode = currentTheme?.mode === "system"
    if (!isSystemMode && themeManager?.setMode) {
      // setMode 
      await themeManager.setMode("light")
    }

    //  ID
    const sites = settings?.theme?.sites || {}
    const currentSite = sites[siteId as keyof typeof sites] || sites._default || {}
    setSettings({
      theme: {
        ...settings?.theme,
        sites: {
          ...settings?.theme?.sites,
          [siteId]: {
            ...currentSite,
            ...(isSystemMode ? {} : { mode: "light" }),
            lightStyleId: presetId,
          },
        },
      },
    })
  }

  // 
  const selectDarkPreset = async (presetId: string) => {
    const themeManager = window.__ophelThemeManager
    const isSystemMode = currentTheme?.mode === "system"
    if (!isSystemMode && themeManager?.setMode) {
      // setMode 
      await themeManager.setMode("dark")
    }

    //  ID
    const sites = settings?.theme?.sites || {}
    const currentSite = sites[siteId as keyof typeof sites] || sites._default || {}
    setSettings({
      theme: {
        ...settings?.theme,
        sites: {
          ...settings?.theme?.sites,
          [siteId]: {
            ...currentSite,
            ...(isSystemMode ? {} : { mode: "dark" }),
            darkStyleId: presetId,
          },
        },
      },
    })
  }

  // 
  const saveCustomStyle = () => {
    if (!editingStyle) return

    if (!editingStyle.name.trim()) {
      showDomToast(t("pleaseEnterStyleName") || "")
      return
    }

    const existingStyles = settings?.theme?.customStyles || []
    let newStyles: CustomStyle[]

    if (editingStyle.id) {
      // 
      newStyles = existingStyles.map((s) => (s.id === editingStyle.id ? editingStyle : s))
    } else {
      // 
      const newStyle: CustomStyle = {
        ...editingStyle,
        id: crypto.randomUUID(),
      }
      newStyles = [...existingStyles, newStyle]
    }

    setSettings({
      theme: {
        ...settings?.theme,
        customStyles: newStyles,
      },
    })
    setShowStyleEditor(false)
    showDomToast(
      editingStyle.id ? t("styleUpdated") || "" : t("styleCreated") || "",
    )
  }

  // 
  const deleteCustomStyle = (styleId: string, styleName: string) => {
    if (confirm(t("confirmDeleteStyle") || `${styleName}`)) {
      const newStyles = (settings?.theme?.customStyles || []).filter((s) => s.id !== styleId)
      setSettings({
        theme: {
          ...settings?.theme,
          customStyles: newStyles,
        },
      })
    }
  }

  const customStyles = settings?.theme?.customStyles || []

  //  ThemePreset  UI 
  const customStyleToPreset = (style: CustomStyle): ThemePreset => {
    //  CSS 
    const parsedVariables = parseThemeVariablesFromCSS(style.css)

    // 
    const defaults = {
      "--gh-bg": style.mode === "light" ? "#f3f4f6" : "#1f2937",
      "--gh-header-bg": style.mode === "light" ? "#e5e7eb" : "#374151",
      "--gh-border": style.mode === "light" ? "#d1d5db" : "#4b5563",
      "--gh-primary": "#4285f4",
      "--gh-text": style.mode === "light" ? "#374151" : "#f9fafb",
      "--gh-text-secondary": style.mode === "light" ? "#6b7280" : "#9ca3af",
      "--gh-bg-secondary": style.mode === "light" ? "#ffffff" : "#1f2937",
    }

    return {
      id: style.id,
      name: style.name,
      variables: {
        ...defaults,
        ...parsedVariables,
      } as ThemeVariables,
    }
  }

  const displayLightPresets = [
    ...lightPresets,
    ...customStyles.filter((s) => s.mode === "light").map(customStyleToPreset),
  ]

  const displayDarkPresets = [
    ...darkPresets,
    ...customStyles.filter((s) => s.mode === "dark").map(customStyleToPreset),
  ]

  return (
    <div>
      <PageTitle title={t("navAppearance") || ""} Icon={AppearanceIcon} />
      <p className="settings-page-desc">
        {t("appearancePageDesc") || ""}
      </p>

      <TabGroup tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === APPEARANCE_TAB_IDS.PRESETS && (
        <>
          {/*  */}
          <SettingCard
            title={t("lightModePreset") || ""}
            description={t("lightModePresetDesc") || ""}
            settingId="appearance-preset-light">
            <div className="settings-theme-grid">
              {displayLightPresets.map((preset) => (
                <ThemeCard
                  key={preset.id}
                  preset={preset}
                  isActive={(currentTheme?.lightStyleId || "google-gradient") === preset.id}
                  onClick={() => selectLightPreset(preset.id)}
                />
              ))}
            </div>
          </SettingCard>

          {/*  */}
          <SettingCard
            title={t("darkModePreset") || ""}
            description={t("darkModePresetDesc") || ""}
            settingId="appearance-preset-dark">
            <div className="settings-theme-grid">
              {displayDarkPresets.map((preset) => (
                <ThemeCard
                  key={preset.id}
                  preset={preset}
                  isActive={(currentTheme?.darkStyleId || "classic-dark") === preset.id}
                  onClick={() => selectDarkPreset(preset.id)}
                />
              ))}
            </div>
          </SettingCard>
        </>
      )}

      {activeTab === APPEARANCE_TAB_IDS.CUSTOM && (
        <>
          <SettingCard
            title={t("customCSS") || ""}
            description={t("customCSSDesc") || " CSS "}
            settingId="appearance-custom-styles">
            <button
              className="settings-btn settings-btn-primary"
              onClick={() => {
                setEditingStyle({
                  id: "",
                  name: "",
                  css: CSS_TEMPLATE,
                  mode: "light",
                })
                setShowStyleEditor(true)
              }}
              style={{ marginBottom: "16px" }}>
              ➕ {t("addCustomStyle") || ""}
            </button>

            {(settings?.theme?.customStyles || []).length === 0 ? (
              <div
                style={{
                  padding: "20px",
                  textAlign: "center",
                  color: "var(--gh-text-secondary, #9ca3af)",
                  fontSize: "13px",
                  border: "1px dashed var(--gh-border, #e5e7eb)",
                  borderRadius: "8px",
                }}>
                {t("noCustomStyles") || ""}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {(settings?.theme?.customStyles || []).map((style) => (
                  <div
                    key={style.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px",
                      background: "var(--gh-bg-secondary, #f9fafb)",
                      borderRadius: "8px",
                    }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span
                        style={{
                          fontSize: "11px",
                          padding: "2px 8px",
                          borderRadius: "4px",
                          backgroundColor:
                            style.mode === "light"
                              ? "rgba(251, 191, 36, 0.2)"
                              : "rgba(99, 102, 241, 0.2)",
                          color: style.mode === "light" ? "#b45309" : "#4338ca",
                        }}>
                        {style.mode === "light" ? "☀️" : "🌙"}
                      </span>
                      <span style={{ fontSize: "14px", fontWeight: 500 }}>
                        {style.name || t("unnamedStyle") || ""}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        className="settings-btn settings-btn-secondary"
                        onClick={() => {
                          setEditingStyle(style)
                          setShowStyleEditor(true)
                        }}
                        style={{ padding: "6px 12px", fontSize: "12px" }}>
                        ✏️ {t("edit") || ""}
                      </button>
                      <button
                        className="settings-btn settings-btn-danger"
                        onClick={() => deleteCustomStyle(style.id, style.name)}
                        style={{ padding: "6px 12px", fontSize: "12px" }}>
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SettingCard>
        </>
      )}

      {/*  */}
      {showStyleEditor && editingStyle && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
          }}>
          <div
            style={{
              background: "var(--gh-bg, white)",
              borderRadius: "12px",
              width: "800px",
              maxWidth: "95%",
              height: "85vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
            }}>
            {/*  */}
            <div
              style={{
                padding: "16px",
                borderBottom: "1px solid var(--gh-border, #e5e7eb)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>
                {editingStyle.id ? t("editStyle") || "" : t("newStyle") || ""}
              </h3>
              <button
                onClick={() => setShowStyleEditor(false)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "18px",
                  color: "var(--gh-text-secondary, #9ca3af)",
                }}>
                ✕
              </button>
            </div>

            {/*  */}
            <div
              style={{
                padding: "16px",
                overflowY: "auto",
                flex: 1,
                display: "flex",
                flexDirection: "column",
              }}>
              {/*  */}
              <div style={{ marginBottom: "16px" }}>
                <label
                  style={{
                    fontSize: "13px",
                    fontWeight: 500,
                    marginBottom: "6px",
                    display: "block",
                  }}>
                  {t("styleNameLabel") || ""}
                </label>
                <input
                  type="text"
                  className="settings-input"
                  value={editingStyle.name}
                  onChange={(e) => setEditingStyle({ ...editingStyle, name: e.target.value })}
                  placeholder={t("enterStyleName") || ""}
                  style={{ width: "100%" }}
                />
              </div>

              {/*  */}
              <div style={{ marginBottom: "16px" }}>
                <label
                  style={{
                    fontSize: "13px",
                    fontWeight: 500,
                    marginBottom: "6px",
                    display: "block",
                  }}>
                  {t("styleModeLabel") || ""}
                </label>
                <div style={{ display: "flex", gap: "12px" }}>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      cursor: "pointer",
                    }}>
                    <input
                      type="radio"
                      checked={editingStyle.mode === "light"}
                      onChange={() => setEditingStyle({ ...editingStyle, mode: "light" })}
                    />
                    <span>☀️ {t("lightMode") || ""}</span>
                  </label>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      cursor: "pointer",
                    }}>
                    <input
                      type="radio"
                      checked={editingStyle.mode === "dark"}
                      onChange={() => setEditingStyle({ ...editingStyle, mode: "dark" })}
                    />
                    <span>🌙 {t("darkMode") || ""}</span>
                  </label>
                </div>
              </div>

              {/* CSS  */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <label
                  style={{
                    fontSize: "13px",
                    fontWeight: 500,
                    marginBottom: "6px",
                    display: "block",
                  }}>
                  CSS {t("code") || ""}
                </label>
                <div
                  className="settings-textarea"
                  style={{
                    flex: 1,
                    padding: 0,
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                  }}>
                  <SafeCodeEditor
                    value={editingStyle.css}
                    onValueChange={(code) => setEditingStyle({ ...editingStyle, css: code })}
                    highlight={(code) =>
                      String(createSafeHTML(hljs.highlight(code, { language: "css" }).value))
                    }
                    padding={12}
                    style={{
                      fontFamily: '"Menlo", "Monaco", "Consolas", monospace',
                      fontSize: 13,
                      minHeight: "100%",
                    }}
                    textareaClassName="focus-outline-none"
                  />
                </div>
              </div>
            </div>

            {/*  */}
            <div
              style={{
                padding: "16px",
                borderTop: "1px solid var(--gh-border, #e5e7eb)",
                display: "flex",
                justifyContent: "flex-end",
                gap: "8px",
              }}>
              <button
                className="settings-btn settings-btn-secondary"
                onClick={() => setShowStyleEditor(false)}>
                {t("cancel") || ""}
              </button>
              <button className="settings-btn settings-btn-primary" onClick={saveCustomStyle}>
                {editingStyle.id ? t("save") || "" : t("create") || ""}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AppearancePage
