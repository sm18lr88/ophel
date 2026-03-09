/**
 * Claude 
 *  SessionKey 
 */
import React, { useState } from "react"

import { CopyIcon } from "~components/icons"
import { ConfirmDialog, DialogOverlay, InputDialog, Tooltip } from "~components/ui"
import {
  BATCH_TEST_CONFIG,
  SITE_IDS,
  STATUS_COLORS,
  TOAST_DURATION,
  VALIDATION_PATTERNS,
} from "~constants"
import { platform } from "~platform"
import { useClaudeSessionKeysStore } from "~stores/claude-sessionkeys-store"
import { t } from "~utils/i18n"
import type { ClaudeSessionKey } from "~utils/storage"
import {
  MSG_CHECK_CLAUDE_GENERATING,
  MSG_CHECK_PERMISSIONS,
  MSG_REQUEST_PERMISSIONS,
  sendToBackground,
} from "~utils/messaging"
import { showToast } from "~utils/toast"

import { SettingCard } from "../components"

interface ClaudeSettingsProps {
  siteId: string
}

// 
type DialogState =
  | { type: "none" }
  | { type: "add" }
  | { type: "import-name"; sessionKey: string }
  | { type: "delete"; id: string; name: string }

const isClaudeSessionKey = (value: unknown): value is ClaudeSessionKey => {
  if (typeof value !== "object" || value === null) return false
  const record = value as Record<string, unknown>
  return (
    typeof record.id === "string" &&
    typeof record.name === "string" &&
    typeof record.key === "string" &&
    typeof record.createdAt === "number"
  )
}

