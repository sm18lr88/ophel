/**
 * 
 * 
 */
import React, { useCallback, useEffect, useMemo, useState } from "react"

import { PermissionsIcon } from "~components/icons"
import { ConfirmDialog } from "~components/ui"
import { useSettingsStore } from "~stores/settings-store"
import { t } from "~utils/i18n"
import {
  MSG_CHECK_PERMISSIONS,
  MSG_REQUEST_PERMISSIONS,
  MSG_REVOKE_PERMISSIONS,
  sendToBackground,
} from "~utils/messaging"
import { getWebDavPermissionOrigin, sanitizeErrorMessage } from "~utils/network-security"
import { showToast } from "~utils/toast"

import { PageTitle, SettingCard, SettingRow } from "../components"

//  manifest 
const REQUIRED_PERMISSIONS = [
  {
    id: "storage",
    name: "",
    nameKey: "permissionStorage",
    description: "permissionStorageDesc",
    icon: "💾",
  },
]

// 
const OPTIONAL_PERMISSIONS = [
  {
    id: "notifications",
    name: "",
    nameKey: "permissionNotifications",
    description: "permissionNotificationsDesc",
    icon: "🔔",
    permissions: ["notifications"],
  },
  {
    id: "cookies",
    name: "Cookie",
    nameKey: "permissionCookies",
    description: "permissionCookiesDesc",
    icon: "🍪",
    permissions: ["cookies"],
  },
]

interface PermissionsPageProps {
  siteId: string
}

