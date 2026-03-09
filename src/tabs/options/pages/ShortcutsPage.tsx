/**
 * 
 * 
 */
import React, { useCallback, useState } from "react"

import { KeyboardIcon } from "~components/icons"
import { ConfirmDialog, Tooltip } from "~components/ui"
import {
  DEFAULT_KEYBINDINGS,
  formatShortcut,
  isMacOS,
  SHORTCUT_CATEGORIES,
  SHORTCUT_META,
  type ShortcutActionId,
  type ShortcutBinding,
} from "~constants/shortcuts"
import { platform } from "~platform"
import { useSettingsStore } from "~stores/settings-store"
import { t } from "~utils/i18n"
import { MSG_OPEN_URL, sendToBackground } from "~utils/messaging"

import { PageTitle, SettingCard, SettingRow, ToggleRow } from "../components"

interface ShortcutsPageProps {
  siteId: string
}

// 
const ShortcutInput: React.FC<{
  binding: ShortcutBinding | null
  onChange: (binding: ShortcutBinding) => void
  onRemove: () => void
  conflictWarning?: string
}> = ({ binding, onChange, onRemove, conflictWarning }) => {
  const [isRecording, setIsRecording] = useState(false)
  const isMac = isMacOS()

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isRecording) return

      e.preventDefault()
      e.stopPropagation()

      // 
      if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) {
        return
      }

      const newBinding: ShortcutBinding = {
        key: e.key,
        alt: e.altKey,
        ctrl: e.ctrlKey,
        meta: e.metaKey,
        shift: e.shiftKey,
      }

      // 
      if (!newBinding.alt && !newBinding.ctrl && !newBinding.meta && !newBinding.shift) {
        // 
        const allowedSingleKeys = [
          "Escape",
          "F1",
          "F2",
          "F3",
          "F4",
          "F5",
          "F6",
          "F7",
          "F8",
          "F9",
          "F10",
          "F11",
          "F12",
        ]
        if (!allowedSingleKeys.includes(e.key)) {
          return
        }
      }

      // Mac  meta (⌘)  ctrl Windows 
      if (isMac && newBinding.meta) {
        newBinding.ctrl = true
        newBinding.meta = false
      }

      onChange(newBinding)
      setIsRecording(false)
    },
    [isRecording, onChange, isMac],
  )

  const handleBlur = () => {
    setIsRecording(false)
  }

  //  binding  null""
  const displayText = isRecording
    ? t("pressAnyKey") || "..."
    : binding
      ? formatShortcut(binding, isMac)
      : t("shortcutNotSet") || ""

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <button
        className={`shortcut-input ${isRecording ? "recording" : ""} ${!binding ? "not-set" : ""}`}
        onClick={() => setIsRecording(true)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        style={{
          padding: "6px 12px",
          minWidth: "120px",
          fontSize: "13px",
          fontFamily: "monospace",
          border: isRecording
            ? "2px solid var(--gh-primary)"
            : "1px solid var(--gh-border, #e5e7eb)",
          borderRadius: "6px",
          background: isRecording ? "var(--gh-bg-hover)" : "var(--gh-bg)",
          color: binding ? "var(--gh-text)" : "var(--gh-text-tertiary)",
          cursor: "pointer",
          textAlign: "center",
          transition: "all 0.2s",
          fontStyle: binding ? "normal" : "italic",
        }}>
        {displayText}
      </button>
      {binding && (
        <Tooltip content={t("shortcutRemove") || ""}>
          <button
            onClick={onRemove}
            style={{
              padding: "4px 8px",
              fontSize: "12px",
              border: "1px solid var(--gh-border)",
              borderRadius: "4px",
              background: "var(--gh-bg)",
              color: "var(--gh-text-secondary)",
              cursor: "pointer",
              transition: "all 0.2s",
            }}>
            ✕
          </button>
        </Tooltip>
      )}
      {conflictWarning && (
        <span style={{ fontSize: "12px", color: "var(--gh-error, #ef4444)" }}>
          {conflictWarning}
        </span>
      )}
    </div>
  )
}

