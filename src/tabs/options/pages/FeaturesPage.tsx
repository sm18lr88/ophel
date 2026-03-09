/**
 * 
 * 
 *  Tab 
 */
import React, { useEffect, useState } from "react"

import { FeaturesIcon } from "~components/icons"
import { NumberInput } from "~components/ui"
import { FEATURES_TAB_IDS } from "~constants"
import { platform } from "~platform"
import { useSettingsStore } from "~stores/settings-store"
import { t } from "~utils/i18n"
import { MSG_CHECK_PERMISSIONS, MSG_REQUEST_PERMISSIONS, sendToBackground } from "~utils/messaging"
import { showToast, showToastThrottled } from "~utils/toast"

import { PageTitle, SettingCard, SettingRow, TabGroup, ToggleRow } from "../components"

interface FeaturesPageProps {
  siteId: string
  initialTab?: string
}

interface LazyInputProps {
  value: string
  onChange: (val: string) => void
  placeholder?: string
  className?: string
  style?: React.CSSProperties
}

const LazyInput: React.FC<LazyInputProps> = ({
  value,
  onChange,
  placeholder,
  className,
  style,
}) => {
  const [localValue, setLocalValue] = useState(value)

  //  value  localValue
  React.useEffect(() => {
    setLocalValue(value)
  }, [value])

  const handleBlur = () => {
    if (localValue !== value) {
      onChange(localValue)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleBlur()
      ;(e.target as HTMLInputElement).blur()
    }
  }

  return (
    <input
      type="text"
      className={className}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      style={style}
    />
  )
}

