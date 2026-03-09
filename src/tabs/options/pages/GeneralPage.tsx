/**
 * 
 *  |  |  | 
 */
import React, { useEffect, useState } from "react"

import { DragIcon, GeneralIcon } from "~components/icons"
import { NumberInput, Switch } from "~components/ui"
import {
  COLLAPSED_BUTTON_DEFS,
  TAB_DEFINITIONS,
  TOOLS_MENU_IDS,
  TOOLS_MENU_ITEMS,
} from "~constants"
import { useSettingsStore } from "~stores/settings-store"
import { t } from "~utils/i18n"
import { showToastThrottled } from "~utils/toast"

import { PageTitle, SettingCard, SettingRow, TabGroup, ToggleRow } from "../components"

interface GeneralPageProps {
  siteId: string
  initialTab?: string
}

// 
const SortableItem: React.FC<{
  iconNode?: React.ReactNode
  label: string
  index: number
  total: number
  enabled?: boolean
  showToggle?: boolean
  onToggle?: () => void
  onDragStart: (e: React.DragEvent, index: number) => void
  onDragOver: (e: React.DragEvent, index: number) => void
  onDragEnd?: () => void
  onDrop: (e: React.DragEvent, index: number) => void
  isDragging?: boolean
}> = ({
  iconNode,
  label,
  index,
  total: _total,
  enabled = true,
  showToggle = false,
  onToggle,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  isDragging = false,
}) => (
  <div
    className={`settings-sortable-item ${isDragging ? "dragging" : ""}`}
    draggable
    onDragStart={(e) => onDragStart(e, index)}
    onDragOver={(e) => onDragOver(e, index)}
    onDragEnd={onDragEnd}
    onDrop={(e) => onDrop(e, index)}
    style={{
      opacity: isDragging ? 0.4 : 1,
      cursor: "grab",
      border: isDragging ? "1px dashed var(--gh-primary)" : undefined,
    }}>
    {/*  */}
    <div
      className="settings-sortable-handle"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "4px 8px 4px 0",
        cursor: "grab",
        color: "var(--gh-text-secondary, #9ca3af)",
      }}>
      <DragIcon size={16} />
    </div>

    {iconNode && <span className="settings-sortable-item-icon">{iconNode}</span>}
    <span className="settings-sortable-item-label">{label}</span>
    <div className="settings-sortable-item-actions">
      {showToggle && <Switch checked={enabled} onChange={() => onToggle?.()} size="sm" />}
    </div>
  </div>
)

