/**
 * Input 
 * 
 */
import React from "react"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** : default=, filled= */
  variant?: "default" | "filled"
}

/**
 * 
 */
export const Input: React.FC<InputProps> = ({ variant = "default", style, ...props }) => {
  return (
    <input
      {...props}
      style={{
        width: "100%",
        padding: "10px 12px",
        border: "1px solid var(--gh-input-border, #d1d5db)",
        borderRadius: "6px",
        fontSize: "14px",
        boxSizing: "border-box",
        backgroundColor:
          variant === "filled" ? "var(--gh-bg-secondary, #f9fafb)" : "var(--gh-input-bg, white)",
        color: "var(--gh-text, #374151)",
        outline: "none",
        transition: "border-color 0.2s",
        ...style,
      }}
    />
  )
}

export default Input