const ShortcutsPage: React.FC<ShortcutsPageProps> = ({ siteId: _siteId }) => {
  const { settings, setSettings } = useSettingsStore()
  const shortcuts = settings?.shortcuts

  // 
  const checkConflict = useCallback(
    (actionId: string, binding: ShortcutBinding | null): string | undefined => {
      if (!binding) return undefined // null 
      const allBindings = shortcuts?.keybindings || {}
      for (const [id, b] of Object.entries(allBindings)) {
        if (id === actionId) continue
        if (b === null) continue // 
        //  SHORTCUT_META 
        const meta = SHORTCUT_META[id as ShortcutActionId]
        if (!meta) continue

        if (
          b.key === binding.key &&
          !!b.alt === !!binding.alt &&
          !!b.ctrl === !!binding.ctrl &&
          !!b.meta === !!binding.meta &&
          !!b.shift === !!binding.shift
        ) {
          return `${t("shortcutConflictWith") || ""} "${t(meta.labelKey) || meta.label}" ${t("shortcutConflict") || ""}`
        }
      }
      return undefined
    },
    [shortcuts?.keybindings],
  )

  // 
  const updateKeybinding = useCallback(
    (actionId: string, binding: ShortcutBinding) => {
      setSettings({
        shortcuts: {
          ...shortcuts,
          enabled: shortcuts?.enabled ?? true,
          globalUrl: shortcuts?.globalUrl ?? "https://gemini.google.com",
          keybindings: {
            ...shortcuts?.keybindings,
            [actionId]: binding,
          },
        },
      })
    },
    [shortcuts, setSettings],
  )

  // 
  const removeKeybinding = useCallback(
    (actionId: string) => {
      setSettings({
        shortcuts: {
          ...shortcuts,
          enabled: shortcuts?.enabled ?? true,
          globalUrl: shortcuts?.globalUrl ?? "https://gemini.google.com",
          keybindings: {
            ...shortcuts?.keybindings,
            [actionId]: null, //  null 
          },
        },
      })
    },
    [shortcuts, setSettings],
  )

  // 
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  // 
  const resetToDefault = useCallback(() => {
    setSettings({
      shortcuts: {
        ...shortcuts,
        keybindings: { ...DEFAULT_KEYBINDINGS },
      },
    })
    setShowResetConfirm(false)
  }, [shortcuts, setSettings])

  // 
  const groupedActions = Object.entries(SHORTCUT_CATEGORIES).map(([categoryId, categoryMeta]) => {
    const actions = Object.entries(SHORTCUT_META).filter(
      ([, meta]) => meta.category === categoryId,
    ) as [ShortcutActionId, (typeof SHORTCUT_META)[ShortcutActionId]][]
    return { categoryId, categoryMeta, actions }
  })

  if (!settings) return null

  return (
    <div>
      <PageTitle title={t("navShortcuts") || ""} Icon={KeyboardIcon} />
      <p className="settings-page-desc">
        {t("shortcutsPageDesc") || ""}
      </p>

      <SettingCard title={t("shortcutsGlobalSettings") || ""}>
        <ToggleRow
          label={t("enableShortcuts") || ""}
          description={t("enableShortcutsDesc") || ""}
          checked={shortcuts?.enabled ?? true}
          settingId="shortcuts-enabled"
          onChange={() =>
            setSettings({
              shortcuts: {
                ...shortcuts,
                enabled: !(shortcuts?.enabled ?? true),
                globalUrl: shortcuts?.globalUrl ?? "https://gemini.google.com",
                keybindings: shortcuts?.keybindings ?? DEFAULT_KEYBINDINGS,
              },
            })
          }
        />

        {platform.hasCapability("commands") && (
          <>
            <SettingRow
              label={t("globalShortcutUrl") || " URL"}
              description={t("globalShortcutUrlDesc") || " Alt+G "}
              settingId="shortcuts-global-url">
              <input
                type="text"
                className="settings-input"
                value={shortcuts?.globalUrl || "https://gemini.google.com"}
                onChange={(e) =>
                  setSettings({
                    shortcuts: {
                      ...shortcuts,
                      enabled: shortcuts?.enabled ?? true,
                      globalUrl: e.target.value,
                      keybindings: shortcuts?.keybindings ?? DEFAULT_KEYBINDINGS,
                    },
                  })
                }
                style={{ width: "280px" }}
                placeholder="https://gemini.google.com"
              />
            </SettingRow>

            <SettingRow
              label={t("globalShortcutsTitle") || ""}
              description={
                t("globalShortcutsDesc") ||
                ""
              }
              settingId="shortcuts-browser-shortcuts">
              {(() => {
                const ua = navigator.userAgent
                const isChrome = ua.includes("Chrome") && !ua.includes("Edg/")
                const isEdge = ua.includes("Edg/")
                const isFirefox = ua.includes("Firefox")

                const isSupported = isChrome || isEdge || isFirefox

                if (!isSupported) {
                  return (
                    <span style={{ fontSize: "13px", color: "var(--gh-text-tertiary)" }}>
                      {t("browserNotSupported") || ""}
                    </span>
                  )
                }

                let url = "chrome://extensions/shortcuts"
                if (isEdge) url = "edge://extensions/shortcuts"
                else if (isFirefox) url = "about:addons"

                return (
                  <button
                    onClick={() => sendToBackground({ type: MSG_OPEN_URL, url })}
                    style={{
                      padding: "6px 12px",
                      fontSize: "13px",
                      border: "none",
                      borderRadius: "6px",
                      background: "var(--gh-primary)",
                      color: "#fff",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}>
                    {t("openBrowserShortcuts") || ""}
                  </button>
                )
              })()}
            </SettingRow>
          </>
        )}

        <div
          style={{
            marginTop: "16px",
            paddingTop: "16px",
          }}>
          <button
            onClick={() => setShowResetConfirm(true)}
            style={{
              padding: "8px 16px",
              fontSize: "13px",
              border: "1px solid var(--gh-border)",
              borderRadius: "6px",
              background: "var(--gh-bg)",
              color: "var(--gh-text-secondary)",
              cursor: "pointer",
            }}>
            {t("resetShortcuts") || ""}
          </button>
        </div>
      </SettingCard>

      <SettingCard
        title={t("shortcutsInteractionGroup") || ""}
        description={
          t("shortcutsInteractionGroupDesc") || "“”"
        }>
        <SettingRow
          label={
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "4px",
              }}>
              <span>{t("promptSubmitShortcutLabel") || "Send shortcut"}</span>
              <span style={{ fontSize: "13px", color: "var(--gh-text-secondary)" }}>
                {(
                  t("promptSubmitShortcutDesc") ||
                  "Applies to both manual send and prompt auto-send"
                ).replace(/[\u3002.]$/, "")}
              </span>
            </div>
          }
          settingId="shortcuts-prompt-submit-shortcut">
          <select
            className="settings-select"
            value={settings.features?.prompts?.submitShortcut ?? "enter"}
            onChange={(e) =>
              setSettings({
                features: {
                  ...settings.features,
                  prompts: {
                    enabled: settings.features?.prompts?.enabled ?? true,
                    doubleClickToSend: settings.features?.prompts?.doubleClickToSend ?? false,
                    submitShortcut: e.target.value as "enter" | "ctrlEnter",
                    promptQueue: settings.features?.prompts?.promptQueue ?? false,
                  },
                },
              })
            }>
            <option value="enter">{t("promptSubmitShortcutEnter") || "Enter"}</option>
            <option value="ctrlEnter">
              {t("promptSubmitShortcutCtrlEnter") || "Ctrl + Enter"}
            </option>
          </select>
        </SettingRow>
      </SettingCard>

      {groupedActions.map(({ categoryId, categoryMeta, actions }) => (
        <SettingCard key={categoryId} title={t(categoryMeta.labelKey) || categoryMeta.label}>
          {actions.map(([actionId, meta]) => {
            //  >  null 
            const userBinding = shortcuts?.keybindings?.[actionId]
            const binding =
              userBinding === null ? null : userBinding || DEFAULT_KEYBINDINGS[actionId]
            const conflict = checkConflict(actionId, binding)

            return (
              <SettingRow
                key={actionId}
                label={t(meta.labelKey) || meta.label}
                disabled={!shortcuts?.enabled}
                settingId={`shortcut-binding-${actionId}`}>
                <ShortcutInput
                  binding={binding}
                  onChange={(b) => updateKeybinding(actionId, b)}
                  onRemove={() => removeKeybinding(actionId)}
                  conflictWarning={conflict || undefined}
                />
              </SettingRow>
            )
          })}
        </SettingCard>
      ))}

      {showResetConfirm && (
        <ConfirmDialog
          title={t("resetShortcuts") || ""}
          message={t("resetShortcutsConfirm") || ""}
          danger
          onConfirm={resetToDefault}
          onCancel={() => setShowResetConfirm(false)}
        />
      )}
    </div>
  )
}

export default ShortcutsPage