const GeneralPage: React.FC<GeneralPageProps> = ({ siteId: _siteId, initialTab }) => {
  const [activeTab, setActiveTab] = useState(initialTab || "panel")
  const { settings, setSettings, updateNestedSetting, updateDeepSetting } = useSettingsStore()

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab)
    }
  }, [initialTab])

  const prerequisiteToastTemplate = t("enablePrerequisiteToast") || "{setting}"
  const showPrerequisiteToast = (label: string) =>
    showToastThrottled(prerequisiteToastTemplate.replace("{setting}", label), 2000, {}, 1500, label)
  const edgeSnapLabel = t("edgeSnapHideLabel") || ""

  // 
  const [draggedItem, setDraggedItem] = useState<{ type: "tab" | "button"; index: number } | null>(
    null,
  )

  // 
  const handleEdgeDistanceChange = (val: number) => {
    updateNestedSetting("panel", "defaultEdgeDistance", val)
  }

  const handleSnapThresholdChange = (val: number) => {
    updateNestedSetting("panel", "edgeSnapThreshold", val)
  }

  const handleHeightChange = (val: number) => {
    updateNestedSetting("panel", "height", val)
  }

  const handleWidthChange = (val: number) => {
    updateNestedSetting("panel", "width", val)
  }

  // 
  const handleDragStart = (e: React.DragEvent, type: "tab" | "button", index: number) => {
    setDraggedItem({ type, index })
    e.dataTransfer.effectAllowed = "move"
  }

  // 
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }

  //  - Tab 
  const handleTabDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault()
    if (!draggedItem || draggedItem.type !== "tab") return
    const fromIndex = draggedItem.index
    if (fromIndex === targetIndex) return

    const newOrder = [...(settings.features?.order || [])]
    const [moved] = newOrder.splice(fromIndex, 1)
    newOrder.splice(targetIndex, 0, moved)
    updateNestedSetting("features", "order", newOrder)
    setDraggedItem(null)
  }

  //  - 
  const handleButtonDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault()
    if (!draggedItem || draggedItem.type !== "button") return
    const fromIndex = draggedItem.index
    if (fromIndex === targetIndex) return

    const newButtons = [...(settings.collapsedButtons || [])]
    const [moved] = newButtons.splice(fromIndex, 1)
    newButtons.splice(targetIndex, 0, moved)
    setSettings({ collapsedButtons: newButtons })
    setDraggedItem(null)
  }

  // 
  const handleDragEnd = () => {
    setDraggedItem(null)
  }

  // 
  const toggleButton = (index: number) => {
    const newButtons = [...(settings.collapsedButtons || [])]
    newButtons[index] = { ...newButtons[index], enabled: !newButtons[index].enabled }
    setSettings({ collapsedButtons: newButtons })
  }

  if (!settings) return null

  const tabs = [
    { id: "panel", label: t("panelTab") || "" },
    { id: "tabOrder", label: t("tabOrderTab") || "" },
    { id: "shortcuts", label: t("shortcutsTab") || "" },
    { id: "toolsMenu", label: t("toolboxMenu") || "" },
  ]

  return (
    <div>
      <PageTitle title={t("navGeneral") || ""} Icon={GeneralIcon} />
      <p className="settings-page-desc">{t("generalPageDesc") || ""}</p>

      <TabGroup tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* ==========  Tab ========== */}
      {activeTab === "panel" && (
        <SettingCard title={t("panelSettings") || ""}>
          <ToggleRow
            label={t("defaultPanelStateLabel") || ""}
            description={t("defaultPanelStateDesc") || ""}
            settingId="panel-default-open"
            checked={settings.panel?.defaultOpen ?? false}
            onChange={() =>
              updateNestedSetting("panel", "defaultOpen", !settings.panel?.defaultOpen)
            }
          />

          {/*  */}
          <SettingRow
            label={t("defaultPositionLabel") || ""}
            description={t("defaultPositionDesc") || ""}
            settingId="panel-default-position">
            <div
              style={{
                display: "inline-flex",
                borderRadius: "6px",
                overflow: "hidden",
                border: "1px solid var(--gh-border, #e5e7eb)",
              }}>
              <button
                onClick={() => updateNestedSetting("panel", "defaultPosition", "left")}
                style={{
                  padding: "4px 12px",
                  fontSize: "13px",
                  border: "none",
                  cursor: "pointer",
                  background:
                    (settings.panel?.defaultPosition || "right") === "left"
                      ? "var(--gh-primary, #4285f4)"
                      : "var(--gh-bg, #fff)",
                  color:
                    (settings.panel?.defaultPosition || "right") === "left"
                      ? "#fff"
                      : "var(--gh-text-secondary, #6b7280)",
                  transition: "all 0.2s",
                }}>
                {t("defaultPositionLeft") || ""}
              </button>
              <button
                onClick={() => updateNestedSetting("panel", "defaultPosition", "right")}
                style={{
                  padding: "4px 12px",
                  fontSize: "13px",
                  border: "none",
                  borderLeft: "1px solid var(--gh-border, #e5e7eb)",
                  cursor: "pointer",
                  background:
                    (settings.panel?.defaultPosition || "right") === "right"
                      ? "var(--gh-primary, #4285f4)"
                      : "var(--gh-bg, #fff)",
                  color:
                    (settings.panel?.defaultPosition || "right") === "right"
                      ? "#fff"
                      : "var(--gh-text-secondary, #6b7280)",
                  transition: "all 0.2s",
                }}>
                {t("defaultPositionRight") || ""}
              </button>
            </div>
          </SettingRow>

          {/*  */}
          <SettingRow
            label={t("defaultEdgeDistanceLabel") || ""}
            description={t("defaultEdgeDistanceDesc") || ""}
            settingId="panel-edge-distance">
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <NumberInput
                value={settings.panel?.defaultEdgeDistance ?? 25}
                onChange={handleEdgeDistanceChange}
                min={0}
                max={400}
                defaultValue={25}
                style={{ width: "85px" }}
              />
              <span style={{ fontSize: "13px", color: "var(--gh-text-secondary)" }}>px</span>
            </div>
          </SettingRow>

          {/*  */}
          <SettingRow
            label={t("panelWidthLabel") || ""}
            description={t("panelWidthDesc") || " (px)"}
            settingId="panel-width">
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <NumberInput
                value={settings.panel?.width ?? 320}
                onChange={handleWidthChange}
                min={200}
                max={600}
                defaultValue={320}
                style={{ width: "85px" }}
              />
              <span style={{ fontSize: "13px", color: "var(--gh-text-secondary)" }}>px</span>
            </div>
          </SettingRow>

          {/*  */}
          <SettingRow
            label={t("panelHeightLabel") || ""}
            description={t("panelHeightDesc") || ""}
            settingId="panel-height">
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <NumberInput
                value={settings.panel?.height ?? 85}
                onChange={handleHeightChange}
                min={50}
                max={100}
                defaultValue={85}
                style={{ width: "85px" }}
              />
              <span style={{ fontSize: "13px", color: "var(--gh-text-secondary)" }}>vh</span>
            </div>
          </SettingRow>

          <ToggleRow
            label={t("edgeSnapHideLabel") || ""}
            description={t("edgeSnapHideDesc") || ""}
            settingId="panel-edge-snap"
            checked={settings.panel?.edgeSnap ?? false}
            onChange={() => updateNestedSetting("panel", "edgeSnap", !settings.panel?.edgeSnap)}
          />

          {/*  */}
          <SettingRow
            label={t("edgeSnapThresholdLabel") || ""}
            description={t("edgeSnapThresholdDesc") || ""}
            settingId="panel-edge-snap-threshold"
            disabled={!settings.panel?.edgeSnap}
            onDisabledClick={() => showPrerequisiteToast(edgeSnapLabel)}>
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <NumberInput
                value={settings.panel?.edgeSnapThreshold ?? 18}
                onChange={handleSnapThresholdChange}
                min={0}
                max={400}
                defaultValue={18}
                disabled={!settings.panel?.edgeSnap}
                style={{ width: "85px" }}
              />
              <span style={{ fontSize: "13px", color: "var(--gh-text-secondary)" }}>px</span>
            </div>
          </SettingRow>

          <ToggleRow
            label={t("autoHidePanelLabel") || ""}
            description={
              settings.panel?.edgeSnap
                ? t("autoHidePanelDescEdgeSnap") || ""
                : t("autoHidePanelDesc") || ""
            }
            settingId="panel-auto-hide"
            checked={settings.panel?.autoHide ?? false}
            onChange={() => updateNestedSetting("panel", "autoHide", !settings.panel?.autoHide)}
          />
        </SettingCard>
      )}

      {/* ==========  Tab ========== */}
      {activeTab === "tabOrder" && (
        <SettingCard
          title={t("tabOrderSettings") || ""}
          description={t("tabOrderDesc") || " ()"}>
          {settings.features?.order
            ?.filter((id) => TAB_DEFINITIONS[id])
            .map((tabId, index) => {
              const def = TAB_DEFINITIONS[tabId]
              const isEnabled =
                tabId === "prompts"
                  ? settings.features?.prompts?.enabled !== false
                  : tabId === "outline"
                    ? settings.features?.outline?.enabled !== false
                    : tabId === "conversations"
                      ? settings.features?.conversations?.enabled !== false
                      : true
              return (
                <SortableItem
                  key={tabId}
                  iconNode={
                    def.IconComponent ? (
                      <def.IconComponent size={18} color="currentColor" />
                    ) : (
                      def.icon
                    )
                  }
                  label={t(def.label) || tabId}
                  index={index}
                  total={settings.features?.order.filter((id) => TAB_DEFINITIONS[id]).length}
                  enabled={isEnabled}
                  showToggle
                  onToggle={() => {
                    if (tabId === "prompts")
                      updateDeepSetting("features", "prompts", "enabled", !isEnabled)
                    else if (tabId === "outline")
                      updateDeepSetting("features", "outline", "enabled", !isEnabled)
                    else if (tabId === "conversations")
                      updateDeepSetting("features", "conversations", "enabled", !isEnabled)
                  }}
                  onDragStart={(e) => handleDragStart(e, "tab", index)}
                  onDragOver={handleDragOver}
                  onDragEnd={handleDragEnd}
                  onDrop={handleTabDrop}
                  isDragging={draggedItem?.type === "tab" && draggedItem?.index === index}
                />
              )
            })}
        </SettingCard>
      )}

      {/* ==========  Tab ========== */}
      {activeTab === "shortcuts" && (
        <SettingCard
          title={t("collapsedButtonsOrderTitle") || ""}
          description={t("collapsedButtonsOrderDesc") || " ()"}>
          {settings.collapsedButtons?.map((btn, index) => {
            const def = COLLAPSED_BUTTON_DEFS[btn.id]
            if (!def) return null
            return (
              <SortableItem
                key={btn.id}
                iconNode={
                  def.IconComponent ? (
                    <def.IconComponent size={18} color="currentColor" />
                  ) : (
                    def.icon
                  )
                }
                label={t(def.labelKey) || btn.id}
                index={index}
                total={settings.collapsedButtons.length}
                enabled={btn.enabled}
                showToggle={def.canToggle}
                onToggle={() => toggleButton(index)}
                onDragStart={(e) => handleDragStart(e, "button", index)}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
                onDrop={handleButtonDrop}
                isDragging={draggedItem?.type === "button" && draggedItem?.index === index}
              />
            )
          })}
          <SettingRow
            label={t("quickButtonsOpacityLabel") || ""}
            description={t("quickButtonsOpacityDesc") || ""}
            settingId="quick-buttons-opacity">
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="range"
                min="0.4"
                max="1"
                step="0.05"
                value={settings.quickButtonsOpacity ?? 1}
                onChange={(e) => setSettings({ quickButtonsOpacity: parseFloat(e.target.value) })}
                style={{ width: "120px" }}
              />
              <span style={{ fontSize: "12px", minWidth: "36px" }}>
                {Math.round((settings.quickButtonsOpacity ?? 1) * 100)}%
              </span>
            </div>
          </SettingRow>
        </SettingCard>
      )}

      {/* ==========  Tab ========== */}
      {activeTab === "toolsMenu" && (
        <SettingCard
          title={t("toolboxMenuTitle") || ""}
          description={t("toolboxMenuDesc") || ""}>
          {TOOLS_MENU_ITEMS.filter((item) => item.id !== TOOLS_MENU_IDS.SETTINGS).map((item) => {
            const enabledIds = settings.toolsMenu ?? TOOLS_MENU_ITEMS.map((i) => i.id)
            const isEnabled = enabledIds.includes(item.id)
            return (
              <ToggleRow
                key={item.id}
                label={t(item.labelKey) || item.defaultLabel}
                settingId={`tools-menu-${item.id}`}
                checked={isEnabled}
                onChange={() => {
                  const currentIds = settings.toolsMenu ?? TOOLS_MENU_ITEMS.map((i) => i.id)
                  const newIds = isEnabled
                    ? currentIds.filter((id) => id !== item.id)
                    : [...currentIds, item.id]
                  setSettings({ toolsMenu: newIds })
                }}
              />
            )
          })}
        </SettingCard>
      )}
    </div>
  )
}

export default GeneralPage
