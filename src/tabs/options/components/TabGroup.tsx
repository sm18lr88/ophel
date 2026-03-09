/**
 * 
 * 
 */
import React from "react"

export interface Tab {
  id: string
  label: string
}

export interface TabGroupProps {
  /**  */
  tabs: Tab[]
  /**  ID */
  activeTab: string
  /**  */
  onTabChange: (tabId: string) => void
}

export const TabGroup: React.FC<TabGroupProps> = ({ tabs, activeTab, onTabChange }) => {
  return (
    <div className="settings-tab-group">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`settings-tab-item ${activeTab === tab.id ? "active" : ""}`}
          onClick={() => onTabChange(tab.id)}>
          {tab.label}
        </button>
      ))}
    </div>
  )
}

export default TabGroup
