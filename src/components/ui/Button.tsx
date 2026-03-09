/**
 * Button 
 * 
 */
import React from "react"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** : primary=, secondary=, danger=, ghost= */
  variant?: "primary" | "secondary" | "danger" | "ghost"
  /** : sm=, md= */
  size?: "sm" | "md"
}

/**
 * 
 */
export const Button: React.FC<ButtonProps> = ({
  variant = "secondary",
  size = "md",
  style,
  children,
  ...props
}) => {
  // 
  const sizeStyles =
    size === "sm"
      ? { padding: "4px 8px", fontSize: "12px" }
      : { padding: "8px 16px", fontSize: "14px" }

  // 
  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      background: "var(--gh-brand-gradient, linear-gradient(135deg, #4285f4 0%, #34a853 100%))",
      color: "white",
      border: "none",
    },
    secondary: {
      background: "var(--gh-bg, white)",
      color: "var(--gh-text, #374151)",
      border: "1px solid var(--gh-input-border, #d1d5db)",
    },
    danger: {
      background: "var(--gh-text-danger, #ef4444)",
      color: "white",
      border: "none",
    },
    ghost: {
      background: "transparent",
      color: "var(--gh-text-secondary, #6b7280)",
      border: "none",
    },
  }

  return (
    <button
      {...props}
      style={{
        borderRadius: "6px",
        cursor: props.disabled ? "not-allowed" : "pointer",
        transition: "all 0.2s",
        fontWeight: 500,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "4px",
        opacity: props.disabled ? 0.5 : 1,
        ...sizeStyles,
        ...variantStyles[variant],
        ...style,
      }}>
      {children}
    </button>
  )
}

export default Button
