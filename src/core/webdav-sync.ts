/**
 */

import { MULTI_PROP_STORES, ZUSTAND_KEYS } from "~constants/defaults"
import { validateBackupData } from "~utils/backup-validator"
import { APP_NAME } from "~utils/config"
import { MSG_WEBDAV_REQUEST } from "~utils/messaging"
import {
  buildWebDavUrl,
  sanitizeErrorMessage,
  sanitizeWebDavHeaders,
  sanitizeWebDavPath,
  validateWebDavMethod,
} from "~utils/network-security"

declare const __PLATFORM__: "extension" | "userscript" | undefined

interface GMXMLHttpResponse {
  status: number
  statusText: string
  responseText: string
  responseHeaders?: string
}

interface GMXMLHttpRequestDetails {
  method: string
  url: string
  headers?: Record<string, string>
  data?: string
  onload?: (response: GMXMLHttpResponse) => void
  onerror?: (error: unknown) => void
  ontimeout?: () => void
  timeout?: number
}

declare function GM_xmlhttpRequest(details: GMXMLHttpRequestDetails): void

function safeDecodeURIComponent(str: string) {
  try {
    return decodeURIComponent(str)
  } catch {
    return str
  }
}

export interface WebDAVConfig {
  enabled: boolean
  url: string
  username: string
  password: string
  syncMode: "manual" | "auto"
  syncInterval: number
  remoteDir: string
  lastSyncTime?: number
  lastSyncStatus?: "success" | "failed" | "syncing"
}

export const DEFAULT_WEBDAV_CONFIG: WebDAVConfig = {
  enabled: false,
  url: "",
  username: "",
  password: "",
  syncMode: "manual",
  syncInterval: 30,
  remoteDir: APP_NAME,
}

/**
 */
function generateBackupFileName(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  const hour = String(now.getHours()).padStart(2, "0")
  const minute = String(now.getMinutes()).padStart(2, "0")
  const second = String(now.getSeconds()).padStart(2, "0")

  const timestamp = `${year}-${month}-${day}_${hour}-${minute}-${second}`
  return `${APP_NAME}_backup_${timestamp}.json`
}

export interface SyncResult {
  success: boolean
  messageKey: string
  messageArgs?: Record<string, unknown>
  timestamp?: number
}

/**
 */
export interface BackupFile {
  name: string
  size: number
  lastModified: Date
  path: string
}

/**
 */
export class WebDAVSyncManager {
  private config: WebDAVConfig = DEFAULT_WEBDAV_CONFIG
  private autoSyncTimer: NodeJS.Timeout | null = null

  constructor() {
    this.loadConfig()
  }

  /**
   */
  async loadConfig(): Promise<WebDAVConfig> {
    const { getSettingsState } = await import("~stores/settings-store")
    const settings = getSettingsState()
    if (settings?.webdav) {
      this.config = { ...DEFAULT_WEBDAV_CONFIG, ...settings.webdav }
    }
    return this.config
  }

  /**
   */
  /**
   */
  async setConfig(config: Partial<WebDAVConfig>, persist: boolean = true): Promise<void> {
    this.config = { ...this.config, ...config }
    if (persist) {
      const { useSettingsStore } = await import("~stores/settings-store")
      useSettingsStore.getState().setSettings({ webdav: this.config })
    }
  }

  /**
   */
  async saveConfig(config: Partial<WebDAVConfig>): Promise<void> {
    return this.setConfig(config, true)
  }

  /**
   */
  getConfig(): WebDAVConfig {
    return { ...this.config }
  }

  /**
   */
  async testConnection(): Promise<SyncResult> {
    if (!this.config.url || !this.config.username || !this.config.password) {
      return { success: false, messageKey: "webdavConfigIncomplete" }
    }

    try {
      const response = await this.request("PROPFIND", this.config.remoteDir, null, {
        Depth: "0",
      })

      if (response.ok || response.status === 404) {
        return { success: true, messageKey: "webdavConnectionSuccess" }
      } else if (response.status === 401) {
        return { success: false, messageKey: "webdavAuthFailed" }
      } else {
        return {
          success: false,
          messageKey: "webdavConnectionFailed",
          messageArgs: { status: response.status },
        }
      }
    } catch (err) {
      return {
        success: false,
        messageKey: "webdavConnectionFailed",
        messageArgs: { error: sanitizeErrorMessage(err) },
      }
    }
  }

