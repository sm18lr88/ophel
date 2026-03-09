/**
 * 
 *  Label + Description Control
 */
import React from "react"

import { Switch } from "~components/ui"

export interface SettingRowProps {
  /**  */
  label: React.ReactNode
  /**  */
  description?: string
  /**  */
  children?: React.ReactNode
  /**  */
  disabled?: boolean
  /**  */
  onDisabledClick?: () => void
  /**  */
  style?: React.CSSProperties
  /**  setting id/ */
  settingId?: string
}

/**
 * 
 */
export const SettingRow: React.FC<SettingRowProps> = ({
  label,
  description,
  children,
  disabled = false,
  onDisabledClick,
  style,
  settingId,
}) => {
  const isDisabledClickable = disabled && !!onDisabledClick
  return (
    <div
      className={`settings-row ${disabled ? "disabled" : ""} ${
        isDisabledClickable ? "disabled-clickable" : ""
      }`}
      data-setting-id={settingId}
      style={style}
      onClick={() => {
        if (isDisabledClickable) {
          onDisabledClick?.()
        }
      }}>
      <div className="settings-row-info">
        <div className="settings-row-label">{label}</div>
        {description && <div className="settings-row-desc">{description}</div>}
      </div>
      {children && <div className="settings-row-control">{children}</div>}
    </div>
  )
}

/**
 * 
 */
export interface ToggleRowProps {
  label: string
  description?: string
  checked: boolean
  onChange: () => void
  disabled?: boolean
  onDisabledClick?: () => void
  settingId?: string
}

export const ToggleRow: React.FC<ToggleRowProps> = ({
  label,
  description,
  checked,
  onChange,
  disabled = false,
  onDisabledClick,
  settingId,
}) => {
  return (
    <SettingRow
      label={label}
      description={description}
      disabled={disabled}
      onDisabledClick={onDisabledClick}
      settingId={settingId}>
      <Switch checked={checked} onChange={onChange} disabled={disabled} />
    </SettingRow>
  )
}

export default SettingRow
