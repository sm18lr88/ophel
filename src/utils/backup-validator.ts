/**
 * 
 * /
 */

export interface ValidationResult {
  valid: boolean
  /**  key  */
  errorKeys: string[]
}

/**
 * 
 * @param data 
 * @returns errorKeys  key
 */
export function validateBackupData(data: unknown): ValidationResult {
  const errorKeys: string[] = []

  // 
  if (!data || typeof data !== "object") {
    return { valid: false, errorKeys: ["backupValidationInvalidFormat"] }
  }

  const parsedData = data as { version?: unknown; data?: Record<string, unknown> }

  if (!parsedData.version) {
    errorKeys.push("backupValidationMissingVersion")
  }

  if (!parsedData.data || typeof parsedData.data !== "object") {
    errorKeys.push("backupValidationMissingData")
    return { valid: false, errorKeys }
  }

  const backupData = parsedData.data

  // 
  if (backupData.settings !== undefined) {
    if (typeof backupData.settings !== "object" || Array.isArray(backupData.settings)) {
      errorKeys.push("backupValidationSettingsType")
    }
  }

  if (backupData.prompts !== undefined) {
    if (!Array.isArray(backupData.prompts)) {
      errorKeys.push("backupValidationPromptsType")
    }
  }

  if (backupData.folders !== undefined) {
    if (!Array.isArray(backupData.folders)) {
      errorKeys.push("backupValidationFoldersType")
    }
  }

  if (backupData.conversations !== undefined) {
    if (typeof backupData.conversations !== "object" || Array.isArray(backupData.conversations)) {
      errorKeys.push("backupValidationConversationsType")
    }
  }

  if (backupData.readingHistory !== undefined) {
    if (typeof backupData.readingHistory !== "object" || Array.isArray(backupData.readingHistory)) {
      errorKeys.push("backupValidationHistoryType")
    }
  }

  return {
    valid: errorKeys.length === 0,
    errorKeys,
  }
}
