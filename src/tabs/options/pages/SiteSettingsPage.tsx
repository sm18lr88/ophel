/**
 * 
 * 
 * 
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { PageContentIcon as LayoutIcon, RefreshIcon } from "~components/icons"
import { NumberInput, Switch, Tooltip } from "~components/ui"
import { LAYOUT_CONFIG, SITE_IDS, SITE_SETTINGS_TAB_IDS } from "~constants"
import { useSettingsStore } from "~stores/settings-store"
import { t } from "~utils/i18n"
import {
  MSG_GET_AISTUDIO_MODELS,
  sendToBackground,
  type AIStudioModelInfo,
} from "~utils/messaging"
import type { Settings } from "~utils/storage"
import { showToast, showToastThrottled } from "~utils/toast"

import { PageTitle, SettingCard, SettingRow, TabGroup, ToggleRow } from "../components"
import ClaudeSettings from "./ClaudeSettings"

interface SiteSettingsPageProps {
  siteId: string
  initialTab?: string
}

//  - 
const ModelLockRow: React.FC<{
  label: string
  siteKey: string
  settings: Settings
  setSettings: (settings: Partial<Settings>) => void
  placeholder: string
  onDisabledClick?: () => void
  settingId?: string
}> = ({ label, siteKey, settings, setSettings, placeholder, onDisabledClick, settingId }) => {
  const currentConfig = useMemo(
    () => settings.modelLock?.[siteKey] || { enabled: false, keyword: "" },
    [settings.modelLock, siteKey],
  )
  const [localKeyword, setLocalKeyword] = useState(currentConfig.keyword)

  // 
  useEffect(() => {
    setLocalKeyword(currentConfig.keyword)
  }, [currentConfig.keyword])

  // 
  const saveKeyword = useCallback(() => {
    if (localKeyword !== currentConfig.keyword) {
      setSettings({
        modelLock: {
          ...settings.modelLock,
          [siteKey]: { ...currentConfig, keyword: localKeyword },
        },
      })
    }
  }, [localKeyword, currentConfig, settings.modelLock, siteKey, setSettings])

  // 
  const toggleEnabled = () => {
    setSettings({
      modelLock: {
        ...settings.modelLock,
        [siteKey]: { ...currentConfig, enabled: !currentConfig.enabled },
      },
    })
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        marginBottom: "12px",
        cursor: currentConfig.enabled ? "default" : "not-allowed",
      }}
      data-setting-id={settingId}>
      <span
        style={{
          fontSize: "14px",
          fontWeight: 500,
          flex: 1,
          color: currentConfig.enabled
            ? "var(--gh-text, #374151)"
            : "var(--gh-text-secondary, #9ca3af)",
        }}>
        {label}
      </span>
      <div
        onMouseDown={(e) => {
          if (!currentConfig.enabled) {
            e.preventDefault()
            onDisabledClick?.()
          }
        }}>
        <input
          type="text"
          className="settings-input"
          value={localKeyword}
          onChange={(e) => setLocalKeyword(e.target.value)}
          onBlur={saveKeyword}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              saveKeyword()
              ;(e.target as HTMLInputElement).blur()
            }
          }}
          placeholder={placeholder}
          disabled={!currentConfig.enabled}
          style={{
            width: "200px",
            opacity: currentConfig.enabled ? 1 : 0.5,
            pointerEvents: currentConfig.enabled ? "auto" : "none",
          }}
        />
      </div>
      <Switch checked={currentConfig.enabled} onChange={toggleEnabled} />
    </div>
  )
}

// AI Studio  - 
const AIStudioModelLockRow: React.FC<{
  settings: Settings
  setSettings: (settings: Partial<Settings>) => void
  onDisabledClick?: () => void
  settingId?: string
}> = ({ settings, setSettings, onDisabledClick, settingId }) => {
  const siteKey = "aistudio"
  const currentConfig = settings.modelLock?.[siteKey] || { enabled: false, keyword: "" }

  // 
  const [modelList, setModelList] = useState<AIStudioModelInfo[]>(
    settings.aistudio?.cachedModels || [],
  )
  const [isLoading, setIsLoading] = useState(false)

  // 
  useEffect(() => {
    if (settings.aistudio?.cachedModels) {
      setModelList(settings.aistudio.cachedModels)
    }
  }, [settings.aistudio?.cachedModels])

  // 
  const handleRefresh = async () => {
    setIsLoading(true)
    try {
      const response = await sendToBackground({
        type: MSG_GET_AISTUDIO_MODELS,
      })

      if (response.success && response.models) {
        setModelList(response.models)
        // 
        setSettings({
          aistudio: {
            ...settings.aistudio,
            cachedModels: response.models,
          },
        })
        showToast(t("aistudioModelsFetched") || ` ${response.models.length} `, 2000)
      } else {
        // 
        const errorMsg =
          response.error === "NO_AISTUDIO_TAB"
            ? t("aistudioNoTabError") || " AI Studio "
            : t("aistudioModelsError") || ""
        showToast(errorMsg, 3000)
      }
    } catch (err) {
      showToast(t("aistudioModelsError") || "", 3000)
      console.error("Refresh model list failed:", err)
    } finally {
      setIsLoading(false)
    }
  }

  // 
  const toggleEnabled = () => {
    setSettings({
      modelLock: {
        ...settings.modelLock,
        [siteKey]: { ...currentConfig, enabled: !currentConfig.enabled },
      },
    })
  }

  // 
  const handleModelChange = (modelId: string) => {
    setSettings({
      modelLock: {
        ...settings.modelLock,
        [siteKey]: { ...currentConfig, keyword: modelId },
      },
    })
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        marginBottom: "12px",
        cursor: currentConfig.enabled ? "default" : "not-allowed",
      }}
      data-setting-id={settingId}>
      <span
        style={{
          fontSize: "14px",
          fontWeight: 500,
          flex: 1,
          color: currentConfig.enabled
            ? "var(--gh-text, #374151)"
            : "var(--gh-text-secondary, #9ca3af)",
        }}>
        AI Studio
      </span>
      {/*  */}
      <Tooltip content=" AI Studio ">
        <button
          className="icon-button"
          onClick={handleRefresh}
          disabled={isLoading}
          style={{
            padding: "4px",
            opacity: isLoading ? 0.5 : 1,
            cursor: isLoading ? "not-allowed" : "pointer",
            background: "transparent",
            border: "none",
            borderRadius: "4px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
          <RefreshIcon size={16} />
        </button>
      </Tooltip>
      {/*  */}
      <div
        onMouseDown={(e) => {
          if (!currentConfig.enabled) {
            e.preventDefault()
            onDisabledClick?.()
          }
        }}>
        <select
          className="settings-select"
          value={currentConfig.keyword || ""}
          onChange={(e) => handleModelChange(e.target.value)}
          disabled={!currentConfig.enabled || modelList.length === 0}
          style={{
            width: "200px",
            opacity: currentConfig.enabled ? 1 : 0.5,
            pointerEvents: currentConfig.enabled ? "auto" : "none",
          }}>
          {modelList.length === 0 && <option value=""></option>}
          {modelList.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name}
            </option>
          ))}
        </select>
      </div>
      <Switch checked={currentConfig.enabled} onChange={toggleEnabled} />
    </div>
  )
}