const FeaturesPage: React.FC<FeaturesPageProps> = ({ siteId: _siteId, initialTab }) => {
  const tabs = [
    { id: FEATURES_TAB_IDS.OUTLINE, label: t("tabOutline") || "" },
    { id: FEATURES_TAB_IDS.CONVERSATIONS, label: t("tabConversations") || "" },
    { id: FEATURES_TAB_IDS.PROMPTS, label: t("tabPrompts") || "Prompts" },
    { id: FEATURES_TAB_IDS.TAB_SETTINGS, label: t("tabSettingsTab") || "" },
    { id: FEATURES_TAB_IDS.CONTENT, label: t("navContent") || "" },
    { id: FEATURES_TAB_IDS.READING_HISTORY, label: t("readingHistoryTitle") || "" },
  ]

  const [activeTab, setActiveTab] = useState<string>(initialTab || tabs[0].id)
  const { settings, updateDeepSetting, updateNestedSetting } = useSettingsStore()

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab)
    }
  }, [initialTab])

  if (!settings) return null

  const prerequisiteToastTemplate = t("enablePrerequisiteToast") || "{setting}"
  const showPrerequisiteToast = (label: string) =>
    showToastThrottled(prerequisiteToastTemplate.replace("{setting}", label), 2000, {}, 1500, label)
  const autoRenameLabel = t("autoRenameTabLabel") || ""
  const showNotificationLabel = t("showNotificationLabel") || ""
  const privacyModeLabel = t("privacyModeLabel") || ""
  const readingHistoryLabel = t("readingHistoryPersistenceLabel") || ""
  const formulaCopyLabel = t("formulaCopyLabel") || ""

  return (
    <div>
      <PageTitle title={t("navFeatures") || ""} Icon={FeaturesIcon} />
      <p className="settings-page-desc">{t("featuresPageDesc") || ""}</p>

      <TabGroup tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* ==========  Tab ========== */}
      {activeTab === FEATURES_TAB_IDS.TAB_SETTINGS && (
        <>
          {/*  */}
          <SettingCard title={t("tabBehaviorTitle") || ""}>
            <ToggleRow
              label={t("openNewTabLabel") || ""}
              description={t("openNewTabDesc") || ""}
              settingId="tab-open-new"
              checked={settings.tab?.openInNewTab ?? true}
              onChange={() =>
                updateNestedSetting("tab", "openInNewTab", !settings.tab?.openInNewTab)
              }
            />

            <ToggleRow
              label={t("autoRenameTabLabel") || ""}
              description={t("autoRenameTabDesc") || ""}
              settingId="tab-auto-rename"
              checked={settings.tab?.autoRename ?? false}
              onChange={() => updateNestedSetting("tab", "autoRename", !settings.tab?.autoRename)}
            />

            <SettingRow
              label={t("renameIntervalLabel") || ""}
              settingId="tab-rename-interval"
              disabled={!settings.tab?.autoRename}
              onDisabledClick={() => showPrerequisiteToast(autoRenameLabel)}>
              <select
                className="settings-select"
                value={settings.tab?.renameInterval || 3}
                onChange={(e) =>
                  updateNestedSetting("tab", "renameInterval", parseInt(e.target.value))
                }
                disabled={!settings.tab?.autoRename}>
                {[1, 3, 5, 10, 30, 60].map((v) => (
                  <option key={v} value={v}>
                    {v} 
                  </option>
                ))}
              </select>
            </SettingRow>

            <SettingRow
              label={t("titleFormatLabel") || ""}
              description={t("titleFormatDesc") || "{status}{title}{model}"}
              settingId="tab-title-format"
              disabled={!settings.tab?.autoRename}
              onDisabledClick={() => showPrerequisiteToast(autoRenameLabel)}>
              <input
                type="text"
                className="settings-input"
                value={settings.tab?.titleFormat || "{status}{title}"}
                onChange={(e) => updateNestedSetting("tab", "titleFormat", e.target.value)}
                placeholder="{status}{title}"
                disabled={!settings.tab?.autoRename}
                style={{ width: "180px" }}
              />
            </SettingRow>

            <ToggleRow
              label={t("showStatusLabel") || ""}
              description={t("showStatusDesc") || ""}
              settingId="tab-show-status"
              checked={settings.tab?.showStatus ?? true}
              onChange={() => updateNestedSetting("tab", "showStatus", !settings.tab?.showStatus)}
            />
          </SettingCard>

          {/*  */}
          <SettingCard title={t("notificationSettings") || ""}>
            <ToggleRow
              label={t("showNotificationLabel") || ""}
              description={t("showNotificationDesc") || ""}
              settingId="tab-show-notification"
              checked={settings.tab?.showNotification ?? false}
              onChange={async () => {
                const checked = settings.tab?.showNotification
                if (!checked) {
                  // GM_notification  @grant 
                  if (!platform.hasCapability("permissions")) {
                    updateNestedSetting("tab", "showNotification", true)
                    return
                  }
                  // 1. 
                  const response = await sendToBackground({
                    type: MSG_CHECK_PERMISSIONS,
                    permissions: ["notifications"],
                  })

                  if (response.success && response.hasPermission) {
                    updateNestedSetting("tab", "showNotification", true)
                  } else {
                    // 2.  ()
                    await sendToBackground({
                      type: MSG_REQUEST_PERMISSIONS,
                      permType: "notifications",
                    })
                    showToast(t("permissionRequestToast") || "", 3000)
                  }
                } else {
                  updateNestedSetting("tab", "showNotification", false)
                }
              }}
            />

            <ToggleRow
              label={t("notificationSoundLabel") || ""}
              description={t("notificationSoundDesc") || ""}
              settingId="tab-notification-sound"
              checked={settings.tab?.notificationSound ?? false}
              disabled={!settings.tab?.showNotification}
              onDisabledClick={() => showPrerequisiteToast(showNotificationLabel)}
              onChange={() =>
                updateNestedSetting("tab", "notificationSound", !settings.tab?.notificationSound)
              }
            />

            <SettingRow
              label={t("notificationVolumeLabel") || ""}
              settingId="tab-notification-volume"
              disabled={!settings.tab?.showNotification || !settings.tab?.notificationSound}
              onDisabledClick={() => showPrerequisiteToast(showNotificationLabel)}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.1"
                  value={settings.tab?.notificationVolume || 0.5}
                  onChange={(e) =>
                    updateNestedSetting("tab", "notificationVolume", parseFloat(e.target.value))
                  }
                  disabled={!settings.tab?.showNotification || !settings.tab?.notificationSound}
                  style={{ width: "100px" }}
                />
                <span style={{ fontSize: "12px", minWidth: "36px" }}>
                  {Math.round((settings.tab?.notificationVolume || 0.5) * 100)}%
                </span>
              </div>
            </SettingRow>

            <ToggleRow
              label={t("notifyWhenFocusedLabel") || ""}
              description={t("notifyWhenFocusedDesc") || ""}
              settingId="tab-notify-when-focused"
              checked={settings.tab?.notifyWhenFocused ?? false}
              disabled={!settings.tab?.showNotification}
              onDisabledClick={() => showPrerequisiteToast(showNotificationLabel)}
              onChange={() =>
                updateNestedSetting("tab", "notifyWhenFocused", !settings.tab?.notifyWhenFocused)
              }
            />

            <ToggleRow
              label={t("autoFocusLabel") || ""}
              description={t("autoFocusDesc") || ""}
              settingId="tab-auto-focus"
              checked={settings.tab?.autoFocus ?? false}
              onChange={() => updateNestedSetting("tab", "autoFocus", !settings.tab?.autoFocus)}
            />
          </SettingCard>

          {/*  */}
          <SettingCard title={t("privacyModeTitle") || ""}>
            <ToggleRow
              label={t("privacyModeLabel") || ""}
              description={t("privacyModeDesc") || ""}
              settingId="tab-privacy-mode"
              checked={settings.tab?.privacyMode ?? false}
              onChange={() => updateNestedSetting("tab", "privacyMode", !settings.tab?.privacyMode)}
            />

            <SettingRow
              label={t("privacyTitleLabel") || ""}
              settingId="tab-privacy-title"
              disabled={!settings.tab?.privacyMode}
              onDisabledClick={() => showPrerequisiteToast(privacyModeLabel)}>
              <input
                type="text"
                className="settings-input"
                value={settings.tab?.privacyTitle || "Google"}
                onChange={(e) => updateNestedSetting("tab", "privacyTitle", e.target.value)}
                placeholder="Google"
                disabled={!settings.tab?.privacyMode}
                style={{ width: "180px" }}
              />
            </SettingRow>
          </SettingCard>
        </>
      )}

      {/* ==========  Tab ========== */}
      {activeTab === FEATURES_TAB_IDS.OUTLINE && (
        <>
          <SettingCard
            title={t("outlineSettings") || ""}
            description={t("outlineSettingsDesc") || ""}>
            <ToggleRow
              label={t("outlineAutoUpdateLabel") || ""}
              description={t("outlineAutoUpdateDesc") || ""}
              settingId="outline-auto-update"
              checked={settings.features?.outline?.autoUpdate ?? true}
              onChange={() =>
                updateDeepSetting(
                  "features",
                  "outline",
                  "autoUpdate",
                  !settings.features?.outline?.autoUpdate,
                )
              }
            />

            <SettingRow
              label={t("outlineUpdateIntervalLabel") || ""}
              description={t("outlineUpdateIntervalDesc") || ""}
              settingId="outline-update-interval">
              <NumberInput
                value={settings.features?.outline?.updateInterval ?? 2}
                onChange={(val) => updateDeepSetting("features", "outline", "updateInterval", val)}
                min={1}
                max={60}
                defaultValue={2}
                style={{ width: "80px" }}
              />
            </SettingRow>

            <SettingRow
              label={t("outlineFollowModeLabel") || ""}
              description={
                settings.features?.outline?.followMode === "current"
                  ? t("outlineFollowCurrentDesc") || ""
                  : settings.features?.outline?.followMode === "latest"
                    ? t("outlineFollowLatestDesc") || ""
                    : t("outlineFollowManualDesc") || ""
              }
              settingId="outline-follow-mode">
              <select
                className="settings-select"
                value={settings.features?.outline?.followMode || "current"}
                onChange={(e) =>
                  updateDeepSetting(
                    "features",
                    "outline",
                    "followMode",
                    e.target.value as "current" | "latest" | "manual",
                  )
                }>
                <option value="current">{t("outlineFollowCurrent") || ""}</option>
                <option value="latest">{t("outlineFollowLatest") || ""}</option>
                <option value="manual">{t("outlineFollowManual") || ""}</option>
              </select>
            </SettingRow>

            <ToggleRow
              label={t("outlineShowWordCountLabel") || ""}
              description={t("outlineShowWordCountDesc") || ""}
              settingId="outline-show-word-count"
              checked={settings.features?.outline?.showWordCount ?? false}
              onChange={() =>
                updateDeepSetting(
                  "features",
                  "outline",
                  "showWordCount",
                  !settings.features?.outline?.showWordCount,
                )
              }
            />
          </SettingCard>

          {/*  */}
          <SettingCard
            title={t("bookmarkSettings") || ""}
            description={t("bookmarkSettingsDesc") || ""}>
            <SettingRow
              label={t("inlineBookmarkModeLabel") || ""}
              description={t("inlineBookmarkModeDesc") || ""}
              settingId="outline-inline-bookmark-mode">
              <select
                className="settings-select"
                value={settings.features?.outline?.inlineBookmarkMode || "always"}
                onChange={(e) =>
                  updateDeepSetting(
                    "features",
                    "outline",
                    "inlineBookmarkMode",
                    e.target.value as "always" | "hover" | "hidden",
                  )
                }>
                <option value="always">{t("inlineBookmarkModeAlways") || ""}</option>
                <option value="hover">{t("inlineBookmarkModeHover") || ""}</option>
                <option value="hidden">{t("inlineBookmarkModeHidden") || ""}</option>
              </select>
            </SettingRow>

            <SettingRow
              label={t("panelBookmarkModeLabel") || ""}
              description={t("panelBookmarkModeDesc") || ""}
              settingId="outline-panel-bookmark-mode">
              <select
                className="settings-select"
                value={settings.features?.outline?.panelBookmarkMode || "always"}
                onChange={(e) =>
                  updateDeepSetting(
                    "features",
                    "outline",
                    "panelBookmarkMode",
                    e.target.value as "always" | "hover" | "hidden",
                  )
                }>
                <option value="always">{t("inlineBookmarkModeAlways") || ""}</option>
                <option value="hover">{t("inlineBookmarkModeHover") || ""}</option>
                <option value="hidden">{t("inlineBookmarkModeHidden") || ""}</option>
              </select>
            </SettingRow>
          </SettingCard>

          {/*  */}
          <SettingCard title={t("scrollSettings") || ""}>
            <ToggleRow
              label={t("preventAutoScrollLabel") || ""}
              description={t("preventAutoScrollDesc") || ""}
              settingId="outline-prevent-auto-scroll"
              checked={settings.panel?.preventAutoScroll ?? false}
              onChange={() =>
                updateNestedSetting(
                  "panel",
                  "preventAutoScroll",
                  !settings.panel?.preventAutoScroll,
                )
              }
            />
          </SettingCard>
        </>
      )}

      {/* ==========  Tab ========== */}
      {activeTab === FEATURES_TAB_IDS.CONVERSATIONS && (
        <>
          <SettingCard
            title={t("conversationsSettingsTitle") || ""}
            description={t("conversationsSettingsDesc") || ""}>
            <ToggleRow
              label={t("folderRainbowLabel") || ""}
              description={t("folderRainbowDesc") || ""}
              settingId="conversation-folder-rainbow"
              checked={settings.features?.conversations?.folderRainbow ?? true}
              onChange={() =>
                updateDeepSetting(
                  "features",
                  "conversations",
                  "folderRainbow",
                  !settings.features?.conversations?.folderRainbow,
                )
              }
            />

            <ToggleRow
              label={t("conversationsSyncUnpinLabel") || ""}
              description={t("conversationsSyncUnpinDesc") || ""}
              settingId="conversation-sync-unpin"
              checked={settings.features?.conversations?.syncUnpin ?? false}
              onChange={() =>
                updateDeepSetting(
                  "features",
                  "conversations",
                  "syncUnpin",
                  !settings.features?.conversations?.syncUnpin,
                )
              }
            />
            <ToggleRow
              label={t("conversationsSyncDeleteLabel") || "Sync Delete Cloud"}
              description={
                t("conversationsSyncDeleteDesc") ||
                "Delete cloud conversation on supported sites when deleting local record"
              }
              settingId="conversation-sync-delete"
              checked={settings.features?.conversations?.syncDelete ?? true}
              onChange={() =>
                updateDeepSetting(
                  "features",
                  "conversations",
                  "syncDelete",
                  !(settings.features?.conversations?.syncDelete ?? true),
                )
              }
            />
          </SettingCard>

          {/*  */}
          <SettingCard title={t("exportSettings") || ""}>
            <SettingRow
              label={t("exportCustomUserName") || ""}
              description={t("exportCustomUserNameDesc") || " (: User)"}
              settingId="export-custom-user-name">
              <LazyInput
                className="settings-input"
                value={settings.export?.customUserName || ""}
                onChange={(val) => updateNestedSetting("export", "customUserName", val)}
                placeholder="User"
                style={{ width: "180px" }}
              />
            </SettingRow>

            <SettingRow
              label={t("exportCustomModelName") || " AI "}
              description={
                t("exportCustomModelNameDesc") || " AI  (: )"
              }
              settingId="export-custom-model-name">
              <LazyInput
                className="settings-input"
                value={settings.export?.customModelName || ""}
                onChange={(val) => updateNestedSetting("export", "customModelName", val)}
                placeholder="Site Name"
                style={{ width: "180px" }}
              />
            </SettingRow>

            <ToggleRow
              label={t("exportFilenameTimestamp") || ""}
              description={t("exportFilenameTimestampDesc") || ""}
              settingId="export-filename-timestamp"
              checked={settings.export?.exportFilenameTimestamp ?? false}
              onChange={() =>
                updateNestedSetting(
                  "export",
                  "exportFilenameTimestamp",
                  !settings.export?.exportFilenameTimestamp,
                )
              }
            />

            <ToggleRow
              label={t("exportIncludeThoughtsLabel") || ""}
              description={t("exportIncludeThoughtsDesc") || ""}
              settingId="export-include-thoughts"
              checked={settings.export?.includeThoughts ?? true}
              onChange={() =>
                updateNestedSetting(
                  "export",
                  "includeThoughts",
                  !(settings.export?.includeThoughts ?? true),
                )
              }
            />

            <ToggleRow
              label={t("exportImagesToBase64Label") || " Base64"}
              description={t("exportImagesToBase64Desc") || " Base64 "}
              settingId="export-images-base64"
              checked={settings.content?.exportImagesToBase64 ?? false}
              onChange={() =>
                updateNestedSetting(
                  "content",
                  "exportImagesToBase64",
                  !settings.content?.exportImagesToBase64,
                )
              }
            />
          </SettingCard>
        </>
      )}
      {/* ========== Prompt Tab ========== */}
      {activeTab === FEATURES_TAB_IDS.PROMPTS && (
        <SettingCard
          title={t("promptSettingsTitle") || "Prompts Settings"}
          description={t("promptSettingsDesc") || "Configure interactions in the prompts tab"}>
          <ToggleRow
            label={t("promptDoubleClickSendLabel") || "Double-click to send prompt"}
            description={
              t("promptDoubleClickSendDesc") ||
              "When enabled, double-click sends the prompt directly. Prompts with variables are sent after confirmation."
            }
            settingId="prompt-double-click-send"
            checked={settings.features?.prompts?.doubleClickToSend ?? false}
            onChange={() =>
              updateDeepSetting(
                "features",
                "prompts",
                "doubleClickToSend",
                !settings.features?.prompts?.doubleClickToSend,
              )
            }
          />

          <ToggleRow
            label={t("queueSettingLabel") || "Prompt Queue"}
            description={
              t("queueSettingDesc") ||
              "Show queue overlay above input for queuing prompts while AI generates"
            }
            settingId="prompt-queue"
            checked={settings.features?.prompts?.promptQueue ?? false}
            onChange={() =>
              updateDeepSetting(
                "features",
                "prompts",
                "promptQueue",
                !(settings.features?.prompts?.promptQueue ?? false),
              )
            }
          />
        </SettingCard>
      )}

      {/* ========== Reading History Tab ========== */}
      {activeTab === FEATURES_TAB_IDS.READING_HISTORY && (
        <SettingCard
          title={t("readingHistoryTitle") || ""}
          description={t("readingHistoryDesc") || ""}>
          <ToggleRow
            label={t("readingHistoryPersistenceLabel") || ""}
            description={t("readingHistoryPersistenceDesc") || ""}
            settingId="reading-history-persistence"
            checked={settings.readingHistory?.persistence ?? true}
            onChange={() =>
              updateNestedSetting(
                "readingHistory",
                "persistence",
                !settings.readingHistory?.persistence,
              )
            }
          />

          <ToggleRow
            label={t("readingHistoryAutoRestoreLabel") || ""}
            description={t("readingHistoryAutoRestoreDesc") || ""}
            settingId="reading-history-auto-restore"
            checked={settings.readingHistory?.autoRestore ?? true}
            disabled={!settings.readingHistory?.persistence}
            onDisabledClick={() => showPrerequisiteToast(readingHistoryLabel)}
            onChange={() =>
              updateNestedSetting(
                "readingHistory",
                "autoRestore",
                !settings.readingHistory?.autoRestore,
              )
            }
          />

          <SettingRow
            label={t("readingHistoryCleanup") || ""}
            settingId="reading-history-cleanup-days"
            disabled={!settings.readingHistory?.persistence}
            onDisabledClick={() => showPrerequisiteToast(readingHistoryLabel)}>
            <select
              className="settings-select"
              value={settings.readingHistory?.cleanupDays || 30}
              onChange={(e) =>
                updateNestedSetting("readingHistory", "cleanupDays", parseInt(e.target.value))
              }
              disabled={!settings.readingHistory?.persistence}>
              <option value={1}>1 {t("day") || ""}</option>
              <option value={3}>3 {t("days") || ""}</option>
              <option value={7}>7 {t("days") || ""}</option>
              <option value={30}>30 {t("days") || ""}</option>
              <option value={90}>90 {t("days") || ""}</option>
              <option value={-1}>{t("forever") || ""}</option>
            </select>
          </SettingRow>
        </SettingCard>
      )}

      {/* ==========  Tab ========== */}
      {activeTab === FEATURES_TAB_IDS.CONTENT && (
        <SettingCard
          title={t("interactionEnhance") || ""}
          description={t("interactionEnhanceDesc") || ""}>
          <ToggleRow
            label={t("userQueryMarkdownLabel") || " Markdown "}
            description={t("userQueryMarkdownDesc") || " Markdown "}
            settingId="content-user-query-markdown"
            checked={settings.content?.userQueryMarkdown ?? false}
            onChange={() =>
              updateNestedSetting(
                "content",
                "userQueryMarkdown",
                !settings.content?.userQueryMarkdown,
              )
            }
          />

          <ToggleRow
            label={t("formulaCopyLabel") || ""}
            description={t("formulaCopyDesc") || " LaTeX "}
            settingId="content-formula-copy"
            checked={settings.content?.formulaCopy ?? true}
            onChange={() =>
              updateNestedSetting("content", "formulaCopy", !settings.content?.formulaCopy)
            }
          />

          <ToggleRow
            label={t("formulaDelimiterLabel") || ""}
            description={t("formulaDelimiterDesc") || ""}
            settingId="content-formula-delimiter"
            checked={settings.content?.formulaDelimiter ?? true}
            disabled={!settings.content?.formulaCopy}
            onDisabledClick={() => showPrerequisiteToast(formulaCopyLabel)}
            onChange={() =>
              updateNestedSetting(
                "content",
                "formulaDelimiter",
                !settings.content?.formulaDelimiter,
              )
            }
          />

          <ToggleRow
            label={t("tableCopyLabel") || " Markdown"}
            description={t("tableCopyDesc") || ""}
            settingId="content-table-copy"
            checked={settings.content?.tableCopy ?? true}
            onChange={() =>
              updateNestedSetting("content", "tableCopy", !settings.content?.tableCopy)
            }
          />
        </SettingCard>
      )}
    </div>
  )
}

export default FeaturesPage