const PermissionsPage: React.FC<PermissionsPageProps> = () => {
  const { settings, updateNestedSetting, setSettings } = useSettingsStore()
  // 
  const [optionalPermissionStatus, setOptionalPermissionStatus] = useState<Record<string, boolean>>(
    {},
  )
  const [loading, setLoading] = useState(true)

  // 
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    message: React.ReactNode
    onConfirm: () => void
  }>({
    open: false,
    message: "",
    onConfirm: () => {},
  })

  //  API
  // content script  chrome.permissions  undefined
  const isExtensionPage = typeof chrome.permissions !== "undefined"
  const webdavOrigin =
    settings?.webdav?.url && settings.webdav.url.trim()
      ? (() => {
          try {
            return getWebDavPermissionOrigin(settings.webdav.url)
          } catch {
            return ""
          }
        })()
      : ""

  const optionalHostPermissions = useMemo(
    () => [
      {
        id: "webdav",
        name: "WebDAV Access",
        nameKey: "permissionWebdavAccess",
        description: webdavOrigin
          ? "permissionWebdavAccessDesc"
          : "Configure a valid HTTPS WebDAV URL before requesting access.",
        icon: "☁️",
        origins: webdavOrigin ? [webdavOrigin] : [],
      },
    ],
    [webdavOrigin],
  )

  // 
  const checkOptionalPermissions = useCallback(async () => {
    setLoading(true)
    const status: Record<string, boolean> = {}

    // 
    for (const perm of OPTIONAL_PERMISSIONS) {
      try {
        let result = false
        if (isExtensionPage) {
          result = await chrome.permissions.contains({
            permissions: perm.permissions || [],
          })
        } else {
          const response = await sendToBackground({
            type: MSG_CHECK_PERMISSIONS,
            permissions: perm.permissions || [],
          })
          if (response && response.success) {
            result = response.hasPermission
          }
        }
        status[perm.id] = result
      } catch (e) {
        console.error(` ${perm.id} :`, e)
        status[perm.id] = false
      }
    }

    // 
    for (const perm of optionalHostPermissions) {
      try {
        if (!perm.origins?.length) {
          status[perm.id] = false
          continue
        }

        let result = false
        if (isExtensionPage) {
          result = await chrome.permissions.contains({
            origins: perm.origins || [],
          })
        } else {
          const response = await sendToBackground({
            type: MSG_CHECK_PERMISSIONS,
            origins: perm.origins || [],
          })
          if (response && response.success) {
            result = response.hasPermission
          }
        }
        status[perm.id] = result
      } catch (e) {
        console.error(` ${perm.id} :`, sanitizeErrorMessage(e))
        status[perm.id] = false
      }
    }

    setOptionalPermissionStatus(status)
    setLoading(false)
  }, [isExtensionPage, optionalHostPermissions])

  // 
  const requestPermission = useCallback(
    async (perm: { id: string; origins?: string[]; permissions?: string[] }) => {
      try {
        if ((!perm.origins || perm.origins.length === 0) && (!perm.permissions || perm.permissions.length === 0)) {
          showToast("Configure a valid HTTPS WebDAV URL first.", 2500)
          return
        }

        if (isExtensionPage) {
          const granted = await chrome.permissions.request({
            origins: perm.origins?.length ? perm.origins : undefined,
            permissions: perm.permissions?.length ? perm.permissions : undefined,
          })

          if (granted) {
            setOptionalPermissionStatus((prev) => ({ ...prev, [perm.id]: true }))
          }
        } else {
          // Content Script 
          await sendToBackground({
            type: MSG_REQUEST_PERMISSIONS,
            permType: perm.id,
            origins: perm.origins,
            permissions: perm.permissions,
          })
          // 
          setTimeout(() => checkOptionalPermissions(), 2000)
        }
      } catch (e) {
        console.error(` ${perm.id} :`, sanitizeErrorMessage(e))
      }
    },
    [isExtensionPage, checkOptionalPermissions],
  )

  // 
  useEffect(() => {
    checkOptionalPermissions()

    //  (auto_request)
    // 
    if (isExtensionPage && typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search)
      if (urlParams.get("auto_request") === "true") {
        // 
        setTimeout(() => {
          //  all_urls
          //  ID
          const perm = optionalHostPermissions[0]
          if (perm) {
            requestPermission(perm)
          }
        }, 500)
      }
    }
  }, [checkOptionalPermissions, isExtensionPage, optionalHostPermissions, requestPermission])

  // 
  const executeRevoke = async (perm: {
    id: string
    origins?: string[]
    permissions?: string[]
  }) => {
    try {
      let removed = false
      if (isExtensionPage) {
        removed = await chrome.permissions.remove({
          origins: perm.origins?.length ? perm.origins : undefined,
          permissions: perm.permissions?.length ? perm.permissions : undefined,
        })
      } else {
        const response = await sendToBackground({
          type: MSG_REVOKE_PERMISSIONS,
          origins: perm.origins,
          permissions: perm.permissions,
        })
        if (response && response.success) {
          removed = response.removed
        }
      }

      if (removed) {
        setOptionalPermissionStatus((prev) => ({ ...prev, [perm.id]: false }))

        // 
        if (perm.id === "notifications") {
          updateNestedSetting("tab", "showNotification", false)
        } else if (perm.id === "webdav") {
          setSettings({
            webdav: {
              enabled: false,
              url: settings?.webdav?.url || "",
              username: settings?.webdav?.username || "",
              password: settings?.webdav?.password || "",
              syncMode: settings?.webdav?.syncMode || "manual",
              syncInterval: settings?.webdav?.syncInterval || 30,
              remoteDir: settings?.webdav?.remoteDir || "ophel",
            },
          })
        }
      }
    } catch (e) {
      console.error(` ${perm.id} :`, sanitizeErrorMessage(e))
    } finally {
      setConfirmDialog((prev) => ({ ...prev, open: false }))
    }
  }

  // 
  const handleRevokeClick = (perm: { id: string; origins?: string[]; permissions?: string[] }) => {
    let confirmMsg =
      t("revokeConfirmDefault") || ""

    if (perm.id === "notifications") {
      confirmMsg =
        t("revokeConfirmNotifications") ||
        "\n\n"
    } else if (perm.id === "webdav") {
      confirmMsg =
        t("revokeConfirmWebdav") ||
        "Are you sure you want to revoke WebDAV access?\n\nWebDAV sync will be disabled until you grant the server origin again."
    }

    setConfirmDialog({
      open: true,
      message: <div style={{ whiteSpace: "pre-wrap" }}>{confirmMsg}</div>,
      onConfirm: () => executeRevoke(perm),
    })
  }

  return (
    <div>
      <PageTitle title={t("navPermissions") || ""} Icon={PermissionsIcon} />
      <p className="settings-page-desc">{t("permissionsPageDesc") || ""}</p>

      {/*  */}
      <SettingCard
        title={t("optionalPermissions") || ""}
        description={t("optionalPermissionsDesc") || ""}>
        {/*  +  */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
            paddingBottom: "12px",
            borderBottom: "1px solid var(--gh-border, #e5e7eb)",
          }}>
          <span style={{ fontSize: "13px", color: "var(--gh-text-secondary, #9ca3af)" }}>
            {t("permissionsSyncHint") || ""}
          </span>
          <button
            className="settings-btn settings-btn-secondary"
            onClick={async (e) => {
              e.preventDefault()
              e.stopPropagation()
              await checkOptionalPermissions()
              showToast(t("permissionsRefreshed") || "", 1500)
            }}
            disabled={loading}
            style={{ fontSize: "12px", padding: "4px 12px", flexShrink: 0 }}>
            {loading ? t("refreshing") || "..." : t("refreshStatus") || ""}
          </button>
        </div>

        {[...OPTIONAL_PERMISSIONS, ...optionalHostPermissions].map((perm, index, arr) => (
          <SettingRow
            key={perm.id}
            label={
              <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "18px" }}>{perm.icon}</span>
                <span>{t(perm.nameKey) || perm.name}</span>
              </span>
            }
            description={t(perm.description) || perm.description}
            style={index === arr.length - 1 ? { borderBottom: "none" } : {}}>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              {optionalPermissionStatus[perm.id] ? (
                <>
                  <span
                    style={{
                      padding: "4px 10px",
                      borderRadius: "4px",
                      fontSize: "12px",
                      background: "rgba(16, 185, 129, 0.1)",
                      color: "#10b981",
                    }}>
                    {t("granted") || ""}
                  </span>
                  <button
                    className="settings-btn settings-btn-secondary"
                    style={{ padding: "4px 12px", fontSize: "12px" }}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleRevokeClick(perm)
                    }}>
                    {t("revoke") || ""}
                  </button>
                </>
              ) : (
                <>
                  <span
                    style={{
                      padding: "4px 10px",
                      borderRadius: "4px",
                      fontSize: "12px",
                      background: "rgba(239, 68, 68, 0.1)",
                      color: "#ef4444",
                    }}>
                    {t("notGranted") || ""}
                  </span>
                  <button
                    className="settings-btn settings-btn-primary"
                    style={{ padding: "4px 12px", fontSize: "12px" }}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      requestPermission(perm)
                    }}>
                    {t("allowRecommended") || ""}
                  </button>
                </>
              )}
            </div>
          </SettingRow>
        ))}
      </SettingCard>

      {/*  */}
      <SettingCard
        title={t("requiredPermissions") || ""}
        description={t("requiredPermissionsDesc") || ""}>
        {REQUIRED_PERMISSIONS.map((perm, index) => (
          <SettingRow
            key={perm.id}
            label={
              <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "18px" }}>{perm.icon}</span>
                <span>{t(perm.nameKey) || perm.name}</span>
              </span>
            }
            description={t(perm.description) || perm.description}
            style={index === REQUIRED_PERMISSIONS.length - 1 ? { borderBottom: "none" } : {}}>
            <span
              style={{
                padding: "4px 10px",
                borderRadius: "4px",
                fontSize: "12px",
                background: "rgba(107, 114, 128, 0.1)",
                color: "var(--gh-text-secondary, #6b7280)",
              }}>
              {t("required") || ""}
            </span>
          </SettingRow>
        ))}
      </SettingCard>

      {/*  */}
      {confirmDialog.open && (
        <ConfirmDialog
          title={t("warning") || ""}
          message={confirmDialog.message}
          confirmText={t("confirm") || ""}
          cancelText={t("cancel") || ""}
          danger={true}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
        />
      )}
    </div>
  )
}

export default PermissionsPage
