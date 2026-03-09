import { APP_DISPLAY_NAME } from "~utils/config"
import {
  MSG_CLEAR_ALL_DATA,
  MSG_CHECK_CLAUDE_GENERATING,
  MSG_CHECK_PERMISSION,
  MSG_CHECK_PERMISSIONS,
  MSG_FOCUS_TAB,
  MSG_GET_AISTUDIO_MODELS,
  MSG_GET_CLAUDE_SESSION_KEY,
  MSG_OPEN_OPTIONS_PAGE,
  MSG_OPEN_URL,
  MSG_PROXY_FETCH,
  MSG_REQUEST_PERMISSIONS,
  MSG_RESTORE_DATA,
  MSG_REVOKE_PERMISSIONS,
  MSG_SET_CLAUDE_SESSION_KEY,
  MSG_SHOW_NOTIFICATION,
  MSG_SWITCH_NEXT_CLAUDE_KEY,
  MSG_TEST_CLAUDE_TOKEN,
  MSG_WEBDAV_REQUEST,
  type ExtensionMessage,
} from "~utils/messaging"
import {
  getWebDavPermissionOrigin,
  sanitizeErrorMessage,
  sanitizeWebDavHeaders,
  validateLlmProviderUrl,
  validateOpenTabUrl,
  validatePermissionOriginPattern,
  validateWatermarkFetchUrl,
  validateWebDavMethod,
  validatePublicHttpsUrl,
} from "~utils/network-security"
import { localStorage, type Settings } from "~utils/storage"

interface ClaudeSessionKey {
  id: string
  key: string
  name: string
  accountType?: string
  isValid?: boolean
}

interface ClaudeSessionKeysPersistedState {
  state?: {
    keys?: unknown
    currentKeyId?: string
  }
}

function isClaudeSessionKey(value: unknown): value is ClaudeSessionKey {
  if (!value || typeof value !== "object") return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.id === "string" &&
    typeof candidate.key === "string" &&
    typeof candidate.name === "string"
  )
}

const ALLOWED_OPTIONAL_PERMISSIONS = new Set(["cookies", "notifications"])

/**
 * Ophel - Background Service Worker
 *
 */

chrome.runtime.onInstalled.addListener(() => {
  setupDynamicRules()
})

chrome.permissions.onRemoved.addListener(async (removed) => {
  if (!removed.origins || removed.origins.length === 0) {
    return
  }

  const settings = await localStorage.get<Settings>("settings")
  const webdavUrl = settings?.webdav?.url
  if (!settings || !webdavUrl) {
    return
  }

  try {
    const expectedOrigin = getWebDavPermissionOrigin(webdavUrl)
    if (removed.origins.includes(expectedOrigin)) {
      settings.webdav = {
        ...settings.webdav,
        enabled: false,
      }
      await localStorage.set("settings", settings)
    }
  } catch {
    // Ignore invalid saved WebDAV URLs.
  }
})

chrome.commands.onCommand.addListener(async (command) => {
  if (command === "open-global-url") {
    const settings = await localStorage.get<Settings>("settings")
    const raw = settings?.shortcuts?.globalUrl || "https://gemini.google.com"
    try {
      const url = validateLlmProviderUrl(raw).toString()
      chrome.tabs.create({ url, active: true })
    } catch {
      chrome.tabs.create({ url: "https://gemini.google.com", active: true })
    }
  }
})

