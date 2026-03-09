/**
 * 
 * / () | WebDAV 
 */
import React, { useEffect, useRef, useState } from "react"

import { CloudIcon } from "~components/icons"
import { ConfirmDialog, Tooltip } from "~components/ui"
import {
  DEFAULT_FOLDERS,
  MULTI_PROP_STORES,
  ZUSTAND_KEYS,
  getDefaultPrompts,
} from "~constants/defaults"
import { getWebDAVSyncManager, type BackupFile } from "~core/webdav-sync"
import { platform } from "~platform"
import { useConversationsStore } from "~stores/conversations-store"
import { useFoldersStore } from "~stores/folders-store"
import { usePromptsStore } from "~stores/prompts-store"
import { useReadingHistoryStore } from "~stores/reading-history-store"
import { useSettingsStore } from "~stores/settings-store"
import { useTagsStore } from "~stores/tags-store"
import { validateBackupData } from "~utils/backup-validator"
import { t } from "~utils/i18n"
import { MSG_CLEAR_ALL_DATA, MSG_RESTORE_DATA } from "~utils/messaging"
import { getWebDavPermissionOrigin, sanitizeErrorMessage } from "~utils/network-security"
import {
  CLEAR_ALL_FLAG_KEY,
  DEFAULT_SETTINGS,
  RESTORE_FLAG_KEY,
  type Settings,
} from "~utils/storage"
import { showToast as showDomToast } from "~utils/toast"

import { PageTitle, SettingCard, SettingRow } from "../components"

interface BackupPageProps {
  siteId: string
  onNavigate?: (page: string) => void
}

