/**
 * Switch 
 */
import React from "react"

export interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  /** : sm=32x18, md=36x20 */
  size?: "sm" | "md"
}

/**
 * 
 *  CSS 
 */
export const Switch: React.FC<SwitchProps> = ({
  checked,
  onChange,
  disabled = false,
  size = "md",
}) => {
  // 
  const dimensions = size === "sm" ? { w: 32, h: 18, thumb: 14 } : { w: 36, h: 20, thumb: 16 }

  return (
    <label
      style={{
        position: "relative",
        display: "inline-block",
        width: `${dimensions.w}px`,
        height: `${dimensions.h}px`,
        flexShrink: 0,
      }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onChange(!checked)}
        disabled={disabled}
        style={{ opacity: 0, width: 0, height: 0, position: "absolute" }}
      />
      <span
        style={{
          position: "absolute",
          cursor: disabled ? "not-allowed" : "pointer",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: checked
            ? "var(--gh-primary, #4285f4)"
            : "var(--gh-input-border, #d1d5db)",
          borderRadius: `${dimensions.h}px`,
          transition: "background-color 0.3s",
        }}>
        <span
          style={{
            position: "absolute",
            height: `${dimensions.thumb}px`,
            width: `${dimensions.thumb}px`,
            left: checked ? `${dimensions.w - dimensions.thumb - 2}px` : "2px",
            bottom: `${(dimensions.h - dimensions.thumb) / 2}px`,
            backgroundColor: "var(--gh-bg, #ffffff)",
            borderRadius: "50%",
            transition: "left 0.3s",
          }}
        />
      </span>
    </label>
  )
}

export default Switch
