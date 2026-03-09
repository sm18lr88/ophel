/**
 * NumberInput 
 *
 *  Store 
 *
 * 
 * 1.  tempValue 
 * 2.  tempValue
 * 3.  value  tempValue
 * 4.  React 
 * 5. 
 */
import React, { useCallback, useEffect, useRef, useState } from "react"

import { ChevronDownIcon, ChevronUpIcon } from "~components/icons"

export interface NumberInputProps {
  /**  Store */
  value: number
  /**  */
  onChange: (value: number) => void
  /**  */
  min?: number
  /**  */
  max?: number
  /**  */
  defaultValue?: number
  /**  */
  disabled?: boolean
  /**  */
  style?: React.CSSProperties
  /**  */
  className?: string
  /**  1 */
  step?: number
}

/**
 * 
 *  Store 
 */
export const NumberInput: React.FC<NumberInputProps> = ({
  value,
  onChange,
  min,
  max,
  defaultValue,
  disabled = false,
  style,
  className = "settings-input",
  step = 1,
}) => {
  // 
  const [tempValue, setTempValue] = useState(value.toString())
  // 
  const isFocusedRef = useRef(false)
  // 
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 
  const inputRef = useRef<HTMLInputElement>(null)

  //  value  tempValue
  useEffect(() => {
    if (!isFocusedRef.current) {
      setTempValue(value.toString())
    }
  }, [value])

  // 
  const commitValue = useCallback(
    (inputValue: string) => {
      let val = parseInt(inputValue)

      // 
      if (isNaN(val)) {
        val = defaultValue ?? value ?? 0
      }

      // Clamp  min/max 
      if (min !== undefined && val < min) val = min
      if (max !== undefined && val > max) val = max

      //  clamp 
      setTempValue(val.toString())

      //  onChange
      if (val !== value) {
        onChange(val)
      }
    },
    [min, max, defaultValue, value, onChange],
  )

  const handleStep = useCallback(
    (delta: number) => {
      if (disabled) return

      let currentVal = parseInt(tempValue)
      if (isNaN(currentVal)) {
        currentVal = defaultValue ?? value ?? 0
      }

      const newVal = currentVal + delta
      commitValue(newVal.toString())
    },
    [tempValue, defaultValue, value, disabled, commitValue],
  )

  const handleFocus = () => {
    //  blur 
    if (blurTimerRef.current) {
      clearTimeout(blurTimerRef.current)
      blurTimerRef.current = null
    }
    isFocusedRef.current = true
  }

  const handleBlur = () => {
    //  100ms  React 
    blurTimerRef.current = setTimeout(() => {
      // 
      if (document.activeElement !== inputRef.current) {
        isFocusedRef.current = false
        commitValue(tempValue)
      }
    }, 100)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      commitValue(tempValue)
      // 
      inputRef.current?.blur()
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      handleStep(step)
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      handleStep(-step)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // 
    const filtered = e.target.value.replace(/[^0-9-]/g, "")
    setTempValue(filtered)
  }

  // 
  useEffect(() => {
    return () => {
      if (blurTimerRef.current) {
        clearTimeout(blurTimerRef.current)
      }
    }
  }, [])

  // 
  const [isHovered, setIsHovered] = useState(false)

  return (
    <div
      className={className}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        ...style,
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
      }}>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        style={{
          width: "100%",
          paddingRight: "20px", // 
          height: "100%",
          border: "none",
          background: "transparent",
          outline: "none",
          color: "inherit",
          fontSize: "inherit",
          fontFamily: "inherit",
          paddingLeft: "8px",
          textAlign: "left", // 
        }}
        value={tempValue}
        disabled={disabled}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />

      {/*  */}
      {!disabled && (
        <div
          style={{
            position: "absolute",
            right: "2px",
            top: "2px",
            bottom: "2px",
            display: "flex",
            flexDirection: "column",
            width: "16px",
            // 
            background: "transparent",
            opacity: isHovered ? 1 : 0.2, // 
            transition: "opacity 0.2s ease",
            pointerEvents: isHovered ? "auto" : "none", // 
          }}>
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.preventDefault()
              handleStep(step)
            }}
            style={{
              flex: 1,
              border: "none",
              background: "var(--gh-hover, #f3f4f6)",
              borderRadius: "3px 3px 0 0",
              cursor: "pointer",
              padding: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--gh-text-secondary, #6b7280)",
              marginBottom: "1px",
            }}>
            <ChevronUpIcon size={8} />
          </button>
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.preventDefault()
              handleStep(-step)
            }}
            style={{
              flex: 1,
              border: "none",
              background: "var(--gh-hover, #f3f4f6)",
              borderRadius: "0 0 3px 3px",
              cursor: "pointer",
              padding: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--gh-text-secondary, #6b7280)",
            }}>
            <ChevronDownIcon size={8} />
          </button>
        </div>
      )}
    </div>
  )
}

export default NumberInput
