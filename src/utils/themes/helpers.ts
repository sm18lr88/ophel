/**
 * 
 */

import { darkPresets } from "./dark"
import { lightPresets } from "./light"
import type { ThemePreset, ThemeVariables } from "./types"

// 
export const getDefaultLightPreset = (): ThemePreset => lightPresets[0]

// 
export const getDefaultDarkPreset = (): ThemePreset => darkPresets[0]

//  ID 
export const findPreset = (id: string, mode: "light" | "dark"): ThemePreset | undefined => {
  const presets = mode === "light" ? lightPresets : darkPresets
  return presets.find((p) => p.id === id)
}

// 
export const getPreset = (presetId: string, mode: "light" | "dark"): ThemePreset => {
  const found = findPreset(presetId, mode)
  return found || (mode === "light" ? getDefaultLightPreset() : getDefaultDarkPreset())
}

//  CSS 
//  !important 
export const themeVariablesToCSS = (variables: ThemeVariables): string => {
  return Object.entries(variables)
    .map(([key, value]) => `${key}: ${value} !important;`)
    .join("\n  ")
}

/**
 *  CSS 
 * 
 */
export const parseThemeVariablesFromCSS = (css: string): Partial<ThemeVariables> => {
  const variables: Partial<ThemeVariables> = {}

  //  CSS : --variable-name: value;
  // 
  const regex = /(--[\w-]+)\s*:\s*([^;]+);/g

  let match
  while ((match = regex.exec(css)) !== null) {
    const key = match[1] as keyof ThemeVariables
    const value = match[2].trim()
    variables[key] = value
  }

  return variables
}