const ClaudeSettings: React.FC<ClaudeSettingsProps> = ({ siteId }) => {
  const { keys, currentKeyId, addKey, deleteKey, setCurrentKey, testKey, setKeys } =
    useClaudeSessionKeysStore()
  const [testing, setTesting] = useState<Record<string, boolean>>({})
  const [dialog, setDialog] = useState<DialogState>({ type: "none" })
  const [hoveredKeyId, setHoveredKeyId] = useState<string | null>(null)
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null)

  const [isBatchTesting, setIsBatchTesting] = useState(false)
  const [batchProgress, setBatchProgress] = useState("")

  const isClaudeSite = siteId === SITE_IDS.CLAUDE

  //  Session Key
  const currentKey = keys.find((k) => k.id === currentKeyId)

  // 
  const closeDialog = () => setDialog({ type: "none" })

  //  Session Key
  const handleCopyKey = async (keyId: string, keyValue: string) => {
    try {
      await navigator.clipboard.writeText(keyValue)
      setCopiedKeyId(keyId)
      showToast(t("claudeKeyCopied"), TOAST_DURATION.SHORT)
      // 1.5
      setTimeout(() => setCopiedKeyId(null), TOAST_DURATION.SHORT)
    } catch {
      showToast(t("claudeKeyCopyFailed"), TOAST_DURATION.SHORT)
    }
  }

  //  Session Key
  const handleSwitchToken = async (keyId: string) => {
    // 
    if (!keyId) {
      showToast(t("claudePleaseSelectKey"), TOAST_DURATION.SHORT)
      return
    }

    // 
    if (keyId === currentKeyId) {
      showToast(t("claudeAlreadyUsing"), TOAST_DURATION.SHORT)
      return
    }

    // 1. cookies ()
    if (platform.hasCapability("permissions")) {
      const checkResult = await sendToBackground({
        type: MSG_CHECK_PERMISSIONS,
        permissions: ["cookies"],
      })

      if (!checkResult.hasPermission) {
        await sendToBackground({
          type: MSG_REQUEST_PERMISSIONS,
          permType: "cookies",
        })
        showToast(t("claudeRequestPermission"), TOAST_DURATION.LONG)
        return
      }
    }

    // 2. cookie
    const key = keyId ? keys.find((k) => k.id === keyId)?.key : ""
    await platform.setClaudeSessionKey(key || "")

    // 3. 
    setCurrentKey(keyId)
    showToast(t("claudeKeySwitched"), TOAST_DURATION.MEDIUM)
  }

  //  Key 
  const performTestKey = async (
    id: string,
    keyName: string,
    keyValue: string,
    showToastMsg: boolean = true,
  ) => {
    // 
    if (platform.hasCapability("tabs")) {
      try {
        const checkResult = await sendToBackground({
          type: MSG_CHECK_CLAUDE_GENERATING,
        })
        if (checkResult.isGenerating) {
          if (showToastMsg) showToast(t("claudeGenerating"), TOAST_DURATION.LONG)
          return false // 
        }
      } catch {
        // 
      }
    }

    setTesting((prev) => ({ ...prev, [id]: true }))

    try {
      //  key
      const result = await platform.testClaudeSessionKey(keyValue)

      if (result.isValid) {
        testKey(id, { isValid: true, accountType: result.accountType })
        if (showToastMsg) showToast(`${keyName}: ${result.accountType}`, TOAST_DURATION.MEDIUM)
        return true
      } else {
        testKey(id, { isValid: false })
        if (showToastMsg) showToast(`${keyName}: ${t("claudeKeyInvalid")}`, TOAST_DURATION.MEDIUM)
        return false
      }
    } catch {
      testKey(id, { isValid: false })
      if (showToastMsg)
        showToast(
          `${keyName}: ${t("claudeKeyTest")} ${t("claudeKeyInvalid")}`,
          TOAST_DURATION.MEDIUM,
        )
      return false
    } finally {
      setTesting((prev) => ({ ...prev, [id]: false }))
    }
  }

  //  Session Key 
  const handleTestToken = async (id: string) => {
    const key = keys.find((k) => k.id === id)
    if (!key) return
    await performTestKey(id, key.name, key.key, true)
  }

  // 
  const handleBatchTest = async () => {
    if (keys.length === 0) return
    if (isBatchTesting) return

    setIsBatchTesting(true)
    let validCount = 0
    let invalidCount = 0

    try {
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i]
        // 
        setBatchProgress(
          t("claudeBatchTesting")
            .replace("{current}", String(i + 1))
            .replace("{total}", String(keys.length)),
        )

        // Toast
        const isValid = await performTestKey(key.id, key.name, key.key, false)
        if (isValid) validCount++
        else invalidCount++

        //  500ms
        if (i < keys.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, BATCH_TEST_CONFIG.INTERVAL_MS))
        }
      }
      showToast(
        t("claudeBatchTestDone")
          .replace("{valid}", String(validCount))
          .replace("{invalid}", String(invalidCount)),
        TOAST_DURATION.LONG,
      )
    } catch {
      showToast(t("claudeBatchTestFailed"), TOAST_DURATION.MEDIUM)
    } finally {
      setIsBatchTesting(false)
      setBatchProgress("")
    }
  }

  // Cookie
  const handleImportFromBrowser = async () => {
    try {
      // 
      if (platform.hasCapability("permissions")) {
        const checkResult = await sendToBackground({
          type: MSG_CHECK_PERMISSIONS,
          permissions: ["cookies"],
        })

        if (!checkResult.hasPermission) {
          await sendToBackground({
            type: MSG_REQUEST_PERMISSIONS,
            permType: "cookies",
          })
          showToast(t("claudeRequestPermission"), TOAST_DURATION.LONG)
          return
        }
      }

      //  session key
      const result = await platform.getClaudeSessionKey()

      if (!result.success) {
        showToast(result.error || t("claudeNoCookieFound"), TOAST_DURATION.MEDIUM)
        return
      }

      const existingKey = keys.find((k) => k.key === result.sessionKey)
      if (existingKey) {
        showToast(t("claudeTokenExists").replace("{name}", existingKey.name), TOAST_DURATION.MEDIUM)
        return
      }

      setDialog({
        type: "import-name",
        sessionKey: result.sessionKey!,
      })
    } catch (error) {
      showToast(t("claudeKeyCopyFailed") + ": " + (error as Error).message, TOAST_DURATION.LONG)
    }
  }

  //  Session Key
  const handleExportTokens = () => {
    if (keys.length === 0) {
      showToast(t("claudeNoTokensToExport"), TOAST_DURATION.SHORT)
      return
    }

    const data = JSON.stringify(keys, null, 2)
    const blob = new Blob([data], { type: "application/json" })
    const url = URL.createObjectURL(blob)

    const a = document.createElement("a")
    a.href = url
    a.download = `claude-session-keys-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    showToast(t("claudeExported"), TOAST_DURATION.SHORT)
  }

  //  Session Key
  const handleImportTokens = () => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "application/json"
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      try {
        const text = await file.text()
        const imported = JSON.parse(text)

        if (!Array.isArray(imported)) {
          showToast(t("claudeInvalidJSON"), TOAST_DURATION.MEDIUM)
          return
        }

        const existingKeys = new Set(keys.map((k) => k.key))
        const newKeys = imported.filter(isClaudeSessionKey).filter((k) => !existingKeys.has(k.key))

        if (newKeys.length === 0) {
          showToast(t("claudeNoNewTokens"), TOAST_DURATION.SHORT)
          return
        }

        setKeys([...keys, ...newKeys])
        showToast(
          t("claudeImported").replace("{count}", String(newKeys.length)),
          TOAST_DURATION.MEDIUM,
        )
      } catch (error) {
        showToast(t("claudeInvalidJSON") + ": " + (error as Error).message, TOAST_DURATION.LONG)
      }
    }
    input.click()
  }

  //  Session Key
  const handleAddToken = () => {
    setDialog({ type: "add" })
  }

  //  Session Key - 
  const handleAddTokenConfirm = (name: string, key: string) => {
    if (!name.trim()) {
      showToast(t("claudeNameRequired"), TOAST_DURATION.SHORT)
      return
    }

    if (!key.trim()) {
      showToast(t("claudeKeyRequired"), TOAST_DURATION.SHORT)
      return
    }

    if (!VALIDATION_PATTERNS.CLAUDE_KEY.test(key)) {
      showToast(t("claudeKeyInvalidFormat"), TOAST_DURATION.MEDIUM)
      return
    }

    if (keys.some((k) => k.key === key)) {
      showToast(t("claudeKeyExists"), TOAST_DURATION.MEDIUM)
      return
    }

    addKey({ name: name.trim(), key: key.trim() })
    showToast(t("claudeKeyAdded"), TOAST_DURATION.SHORT)
    closeDialog()
  }

  //  - 
  const handleImportComplete = (name: string) => {
    if (!name.trim()) {
      showToast(t("claudeNameRequired"), TOAST_DURATION.SHORT)
      return
    }

    const dialogState = dialog as { type: "import-name"; sessionKey: string }
    const newKey = addKey({ name: name.trim(), key: dialogState.sessionKey })

    //  key
    setCurrentKey(newKey.id)

    showToast(t("claudeKeyImported"), TOAST_DURATION.SHORT)
    closeDialog()
    setTimeout(() => handleTestToken(newKey.id), BATCH_TEST_CONFIG.INTERVAL_MS)
  }

  //  Session Key
  const handleDeleteToken = (id: string, name: string) => {
    setDialog({ type: "delete", id, name })
  }

  const confirmDelete = () => {
    const dialogState = dialog as { type: "delete"; id: string; name: string }
    deleteKey(dialogState.id)
    showToast(t("claudeKeyDeleted"), TOAST_DURATION.SHORT)
    closeDialog()
  }

  // 
  const renderStatusBadge = (isValid: boolean | undefined) => {
    if (isValid === undefined) return <span style={{ color: STATUS_COLORS.INFO }}>-</span>
    return isValid ? (
      <span style={{ color: STATUS_COLORS.SUCCESS, fontWeight: 500 }}>✓ {t("claudeKeyValid")}</span>
    ) : (
      <span style={{ color: STATUS_COLORS.ERROR, fontWeight: 500 }}>✗ {t("claudeKeyInvalid")}</span>
    )
  }

  // 
  const renderTypeBadge = (type: string | undefined) => {
    if (!type)
      return <span style={{ color: "var(--gh-text-secondary)" }}>{t("claudeKeyUntested")}</span>
    return (
      <span
        style={{
          padding: "2px 8px",
          borderRadius: "4px",
          fontSize: "11px",
          fontWeight: 500,
          backgroundColor: "var(--gh-bg-secondary)",
        }}>
        {type}
      </span>
    )
  }

  return (
    <div>
      {/* Session Key  */}
      <SettingCard
        title={t("claudeSessionKeyTitle")}
        description={t("claudeSessionKeyDesc")}
        settingId="claude-session-keys">
        {/*  */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px",
            marginBottom: "20px",
            backgroundColor: "var(--gh-bg-secondary)",
            borderRadius: "12px",
            border: "1px solid var(--gh-border)",
            flexWrap: "wrap",
            gap: "12px",
          }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: "1 1 auto" }}>
            <span style={{ fontSize: "13px", color: "var(--gh-text-secondary)" }}>
              {t("claudeCurrentUsing")}
            </span>
            <span
              style={{
                fontSize: "14px",
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}>
              {currentKey ? (
                <>
                  <span style={{ fontWeight: 600 }}>🔑 {currentKey.name}</span>
                  {currentKey.accountType && (
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: "12px",
                        fontSize: "11px",
                        fontWeight: 500,
                        backgroundColor: "var(--gh-bg)",
                        border: "1px solid var(--gh-border)",
                        color: "var(--gh-text-secondary)",
                      }}>
                      {currentKey.accountType}
                    </span>
                  )}
                </>
              ) : (
                <span style={{ color: "var(--gh-text-secondary)" }}>
                  {t("claudeNoKeySelected")}
                </span>
              )}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            {!isClaudeSite && (
              <div
                style={{
                  color: "#ca8a04", // 
                  backgroundColor: "rgba(234, 179, 8, 0.1)",
                  fontSize: "12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 10px",
                  borderRadius: "6px",
                  border: "1px solid rgba(234, 179, 8, 0.2)",
                  whiteSpace: "nowrap",
                }}>
                <span>⚠️</span>
                <span>{t("claudeNotOnSiteHint")}</span>
              </div>
            )}
            {/*  */}
            <Tooltip
              content={
                !isClaudeSite ? t("claudeNotOnSiteHint") || " Claude " : ""
              }>
              <select
                className="settings-select"
                value={currentKeyId}
                onChange={(e) => handleSwitchToken(e.target.value)}
                disabled={!isClaudeSite || keys.length === 0 || isBatchTesting}
                style={{
                  minWidth: "200px",
                  padding: "8px 12px",
                  fontSize: "13px",
                  borderRadius: "8px",
                  opacity: !isClaudeSite || keys.length === 0 || isBatchTesting ? 0.6 : 1,
                  cursor: !isClaudeSite || isBatchTesting ? "not-allowed" : "pointer",
                  backgroundColor: "var(--gh-bg)",
                  border: "1px solid var(--gh-border)",
                  color: "var(--gh-text)",
                }}>
                {keys.length === 0 ? (
                  <option value="">{t("claudePleaseAddKey")}</option>
                ) : (
                  keys.map((k) => (
                    <option key={k.id} value={k.id}>
                      🔑 {k.name} {k.accountType ? `(${k.accountType})` : ""}
                    </option>
                  ))
                )}
              </select>
            </Tooltip>
          </div>
        </div>

        {/*  */}
        <div
          style={{
            display: "flex", //  Flex 
            gap: "10px", // 
            marginBottom: "20px",
            flexWrap: "nowrap", // 
          }}>
          <button
            className="settings-btn settings-btn-primary"
            onClick={handleAddToken}
            disabled={isBatchTesting}
            style={{
              justifyContent: "center",
              padding: "8px 12px", // 
              flex: "1 1 auto", // 
              opacity: isBatchTesting ? 0.6 : 1,
              whiteSpace: "nowrap", // 
            }}>
            ➕ {t("claudeAddKey")}
          </button>

          <button
            className="settings-btn settings-btn-secondary"
            onClick={handleBatchTest}
            disabled={keys.length === 0 || isBatchTesting}
            style={{
              justifyContent: "center",
              padding: "8px 12px",
              flex: "1 1 auto",
              opacity: keys.length === 0 || isBatchTesting ? 0.6 : 1,
              backgroundColor: isBatchTesting ? "rgba(var(--gh-primary-rgb), 0.1)" : undefined,
              color: isBatchTesting ? "var(--gh-primary)" : undefined,
              borderColor: isBatchTesting ? "var(--gh-primary)" : undefined,
              whiteSpace: "nowrap",
            }}>
            {isBatchTesting ? (
              <>
                <div
                  style={{
                    marginRight: "8px",
                    width: "14px",
                    height: "14px",
                    border: "2px solid currentColor",
                    borderTopColor: "transparent",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite",
                  }}
                />
                {batchProgress}
              </>
            ) : (
              <>⚡ {t("claudeBatchTest")}</>
            )}
          </button>

          {/*  HttpOnly cookie */}
          {platform.hasCapability("cookies") && (
            <Tooltip content={!isClaudeSite ? t("claudeNotOnSiteHint") : ""}>
              <button
                className="settings-btn settings-btn-secondary"
                onClick={handleImportFromBrowser}
                disabled={!isClaudeSite || isBatchTesting}
                style={{
                  justifyContent: "center",
                  padding: "8px 12px",
                  flex: "1 1 auto",
                  opacity: !isClaudeSite || isBatchTesting ? 0.6 : 1,
                  backgroundColor: isClaudeSite ? "var(--gh-bg)" : "var(--gh-bg-secondary)",
                  color: isClaudeSite ? "var(--gh-primary)" : "var(--gh-text-secondary)",
                  borderColor: isClaudeSite ? "var(--gh-primary)" : "var(--gh-border)",
                  whiteSpace: "nowrap",
                }}>
                🌐 {t("claudeImportFromBrowser")}
              </button>
            </Tooltip>
          )}
          <button
            className="settings-btn settings-btn-secondary"
            onClick={handleImportTokens}
            disabled={isBatchTesting}
            style={{
              justifyContent: "center",
              padding: "8px 12px",
              flex: "1 1 auto",
              opacity: isBatchTesting ? 0.6 : 1,
              whiteSpace: "nowrap",
            }}>
            📥 {t("claudeImportJSON")}
          </button>
          <button
            className="settings-btn settings-btn-secondary"
            onClick={handleExportTokens}
            disabled={keys.length === 0 || isBatchTesting}
            style={{
              justifyContent: "center",
              padding: "8px 12px",
              flex: "1 1 auto",
              opacity: keys.length === 0 || isBatchTesting ? 0.6 : 1,
              whiteSpace: "nowrap",
            }}>
            📤 {t("claudeExportJSON")}
          </button>
        </div>

        {/* Token  */}
        {keys.length === 0 ? (
          <div
            style={{
              padding: "48px 24px",
              textAlign: "center",
              color: "var(--gh-text-secondary)",
              backgroundColor: "var(--gh-bg-secondary)",
              borderRadius: "8px",
              border: "1px dashed var(--gh-border)",
            }}>
            <div style={{ marginBottom: "8px", fontSize: "24px" }}>🔑</div>
            <div>{t("claudeNoKeys")}</div>
            <div style={{ fontSize: "12px", marginTop: "4px" }}>{t("claudeNoKeysHint")}</div>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}>
            {keys.map((key) => {
              const isCurrent = key.id === currentKeyId
              const isHovered = hoveredKeyId === key.id

              return (
                <div
                  key={key.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "16px",
                    padding: "16px 20px",
                    backgroundColor: isCurrent ? "var(--gh-bg)" : "var(--gh-bg-secondary)",
                    borderRadius: "12px",
                    border: isCurrent
                      ? "2px solid var(--gh-primary)"
                      : "1px solid var(--gh-border)",
                    transition: "all 0.2s ease",
                    boxShadow: isCurrent ? "var(--gh-shadow-brand)" : "none",
                  }}
                  onMouseEnter={() => setHoveredKeyId(key.id)}
                  onMouseLeave={() => setHoveredKeyId(null)}>
                  {/*  */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                      flex: "1 1 auto",
                      minWidth: 0,
                    }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: "15px",
                          color: "var(--gh-text)",
                        }}>
                        {key.name}
                      </span>
                      {isCurrent && (
                        <span
                          style={{
                            fontSize: "11px",
                            color: "var(--gh-primary)",
                            backgroundColor: "var(--gh-bg-secondary)",
                            padding: "1px 6px",
                            borderRadius: "4px",
                            fontWeight: 500,
                            border: "1px solid var(--gh-border)",
                          }}>
                          
                        </span>
                      )}
                      {renderTypeBadge(key.accountType)}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {/* Session Key Preview */}
                      <Tooltip content={t("claudeKeyDoubleTapCopy")}>
                        <code
                          onDoubleClick={() => handleCopyKey(key.id, key.key)}
                          style={{
                            fontSize: "12px",
                            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                            color: "var(--gh-text-secondary)",
                            backgroundColor: "var(--gh-bg-tertiary)",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            cursor: "pointer",
                            maxWidth: "300px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}>
                          {key.key.substring(0, 32)}...
                        </code>
                      </Tooltip>
                      {(isHovered || copiedKeyId === key.id) && (
                        <Tooltip
                          content={copiedKeyId === key.id ? t("claudeCopied") : t("claudeCopyKey")}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleCopyKey(key.id, key.key)
                            }}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: copiedKeyId === key.id ? "default" : "pointer",
                              fontSize: "12px",
                              padding: "2px",
                              color:
                                copiedKeyId === key.id
                                  ? "var(--gh-secondary)"
                                  : "var(--gh-text-tertiary)",
                            }}>
                            {copiedKeyId === key.id ? "✓" : <CopyIcon size={14} />}
                          </button>
                        </Tooltip>
                      )}
                    </div>
                  </div>

                  {/*  */}
                  <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    {/*  */}
                    <div style={{ fontSize: "13px", color: "var(--gh-text-secondary)" }}>
                      {renderStatusBadge(key.isValid)}
                    </div>

                    {/*  */}
                    <div style={{ display: "flex", gap: "8px" }}>
                      <Tooltip
                        content={
                          isCurrent
                            ? t("claudeAlreadyUsing")
                            : !isClaudeSite
                              ? t("claudeNotOnSiteHint")
                              : t("claudeKeyUse")
                        }>
                        <button
                          className="settings-btn settings-btn-secondary"
                          onClick={() => handleSwitchToken(key.id)}
                          disabled={!isClaudeSite || isCurrent}
                          style={{
                            padding: "6px 12px",
                            fontSize: "13px",
                            opacity: !isClaudeSite || isCurrent ? 0.5 : 1,
                            cursor: !isClaudeSite || isCurrent ? "not-allowed" : "pointer",
                          }}>
                          {isCurrent ? t("claudeKeyUsing") : t("claudeKeyUse")}
                        </button>
                      </Tooltip>
                      <button
                        className="settings-btn settings-btn-secondary"
                        style={{
                          padding: "6px 12px",
                          fontSize: "13px",
                          minWidth: "60px",
                          justifyContent: "center",
                        }}
                        onClick={() => handleTestToken(key.id)}
                        disabled={testing[key.id]}>
                        {testing[key.id] ? (
                          <div
                            style={{
                              width: "14px",
                              height: "14px",
                              border: "2px solid currentColor",
                              borderTopColor: "transparent",
                              borderRadius: "50%",
                              animation: "spin 1s linear infinite",
                            }}
                          />
                        ) : (
                          t("claudeKeyTest")
                        )}
                      </button>
                      <button
                        className="settings-btn settings-btn-secondary"
                        style={{
                          padding: "6px 12px",
                          fontSize: "13px",
                          color: "var(--gh-danger)",
                          borderColor: "rgba(239, 68, 68, 0.2)",
                          backgroundColor: "rgba(239, 68, 68, 0.05)",
                        }}
                        onClick={() => handleDeleteToken(key.id, key.name)}>
                        {t("claudeKeyDelete")}
                      </button>
                      <style>{`
                        @keyframes spin {
                          from { transform: rotate(0deg); }
                          to { transform: rotate(360deg); }
                        }
                      `}</style>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </SettingCard>

      {/*  */}
      {dialog.type === "add" && (
        <AddKeyDialog onConfirm={handleAddTokenConfirm} onCancel={closeDialog} />
      )}

      {dialog.type === "import-name" && (
        <InputDialog
          title={t("claudeImportNameTitle")}
          defaultValue={`Import-${new Date().toLocaleDateString()}`}
          placeholder={t("claudeImportNamePlaceholder")}
          onConfirm={handleImportComplete}
          onCancel={closeDialog}
        />
      )}

      {dialog.type === "delete" && (
        <ConfirmDialog
          title={t("claudeDeleteConfirmTitle")}
          message={t("claudeDeleteConfirmMsg").replace("{name}", dialog.name)}
          confirmText={t("claudeKeyDelete")}
          danger
          onConfirm={confirmDelete}
          onCancel={closeDialog}
        />
      )}
    </div>
  )
}

interface AddKeyDialogProps {
  onConfirm: (name: string, key: string) => void
  onCancel: () => void
}

const AddKeyDialog: React.FC<AddKeyDialogProps> = ({ onConfirm, onCancel }) => {
  const [name, setName] = useState("")
  const [key, setKey] = useState("")
  const nameInputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    nameInputRef.current?.focus()
  }, [])

  const handleConfirm = () => {
    onConfirm(name, key)
  }

  return (
    <DialogOverlay onClose={onCancel}>
      <div className="gh-dialog-title">{t("claudeAddKey")}</div>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "24px" }}>
        <div>
          <div
            style={{
              marginBottom: "6px",
              fontSize: "14px",
              fontWeight: 500,
              color: "var(--gh-text)",
            }}>
            {t("claudeAddKeyNameTitle").split("-")[1].trim().replace("", "")}
          </div>
          <input
            ref={nameInputRef}
            type="text"
            className="gh-dialog-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("claudeAddKeyNamePlaceholder")}
            style={{ marginBottom: 0 }}
            onKeyDown={(e) =>
              e.key === "Enter" && document.getElementById("claude-key-input")?.focus()
            }
          />
        </div>

        <div>
          <div
            style={{
              marginBottom: "6px",
              fontSize: "14px",
              fontWeight: 500,
              color: "var(--gh-text)",
            }}>
            Session Key
          </div>
          <input
            id="claude-key-input"
            type="text"
            className="gh-dialog-input"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={t("claudeAddKeyValuePlaceholder")}
            style={{ marginBottom: 0 }}
            onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
          />
        </div>
      </div>

      <div className="gh-dialog-buttons">
        <button className="gh-dialog-btn gh-dialog-btn-secondary" onClick={onCancel}>
          {t("cancel")}
        </button>
        <button className="gh-dialog-btn gh-dialog-btn-primary" onClick={handleConfirm}>
          {t("confirm")}
        </button>
      </div>
    </DialogOverlay>
  )
}

export default ClaudeSettings