async function setupDynamicRules() {
  const extensionOrigin = chrome.runtime.getURL("").slice(0, -1)

  const oldRules = await chrome.declarativeNetRequest.getDynamicRules()
  const oldRuleIds = oldRules.map((rule) => rule.id)
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: oldRuleIds,
  })

  const headerActionHeaders = {
    requestHeaders: [
      {
        header: "Referer",
        operation: chrome.declarativeNetRequest.HeaderOperation.SET,
        value: "https://gemini.google.com/",
      },
      {
        header: "Origin",
        operation: chrome.declarativeNetRequest.HeaderOperation.SET,
        value: "https://gemini.google.com",
      },
    ],
    responseHeaders: [
      {
        header: "Access-Control-Allow-Origin",
        operation: chrome.declarativeNetRequest.HeaderOperation.SET,
        value: extensionOrigin,
      },
      {
        header: "Access-Control-Allow-Credentials",
        operation: chrome.declarativeNetRequest.HeaderOperation.SET,
        value: "true",
      },
    ],
  }

  await chrome.declarativeNetRequest.updateDynamicRules({
    addRules: [
      {
        id: 1001,
        priority: 2,
        action: {
          type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
          requestHeaders: headerActionHeaders.requestHeaders,
          responseHeaders: headerActionHeaders.responseHeaders,
        },
        condition: {
          excludedInitiatorDomains: ["google.com", "gemini.google.com"],
          urlFilter: "*://*.googleusercontent.com/*",
          resourceTypes: [
            chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
            chrome.declarativeNetRequest.ResourceType.IMAGE,
            chrome.declarativeNetRequest.ResourceType.OTHER,
          ],
        },
      },
    ],
  })
}

chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  switch (message.type) {
    case MSG_SHOW_NOTIFICATION:
      chrome.notifications.create({
        type: "basic",
        iconUrl: chrome.runtime.getURL("assets/icon.png"),
        title: message.title || APP_DISPLAY_NAME,
        message: message.body || "",
        silent: true,
      })
      sendResponse({ success: true })
      break

    case MSG_FOCUS_TAB:
      if (sender.tab?.id) {
        chrome.tabs.update(sender.tab.id, { active: true })
        if (sender.tab.windowId) {
          chrome.windows.update(sender.tab.windowId, { focused: true })
        }
      }
      sendResponse({ success: true })
      break

    case MSG_PROXY_FETCH:
      ;(async () => {
        try {
          if (message.purpose !== "gemini-watermark") {
            throw new Error("Blocked proxy fetch with unknown purpose")
          }

          const targetUrl = validateWatermarkFetchUrl(message.url).toString()

          const rules = await chrome.declarativeNetRequest.getDynamicRules()
          if (!rules || rules.length === 0 || !rules.find((r) => r.id === 1001)) {
            await setupDynamicRules()
          }

          const response = await fetch(targetUrl, {
            credentials: "include",
          })

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
          }

          const blob = await response.blob()
          const reader = new FileReader()
          reader.onloadend = () => {
            sendResponse({ success: true, data: reader.result })
          }
          reader.onerror = () => {
            sendResponse({ success: false, error: "Failed to read blob" })
          }
          reader.readAsDataURL(blob)
        } catch (err) {
          console.error("Proxy fetch failed:", sanitizeErrorMessage(err))
          sendResponse({ success: false, error: sanitizeErrorMessage(err) })
        }
      })()
      break

    case MSG_WEBDAV_REQUEST:
      ;(async () => {
        try {
          const { method, url, body, headers, auth } = message
          const validatedMethod = validateWebDavMethod(method)
          const targetUrl = validatePublicHttpsUrl(url).toString()
          const fetchHeaders: Record<string, string> = sanitizeWebDavHeaders(headers)

          if (auth?.username && auth?.password) {
            const credentials = btoa(`${auth.username}:${auth.password}`)
            fetchHeaders["Authorization"] = `Basic ${credentials}`
          }

          const response = await fetch(targetUrl, {
            method: validatedMethod,
            headers: fetchHeaders,
            body: body || undefined,
          })

          const responseText = await response.text()

          sendResponse({
            success: true,
            status: response.status,
            statusText: response.statusText,
            body: responseText,
            headers: Object.fromEntries(response.headers.entries()),
          })
        } catch (err) {
          console.error("WebDAV request failed:", sanitizeErrorMessage(err))
          sendResponse({ success: false, error: sanitizeErrorMessage(err) })
        }
      })()
      break

    case MSG_CHECK_PERMISSION:
      ;(async () => {
        try {
          const { origin } = message
          const safeOrigin = validatePermissionOriginPattern(origin)
          const hasPermission = await chrome.permissions.contains({
            origins: [safeOrigin],
          })
          sendResponse({ success: true, hasPermission })
        } catch (err) {
          console.error("Permission check failed:", err)
          sendResponse({ success: false, error: (err as Error).message })
        }
      })()
      break

    case MSG_CHECK_PERMISSIONS:
      ;(async () => {
        try {
          const { origins, permissions } = message
          const safeOrigins = Array.isArray(origins)
            ? origins.map((origin: string) => validatePermissionOriginPattern(origin))
            : undefined
          const safePermissions = Array.isArray(permissions)
            ? permissions.filter((permission: string) =>
                ALLOWED_OPTIONAL_PERMISSIONS.has(permission),
              )
            : undefined
          const hasPermission = await chrome.permissions.contains({
            origins: safeOrigins,
            permissions: safePermissions,
          })
          sendResponse({ success: true, hasPermission })
        } catch (err) {
          console.error("Permissions check failed:", err)
          sendResponse({ success: false, error: (err as Error).message })
        }
      })()
      break

    case MSG_REVOKE_PERMISSIONS:
      ;(async () => {
        try {
          const { origins, permissions } = message
          const safeOrigins = Array.isArray(origins)
            ? origins.map((origin: string) => validatePermissionOriginPattern(origin))
            : undefined
          const safePermissions = Array.isArray(permissions)
            ? permissions.filter((permission: string) =>
                ALLOWED_OPTIONAL_PERMISSIONS.has(permission),
              )
            : undefined
          const removed = await chrome.permissions.remove({
            origins: safeOrigins,
            permissions: safePermissions,
          })
          sendResponse({ success: true, removed })
        } catch (err) {
          console.error("Permissions revoke failed:", err)
          sendResponse({ success: false, error: (err as Error).message })
        }
      })()
      break

    case MSG_REQUEST_PERMISSIONS:
      ;(async () => {
        try {
          const permType = typeof message.permType === "string" ? message.permType : ""
          const rawOrigins = Array.isArray(message.origins) ? message.origins : []
          const rawPermissions = Array.isArray(message.permissions) ? message.permissions : []
          const safeOrigins = rawOrigins.map((origin: string) =>
            validatePermissionOriginPattern(origin),
          )
          const safePermissions = rawPermissions.filter((permission: string) =>
            ALLOWED_OPTIONAL_PERMISSIONS.has(permission),
          )
          const params = new URLSearchParams()
          if (permType) {
            params.set("type", permType)
          }
          if (safeOrigins.length > 0) {
            params.set("origins", JSON.stringify(safeOrigins))
          }
          if (safePermissions.length > 0) {
            params.set("permissions", JSON.stringify(safePermissions))
          }
          const url = chrome.runtime.getURL(`tabs/perm-request.html?${params.toString()}`)

          const currentWindow = await chrome.windows.getCurrent()
          const width = 450
          const height = 380
          const left = currentWindow.left! + Math.round((currentWindow.width! - width) / 2)
          const top = currentWindow.top! + Math.round((currentWindow.height! - height) / 2)

          await chrome.windows.create({
            url,
            type: "popup",
            width,
            height,
            left,
            top,
            focused: true,
          })

          sendResponse({ success: true })
        } catch (err) {
          console.error("Request permissions flow failed:", sanitizeErrorMessage(err))
          sendResponse({ success: false, error: sanitizeErrorMessage(err) })
        }
      })()
      break

    case MSG_OPEN_OPTIONS_PAGE:
      ;(async () => {
        try {
          const optionsUrl = chrome.runtime.getURL("tabs/options.html")
          await chrome.tabs.create({
            url: optionsUrl,
            active: true,
          })
          sendResponse({ success: true })
        } catch (err) {
          console.error("Open options page failed:", err)
          sendResponse({ success: false, error: (err as Error).message })
        }
      })()
      break

    case MSG_OPEN_URL:
      ;(async () => {
        try {
          const { url } = message
          const targetUrl = validateOpenTabUrl(url)
          await chrome.tabs.create({
            url: targetUrl,
            active: true,
          })
          sendResponse({ success: true })
        } catch (err) {
          console.error("Open URL failed:", err)
          sendResponse({ success: false, error: (err as Error).message })
        }
      })()
      break

    case MSG_CLEAR_ALL_DATA:
      ;(async () => {
        try {
          const targets = [
            "https://gemini.google.com/*",
            "https://business.gemini.google/*",
            "https://aistudio.google.com/*",
            "https://grok.com/*",
            "https://chat.openai.com/*",
            "https://chatgpt.com/*",
            "https://claude.ai/*",
          ]
          const tabs = await chrome.tabs.query({ url: targets })
          await Promise.all(
            tabs
              .filter((tab) => tab.id)
              .map((tab) =>
                chrome.tabs
                  .sendMessage(tab.id as number, { type: MSG_CLEAR_ALL_DATA })
                  .catch(() => {}),
              ),
          )
          sendResponse({ success: true, tabs: tabs.length })
        } catch (err) {
          console.error("Broadcast clear all data failed:", err)
          sendResponse({ success: false, error: (err as Error).message })
        }
      })()
      break

    case MSG_RESTORE_DATA:
      ;(async () => {
        try {
          const targets = [
            "https://gemini.google.com/*",
            "https://business.gemini.google/*",
            "https://aistudio.google.com/*",
            "https://grok.com/*",
            "https://chat.openai.com/*",
            "https://chatgpt.com/*",
            "https://claude.ai/*",
          ]
          const tabs = await chrome.tabs.query({ url: targets })
          await Promise.all(
            tabs
              .filter((tab) => tab.id)
              .map((tab) =>
                chrome.tabs
                  .sendMessage(tab.id as number, { type: MSG_RESTORE_DATA })
                  .catch(() => {}),
              ),
          )
          sendResponse({ success: true, tabs: tabs.length })
        } catch (err) {
          console.error("Broadcast restore data failed:", err)
          sendResponse({ success: false, error: (err as Error).message })
        }
      })()
      break

    case MSG_SET_CLAUDE_SESSION_KEY:
      ;(async () => {
        try {
          const { key } = message

          if (key) {
            await chrome.cookies.set({
              url: "https://claude.ai",
              name: "sessionKey",
              value: key,
              domain: ".claude.ai",
              path: "/",
              secure: true,
              sameSite: "lax",
            })
          } else {
            await chrome.cookies.remove({
              url: "https://claude.ai",
              name: "sessionKey",
            })
          }

          const claudeTabs = await chrome.tabs.query({ url: "*://claude.ai/*" })
          for (const tab of claudeTabs) {
            if (tab.id) {
              await chrome.tabs.reload(tab.id)
            }
          }

          sendResponse({ success: true, reloadedTabs: claudeTabs.length })
        } catch (err) {
          console.error("Set Claude SessionKey failed:", sanitizeErrorMessage(err))
          sendResponse({ success: false, error: sanitizeErrorMessage(err) })
        }
      })()
      break

    case MSG_SWITCH_NEXT_CLAUDE_KEY:
      ;(async () => {
        try {
          const storageData =
            await localStorage.get<ClaudeSessionKeysPersistedState>("claudeSessionKeys")
          const rawStoredKeys = storageData?.state?.keys
          const rawKeys = Array.isArray(rawStoredKeys)
            ? rawStoredKeys.filter(isClaudeSessionKey)
            : []

          if (rawKeys.length === 0) {
            sendResponse({ success: false, error: "No keys found" })
            return
          }

          const currentId = storageData?.state?.currentKeyId

          let availableKeys = rawKeys.filter((k) => k.isValid !== false)

          if (availableKeys.length === 0) {
            availableKeys = [...rawKeys]
          }

          availableKeys.sort((a, b) => {
            const isAPro = a.accountType?.toLowerCase()?.includes("pro")
            const isBPro = b.accountType?.toLowerCase()?.includes("pro")
            if (isAPro && !isBPro) return -1
            if (!isAPro && isBPro) return 1
            return a.name.localeCompare(b.name)
          })

          const currentIndex = availableKeys.findIndex((k) => k.id === currentId)

          if (availableKeys.length === 1 && currentIndex !== -1) {
            sendResponse({ success: false, error: "claudeOnlyOneKey" })
            return
          }

          let nextIndex = 0
          if (currentIndex !== -1) {
            nextIndex = (currentIndex + 1) % availableKeys.length
          }

          const nextKey = availableKeys[nextIndex]
          if (!nextKey) {
            sendResponse({ success: false, error: "Next key not found" })
            return
          }

          if (nextKey.key) {
            await chrome.cookies.set({
              url: "https://claude.ai",
              name: "sessionKey",
              value: nextKey.key,
              domain: ".claude.ai",
              path: "/",
              secure: true,
              sameSite: "lax",
            })
          }

          if (storageData?.state) {
            storageData.state.currentKeyId = nextKey.id
            await localStorage.set("claudeSessionKeys", storageData)
          }

          const claudeTabs = await chrome.tabs.query({ url: "*://claude.ai/*" })
          for (const tab of claudeTabs) {
            if (tab.id) {
              await chrome.tabs.update(tab.id, { url: "https://claude.ai/" })
            }
          }

          sendResponse({ success: true, keyName: nextKey.name })
        } catch (err) {
          console.error("Switch Claude SessionKey failed:", err)
          sendResponse({ success: false, error: (err as Error).message })
        }
      })()
      break

    case MSG_TEST_CLAUDE_TOKEN:
      ;(async () => {
        let originalCookie: chrome.cookies.Cookie | null = null

        try {
          const { sessionKey } = message

          const existingCookies = await chrome.cookies.getAll({
            url: "https://claude.ai",
            name: "sessionKey",
          })
          originalCookie = existingCookies.length > 0 ? existingCookies[0] : null

          await chrome.cookies.set({
            url: "https://claude.ai",
            name: "sessionKey",
            value: sessionKey,
            domain: ".claude.ai",
            path: "/",
            secure: true,
            sameSite: "lax",
          })

          const response = await fetch("https://claude.ai/api/organizations", {
            method: "GET",
            headers: {
              Accept: "application/json",
              "Cache-Control": "no-cache",
            },
            credentials: "include",
          })

          if (originalCookie) {
            await chrome.cookies.set({
              url: "https://claude.ai",
              name: "sessionKey",
              value: originalCookie.value,
              domain: ".claude.ai",
              path: "/",
              secure: true,
              sameSite: "lax",
            })
          } else {
            await chrome.cookies.remove({
              url: "https://claude.ai",
              name: "sessionKey",
            })
          }

          if (!response.ok) {
            sendResponse({
              success: true,
              isValid: false,
              error: `HTTP ${response.status}`,
            })
            return
          }

          const responseText = await response.text()

          if (responseText.toLowerCase().includes("unauthorized")) {
            sendResponse({
              success: true,
              isValid: false,
              error: "Unauthorized",
            })
            return
          }

          if (!responseText.trim()) {
            sendResponse({
              success: true,
              isValid: false,
              error: "Empty response",
            })
            return
          }

          let orgs
          try {
            orgs = JSON.parse(responseText)
          } catch {
            sendResponse({
              success: true,
              isValid: false,
              error: "Invalid JSON",
            })
            return
          }

          if (!orgs || !Array.isArray(orgs) || orgs.length === 0) {
            sendResponse({
              success: true,
              isValid: false,
              error: "No organizations",
            })
            return
          }

          const org = orgs[0]
          const tier = org?.rate_limit_tier
          const capabilities = org?.capabilities || []
          const apiDisabledReason = org?.api_disabled_reason

          let accountType = "Unknown"
          if (tier === "default_claude_max_5x") {
            accountType = "Max(5x)"
          } else if (tier === "default_claude_max_20x") {
            accountType = "Max(20x)"
          } else if (tier === "default_claude_ai") {
            accountType = "Free"
          } else if (tier === "auto_api_evaluation") {
            accountType = apiDisabledReason === "out_of_credits" ? "API(No credits)" : "API"
          } else if (capabilities.includes("claude_max")) {
            accountType = "Max"
          } else if (capabilities.includes("api")) {
            accountType = "API"
          } else if (capabilities.includes("chat")) {
            accountType = "Free"
          }

          sendResponse({
            success: true,
            isValid: true,
            accountType,
          })
        } catch (err) {
          try {
            if (originalCookie) {
              await chrome.cookies.set({
                url: "https://claude.ai",
                name: "sessionKey",
                value: originalCookie.value,
                domain: ".claude.ai",
                path: "/",
                secure: true,
                sameSite: "lax",
              })
            }
          } catch {}

          console.error("Test Claude Token failed:", sanitizeErrorMessage(err))
          sendResponse({
            success: true,
            isValid: false,
            error: sanitizeErrorMessage(err),
          })
        }
      })()
      break

    case MSG_GET_CLAUDE_SESSION_KEY:
      ;(async () => {
        try {
          const cookies = await chrome.cookies.getAll({
            url: "https://claude.ai",
            name: "sessionKey",
          })

          if (cookies && cookies.length > 0) {
            sendResponse({
              success: true,
              sessionKey: cookies[0].value,
            })
          } else {
            sendResponse({
              success: false,
              error: "sessionKey cookie not found",
            })
          }
        } catch (err) {
          console.error("Get Claude SessionKey failed:", sanitizeErrorMessage(err))
          sendResponse({
            success: false,
            error: sanitizeErrorMessage(err),
          })
        }
      })()
      break

    case MSG_CHECK_CLAUDE_GENERATING:
      ;(async () => {
        try {
          const claudeTabs = await chrome.tabs.query({ url: "*://claude.ai/*" })

          if (claudeTabs.length === 0) {
            sendResponse({ success: true, isGenerating: false })
            return
          }

          let isGenerating = false

          for (const tab of claudeTabs) {
            if (!tab.id) continue
            try {
              const result = await chrome.tabs.sendMessage(tab.id, {
                type: "CHECK_IS_GENERATING",
              })
              if (result?.isGenerating) {
                isGenerating = true
                break
              }
            } catch {}
          }

          sendResponse({ success: true, isGenerating })
        } catch (err) {
          console.error("Check Claude generating failed:", err)
          sendResponse({ success: true, isGenerating: false })
        }
      })()
      break

    case MSG_GET_AISTUDIO_MODELS:
      ;(async () => {
        try {
          const aistudioTabs = await chrome.tabs.query({
            url: "*://aistudio.google.com/*",
          })

          if (aistudioTabs.length === 0) {
            sendResponse({
              success: false,
              error: "NO_AISTUDIO_TAB",
              message: "Please open the AI Studio page first",
            })
            return
          }

          const tab = aistudioTabs[0]
          if (!tab.id) {
            sendResponse({ success: false, error: "INVALID_TAB" })
            return
          }

          try {
            const result = await chrome.tabs.sendMessage(tab.id, {
              type: "GET_MODEL_LIST",
            })
            sendResponse(result)
          } catch (err) {
            console.error("Send message to AI Studio tab failed:", err)
            sendResponse({
              success: false,
              error: "SEND_MESSAGE_FAILED",
              message: (err as Error).message,
            })
          }
        } catch (err) {
          console.error("Get AI Studio models failed:", sanitizeErrorMessage(err))
          sendResponse({ success: false, error: sanitizeErrorMessage(err) })
        }
      })()
      break

    default:
      sendResponse({ success: false, error: "Unknown message type" })
  }

  return true
})

export {}
