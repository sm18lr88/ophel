/**
 * 
 * 
 */
import React from "react"

export interface SettingCardProps {
  /**  */
  title?: string
  /**  */
  description?: string
  /**  */
  children: React.ReactNode
  /**  */
  className?: string
  /**  */
  style?: React.CSSProperties
  /**  setting id/ */
  settingId?: string
}

export const SettingCard: React.FC<SettingCardProps> = ({
  title,
  description,
  children,
  className = "",
  style,
  settingId,
}) => {
  return (
    <div className={`settings-card ${className}`} style={style} data-setting-id={settingId}>
      {title && <div className="settings-card-title">{title}</div>}
      {description && <div className="settings-card-desc">{description}</div>}
      {children}
    </div>
  )
}

export default SettingCard
