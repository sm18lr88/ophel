/**
 * Messaging Protocol Definitions
 */

// ============================================================================
// Content Script <-> Background Service Worker
// ============================================================================

export const MSG_SHOW_NOTIFICATION = "SHOW_NOTIFICATION"
export const MSG_FOCUS_TAB = "FOCUS_TAB"

export interface ShowNotificationPayload {
  title: string
  body: string
}

export interface ShowNotificationMessage extends ShowNotificationPayload {
  type: typeof MSG_SHOW_NOTIFICATION
}

export interface FocusTabMessage {
  type: typeof MSG_FOCUS_TAB
}

export const MSG_PROXY_FETCH = "PROXY_FETCH"

export interface ProxyFetchPayload {
  url: string
  purpose: "gemini-watermark"
}

export interface ProxyFetchMessage extends ProxyFetchPayload {
  type: typeof MSG_PROXY_FETCH
}

// WebDAV  CORS
export const MSG_WEBDAV_REQUEST = "WEBDAV_REQUEST"

export interface WebDAVRequestPayload {
  method: string
  url: string
  body?: string | null
  headers?: Record<string, string>
  auth?: { username: string; password: string }
}

export interface WebDAVRequestMessage extends WebDAVRequestPayload {
  type: typeof MSG_WEBDAV_REQUEST
}

// 
export const MSG_CHECK_PERMISSION = "CHECK_PERMISSION"

export interface CheckPermissionPayload {
  origin: string
}

export interface CheckPermissionMessage extends CheckPermissionPayload {
  type: typeof MSG_CHECK_PERMISSION
}

// 
export const MSG_CHECK_PERMISSIONS = "CHECK_PERMISSIONS"

export interface CheckPermissionsPayload {
  origins?: string[]
  permissions?: string[]
}

export interface CheckPermissionsMessage extends CheckPermissionsPayload {
  type: typeof MSG_CHECK_PERMISSIONS
}

// 
export const MSG_REQUEST_PERMISSIONS = "REQUEST_PERMISSIONS"

export interface RequestPermissionsPayload {
  permType?: string
  origins?: string[]
  permissions?: string[]
}

export interface RequestPermissionsMessage extends RequestPermissionsPayload {
  type: typeof MSG_REQUEST_PERMISSIONS
}

// 
export const MSG_REVOKE_PERMISSIONS = "REVOKE_PERMISSIONS"

export interface RevokePermissionsPayload {
  origins?: string[]
  permissions?: string[]
}

export interface RevokePermissionsMessage extends RevokePermissionsPayload {
  type: typeof MSG_REVOKE_PERMISSIONS
}

//  Options 
export const MSG_OPEN_OPTIONS_PAGE = "OPEN_OPTIONS_PAGE"

export interface OpenOptionsPageMessage {
  type: typeof MSG_OPEN_OPTIONS_PAGE
}

//  URL chrome:// 
export const MSG_OPEN_URL = "OPEN_URL"

export interface OpenUrlPayload {
  url: string
}

export interface OpenUrlMessage extends OpenUrlPayload {
  type: typeof MSG_OPEN_URL
}

// 
export const MSG_CLEAR_ALL_DATA = "CLEAR_ALL_DATA"

export interface ClearAllDataMessage {
  type: typeof MSG_CLEAR_ALL_DATA
}

// 
export const MSG_RESTORE_DATA = "RESTORE_DATA"

export interface RestoreDataMessage {
  type: typeof MSG_RESTORE_DATA
}

// Claude SessionKey Cookie
export const MSG_SET_CLAUDE_SESSION_KEY = "SET_CLAUDE_SESSION_KEY"

export interface SetClaudeSessionKeyPayload {
  key: string // SessionKey,cookie()
}

export interface SetClaudeSessionKeyMessage extends SetClaudeSessionKeyPayload {
  type: typeof MSG_SET_CLAUDE_SESSION_KEY
}

// Claude SessionKeybackgroundCORS
export const MSG_TEST_CLAUDE_TOKEN = "TEST_CLAUDE_TOKEN"

export interface TestClaudeTokenPayload {
  sessionKey: string // SessionKey
}

export interface TestClaudeTokenMessage extends TestClaudeTokenPayload {
  type: typeof MSG_TEST_CLAUDE_TOKEN
}

// Claude SessionKey Cookiebackground
export const MSG_GET_CLAUDE_SESSION_KEY = "GET_CLAUDE_SESSION_KEY"

export interface GetClaudeSessionKeyMessage {
  type: typeof MSG_GET_CLAUDE_SESSION_KEY
}

// Claude
export const MSG_CHECK_CLAUDE_GENERATING = "CHECK_CLAUDE_GENERATING"

export interface CheckClaudeGeneratingMessage {
  type: typeof MSG_CHECK_CLAUDE_GENERATING
}

export type ExtensionMessage =
  | ShowNotificationMessage
  | FocusTabMessage
  | ProxyFetchMessage
  | WebDAVRequestMessage
  | CheckPermissionMessage
  | CheckPermissionsMessage
  | RequestPermissionsMessage
  | RevokePermissionsMessage
  | OpenOptionsPageMessage
  | OpenUrlMessage
  | ClearAllDataMessage
  | RestoreDataMessage
  | SetClaudeSessionKeyMessage
  | TestClaudeTokenMessage
  | GetClaudeSessionKeyMessage
  | CheckClaudeGeneratingMessage
  | SwitchNextClaudeKeyMessage
  | GetAIStudioModelsMessage

export const MSG_SWITCH_NEXT_CLAUDE_KEY = "SWITCH_NEXT_CLAUDE_KEY"

export interface SwitchNextClaudeKeyMessage {
  type: typeof MSG_SWITCH_NEXT_CLAUDE_KEY
}

//  AI Studio  content script 
export const MSG_GET_AISTUDIO_MODELS = "GET_AISTUDIO_MODELS"

export interface GetAIStudioModelsMessage {
  type: typeof MSG_GET_AISTUDIO_MODELS
}

export interface AIStudioModelInfo {
  id: string
  name: string
}

export interface BackgroundMessageResponse {
  success?: boolean
  hasPermission?: boolean
  removed?: boolean
  isGenerating?: boolean
  data?: string
  error?: string
  models?: AIStudioModelInfo[]
  [key: string]: unknown
}

/**
 * Send a message to the background service worker with type safety
 */
export function sendToBackground<T extends ExtensionMessage, R = BackgroundMessageResponse>(
  message: T,
): Promise<R> {
  return chrome.runtime.sendMessage(message) as Promise<R>
}

// ============================================================================
// Main World (Monitor) <-> Isolated World (Content Script)
// ============================================================================

export const EVENT_MONITOR_INIT = "GH_MONITOR_INIT"
export const EVENT_MONITOR_START = "GH_MONITOR_START"
export const EVENT_MONITOR_COMPLETE = "GH_MONITOR_COMPLETE"
export const EVENT_PRIVACY_TOGGLE = "GH_PRIVACY_TOGGLE"

export interface MonitorConfigPayload {
  urlPatterns: string[]
  silenceThreshold: number
}

export interface MonitorEventPayload {
  url?: string
  timestamp: number
  activeCount?: number
  lastUrl?: string
  type?: string
}

export interface WindowMessage {
  type: string
  payload?: unknown
}
