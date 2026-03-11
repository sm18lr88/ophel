/**
 * SVG Brain Icon — AI-themed monochrome icon
 * Outline (stroke-based), viewBox 0 0 24 24
 */
import React from "react"

interface IconProps {
  size?: number
  color?: string
  className?: string
}

export const BrainIcon: React.FC<IconProps> = ({
  size = 18,
  color = "currentColor",
  className = "",
}) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={{ display: "block" }}>
    <path d="M9.5 2a3.5 3.5 0 0 0-3.4 2.7A3.5 3.5 0 0 0 3 8.2a3.5 3.5 0 0 0 .7 4.3 3.5 3.5 0 0 0 1.8 4.8A3.5 3.5 0 0 0 9 21h3V2Z" />
    <path d="M14.5 2a3.5 3.5 0 0 1 3.4 2.7A3.5 3.5 0 0 1 21 8.2a3.5 3.5 0 0 1-.7 4.3 3.5 3.5 0 0 1-1.8 4.8A3.5 3.5 0 0 1 15 21h-3V2Z" />
    <path d="M12 2v19" />
    <path d="M8 8h.01" />
    <path d="M16 8h.01" />
    <path d="M8 12h.01" />
    <path d="M16 12h.01" />
    <path d="M8 16h.01" />
    <path d="M16 16h.01" />
  </svg>
)

export default BrainIcon
