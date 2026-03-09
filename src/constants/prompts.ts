/**
 * 
 */

/**
 * 
 * 
 */
export const VIRTUAL_CATEGORY = {
  /**  */
  ALL: "__all__",
  /**  */
  RECENT: "__recent__",
} as const

export type VirtualCategoryType = (typeof VIRTUAL_CATEGORY)[keyof typeof VIRTUAL_CATEGORY]