const SiteSettingsPage: React.FC<SiteSettingsPageProps> = ({ siteId, initialTab }) => {
  const [activeTab, setActiveTab] = useState<string>(initialTab || SITE_SETTINGS_TAB_IDS.LAYOUT)

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab)
    }
  }, [initialTab])
  const { settings, setSettings, updateNestedSetting } = useSettingsStore()
  const prerequisiteToastTemplate = t("enablePrerequisiteToast") || "{setting}"
  const showPrerequisiteToast = (label: string) =>
    showToastThrottled(prerequisiteToastTemplate.replace("{setting}", label), 2000, {}, 1500, label)
  const enablePageWidthLabel = t("enablePageWidth") || ""
  const enableUserQueryWidthLabel = t("enableUserQueryWidth") || ""
  const modelLockLabel = t("modelLockTitle") || ""

  // 
  const currentPageWidth =
    settings?.layout?.pageWidth?.[siteId as keyof typeof settings.layout.pageWidth] ||
    settings?.layout?.pageWidth?._default
  const currentUserQueryWidth =
    settings?.layout?.userQueryWidth?.[siteId as keyof typeof settings.layout.userQueryWidth] ||
    settings?.layout?.userQueryWidth?._default

  const [tempWidth, setTempWidth] = useState(
    currentPageWidth?.value || LAYOUT_CONFIG.PAGE_WIDTH.DEFAULT_PERCENT,
  )
  const [tempUserQueryWidth, setTempUserQueryWidth] = useState(
    currentUserQueryWidth?.value || LAYOUT_CONFIG.USER_QUERY_WIDTH.DEFAULT_PX,
  )

  //  Store 
  const [focusedInput, setFocusedInput] = useState<string | null>(null)

  // 
  const widthBlurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const userQueryWidthBlurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const widthInputRef = useRef<HTMLInputElement>(null)
  const userQueryWidthInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (currentPageWidth?.value && focusedInput !== "pageWidth") {
      setTempWidth(currentPageWidth.value)
    }
  }, [currentPageWidth?.value, focusedInput])

  useEffect(() => {
    if (currentUserQueryWidth?.value && focusedInput !== "userQueryWidth") {
      setTempUserQueryWidth(currentUserQueryWidth.value)
    }
  }, [currentUserQueryWidth?.value, focusedInput])

  // 
  useEffect(() => {
    return () => {
      if (widthBlurTimerRef.current) clearTimeout(widthBlurTimerRef.current)
      if (userQueryWidthBlurTimerRef.current) clearTimeout(userQueryWidthBlurTimerRef.current)
    }
  }, [])

  // 
  const commitWidth = useCallback(() => {
    let val = parseInt(tempWidth)
    const unit = currentPageWidth?.unit || "%"

    if (isNaN(val)) {
      val =
        unit === "%"
          ? parseInt(LAYOUT_CONFIG.PAGE_WIDTH.DEFAULT_PERCENT)
          : parseInt(LAYOUT_CONFIG.PAGE_WIDTH.DEFAULT_PX)
    }

    if (unit === "%") {
      if (val < LAYOUT_CONFIG.PAGE_WIDTH.MIN_PERCENT) val = LAYOUT_CONFIG.PAGE_WIDTH.MIN_PERCENT
      if (val > LAYOUT_CONFIG.PAGE_WIDTH.MAX_PERCENT) val = LAYOUT_CONFIG.PAGE_WIDTH.MAX_PERCENT
    } else {
      if (val <= 0) val = LAYOUT_CONFIG.PAGE_WIDTH.MIN_PX
    }

    const finalVal = val.toString()
    setTempWidth(finalVal)
    if (finalVal !== currentPageWidth?.value && settings) {
      const current = currentPageWidth || { enabled: true, value: finalVal, unit: "%" }
      setSettings({
        layout: {
          ...settings.layout,
          pageWidth: {
            ...settings.layout?.pageWidth,
            [siteId]: { ...current, value: finalVal },
          },
        },
      })
    }
  }, [tempWidth, currentPageWidth, settings, siteId, setSettings])

  const handleWidthFocus = () => {
    if (widthBlurTimerRef.current) {
      clearTimeout(widthBlurTimerRef.current)
      widthBlurTimerRef.current = null
    }
    setFocusedInput("pageWidth")
  }

  const handleWidthBlur = () => {
    widthBlurTimerRef.current = setTimeout(() => {
      if (document.activeElement !== widthInputRef.current) {
        setFocusedInput(null)
        commitWidth()
      }
    }, 100)
  }

  const handleUnitChange = (newUnit: string) => {
    const newValue =
      newUnit === "px"
        ? LAYOUT_CONFIG.PAGE_WIDTH.DEFAULT_PX
        : LAYOUT_CONFIG.PAGE_WIDTH.DEFAULT_PERCENT
    setTempWidth(newValue)

    if (settings) {
      const newPageWidth = {
        ...currentPageWidth,
        unit: newUnit,
        value: newValue,
        enabled: currentPageWidth?.enabled ?? false,
      }
      setSettings({
        layout: {
          ...settings.layout,
          pageWidth: {
            ...settings.layout?.pageWidth,
            [siteId]: newPageWidth,
          },
        },
      })
    }
  }

  // 
  const commitUserQueryWidth = useCallback(() => {
    let val = parseInt(tempUserQueryWidth)
    const unit = currentUserQueryWidth?.unit || "px"

    if (isNaN(val)) {
      val =
        unit === "%"
          ? parseInt(LAYOUT_CONFIG.USER_QUERY_WIDTH.DEFAULT_PERCENT)
          : parseInt(LAYOUT_CONFIG.USER_QUERY_WIDTH.DEFAULT_PX)
    }

    if (unit === "%") {
      if (val < LAYOUT_CONFIG.USER_QUERY_WIDTH.MIN_PERCENT)
        val = LAYOUT_CONFIG.USER_QUERY_WIDTH.MIN_PERCENT
      if (val > LAYOUT_CONFIG.USER_QUERY_WIDTH.MAX_PERCENT)
        val = LAYOUT_CONFIG.USER_QUERY_WIDTH.MAX_PERCENT
    } else {
      if (val <= 0) val = LAYOUT_CONFIG.USER_QUERY_WIDTH.MIN_PX
    }

    const finalVal = val.toString()
    setTempUserQueryWidth(finalVal)
    if (finalVal !== currentUserQueryWidth?.value && settings) {
      const current = currentUserQueryWidth || { enabled: true, value: finalVal, unit: "px" }
      setSettings({
        layout: {
          ...settings.layout,
          userQueryWidth: {
            ...settings.layout?.userQueryWidth,
            [siteId]: { ...current, value: finalVal },
          },
        },
      })
    }
  }, [tempUserQueryWidth, currentUserQueryWidth, settings, siteId, setSettings])

  const handleUserQueryWidthFocus = () => {
    if (userQueryWidthBlurTimerRef.current) {
      clearTimeout(userQueryWidthBlurTimerRef.current)
      userQueryWidthBlurTimerRef.current = null
    }
    setFocusedInput("userQueryWidth")
  }

  const handleUserQueryWidthBlur = () => {
    userQueryWidthBlurTimerRef.current = setTimeout(() => {
      if (document.activeElement !== userQueryWidthInputRef.current) {
        setFocusedInput(null)
        commitUserQueryWidth()
      }
    }, 100)
  }

  const handleUserQueryUnitChange = (newUnit: string) => {
    const newValue =
      newUnit === "px"
        ? LAYOUT_CONFIG.USER_QUERY_WIDTH.DEFAULT_PX
        : LAYOUT_CONFIG.USER_QUERY_WIDTH.DEFAULT_PERCENT
    setTempUserQueryWidth(newValue)
    if (settings) {
      const current = currentUserQueryWidth || { enabled: false, value: newValue, unit: newUnit }
      setSettings({
        layout: {
          ...settings.layout,
          userQueryWidth: {
            ...settings.layout?.userQueryWidth,
            [siteId]: { ...current, unit: newUnit, value: newValue },
          },
        },
      })
    }
  }

  if (!settings) return null

  const tabs = [
    { id: SITE_SETTINGS_TAB_IDS.LAYOUT, label: t("tabLayout") || "" },
    { id: SITE_SETTINGS_TAB_IDS.MODEL_LOCK, label: t("tabModelLock") || "" },
    { id: SITE_IDS.GEMINI, label: t("tabGemini") || "Gemini" },
    { id: SITE_IDS.AISTUDIO, label: "AI Studio" },
    { id: SITE_IDS.CHATGPT, label: "ChatGPT" },
    { id: SITE_IDS.CLAUDE, label: "Claude" },
  ]

  return (
    <div>
      <PageTitle title={t("navSiteSettings") || ""} Icon={LayoutIcon} />
      <p className="settings-page-desc">
        {t("siteSettingsPageDesc") || ""}
      </p>

      <TabGroup tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* ==========  Tab ========== */}
      {activeTab === SITE_SETTINGS_TAB_IDS.LAYOUT && (
        <>
          {/*  */}
          <SettingCard title={t("layoutSettingsTitle") || ""}>
            <ToggleRow
              label={t("enablePageWidth") || ""}
              description={t("pageWidthDesc") || ""}
              settingId="layout-page-width-enabled"
              checked={currentPageWidth?.enabled ?? false}
              onChange={() => {
                const current = currentPageWidth || { enabled: false, value: "81", unit: "%" }
                setSettings({
                  layout: {
                    ...settings?.layout,
                    pageWidth: {
                      ...settings?.layout?.pageWidth,
                      [siteId]: { ...current, enabled: !current.enabled },
                    },
                  },
                })
              }}
            />

            <SettingRow
              label={t("pageWidthValueLabel") || ""}
              settingId="layout-page-width-value"
              disabled={!currentPageWidth?.enabled}
              onDisabledClick={() => showPrerequisiteToast(enablePageWidthLabel)}>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  ref={widthInputRef}
                  type="text"
                  className="settings-input"
                  value={tempWidth}
                  onFocus={handleWidthFocus}
                  onChange={(e) => setTempWidth(e.target.value.replace(/[^0-9]/g, ""))}
                  onBlur={handleWidthBlur}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      commitWidth()
                      widthInputRef.current?.blur()
                    }
                  }}
                  disabled={!currentPageWidth?.enabled}
                  style={{ width: "80px" }}
                />
                <select
                  className="settings-select"
                  value={currentPageWidth?.unit || "%"}
                  onChange={(e) => handleUnitChange(e.target.value)}
                  disabled={!currentPageWidth?.enabled}>
                  <option value="%">%</option>
                  <option value="px">px</option>
                </select>
              </div>
            </SettingRow>
          </SettingCard>

          {/*  */}
          <SettingCard title={t("userQueryWidthSettings") || ""}>
            <ToggleRow
              label={t("enableUserQueryWidth") || ""}
              description={t("userQueryWidthDesc") || ""}
              settingId="layout-user-query-width-enabled"
              checked={currentUserQueryWidth?.enabled ?? false}
              onChange={() => {
                const current = currentUserQueryWidth || {
                  enabled: false,
                  value: "600",
                  unit: "px",
                }
                setSettings({
                  layout: {
                    ...settings?.layout,
                    userQueryWidth: {
                      ...settings?.layout?.userQueryWidth,
                      [siteId]: { ...current, enabled: !current.enabled },
                    },
                  },
                })
              }}
            />

            <SettingRow
              label={t("userQueryWidthValueLabel") || ""}
              settingId="layout-user-query-width-value"
              disabled={!currentUserQueryWidth?.enabled}
              onDisabledClick={() => showPrerequisiteToast(enableUserQueryWidthLabel)}>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  ref={userQueryWidthInputRef}
                  type="text"
                  className="settings-input"
                  value={tempUserQueryWidth}
                  onFocus={handleUserQueryWidthFocus}
                  onChange={(e) => setTempUserQueryWidth(e.target.value.replace(/[^0-9]/g, ""))}
                  onBlur={handleUserQueryWidthBlur}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      commitUserQueryWidth()
                      userQueryWidthInputRef.current?.blur()
                    }
                  }}
                  disabled={!currentUserQueryWidth?.enabled}
                  style={{ width: "80px" }}
                />
                <select
                  className="settings-select"
                  value={currentUserQueryWidth?.unit || "px"}
                  onChange={(e) => handleUserQueryUnitChange(e.target.value)}
                  disabled={!currentUserQueryWidth?.enabled}>
                  <option value="px">px</option>
                  <option value="%">%</option>
                </select>
              </div>
            </SettingRow>
          </SettingCard>

          {/*  (Zen Mode)  */}
          <SettingCard title={t("zenModeTitle") || " (Zen Mode)"}>
            <ToggleRow
              label={t("zenModeLabel") || ""}
              description={
                t("zenModeDesc") ||
                ""
              }
              settingId="layout-zen-mode-enabled"
              checked={
                settings.layout?.zenMode?.[siteId as keyof typeof settings.layout.zenMode]
                  ?.enabled ?? false
              }
              onChange={() => {
                const currentZenMode = settings.layout?.zenMode?.[
                  siteId as keyof typeof settings.layout.zenMode
                ] || { enabled: false }

                setSettings({
                  layout: {
                    ...settings.layout,
                    zenMode: {
                      ...settings.layout?.zenMode,
                      [siteId]: {
                        ...currentZenMode,
                        enabled: !currentZenMode.enabled,
                      },
                    },
                  },
                })
              }}
            />
          </SettingCard>
        </>
      )}

      {/* ==========  Tab ========== */}
      {activeTab === SITE_SETTINGS_TAB_IDS.MODEL_LOCK && (
        <SettingCard
          title={t("modelLockTitle") || ""}
          description={t("modelLockDesc") || ""}>
          {/* Gemini */}
          <ModelLockRow
            label="Gemini"
            siteKey="gemini"
            settings={settings}
            setSettings={setSettings}
            placeholder={t("modelKeywordPlaceholder") || ""}
            onDisabledClick={() => showPrerequisiteToast(modelLockLabel)}
            settingId="model-lock-gemini"
          />

          {/* Gemini Enterprise */}
          <ModelLockRow
            label="Gemini Enterprise"
            siteKey="gemini-enterprise"
            settings={settings}
            setSettings={setSettings}
            placeholder={t("modelKeywordPlaceholder") || ""}
            onDisabledClick={() => showPrerequisiteToast(modelLockLabel)}
            settingId="model-lock-gemini-enterprise"
          />

          {/* AI Studio -  */}
          <AIStudioModelLockRow
            settings={settings}
            setSettings={setSettings}
            onDisabledClick={() => showPrerequisiteToast(modelLockLabel)}
            settingId="model-lock-aistudio"
          />

          {/* ChatGPT */}
          <ModelLockRow
            label="ChatGPT"
            siteKey="chatgpt"
            settings={settings}
            setSettings={setSettings}
            placeholder={t("modelKeywordPlaceholder") || ""}
            onDisabledClick={() => showPrerequisiteToast(modelLockLabel)}
            settingId="model-lock-chatgpt"
          />

          {/* Claude */}
          <ModelLockRow
            label="Claude"
            siteKey="claude"
            settings={settings}
            setSettings={setSettings}
            placeholder={t("modelKeywordPlaceholder") || ""}
            onDisabledClick={() => showPrerequisiteToast(modelLockLabel)}
            settingId="model-lock-claude"
          />

          {/* Grok */}
          <ModelLockRow
            label="Grok"
            siteKey="grok"
            settings={settings}
            setSettings={setSettings}
            placeholder={t("modelKeywordPlaceholder") || ""}
            onDisabledClick={() => showPrerequisiteToast(modelLockLabel)}
            settingId="model-lock-grok"
          />
        </SettingCard>
      )}

      {/* ========== Gemini  Tab ========== */}
      {activeTab === "gemini" && (
        <SettingCard
          title={t("geminiSettingsTab") || "Gemini "}
          description={t("contentProcessingDesc") || " AI "}>
          <ToggleRow
            label={t("markdownFixLabel") || "Markdown "}
            description={t("markdownFixDesc") || " Gemini "}
            settingId="gemini-markdown-fix"
            checked={settings.content?.markdownFix ?? true}
            onChange={() =>
              updateNestedSetting("content", "markdownFix", !settings.content?.markdownFix)
            }
          />

          <ToggleRow
            label={t("watermarkRemovalLabel") || ""}
            description={t("watermarkRemovalDesc") || " AI "}
            settingId="gemini-watermark-removal"
            checked={settings.content?.watermarkRemoval ?? false}
            onChange={() => {
              updateNestedSetting("content", "watermarkRemoval", !settings.content?.watermarkRemoval)
            }}
          />

          {/* Gemini Enterprise  */}
          <div
            className="setting-subsection"
            style={{
              marginTop: "24px",
              paddingTop: "16px",
              borderTop: "1px solid var(--gh-border-color)",
            }}>
            <h3 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "12px" }}>
              Gemini Enterprise
            </h3>
            <ToggleRow
              label={t("policyRetryLabel")}
              description={t("policyRetryDesc")}
              settingId="gemini-policy-retry"
              checked={settings.geminiEnterprise?.policyRetry?.enabled ?? false}
              onChange={() => {
                const current = settings.geminiEnterprise?.policyRetry || {
                  enabled: false,
                  maxRetries: 3,
                }
                setSettings({
                  geminiEnterprise: {
                    ...settings.geminiEnterprise,
                    policyRetry: {
                      ...current,
                      enabled: !current.enabled,
                    },
                  },
                })
              }}
            />
            {settings.geminiEnterprise?.policyRetry?.enabled && (
              <SettingRow label={t("maxRetriesLabel")} settingId="gemini-policy-max-retries">
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <NumberInput
                    value={settings.geminiEnterprise?.policyRetry?.maxRetries ?? 3}
                    onChange={(val) =>
                      setSettings({
                        geminiEnterprise: {
                          ...settings.geminiEnterprise,
                          policyRetry: {
                            ...settings.geminiEnterprise?.policyRetry!,
                            maxRetries: val,
                          },
                        },
                      })
                    }
                    min={1}
                    max={10}
                    defaultValue={3}
                    style={{ width: "60px" }}
                  />
                  <span style={{ fontSize: "12px", color: "var(--gh-text-secondary)" }}>
                    {t("retryCountSuffix")}
                  </span>
                </div>
              </SettingRow>
            )}
          </div>
        </SettingCard>
      )}

      {/* ========== AI Studio  Tab ========== */}
      {activeTab === SITE_IDS.AISTUDIO && (
        <SettingCard
          title={t("aistudioSettingsTitle") || "AI Studio "}
          description={t("aistudioSettingsDesc") || " AI Studio "}>
          {/*  */}
          <ToggleRow
            label={t("aistudioCollapseNavbar") || ""}
            description={t("aistudioCollapseNavbarDesc") || ""}
            settingId="aistudio-collapse-navbar"
            checked={settings.aistudio?.collapseNavbar ?? false}
            onChange={() =>
              setSettings({
                aistudio: {
                  ...settings.aistudio,
                  collapseNavbar: !settings.aistudio?.collapseNavbar,
                },
              })
            }
          />

          <ToggleRow
            label={t("aistudioCollapseRunSettings") || ""}
            description={
              t("aistudioCollapseRunSettingsDesc") || ""
            }
            settingId="aistudio-collapse-run-settings"
            checked={settings.aistudio?.collapseRunSettings ?? false}
            onChange={() =>
              setSettings({
                aistudio: {
                  ...settings.aistudio,
                  collapseRunSettings: !settings.aistudio?.collapseRunSettings,
                },
              })
            }
          />

          <ToggleRow
            label={t("aistudioCollapseTools") || ""}
            description={t("aistudioCollapseToolsDesc") || ""}
            settingId="aistudio-collapse-tools"
            checked={settings.aistudio?.collapseTools ?? false}
            onChange={() =>
              setSettings({
                aistudio: {
                  ...settings.aistudio,
                  collapseTools: !settings.aistudio?.collapseTools,
                },
              })
            }
          />

          <ToggleRow
            label={t("aistudioCollapseAdvanced") || ""}
            description={
              t("aistudioCollapseAdvancedDesc") || ""
            }
            settingId="aistudio-collapse-advanced"
            checked={settings.aistudio?.collapseAdvanced ?? false}
            onChange={() =>
              setSettings({
                aistudio: {
                  ...settings.aistudio,
                  collapseAdvanced: !settings.aistudio?.collapseAdvanced,
                },
              })
            }
          />

          <ToggleRow
            label={t("aistudioEnableSearch") || ""}
            description={t("aistudioEnableSearchDesc") || " Google "}
            settingId="aistudio-enable-search"
            checked={settings.aistudio?.enableSearch ?? true}
            onChange={() =>
              setSettings({
                aistudio: {
                  ...settings.aistudio,
                  enableSearch: !settings.aistudio?.enableSearch,
                },
              })
            }
          />

          <ToggleRow
            label={t("aistudioRemoveWatermark") || ""}
            description={
              t("aistudioRemoveWatermarkDesc") ||
              " ()"
            }
            settingId="aistudio-remove-watermark"
            checked={settings.aistudio?.removeWatermark ?? false}
            onChange={() => {
              setSettings({
                aistudio: {
                  ...settings.aistudio,
                  removeWatermark: !settings.aistudio?.removeWatermark,
                },
              })
              showToast(t("aistudioReloadHint") || " AI Studio ", 3000)
            }}
          />

          <ToggleRow
            label={t("aistudioMarkdownFixLabel") || "Markdown "}
            description={
              t("aistudioMarkdownFixDesc") || " AI Studio  **** "
            }
            settingId="aistudio-markdown-fix"
            checked={settings.aistudio?.markdownFix ?? false}
            onChange={() =>
              setSettings({
                aistudio: {
                  ...settings.aistudio,
                  markdownFix: !settings.aistudio?.markdownFix,
                },
              })
            }
          />
        </SettingCard>
      )}

      {/* ========== Claude  Tab ========== */}
      {activeTab === "claude" && <ClaudeSettings siteId={siteId} />}

      {/* ========== ChatGPT  Tab ========== */}
      {activeTab === SITE_IDS.CHATGPT && (
        <SettingCard
          title={t("chatgptSettingsTitle") || "ChatGPT "}
          description={t("chatgptSettingsDesc") || " ChatGPT "}>
          <ToggleRow
            label={t("chatgptMarkdownFixLabel") || "Markdown "}
            description={t("chatgptMarkdownFixDesc") || " ChatGPT  **** "}
            settingId="chatgpt-markdown-fix"
            checked={settings.chatgpt?.markdownFix ?? false}
            onChange={() =>
              setSettings({
                chatgpt: {
                  ...settings.chatgpt,
                  markdownFix: !settings.chatgpt?.markdownFix,
                },
              })
            }
          />
        </SettingCard>
      )}
    </div>
  )
}

export default SiteSettingsPage
