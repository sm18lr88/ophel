/**
 * Minimal permission request page
 * Dedicated to requesting optional permissions, small size (400x300), auto-closes after authorization
 *
 * URL parameters:
 * - type: webdav | tabs | notifications | watermark
 */
import React, { useEffect, useState } from "react"

import { useSettingsHydrated, useSettingsStore } from "~stores/settings-store"
import { setLanguage, t } from "~utils/i18n"
import { sanitizeErrorMessage } from "~utils/network-security"

import "~styles/settings.css"

// Inject page-level styles to hide scrollbar
const PERM_PAGE_STYLES = `
  html, body {
    overflow: hidden !important;
    margin: 0;
    padding: 0;
    height: 100%;
  }
`

// Permission configuration
const PERMISSION_CONFIGS = {
  webdav: {
    titleKey: "permWebdavTitle",
    descKey: "permWebdavDesc",
    origins: [] as string[],
    permissions: [] as string[],
  },
  notifications: {
    titleKey: "permNotifyTitle",
    descKey: "permNotifyDesc",
    origins: [] as string[],
    permissions: ["notifications"],
  },
  cookies: {
    titleKey: "permCookiesTitle",
    descKey: "permCookiesDesc",
    origins: [] as string[],
    permissions: ["cookies"],
  },
}

type PermissionType = keyof typeof PERMISSION_CONFIGS

function parseJsonArrayParam(value: string | null): string[] {
  if (!value) return []

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : []
  } catch {
    return []
  }
}

const PermissionRequestPage: React.FC = () => {
  const [status, setStatus] = useState<"pending" | "granted" | "denied">("pending")
  // Prioritize getting permission type from URL parameters
  const [permType, setPermType] = useState<PermissionType>(() => {
    const params = new URLSearchParams(window.location.search)
    const type = params.get("type") as PermissionType
    return type && type in PERMISSION_CONFIGS ? type : "webdav"
  })
  const [requestedOrigins, setRequestedOrigins] = useState<string[]>([])
  const [requestedPermissions, setRequestedPermissions] = useState<string[]>([])
  const [_langReady, setLangReady] = useState(false)
  const { settings } = useSettingsStore()
  const isHydrated = useSettingsHydrated()

  // Initialize language
  useEffect(() => {
    if (isHydrated) {
      if (settings?.language) {
        setLanguage(settings.language)
      }
      // Mark as ready after language setup, trigger re-render
      setLangReady(true)
    }
  }, [isHydrated, settings?.language])

  // Inject page-level styles (hide scrollbar)
  useEffect(() => {
    const style = document.createElement("style")
    style.textContent = PERM_PAGE_STYLES
    document.head.appendChild(style)
    return () => {
      document.head.removeChild(style)
    }
  }, [])

  // Parse URL parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const type = params.get("type") as PermissionType
    if (type && PERMISSION_CONFIGS[type]) {
      setPermType(type)
    }
    setRequestedOrigins(parseJsonArrayParam(params.get("origins")))
    setRequestedPermissions(parseJsonArrayParam(params.get("permissions")))
  }, [])

  const config = PERMISSION_CONFIGS[permType]
  const origins = requestedOrigins.length > 0 ? requestedOrigins : config.origins
  const permissions = requestedPermissions.length > 0 ? requestedPermissions : config.permissions
  const primaryOrigin = origins[0]?.replace(/\/\*$/, "")
  const description =
    permType === "webdav" && primaryOrigin
      ? `${t(config.descKey) || "WebDAV sync needs access to your server. Backup and restore will be available after authorization."}\n\n${primaryOrigin}`
      : t(config.descKey) || "This feature requires additional permission."

  // Request permission
  const handleRequest = async () => {
    try {
      console.warn("[PermRequest] Requesting permissions:", {
        origins,
        permissions,
      })
      const granted = await chrome.permissions.request({
        origins: origins.length > 0 ? origins : undefined,
        permissions: permissions.length > 0 ? permissions : undefined,
      })

      console.warn("[PermRequest] Permission granted:", granted)
      if (granted) {
        setStatus("granted")
        // Delay window close
        setTimeout(() => {
          window.close()
        }, 1500)
      } else {
        setStatus("denied")
        // Close window on denial
        setTimeout(() => {
          window.close()
        }, 1000)
      }
    } catch (e) {
      console.error("[PermRequest] Permission request failed:", sanitizeErrorMessage(e))
      setStatus("denied")
      setTimeout(() => {
        window.close()
      }, 1000)
    }
  }

  // Cancel
  const handleCancel = () => {
    setStatus("denied")
    setTimeout(() => {
      window.close()
    }, 500)
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--gh-bg, #ffffff)",
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        padding: "20px",
        overflow: "hidden",
      }}>
      <div
        style={{
          textAlign: "center",
          maxWidth: "320px",
        }}>
        {status === "pending" && (
          <>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔐</div>

            <h1
              style={{
                fontSize: "18px",
                fontWeight: 600,
                marginBottom: "12px",
                color: "var(--gh-text, #1f2937)",
              }}>
              {t(config.titleKey) || "Authorization required"}
            </h1>

            <p
              style={{
                fontSize: "14px",
                color: "var(--gh-text-secondary, #6b7280)",
                marginBottom: "24px",
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
              }}>
              {description}
            </p>

            {/*  */}
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button
                onClick={handleCancel}
                style={{
                  padding: "10px 24px",
                  borderRadius: "8px",
                  border: "1px solid var(--gh-border, #e5e7eb)",
                  background: "transparent",
                  color: "var(--gh-text-secondary, #6b7280)",
                  fontSize: "14px",
                  cursor: "pointer",
                }}>
                {t("cancel") || "Cancel"}
              </button>
              <button
                onClick={handleRequest}
                style={{
                  padding: "10px 24px",
                  borderRadius: "8px",
                  border: "none",
                  background: "var(--gh-primary, #4285f4)",
                  color: "white",
                  fontSize: "14px",
                  fontWeight: 500,
                  cursor: "pointer",
                }}>
                {t("allow") || "Allow"}
              </button>
            </div>
          </>
        )}

        {status === "granted" && (
          <>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>✅</div>
            <h1
              style={{
                fontSize: "18px",
                fontWeight: 600,
                color: "#10b981",
              }}>
              {t("permissionGranted") || "Authorization successful"}
            </h1>
            <p
              style={{
                fontSize: "14px",
                color: "var(--gh-text-secondary, #6b7280)",
                marginTop: "8px",
              }}>
              {t("windowClosing") || "Window closing..."}
            </p>
          </>
        )}

        {status === "denied" && (
          <>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>❌</div>
            <h1
              style={{
                fontSize: "18px",
                fontWeight: 600,
                color: "#ef4444",
              }}>
              {t("permissionDenied") || "Authorization cancelled"}
            </h1>
          </>
        )}
      </div>
    </div>
  )
}

export default PermissionRequestPage