  /**
   */
  async upload(): Promise<SyncResult> {
    if (!this.config.url || !this.config.username || !this.config.password) {
      return { success: false, messageKey: "webdavConfigIncomplete" }
    }

    try {
      await this.saveConfig({ lastSyncStatus: "syncing" })

      const localData = await new Promise<Record<string, unknown>>((resolve) =>
        chrome.storage.local.get(null, resolve),
      )

      const hydratedData = Object.fromEntries(
        Object.entries(localData).map(([k, v]) => {
          try {
            let parsed = typeof v === "string" ? JSON.parse(v) : v

            if (ZUSTAND_KEYS.includes(k) && parsed?.state) {
              if (MULTI_PROP_STORES.includes(k)) {
                parsed = parsed.state
              } else if (parsed.state[k] !== undefined) {
                parsed = parsed.state[k]
              } else {
                parsed = parsed.state
              }
            }

            return [k, parsed]
          } catch {
            return [k, v]
          }
        }),
      )

      const exportData = {
        version: 3,
        timestamp: new Date().toISOString(),
        data: hydratedData,
      }

      const fileName = generateBackupFileName()
      const remotePath = this.buildRemotePath(fileName)

      if (this.config.remoteDir) {
        try {
          await this.request("MKCOL", this.config.remoteDir)
          // 201 Created
        } catch {}
      }

      const response = await this.request("PUT", remotePath, JSON.stringify(exportData, null, 2), {
        "Content-Type": "application/json",
      })

      if (response.ok || response.status === 201 || response.status === 204) {
        const now = Date.now()
        await this.saveConfig({ lastSyncTime: now, lastSyncStatus: "success" })
        return { success: true, messageKey: "webdavUploadSuccess", timestamp: now }
      } else {
        await this.saveConfig({ lastSyncStatus: "failed" })
        return {
          success: false,
          messageKey: "webdavUploadFailed",
          messageArgs: { status: response.status },
        }
      }
    } catch (err) {
      await this.saveConfig({ lastSyncStatus: "failed" })
      return {
        success: false,
        messageKey: "webdavUploadFailed",
        messageArgs: { error: sanitizeErrorMessage(err) },
      }
    }
  }