// 
const formatSize = (bytes: number) => {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message
  return String(error)
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

const formatBackupTypeLabel = (type: unknown): string => {
  if (type === "full") return t("fullBackup") || ""
  if (type === "prompts") return t("promptsBackup") || ""
  if (type === "settings") return t("settingsBackup") || ""
  return String(type || t("unknown") || "")
}

// ====================  () ====================
const RemoteBackupModal: React.FC<{
  onClose: () => void
  onRestore: () => void
}> = ({ onClose, onRestore }) => {
  const [backups, setBackups] = useState<BackupFile[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmConfig, setConfirmConfig] = useState<{
    show: boolean
    title: string
    message: string
    danger?: boolean
    onConfirm: () => void
  }>({
    show: false,
    title: "",
    message: "",
    onConfirm: () => {},
  })

  const loadBackups = async () => {
    setLoading(true)
    try {
      const manager = getWebDAVSyncManager()
      const files = await manager.getBackupList()
      setBackups(files)
    } catch (e) {
      showDomToast(": " + String(e))
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    loadBackups()
  }, [])

  const handleRestoreClick = (file: BackupFile) => {
    setConfirmConfig({
      show: true,
      title: t("restore") || "",
      message: ` "${file.name}" ${t("openAiPagesWillRefresh") || " AI "}`,
      danger: true,
      onConfirm: async () => {
        setConfirmConfig((prev) => ({ ...prev, show: false }))
        try {
          setLoading(true)
          const manager = getWebDAVSyncManager()
          const result = await manager.download(file.name)
          if (result.success) {
            try {
              if (platform.type === "extension" && typeof chrome !== "undefined") {
                await new Promise<void>((resolve, reject) =>
                  chrome.storage.local.set({ [RESTORE_FLAG_KEY]: Date.now() }, () =>
                    chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve(),
                  ),
                )
                await chrome.runtime.sendMessage({ type: MSG_RESTORE_DATA })
              }
            } catch {
              // ignore
            }
            showDomToast(t("restoreSuccess") || "...")
            setTimeout(() => {
              onRestore()
            }, 1500)
          } else {
            showDomToast(t("restoreError") || ": " + result.messageKey)
            setLoading(false)
          }
        } catch (e) {
          showDomToast(": " + String(e))
          setLoading(false)
        }
      },
    })
  }

  const handleDeleteClick = (file: BackupFile) => {
    setConfirmConfig({
      show: true,
      title: t("delete") || "",
      message: ` "${file.name}" `,
      danger: true,
      onConfirm: async () => {
        setConfirmConfig((prev) => ({ ...prev, show: false }))
        try {
          setLoading(true)
          const manager = getWebDAVSyncManager()
          const result = await manager.deleteFile(file.name)
          if (result.success) {
            showDomToast(t("deleteSuccess") || "")
            loadBackups()
          } else {
            showDomToast(t("deleteError") || "")
            setLoading(false)
          }
        } catch (e) {
          showDomToast(": " + String(e))
          setLoading(false)
        }
      },
    })
  }

  return (
    <div
      className="settings-modal-overlay"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
      {confirmConfig.show && (
        <ConfirmDialog
          title={confirmConfig.title}
          message={confirmConfig.message}
          danger={confirmConfig.danger}
          onConfirm={confirmConfig.onConfirm}
          onCancel={() => setConfirmConfig((prev) => ({ ...prev, show: false }))}
        />
      )}

      <div
        className="settings-modal"
        style={{
          width: "500px",
          height: "600px",
          background: "var(--gh-card-bg, #ffffff)",
          borderRadius: "12px",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}>
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--gh-border, #e5e7eb)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}>
          <div style={{ fontWeight: 600, fontSize: "16px" }}>
            {t("webdavBackupList") || "WebDAV "}
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <Tooltip content={t("refresh") || ""}>
              <button
                onClick={loadBackups}
                className="settings-btn settings-btn-secondary"
                style={{ padding: "6px" }}>
                🔄
              </button>
            </Tooltip>
            <button
              onClick={onClose}
              className="settings-btn settings-btn-secondary"
              style={{ padding: "6px 12px" }}>
              ✕
            </button>
          </div>
        </div>

        <div style={{ overflowY: "auto", padding: "16px", flex: 1 }}>
          {loading ? (
            <div
              style={{ textAlign: "center", padding: "20px", color: "var(--gh-text-secondary)" }}>
              {t("loading") || "..."}
            </div>
          ) : backups.length === 0 ? (
            <div
              style={{ textAlign: "center", padding: "20px", color: "var(--gh-text-secondary)" }}>
              {t("noBackupsFound") || ""}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {backups.map((file) => (
                <div
                  key={file.name}
                  style={{
                    padding: "12px",
                    background: "var(--gh-bg-secondary, #f9fafb)",
                    borderRadius: "8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: 500 }}>{file.name}</div>
                    <div style={{ fontSize: "12px", color: "var(--gh-text-secondary)" }}>
                      {formatSize(file.size)} • {file.lastModified.toLocaleString()}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={() => handleRestoreClick(file)}
                      className="settings-btn settings-btn-primary"
                      style={{ padding: "6px 12px", fontSize: "12px" }}>
                      {t("restore") || ""}
                    </button>
                    <button
                      onClick={() => handleDeleteClick(file)}
                      className="settings-btn settings-btn-danger"
                      style={{ padding: "6px 12px", fontSize: "12px" }}>
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ====================  ====================
const BackupPage: React.FC<BackupPageProps> = ({ siteId: _siteId, onNavigate: _onNavigate }) => {
  const { settings, setSettings, resetSettings } = useSettingsStore()

  // 
  const [showRemoteBackups, setShowRemoteBackups] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pasteContent, setPasteContent] = useState("")

  // WebDAV  Store 
  const [webdavForm, setWebdavForm] = useState<NonNullable<Settings["webdav"]>>({
    url: "",
    username: "",
    password: "",
    enabled: false,
    syncMode: "manual",
    syncInterval: 30,
    remoteDir: "ophel",
  })

  // 
  useEffect(() => {
    if (settings?.webdav) {
      setWebdavForm((prev) => ({
        ...prev,
        ...settings.webdav,
      }))
    }
  }, [settings?.webdav])

  // 
  const [confirmConfig, setConfirmConfig] = useState<{
    show: boolean
    title: string
    message: React.ReactNode
    danger?: boolean
    onConfirm: () => void
  }>({
    show: false,
    title: "",
    message: "",
    onConfirm: () => {},
  })

  // 
  const [permissionConfirm, setPermissionConfirm] = useState<{
    show: boolean
    onConfirm: () => void
  }>({
    show: false,
    onConfirm: () => {},
  })

  if (!settings) return null

  // --------------------  --------------------

  const handleExport = async (type: "full" | "prompts" | "settings") => {
    try {
      let exportData: Record<string, unknown> = {}
      const timestamp = new Date().toISOString()
      let filename = `ophel-backup-${timestamp.slice(0, 10)}.json`

      if (type === "full") {
        // 1. 
        const localData = await new Promise<Record<string, unknown>>((resolve) =>
          chrome.storage.local.get(null, resolve),
        )
        // 
        const hydratedData = Object.fromEntries(
          Object.entries(localData).map(([k, v]) => {
            try {
              let parsed = typeof v === "string" ? JSON.parse(v) : v
              if (ZUSTAND_KEYS.includes(k) && parsed?.state) {
                if (MULTI_PROP_STORES.includes(k)) {
                  //  store state lastUsedFolderId 
                  parsed = parsed.state
                } else if (parsed.state[k] !== undefined) {
                  //  store
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
        exportData = {
          version: 3,
          timestamp,
          type: "full",
          data: hydratedData,
        }
      } else if (type === "prompts") {
        // 2.  (KEY: prompts)
        //  folders  tags
        const raw = await new Promise<Record<string, unknown>>((resolve) =>
          chrome.storage.local.get("prompts", resolve),
        )
        //  Zustand 
        let promptsData = []
        try {
          const parsed = typeof raw.prompts === "string" ? JSON.parse(raw.prompts) : raw.prompts
          if (parsed?.state?.prompts) {
            promptsData = parsed.state.prompts
          }
        } catch (e) {
          console.error(e)
        }

        exportData = {
          version: 3,
          timestamp,
          type: "prompts",
          data: { prompts: promptsData },
        }
        filename = `ophel-prompts-${timestamp.slice(0, 10)}.json`
      } else if (type === "settings") {
        // 3.  (KEY: settings)
        const raw = await new Promise<Record<string, unknown>>((resolve) =>
          chrome.storage.local.get("settings", resolve),
        )
        let settingsData = {}
        try {
          const parsed = typeof raw.settings === "string" ? JSON.parse(raw.settings) : raw.settings
          if (parsed?.state?.settings) {
            settingsData = parsed.state.settings
          } else if (parsed?.state) {
            settingsData = parsed.state
          }
        } catch (e) {
          console.error(e)
        }

        exportData = {
          version: 3,
          timestamp,
          type: "settings",
          data: { settings: settingsData }, //  settings  settings store key
        }
        filename = `ophel-settings-${timestamp.slice(0, 10)}.json`
      }

      // 
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      showDomToast(t("exportSuccess") || "")
    } catch (err) {
      showDomToast(t("exportError") || "" + String(err))
    }
  }

  // --------------------  --------------------

  const processImport = async (jsonString: string) => {
    try {
      const data = JSON.parse(jsonString)

      // 
      const validation = validateBackupData(data)
      if (!validation.valid) {
        const errorMsgs = validation.errorKeys.map((key) => t(key) || key).join(", ")
        console.error("Backup validation failed:", validation.errorKeys)
        showDomToast(t("invalidBackupFile") || ": " + errorMsgs)
        return
      }

      setConfirmConfig({
        show: true,
        title: t("importData") || "",
        message: (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div>{t("importConfirm") || ""}</div>
            <div
              style={{
                border: "1px solid var(--gh-border, #e5e7eb)",
                background: "var(--gh-hover, #f8fafc)",
                borderRadius: "8px",
                padding: "10px 12px",
              }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "72px 1fr",
                  rowGap: "6px",
                  columnGap: "10px",
                  alignItems: "start",
                }}>
                <div style={{ color: "var(--gh-text-secondary, #6b7280)" }}>
                  {t("backupTime") || ""}
                </div>
                <div style={{ color: "var(--gh-text, #111827)", fontWeight: 500 }}>
                  {String(data.timestamp || "-")}
                </div>
                <div style={{ color: "var(--gh-text-secondary, #6b7280)" }}>
                  {t("backupType") || ""}
                </div>
                <div style={{ color: "var(--gh-text, #111827)", fontWeight: 500 }}>
                  {formatBackupTypeLabel(data.type)}
                </div>
              </div>
            </div>
            <div style={{ fontSize: "12px", color: "var(--gh-text-secondary, #6b7280)" }}>
              {t("openAiPagesWillRefresh") || " AI "}
            </div>
          </div>
        ),
        danger: true,
        onConfirm: async () => {
          setConfirmConfig((prev) => ({ ...prev, show: false }))
          try {
            //  (Rehydration)
            const updates: Record<string, unknown> = {}

            Object.entries(data.data).forEach(([k, v]) => {
              if (v === null || v === undefined) return

              //  key
              //  prompts data.data  prompts

              if (ZUSTAND_KEYS.includes(k)) {
                //  Zustand persist 
                let stateContent = v
                //  multi-prop stores  ( conversations)
                if (MULTI_PROP_STORES.includes(k)) {
                  //  v  store 
                  if (typeof v === "object" && !Array.isArray(v)) {
                    const obj = v as Record<string, unknown>
                    if (k === "conversations" && obj.conversations !== undefined) {
                      // { conversations: {...}, lastUsedFolderId: "..." }
                      stateContent = v
                    } else if (
                      k === "readingHistory" &&
                      (obj.history !== undefined || obj.lastCleanupRun !== undefined)
                    ) {
                      // { history: {...}, lastCleanupRun: number }
                      stateContent = v
                    } else {
                      // 
                      stateContent = k === "readingHistory" ? { history: v } : { [k]: v }
                    }
                  } else {
                    // v 
                    stateContent = k === "readingHistory" ? { history: v } : { [k]: v }
                  }
                } else {
                  // prompts, settings  state key = store name
                  //  state = { [key]: value } 
                  //  store  { prompts: [...] }
                  //  v  [...] (array)  object
                  //  v  array (prompts list) { prompts: v }
                  if (k === "prompts" && Array.isArray(v)) {
                    stateContent = { prompts: v }
                  } else if (k === "settings" && (!isRecord(v) || v.settings === undefined)) {
                    // settings store  { settings: {...}, ...actions }
                    //  v  settings 
                    stateContent = { settings: v }
                  } else {
                    // 
                    stateContent = { [k]: v }
                  }
                }

                updates[k] = JSON.stringify({ state: stateContent, version: 0 })
              } else {
                // 
                if (typeof v === "object") {
                  updates[k] = JSON.stringify(v)
                } else {
                  updates[k] = v
                }
              }
            })

            await new Promise<void>((resolve, reject) =>
              chrome.storage.local.set(updates, () =>
                chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve(),
              ),
            )

            try {
              if (platform.type === "extension" && typeof chrome !== "undefined") {
                await new Promise<void>((resolve, reject) =>
                  chrome.storage.local.set({ [RESTORE_FLAG_KEY]: Date.now() }, () =>
                    chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve(),
                  ),
                )
                await chrome.runtime.sendMessage({ type: MSG_RESTORE_DATA })
              }
            } catch {
              // ignore
            }

            showDomToast(t("importSuccess") || "")
            setTimeout(() => window.location.reload(), 1000)
          } catch (err) {
            console.error("[Backup] import storage write failed:", err)
            showDomToast(`${t("importError") || ""}${getErrorMessage(err)}`)
          }
        },
      })
    } catch (e) {
      console.error("[Backup] import parse failed:", e)
      showDomToast(`${t("importError") || ""}${getErrorMessage(e)}`)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    setPasteContent(text) // 
    // processImport(text) // 
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleImportClick = () => {
    if (!pasteContent.trim()) {
      showDomToast("")
      return
    }
    processImport(pasteContent)
  }

  const resetLocalStores = () => {
    resetSettings()
    usePromptsStore.getState().setPrompts(getDefaultPrompts())
    useFoldersStore.setState({ folders: DEFAULT_FOLDERS })
    useTagsStore.setState({ tags: [] })
    useConversationsStore.setState({ conversations: {}, lastUsedFolderId: "inbox" })
    useReadingHistoryStore.setState({ history: {}, lastCleanupRun: 0 })
  }

  // 
  const handleClearAll = () => {
    setConfirmConfig({
      show: true,
      title: t("clearAllData") || "",
      message:
        t("clearAllDataConfirm") ||
        "",
      danger: true,
      onConfirm: async () => {
        setConfirmConfig((prev) => ({ ...prev, show: false }))
        try {
          if (platform.type === "extension" && typeof chrome !== "undefined") {
            try {
              await chrome.runtime.sendMessage({ type: MSG_CLEAR_ALL_DATA })
            } catch {
              // 
            }
          }

          await Promise.all([
            new Promise<void>((resolve, reject) =>
              chrome.storage.local.clear(() =>
                chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve(),
              ),
            ),
            new Promise<void>((resolve, reject) =>
              chrome.storage.sync.clear(() =>
                chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve(),
              ),
            ),
          ])
          await new Promise<void>((resolve, reject) =>
            chrome.storage.local.set({ [CLEAR_ALL_FLAG_KEY]: Date.now() }, () =>
              chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve(),
            ),
          )
          resetLocalStores()
          showDomToast(t("clearSuccess") || "...")
          setTimeout(() => window.location.reload(), 1500)
        } catch (err) {
          showDomToast(t("error") + ": " + String(err))
        }
      },
    })
  }

  // -------------------- WebDAV  --------------------

  const checkAndRequestWebDAVPermission = async (onGranted: () => void): Promise<boolean> => {
    const url = webdavForm.url // 
    if (!url) {
      showDomToast(t("webdavConfigIncomplete") || " WebDAV ")
      return false
    }

    // GM_xmlhttpRequest  @grant 
    if (!platform.hasCapability("permissions")) {
      await onGranted()
      return true
    }

    try {
      const origin = getWebDavPermissionOrigin(url)
      const checkResult: unknown = await chrome.runtime.sendMessage({
        type: "CHECK_PERMISSION",
        origin,
      })
      if (!isRecord(checkResult) || !checkResult.hasPermission) {
        setPermissionConfirm({
          show: true,
          onConfirm: async () => {
            setPermissionConfirm((prev) => ({ ...prev, show: false }))
            await chrome.runtime.sendMessage({
              type: "REQUEST_PERMISSIONS",
              permType: "webdav",
              origins: [origin],
            })
          },
        })
        return false
      }
      await onGranted()
      return true
    } catch (e) {
      console.warn("Perm check failed:", sanitizeErrorMessage(e))
      showDomToast(sanitizeErrorMessage(e, "Invalid WebDAV URL"))
      return false
    }
  }

  const handleSaveConfig = () => {
    //  Store
    setSettings({
      webdav: {
        ...(settings.webdav ?? DEFAULT_SETTINGS.webdav ?? {}),
        ...webdavForm,
      },
    })
    showDomToast(t("saveSuccess") || "")
  }

  const testWebDAVConnection = async () => {
    await checkAndRequestWebDAVPermission(async () => {
      const manager = getWebDAVSyncManager()
      // 
      await manager.setConfig(webdavForm, false)

      const res = await manager.testConnection()
      if (res.success) showDomToast(t("webdavConnectionSuccess") || "")
      else showDomToast(t("webdavConnectionFailed") || ": " + res.messageKey)
    })
  }

  const uploadToWebDAV = async () => {
    await checkAndRequestWebDAVPermission(async () => {
      const manager = getWebDAVSyncManager()
      // 
      await manager.setConfig(webdavForm, false)

      const res = await manager.upload()
      if (res.success) showDomToast(t("webdavUploadSuccess") || "")
      else showDomToast(t("webdavUploadFailed") || ": " + res.messageKey)
    })
  }

  return (
    <div className="settings-content">
      <PageTitle title={t("navBackup") || ""} Icon={CloudIcon} />

      {/*  */}
      {confirmConfig.show && (
        <ConfirmDialog
          title={confirmConfig.title}
          message={confirmConfig.message}
          danger={confirmConfig.danger}
          onConfirm={confirmConfig.onConfirm}
          onCancel={() => setConfirmConfig((prev) => ({ ...prev, show: false }))}
        />
      )}

      {/*  */}
      {permissionConfirm.show && (
        <ConfirmDialog
          title={t("permissionRequired") || ""}
          message={t("webdavPermissionDesc") || " WebDAV "}
          onConfirm={permissionConfirm.onConfirm}
          onCancel={() => setPermissionConfirm((prev) => ({ ...prev, show: false }))}
        />
      )}

      {/*  */}
      {showRemoteBackups && (
        <RemoteBackupModal
          onClose={() => setShowRemoteBackups(false)}
          onRestore={() => window.location.reload()}
        />
      )}

      {/*  */}
      <div
        className="backup-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
          gap: "20px",
          marginBottom: "24px",
        }}>
        {/*  */}
        <SettingCard
          title={t("exportData") || ""}
          description={t("exportDataDesc") || " JSON "}>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {/*  */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px",
                background: "var(--gh-bg-secondary)",
                borderRadius: "8px",
              }}>
              <div>
                <div style={{ fontWeight: 500, fontSize: "14px" }}>
                  {t("fullBackup") || ""}
                </div>
                <div style={{ fontSize: "12px", color: "var(--gh-text-secondary)" }}>
                  {t("fullBackupDesc") || ""}
                </div>
              </div>
              <button
                onClick={() => handleExport("full")}
                className="settings-btn settings-btn-success"
                style={{ padding: "6px 16px" }}>
                {t("export") || ""}
              </button>
            </div>

            {/*  */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px",
                background: "var(--gh-bg-secondary)",
                borderRadius: "8px",
              }}>
              <div>
                <div style={{ fontWeight: 500, fontSize: "14px" }}>
                  {t("promptsBackup") || ""}
                </div>
                <div style={{ fontSize: "12px", color: "var(--gh-text-secondary)" }}>
                  {t("promptsBackupDesc") || ""}
                </div>
              </div>
              <button
                onClick={() => handleExport("prompts")}
                className="settings-btn settings-btn-primary"
                style={{ padding: "6px 16px" }}>
                {t("export") || ""}
              </button>
            </div>

            {/*  */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px",
                background: "var(--gh-bg-secondary)",
                borderRadius: "8px",
              }}>
              <div>
                <div style={{ fontWeight: 500, fontSize: "14px" }}>
                  {t("settingsBackup") || ""}
                </div>
                <div style={{ fontSize: "12px", color: "var(--gh-text-secondary)" }}>
                  {t("settingsBackupDesc") || ""}
                </div>
              </div>
              <button
                onClick={() => handleExport("settings")}
                className="settings-btn settings-btn-secondary"
                style={{ padding: "6px 16px" }}>
                {t("export") || ""}
              </button>
            </div>
          </div>
        </SettingCard>

        {/*  */}
        <SettingCard
          title={t("importData") || ""}
          description={t("importDataDesc") || ""}>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {/*  */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: "14px", fontWeight: 500 }}>
                {t("selectFile") || ""}
              </div>
              <button
                className="settings-btn settings-btn-secondary"
                onClick={() => fileInputRef.current?.click()}
                style={{ padding: "6px 12px" }}>
                {t("browse") || "..."}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  style={{ display: "none" }}
                  onChange={handleFileChange}
                />
              </button>
            </div>

            {/*  */}
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: "12px",
                  color: "var(--gh-text-secondary)",
                  marginBottom: "4px",
                }}>
                {t("dataPreview") || " ()"}
              </div>
              <textarea
                className="settings-input"
                value={pasteContent}
                onChange={(e) => setPasteContent(e.target.value)}
                placeholder={t("pastePlaceholder") || " JSON ..."}
                style={{
                  width: "100%",
                  height: "120px",
                  fontFamily: "monospace",
                  fontSize: "12px",
                  resize: "vertical",
                }}
              />
            </div>

            {/*  */}
            <button
              onClick={handleImportClick}
              className="settings-btn settings-btn-primary"
              style={{ width: "100%", justifyContent: "center", padding: "8px" }}
              disabled={!pasteContent.trim()}>
              {t("importBtn") || ""}
            </button>
          </div>
        </SettingCard>
      </div>

      {/* WebDAV  */}
      <SettingCard
        title={t("webdavConfig") || "WebDAV "}
        description={t("webdavConfigDesc") || " WebDAV "}>
        {/*  */}
        <div
          style={{
            background: "var(--gh-primary-light-bg, rgba(66, 133, 244, 0.05))",
            border: "1px solid var(--gh-primary-border, rgba(66, 133, 244, 0.2))",
            borderRadius: "8px",
            padding: "12px",
            marginBottom: "20px",
            fontSize: "13px",
            color: "var(--gh-primary, #4285f4)",
          }}>
          <div style={{ fontWeight: 600, marginBottom: "4px" }}>
            ℹ️ {t("restoreTip") || ""}
          </div>
          <div style={{ lineHeight: 1.5, opacity: 0.9 }}>{t("restoreTipContent")}</div>
        </div>

        <SettingRow label={t("webdavAddress") || ""}>
          <input
            type="text"
            className="settings-input"
            placeholder="https://dav.example.com/dav/"
            value={webdavForm.url}
            onChange={(e) => setWebdavForm({ ...webdavForm, url: e.target.value })}
            style={{ width: "280px" }}
          />
        </SettingRow>

        <SettingRow label={t("username") || ""}>
          <input
            type="text"
            className="settings-input"
            value={webdavForm.username}
            onChange={(e) => setWebdavForm({ ...webdavForm, username: e.target.value })}
            style={{ width: "280px" }}
          />
        </SettingRow>

        <SettingRow label={t("password") || ""}>
          <input
            type="password"
            className="settings-input"
            value={webdavForm.password}
            onChange={(e) => setWebdavForm({ ...webdavForm, password: e.target.value })}
            style={{ width: "280px" }}
          />
        </SettingRow>

        <SettingRow label={t("defaultDir") || ""}>
          <input
            type="text"
            className="settings-input"
            placeholder="ophel"
            value={webdavForm.remoteDir}
            onChange={(e) => setWebdavForm({ ...webdavForm, remoteDir: e.target.value })}
            style={{ width: "280px" }}
          />
        </SettingRow>

        <div
          style={{
            marginTop: "16px",
            paddingTop: "16px",
            borderTop: "1px solid var(--gh-border)",
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
            alignItems: "center",
          }}>
          <button
            className="settings-btn settings-btn-primary"
            onClick={handleSaveConfig}
            style={{ padding: "6px 20px" }}>
            💾 {t("saveConfig") || ""}
          </button>
          <div
            style={{
              width: "1px",
              height: "20px",
              background: "var(--gh-border)",
              margin: "0 8px",
            }}></div>
          <button className="settings-btn settings-btn-secondary" onClick={testWebDAVConnection}>
            🔗 {t("webdavTestBtn") || ""}
          </button>
          <button
            className="settings-btn settings-btn-secondary"
            onClick={async () => {
              await checkAndRequestWebDAVPermission(async () => {
                // 
                const manager = getWebDAVSyncManager()
                await manager.setConfig(webdavForm, false)
                setShowRemoteBackups(true)
              })
            }}>
            📂 {t("restore") || "/"}
          </button>
          <button
            className="settings-btn settings-btn-success"
            onClick={uploadToWebDAV}
            style={{ marginLeft: "auto" }}>
            ☁️ {t("backupNow") || ""}
          </button>
        </div>
      </SettingCard>

      {/*  */}
      <SettingCard
        title={t("dangerZone") || ""}
        description={t("dangerZoneDesc") || ""}
        className="danger-zone-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div
              style={{
                fontSize: "14px",
                fontWeight: 500,
                color: "var(--gh-danger, #ef4444)",
              }}>
              {t("clearAllData") || ""}
            </div>
            <div style={{ fontSize: "12px", color: "var(--gh-text-secondary)" }}>
              {t("clearAllDataDesc") || ""}
            </div>
          </div>
          <button
            className="settings-btn settings-btn-danger"
            onClick={handleClearAll}
            style={{ padding: "8px 16px", fontSize: "13px" }}>
            {t("clearAllData") || ""}
          </button>
        </div>
      </SettingCard>
    </div>
  )
}

export default BackupPage