  /**
   */
  async getBackupList(limit: number = 10): Promise<BackupFile[]> {
    if (!this.config.url || !this.config.username || !this.config.password) {
      return []
    }

    try {
      const body = `<?xml version="1.0" encoding="utf-8" ?>
<D:propfind xmlns:D="DAV:">
  <D:prop>
    <D:displayname/>
    <D:getcontentlength/>
    <D:getlastmodified/>
  </D:prop>
</D:propfind>`

      const response = await this.request("PROPFIND", this.config.remoteDir, body, {
        Depth: "1",
        "Content-Type": "application/xml",
      })

      if (!response.ok) return []

      const text = await response.text()
      const NS = `(?:[a-zA-Z0-9_-]+:)?`
      const responseRegex = new RegExp(`<${NS}response[^>]*>([\\s\\S]*?)<\\/${NS}response>`, "gi")
      const responses = Array.from(text.matchAll(responseRegex))

      const files: BackupFile[] = []

      for (const match of responses) {
        const content = match[1]

        const hrefMatch = content.match(new RegExp(`<${NS}href[^>]*>([^<]+)<\\/${NS}href>`, "i"))
        if (!hrefMatch) continue
        const href = safeDecodeURIComponent(hrefMatch[1])

        if (!href.endsWith(".json") || !href.includes(`${APP_NAME}_backup_`)) continue

        const sizeMatch = content.match(
          new RegExp(`<${NS}getcontentlength[^>]*>([^<]+)<\\/${NS}getcontentlength>`, "i"),
        )
        const size = sizeMatch ? parseInt(sizeMatch[1], 10) : 0

        const timeMatch = content.match(
          new RegExp(`<${NS}getlastmodified[^>]*>([^<]+)<\\/${NS}getlastmodified>`, "i"),
        )
        const lastModified = timeMatch ? new Date(timeMatch[1]) : new Date(0)

        const name = href.split("/").pop() || href

        files.push({
          name,
          path: href,
          size,
          lastModified,
        })
      }

      files.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime())

      return files.slice(0, limit)
    } catch (err) {
      console.error("Failed to get backup list:", sanitizeErrorMessage(err))
      return []
    }
  }

  /**
   */
  async deleteFile(fileName: string): Promise<SyncResult> {
    if (!this.config.url || !this.config.username || !this.config.password) {
      return { success: false, messageKey: "webdavConfigIncomplete" }
    }

    try {
      const remotePath = this.buildRemotePath(fileName)
      const response = await this.request("DELETE", remotePath)

      if (response.ok || response.status === 204 || response.status === 404) {
        return { success: true, messageKey: "webdavDeleteSuccess" }
      } else {
        return {
          success: false,
          messageKey: "webdavDeleteFailed",
          messageArgs: { status: response.status },
        }
      }
    } catch (err) {
      return {
        success: false,
        messageKey: "webdavDeleteFailed",
        messageArgs: { error: sanitizeErrorMessage(err) },
      }
    }
  }

  /**
   */
  async download(targetFileName?: string): Promise<SyncResult> {
    if (!this.config.url || !this.config.username || !this.config.password) {
      return { success: false, messageKey: "webdavConfigIncomplete" }
    }

    try {
      await this.saveConfig({ lastSyncStatus: "syncing" })

      let fileName = targetFileName
      if (!fileName) {
        // Find latest backup
        const list = await this.getBackupList(1)
        if (list.length === 0) {
          await this.saveConfig({ lastSyncStatus: "failed" })
          return { success: false, messageKey: "webdavFileNotFound" }
        }
        fileName = list[0].name
      }

      const remotePath = this.buildRemotePath(fileName)
      const response = await this.request("GET", remotePath)

      if (!response.ok) {
        await this.saveConfig({ lastSyncStatus: "failed" })
        return {
          success: false,
          messageKey: "webdavDownloadFailed",
          messageArgs: { status: response.status },
        }
      }

      const text = await response.text()
      const backupData = JSON.parse(text)

      const validation = validateBackupData(backupData)
      if (!validation.valid) {
        console.error("Backup validation failed:", validation.errorKeys)
        await this.saveConfig({ lastSyncStatus: "failed" })
        return { success: false, messageKey: "webdavInvalidFormat" }
      }

      const currentWebdavConfig = this.config

      const dehydratedData = Object.fromEntries(
        Object.entries(backupData.data).map(([k, v]) => {
          if (v === null || v === undefined) {
            return [k, v]
          }

          if (ZUSTAND_KEYS.includes(k)) {
            let state: Record<string, unknown>
            if (MULTI_PROP_STORES.includes(k)) {
              if (typeof v === "object" && !Array.isArray(v)) {
                const obj = v as Record<string, unknown>
                if (k === "conversations" && obj.conversations !== undefined) {
                  state = obj
                } else if (
                  k === "readingHistory" &&
                  (obj.history !== undefined || obj.lastCleanupRun !== undefined)
                ) {
                  state = obj
                } else {
                  state = k === "readingHistory" ? { history: v } : { [k]: v }
                }
              } else {
                state = k === "readingHistory" ? { history: v } : { [k]: v }
              }
            } else {
              state = { [k]: v }
            }
            return [k, JSON.stringify({ state, version: 0 })]
          }

          if (typeof v === "object") {
            return [k, JSON.stringify(v)]
          }
          return [k, v]
        }),
      )

      await new Promise<void>((resolve, reject) =>
        chrome.storage.local.set(dehydratedData, () =>
          chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve(),
        ),
      )

      await new Promise<void>((resolve, reject) => {
        chrome.storage.local.get("settings", (result) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError)
            return
          }

          let settingsWrapper = result.settings
          if (typeof settingsWrapper === "string") {
            try {
              settingsWrapper = JSON.parse(settingsWrapper)
            } catch {
              resolve()
              return
            }
          }

          if (settingsWrapper?.state?.settings) {
            settingsWrapper.state.settings.webdav = currentWebdavConfig
          }

          chrome.storage.local.set({ settings: JSON.stringify(settingsWrapper) }, () =>
            chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve(),
          )
        })
      })

      const now = Date.now()
      await this.saveConfig({ lastSyncTime: now, lastSyncStatus: "success" })
      return { success: true, messageKey: "webdavDownloadSuccess", timestamp: now }
    } catch (err) {
      await this.saveConfig({ lastSyncStatus: "failed" })
      return {
        success: false,
        messageKey: "webdavDownloadFailed",
        messageArgs: { error: sanitizeErrorMessage(err) },
      }
    }
  }

  /**
   */
  startAutoSync(): void {
    this.stopAutoSync()
    if (this.config.enabled && this.config.syncMode === "auto" && this.config.syncInterval > 0) {
      this.autoSyncTimer = setInterval(
        () => {
          this.upload()
        },
        this.config.syncInterval * 60 * 1000,
      )
    }
  }

  /**
   */
  stopAutoSync(): void {
    if (this.autoSyncTimer) {
      clearInterval(this.autoSyncTimer)
      this.autoSyncTimer = null
    }
  }

  /**
   */
  private buildRemotePath(fileName: string): string {
    const dir = sanitizeWebDavPath(this.config.remoteDir)
    const safeFileName = sanitizeWebDavPath(fileName)
    if (!dir) return safeFileName
    return `${dir}/${safeFileName}`
  }

  /**
   */
  private async request(
    method: string,
    path: string,
    body?: string | null,
    headers?: Record<string, string>,
  ): Promise<Response> {
    const validatedMethod = validateWebDavMethod(method)
    const url = this.buildUrl(path)
    const requestHeaders = sanitizeWebDavHeaders(headers)

    const isUserscript = typeof __PLATFORM__ !== "undefined" && __PLATFORM__ === "userscript"

    if (isUserscript) {
      return this.requestViaGM(validatedMethod, url, body, requestHeaders)
    } else {
      return this.requestViaBackground(validatedMethod, url, body, requestHeaders)
    }
  }

  /**
   */
  private requestViaGM(
    method: string,
    url: string,
    body?: string | null,
    headers?: Record<string, string>,
  ): Promise<Response> {
    return new Promise((resolve, reject) => {
      const requestHeaders: Record<string, string> = { ...sanitizeWebDavHeaders(headers) }
      if (this.config.username && this.config.password) {
        const credentials = btoa(`${this.config.username}:${this.config.password}`)
        requestHeaders["Authorization"] = `Basic ${credentials}`
      }

      GM_xmlhttpRequest({
        method,
        url,
        headers: requestHeaders,
        data: body || undefined,
        onload: (response: GMXMLHttpResponse) => {
          resolve({
            ok: response.status >= 200 && response.status < 300,
            status: response.status,
            statusText: response.statusText,
            text: async () => response.responseText,
            headers: {
              get: (name: string) => {
                const headerLines = response.responseHeaders?.split("\r\n") || []
                for (const line of headerLines) {
                  const [key, ...valueParts] = line.split(":")
                  if (key?.toLowerCase() === name.toLowerCase()) {
                    return valueParts.join(":").trim()
                  }
                }
                return null
              },
            },
          } as unknown as Response)
        },
        onerror: (error: unknown) => {
          reject(new Error(sanitizeErrorMessage(error, "GM_xmlhttpRequest failed")))
        },
        ontimeout: () => {
          reject(new Error("Request timeout"))
        },
        timeout: 15000,
      })
    })
  }

  /**
   */
  private async requestViaBackground(
    method: string,
    url: string,
    body?: string | null,
    headers?: Record<string, string>,
  ): Promise<Response> {
    const response = await chrome.runtime.sendMessage({
      type: MSG_WEBDAV_REQUEST,
      method,
      url,
      body,
      headers: sanitizeWebDavHeaders(headers),
      auth: {
        username: this.config.username,
        password: this.config.password,
      },
    })

    if (!response.success) {
      throw new Error(response.error || "WebDAV request failed")
    }

    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      statusText: response.statusText,
      text: async () => response.body,
      headers: {
        get: (name: string) => response.headers?.[name.toLowerCase()] || null,
      },
    } as unknown as Response
  }

  /**
   */
  private buildUrl(path: string): string {
    return buildWebDavUrl(this.config.url.trim(), path)
  }
}

let instance: WebDAVSyncManager | null = null

export function getWebDAVSyncManager(): WebDAVSyncManager {
  if (!instance) {
    instance = new WebDAVSyncManager()
  }
  return instance
}
