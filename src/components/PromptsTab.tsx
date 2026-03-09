import React, { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

import {
  ClearIcon,
  CopyIcon,
  DeleteIcon,
  DragIcon,
  EditIcon,
  ExportIcon,
  EyeIcon,
  ImportIcon,
  PinIcon,
  TimeIcon,
} from "~components/icons"
import { Button, ConfirmDialog, InputDialog, Tooltip } from "~components/ui"
import {
  extractVariables,
  type ParsedVariable,
  replaceVariables,
  VariableInputDialog,
} from "~components/VariableInputDialog"
import { VIRTUAL_CATEGORY } from "~constants"
import type { PromptManager } from "~core/prompt-manager"
import { useSettingsStore } from "~stores/settings-store"
import { APP_NAME } from "~utils/config"
import { t } from "~utils/i18n"
import { initCopyButtons, showCopySuccess } from "~utils/icons"
import { getHighlightStyles, renderMarkdown } from "~utils/markdown"
import type { Prompt } from "~utils/storage"
import { showToast } from "~utils/toast"
import { createSafeHTML } from "~utils/trusted-types"

interface PromptsTabProps {
  manager: PromptManager
  onPromptSelect?: (prompt: Prompt | null) => void
  selectedPromptId?: string | null
}

// 
interface ConfirmState {
  show: boolean
  title: string
  message: string
  onConfirm: () => void
}

// 
interface PromptInputState {
  show: boolean
  title: string
  defaultValue: string
  onConfirm: (value: string) => void
}

interface OpenPromptVariableDialogDetail {
  promptId?: string
  submitAfterInsert?: boolean
}

interface LocatePromptDetail {
  promptId?: string
}

//  1-7
const getCategoryColorIndex = (categoryName: string): number => {
  let hash = 0
  for (let i = 0; i < categoryName.length; i++) {
    hash = categoryName.charCodeAt(i) + ((hash << 5) - hash)
  }
  return (Math.abs(hash) % 7) + 1
}

export const PromptsTab: React.FC<PromptsTabProps> = ({
  manager,
  onPromptSelect,
  selectedPromptId,
}) => {
  const DOUBLE_CLICK_DELAY_MS = 340

  const doubleClickToSend = useSettingsStore(
    (state) => state.settings.features?.prompts?.doubleClickToSend ?? false,
  )
  const submitShortcut = useSettingsStore(
    (state) => state.settings.features?.prompts?.submitShortcut ?? "enter",
  )

  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>(VIRTUAL_CATEGORY.ALL)
  const [searchQuery, setSearchQuery] = useState("")

  // 
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPrompt, setEditingPrompt] = useState<Partial<Prompt> | null>(null)

  // 
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)

  // 
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    show: false,
    title: "",
    message: "",
    onConfirm: () => {},
  })

  // 
  const [promptInputState, setPromptInputState] = useState<PromptInputState>({
    show: false,
    title: "",
    defaultValue: "",
    onConfirm: () => {},
  })
  // 
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const dragNodeRef = useRef<HTMLDivElement | null>(null)

  // 
  const [variableDialogState, setVariableDialogState] = useState<{
    show: boolean
    prompt: Prompt | null
    variables: ParsedVariable[]
    submitAfterInsert: boolean
  }>({ show: false, prompt: null, variables: [], submitAfterInsert: false })

  // 
  const [importDialogState, setImportDialogState] = useState<{
    show: boolean
    prompts: Prompt[]
  }>({ show: false, prompts: [] })

  // Markdown 
  const [showPreview, setShowPreview] = useState(false)

  // 
  const [previewModal, setPreviewModal] = useState<{
    show: boolean
    prompt: Prompt | null
  }>({ show: false, prompt: null })

  const clickTimerRef = useRef<number | null>(null)
  const locateHighlightTimerRef = useRef<number | null>(null)
  const promptListRef = useRef<HTMLDivElement | null>(null)
  const [locatedPromptId, setLocatedPromptId] = useState<string | null>(null)

  //  refs SVG 
  const editPreviewRef = useRef<HTMLDivElement>(null)
  const modalPreviewRef = useRef<HTMLDivElement>(null)

  const loadData = useCallback(() => {
    const allPrompts = manager.getPrompts()
    const allCategories = manager.getCategories()
    setPrompts(allPrompts)
    setCategories(allCategories)

    // 
    setSelectedCategory((prev) => {
      if (prev === VIRTUAL_CATEGORY.ALL) return prev
      // 
      if (!allCategories.includes(prev)) return VIRTUAL_CATEGORY.ALL
      // 
      const hasPrompts = allPrompts.some((p) => p.category === prev)
      if (!hasPrompts) return VIRTUAL_CATEGORY.ALL
      return prev
    })
  }, [manager])

  const openVariableDialogByPromptId = useCallback(
    (promptId: string, submitAfterInsert = false) => {
      const targetPrompt = manager.getPrompts().find((prompt) => prompt.id === promptId)
      if (!targetPrompt) {
        return false
      }

      const variables = extractVariables(targetPrompt.content)
      if (variables.length === 0) {
        return false
      }

      setVariableDialogState({
        show: true,
        prompt: targetPrompt,
        variables,
        submitAfterInsert,
      })
      return true
    },
    [manager],
  )

  const locatePromptById = useCallback(
    (promptId: string) => {
      const targetPrompt = manager.getPrompts().find((prompt) => prompt.id === promptId)
      if (!targetPrompt) {
        return false
      }

      setSelectedCategory(VIRTUAL_CATEGORY.ALL)
      setSearchQuery("")
      onPromptSelect?.(null)
      setLocatedPromptId(targetPrompt.id)
      return true
    },
    [manager, onPromptSelect],
  )

  useEffect(() => {
    const ophelWindow = window as Window & {
      __ophelPendingPromptVariableDialog?: OpenPromptVariableDialogDetail | null
    }

    const handleOpenPromptVariableDialog = (event: Event) => {
      const detail = (event as CustomEvent<OpenPromptVariableDialogDetail>).detail
      const promptId = detail?.promptId
      if (!promptId) {
        return
      }

      const opened = openVariableDialogByPromptId(promptId, Boolean(detail?.submitAfterInsert))
      if (opened) {
        onPromptSelect?.(null)
        ophelWindow.__ophelPendingPromptVariableDialog = null
      }
    }

    window.addEventListener("ophel:openPromptVariableDialog", handleOpenPromptVariableDialog)

    const pending = ophelWindow.__ophelPendingPromptVariableDialog
    if (pending?.promptId) {
      const opened = openVariableDialogByPromptId(
        pending.promptId,
        Boolean(pending.submitAfterInsert),
      )
      if (opened) {
        onPromptSelect?.(null)
        ophelWindow.__ophelPendingPromptVariableDialog = null
      }
    }

    return () => {
      window.removeEventListener("ophel:openPromptVariableDialog", handleOpenPromptVariableDialog)
    }
  }, [onPromptSelect, openVariableDialogByPromptId])

  useEffect(() => {
    const ophelWindow = window as Window & {
      __ophelPendingLocatePrompt?: LocatePromptDetail | null
    }

    const handleLocatePrompt = (event: Event) => {
      const detail = (event as CustomEvent<LocatePromptDetail>).detail
      const promptId = detail?.promptId
      if (!promptId) {
        return
      }

      const located = locatePromptById(promptId)
      if (located) {
        ophelWindow.__ophelPendingLocatePrompt = null
      }
    }

    window.addEventListener("ophel:locatePrompt", handleLocatePrompt)

    const pending = ophelWindow.__ophelPendingLocatePrompt
    if (pending?.promptId) {
      const located = locatePromptById(pending.promptId)
      if (located) {
        ophelWindow.__ophelPendingLocatePrompt = null
      }
    }

    return () => {
      window.removeEventListener("ophel:locatePrompt", handleLocatePrompt)
    }
  }, [locatePromptById])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    return () => {
      if (clickTimerRef.current !== null) {
        window.clearTimeout(clickTimerRef.current)
      }
      if (locateHighlightTimerRef.current !== null) {
        window.clearTimeout(locateHighlightTimerRef.current)
      }
    }
  }, [])

  // 
  useEffect(() => {
    if (showPreview && editPreviewRef.current) {
      initCopyButtons(editPreviewRef.current, { size: 14, color: "#6b7280" })
    }
  }, [showPreview, editingPrompt?.content])

  // 
  useEffect(() => {
    if (previewModal.show && modalPreviewRef.current) {
      initCopyButtons(modalPreviewRef.current, { size: 14, color: "#6b7280" })
    }
  }, [previewModal.show, previewModal.prompt])

  const getFilteredPrompts = () => {
    let filtered: Prompt[]

    //  lastUsedAt 
    if (selectedCategory === VIRTUAL_CATEGORY.RECENT) {
      filtered = manager
        .getPrompts()
        .filter((p) => p.lastUsedAt)
        .sort((a, b) => (b.lastUsedAt || 0) - (a.lastUsedAt || 0))
        .slice(0, 10) //  10 

      // 
      if (searchQuery) {
        const lower = searchQuery.toLowerCase()
        filtered = filtered.filter(
          (p) => p.title.toLowerCase().includes(lower) || p.content.toLowerCase().includes(lower),
        )
      }
    } else {
      filtered = manager.filterPrompts(searchQuery, selectedCategory)
    }

    // 
    if (selectedCategory !== VIRTUAL_CATEGORY.RECENT) {
      filtered = filtered.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1
        if (!a.pinned && b.pinned) return 1
        return 0
      })
    }

    return filtered
  }

  // 
  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmState({ show: true, title, message, onConfirm })
  }

  // 
  const showPromptInput = (
    title: string,
    defaultValue: string,
    onConfirm: (value: string) => void,
  ) => {
    setPromptInputState({ show: true, title, defaultValue, onConfirm })
  }

  // 
  const handleSelect = async (prompt: Prompt, submitAfterInsert = false) => {
    // Extract variables from the selected prompt
    const variables = extractVariables(prompt.content)

    if (variables.length > 0) {
      // Prompt includes variables; open the variable dialog first
      setVariableDialogState({
        show: true,
        prompt,
        variables,
        submitAfterInsert,
      })
    } else {
      // No variables; insert (and optionally submit) directly
      await doInsert(prompt, prompt.content, submitAfterInsert)
    }
  }

  const doInsert = async (prompt: Prompt, content: string, submitAfterInsert = false) => {
    const success = await manager.insertPrompt(content)
    if (success) {
      let submitSuccess = true
      if (submitAfterInsert) {
        submitSuccess = await manager.submitPrompt(submitShortcut)
        if (!submitSuccess) {
          showToast(t("promptSendFailed") || "")
        }
      }

      manager.updateLastUsed(prompt.id)
      if (submitAfterInsert) {
        onPromptSelect?.(submitSuccess ? null : prompt)
      } else {
        onPromptSelect?.(prompt)
      }

      if (submitAfterInsert) {
        if (submitSuccess) {
          showToast(`${t("promptSent") || ""}: ${prompt.title}`)
        }
      } else {
        showToast(`${t("inserted") || ""}: ${prompt.title}`)
      }
    } else {
      showToast(t("insertFailed") || "")
    }
  }

  const handleVariableConfirm = async (values: Record<string, string>) => {
    const { prompt, submitAfterInsert } = variableDialogState
    if (!prompt) return

    const replacedContent = replaceVariables(prompt.content, values)
    setVariableDialogState({ show: false, prompt: null, variables: [], submitAfterInsert: false })

    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => resolve())
      })
    })

    await doInsert(prompt, replacedContent, submitAfterInsert)
  }

  const handlePromptClick = (prompt: Prompt) => {
    setLocatedPromptId(null)

    if (!doubleClickToSend) {
      void handleSelect(prompt)
      return
    }

    if (clickTimerRef.current !== null) {
      window.clearTimeout(clickTimerRef.current)
      clickTimerRef.current = null
    }

    clickTimerRef.current = window.setTimeout(() => {
      clickTimerRef.current = null
      void handleSelect(prompt)
    }, DOUBLE_CLICK_DELAY_MS)
  }

  const handlePromptDoubleClick = (prompt: Prompt) => {
    if (clickTimerRef.current !== null) {
      window.clearTimeout(clickTimerRef.current)
      clickTimerRef.current = null
    }

    if (doubleClickToSend) {
      void handleSelect(prompt, true)
    }
  }

  // Toggle pin state
  const handleTogglePin = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    manager.togglePin(id)
    loadData()
  }

  //  JSON 
  const handleExport = () => {
    const allPrompts = manager.getPrompts()
    const json = JSON.stringify(allPrompts, null, 2)
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${APP_NAME}-prompts-${new Date().toISOString().split("T")[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    showToast(t("promptExportSuccess") || "")
  }

  // 
  const handleImport = () => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".json"
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      try {
        const text = await file.text()
        const imported = JSON.parse(text) as Prompt[]

        if (!Array.isArray(imported)) {
          showToast(t("promptImportFailed") || "")
          return
        }

        // //
        setImportDialogState({ show: true, prompts: imported })
      } catch {
        showToast(t("promptImportFailed") || "")
      }
    }
    input.click()
  }

  // 
  const handleImportOverwrite = () => {
    const imported = importDialogState.prompts
    manager.setPrompts(imported)
    loadData()
    setImportDialogState({ show: false, prompts: [] })
    showToast(
      (t("promptImportSuccess") || " {count} ").replace(
        "{count}",
        imported.length.toString(),
      ),
    )
  }

  //  ID 
  const handleImportMerge = () => {
    const imported = importDialogState.prompts
    const existing = manager.getPrompts()
    const existingIds = new Set(existing.map((p) => p.id))

    //  
    const toUpdate = imported.filter((p) => existingIds.has(p.id))
    const toAdd = imported.filter((p) => !existingIds.has(p.id))

    // 
    toUpdate.forEach((p) => {
      manager.updatePrompt(p.id, {
        title: p.title,
        content: p.content,
        category: p.category,
        pinned: p.pinned,
      })
    })

    // 
    toAdd.forEach((p) => {
      manager.addPrompt({
        title: p.title,
        content: p.content,
        category: p.category,
        pinned: p.pinned,
      })
    })

    loadData()
    setImportDialogState({ show: false, prompts: [] })
    const msg = ` ${toUpdate.length}  ${toAdd.length} `
    showToast(
      t("promptMergeSuccess")
        ?.replace("{updated}", toUpdate.length.toString())
        .replace("{added}", toAdd.length.toString()) || msg,
    )
  }

  // /
  const handleSave = async () => {
    if (!editingPrompt?.title || !editingPrompt?.content) {
      showToast(t("fillTitleContent") || "")
      return
    }

    const newCategory = editingPrompt.category || t("uncategorized") || ""
    let shouldSwitchToNewCategory = false

    if (editingPrompt.id) {
      // 
      const oldPrompt = prompts.find((p) => p.id === editingPrompt.id)
      const oldCategory = oldPrompt?.category

      // 
      if (oldCategory && oldCategory !== newCategory && selectedCategory === oldCategory) {
        // 
        const otherPromptsInOldCategory = prompts.filter(
          (p) => p.category === oldCategory && p.id !== editingPrompt.id,
        )
        if (otherPromptsInOldCategory.length === 0) {
          shouldSwitchToNewCategory = true
        }
      }

      await manager.updatePrompt(editingPrompt.id, {
        title: editingPrompt.title,
        content: editingPrompt.content,
        category: newCategory,
      })
      showToast(t("promptUpdated") || "")

      // 
      if (shouldSwitchToNewCategory) {
        setSelectedCategory(newCategory)
      }
    } else {
      await manager.addPrompt({
        title: editingPrompt.title!,
        content: editingPrompt.content!,
        category: newCategory,
      })
      showToast(t("promptAdded") || "")
    }
    closeEditModal()
    loadData()
  }

  const closeEditModal = useCallback(() => {
    setIsModalOpen(false)
    setEditingPrompt(null)
  }, [])

  const closeCategoryModal = useCallback(() => {
    setIsCategoryModalOpen(false)
  }, [])

  const closeConfirmDialog = useCallback(() => {
    setConfirmState((prev) => ({ ...prev, show: false }))
  }, [])

  const closePromptInputDialog = useCallback(() => {
    setPromptInputState((prev) => ({ ...prev, show: false }))
  }, [])

  const closePreviewModal = useCallback(() => {
    setPreviewModal({ show: false, prompt: null })
  }, [])

  const closeImportDialog = useCallback(() => {
    setImportDialogState({ show: false, prompts: [] })
  }, [])

  const closeVariableDialog = useCallback(() => {
    setVariableDialogState({
      show: false,
      prompt: null,
      variables: [],
      submitAfterInsert: false,
    })
  }, [])

  // 
  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    showConfirm(t("confirmDelete") || "", "", async () => {
      await manager.deletePrompt(id)
      showToast(t("deleted") || "")
      loadData()
    })
  }

  // 
  const handleCopy = async (content: string, e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    try {
      await navigator.clipboard.writeText(content)
      showToast(t("copied") || "")
    } catch {
      const textarea = document.createElement("textarea")
      textarea.value = content
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand("copy")
      document.body.removeChild(textarea)
      showToast(t("copied") || "")
    }
  }

  // /
  const openEditModal = (prompt?: Prompt) => {
    if (prompt) {
      setEditingPrompt({ ...prompt })
    } else {
      // 
      const isVirtualCategory =
        selectedCategory === VIRTUAL_CATEGORY.ALL || selectedCategory === VIRTUAL_CATEGORY.RECENT
      const defaultCategory = isVirtualCategory
        ? categories[0] || t("uncategorized") || ""
        : selectedCategory
      setEditingPrompt({ title: "", content: "", category: defaultCategory })
    }
    setIsModalOpen(true)
  }

  // ===  ===
  const handleRenameCategory = (oldName: string, e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    showPromptInput(
      t("newCategoryName") || "",
      oldName,
      async (newName: string) => {
        if (newName && newName.trim() && newName !== oldName) {
          await manager.renameCategory(oldName, newName.trim())
          showToast(
            (t("categoryRenamedTo") || "{name}").replace(
              "{name}",
              newName.trim(),
            ),
          )
          // 
          if (selectedCategory === oldName) {
            setSelectedCategory(newName.trim())
          }
          loadData()
        }
      },
    )
  }

  const handleDeleteCategory = (name: string, e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    showConfirm(
      t("confirmDeleteCategory") || "",
      (
        t("confirmDeleteCategoryMsg") || "{name}"
      ).replace("{name}", name),
      async () => {
        await manager.deleteCategory(name)
        showToast((t("categoryDeletedMsg") || "{name}").replace("{name}", name))
        if (selectedCategory === name) {
          setSelectedCategory(VIRTUAL_CATEGORY.ALL)
        }
        loadData()
      },
    )
  }

  // ===  ===
  const handleDragStart = (e: React.DragEvent, id: string, node: HTMLDivElement) => {
    setDraggedId(id)
    dragNodeRef.current = node
    e.dataTransfer.effectAllowed = "move"
    node.classList.add("dragging")
  }

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"

    if (!draggedId || draggedId === targetId) return

    const target = e.currentTarget as HTMLElement
    const rect = target.getBoundingClientRect()
    const midpoint = rect.top + rect.height / 2

    document.querySelectorAll(".drop-above, .drop-below").forEach((el) => {
      el.classList.remove("drop-above", "drop-below")
    })

    if (e.clientY < midpoint) {
      target.classList.add("drop-above")
    } else {
      target.classList.add("drop-below")
    }
  }

  const handleDragEnd = () => {
    if (dragNodeRef.current) {
      dragNodeRef.current.classList.remove("dragging")
    }
    document.querySelectorAll(".drop-above, .drop-below").forEach((el) => {
      el.classList.remove("drop-above", "drop-below")
    })
    setDraggedId(null)
    dragNodeRef.current = null
  }

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault()

    if (!draggedId || draggedId === targetId) {
      handleDragEnd()
      return
    }

    const allPrompts = manager.getPrompts()
    const draggedIndex = allPrompts.findIndex((p) => p.id === draggedId)
    const targetIndex = allPrompts.findIndex((p) => p.id === targetId)

    if (draggedIndex === -1 || targetIndex === -1) {
      handleDragEnd()
      return
    }

    const newOrder = [...allPrompts]
    const [removed] = newOrder.splice(draggedIndex, 1)

    const target = e.currentTarget as HTMLElement
    const rect = target.getBoundingClientRect()
    const insertBefore = e.clientY < rect.top + rect.height / 2

    let insertIndex = allPrompts.findIndex((p) => p.id === targetId)
    if (draggedIndex < insertIndex) {
      insertIndex--
    }
    if (!insertBefore) {
      insertIndex++
    }

    newOrder.splice(insertIndex, 0, removed)

    await manager.updateOrder(newOrder.map((p) => p.id))
    showToast(t("orderUpdated") || "")
    loadData()
    handleDragEnd()
  }

  const filtered = getFilteredPrompts()

  useEffect(() => {
    const hasPromptDialogs =
      promptInputState.show ||
      confirmState.show ||
      isCategoryModalOpen ||
      isModalOpen ||
      previewModal.show ||
      importDialogState.show ||
      variableDialogState.show

    if (!hasPromptDialogs) {
      return
    }

    const handleEscapeForPromptDialogs = (e: KeyboardEvent) => {
      if (e.key !== "Escape") {
        return
      }

      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation?.()

      if (promptInputState.show) {
        closePromptInputDialog()
        return
      }

      if (confirmState.show) {
        closeConfirmDialog()
        return
      }

      if (variableDialogState.show) {
        closeVariableDialog()
        return
      }

      if (isCategoryModalOpen) {
        closeCategoryModal()
        return
      }

      if (isModalOpen) {
        closeEditModal()
        return
      }

      if (previewModal.show) {
        closePreviewModal()
        return
      }

      if (importDialogState.show) {
        closeImportDialog()
      }
    }

    document.addEventListener("keydown", handleEscapeForPromptDialogs, true)
    return () => {
      document.removeEventListener("keydown", handleEscapeForPromptDialogs, true)
    }
  }, [
    closeCategoryModal,
    closeConfirmDialog,
    closeEditModal,
    closeImportDialog,
    closePreviewModal,
    closePromptInputDialog,
    closeVariableDialog,
    confirmState.show,
    importDialogState.show,
    isCategoryModalOpen,
    isModalOpen,
    previewModal.show,
    promptInputState.show,
    variableDialogState.show,
  ])

  useEffect(() => {
    if (!locatedPromptId) {
      return
    }

    const container = promptListRef.current
    if (!container) {
      return
    }

    const escapedPromptId =
      typeof CSS !== "undefined" && typeof CSS.escape === "function"
        ? CSS.escape(locatedPromptId)
        : locatedPromptId.replace(/["\\]/g, "\\$&")

    const target = container.querySelector<HTMLElement>(
      `.prompt-item[data-prompt-id="${escapedPromptId}"]`,
    )
    if (!target) {
      return
    }

    target.scrollIntoView({ behavior: "smooth", block: "center" })

    if (locateHighlightTimerRef.current !== null) {
      window.clearTimeout(locateHighlightTimerRef.current)
    }

    locateHighlightTimerRef.current = window.setTimeout(() => {
      setLocatedPromptId((current) => (current === locatedPromptId ? null : current))
      locateHighlightTimerRef.current = null
    }, 2200)
  }, [locatedPromptId, prompts, searchQuery, selectedCategory])

  // /
  const renderEditModal = () => {
    if (!isModalOpen) return null

    return createPortal(
      <div
        className="prompt-modal gh-interactive"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "var(--gh-overlay-bg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 2147483646,
          animation: "fadeIn 0.2s",
        }}>
        <div
          className="prompt-modal-content"
          onClick={(e) => e.stopPropagation()}
          style={{
            background: "var(--gh-bg, white)",
            borderRadius: "12px",
            width: "90%",
            maxWidth: "500px",
            padding: "24px",
            animation: "slideUp 0.3s",
            boxShadow: "var(--gh-shadow, 0 20px 50px rgba(0,0,0,0.3))",
          }}>
          <div
            style={{
              fontSize: "18px",
              fontWeight: 600,
              marginBottom: "20px",
              color: "var(--gh-text, #1f2937)",
            }}>
            {editingPrompt?.id ? t("editPrompt") : t("addNewPrompt")}
          </div>

          {/*  */}
          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                fontSize: "14px",
                fontWeight: 500,
                color: "var(--gh-text, #374151)",
                marginBottom: "6px",
              }}>
              {t("title")}
            </label>
            <input
              type="text"
              value={editingPrompt?.title || ""}
              onChange={(e) => setEditingPrompt({ ...editingPrompt, title: e.target.value })}
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid var(--gh-border, #d1d5db)",
                borderRadius: "6px",
                fontSize: "14px",
                boxSizing: "border-box",
                background: "var(--gh-bg, #ffffff)",
                color: "var(--gh-text, #1f2937)",
              }}
            />
          </div>

          {/*  */}
          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                fontSize: "14px",
                fontWeight: 500,
                color: "var(--gh-text, #374151)",
                marginBottom: "6px",
              }}>
              {t("category")}
            </label>
            <input
              type="text"
              value={editingPrompt?.category || ""}
              onChange={(e) => setEditingPrompt({ ...editingPrompt, category: e.target.value })}
              placeholder={t("categoryPlaceholder") || ""}
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid var(--gh-border, #d1d5db)",
                borderRadius: "6px",
                fontSize: "14px",
                boxSizing: "border-box",
                background: "var(--gh-bg, #ffffff)",
                color: "var(--gh-text, #1f2937)",
              }}
            />
            {categories.length > 0 && (
              <div
                style={{
                  marginTop: "6px",
                  display: "flex",
                  gap: "4px",
                  flexWrap: "wrap",
                  userSelect: "none",
                }}>
                {categories.map((cat) => (
                  <span
                    key={cat}
                    onClick={() => setEditingPrompt({ ...editingPrompt, category: cat })}
                    style={{
                      padding: "2px 8px",
                      fontSize: "11px",
                      background:
                        editingPrompt?.category === cat
                          ? "var(--gh-primary, #4285f4)"
                          : "var(--gh-hover, #f3f4f6)",
                      color:
                        editingPrompt?.category === cat
                          ? "var(--gh-text-on-primary, white)"
                          : "var(--gh-text-secondary, #6b7280)",
                      borderRadius: "10px",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}>
                    {cat}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/*  */}
          <div style={{ marginBottom: "16px" }}>
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "6px",
                }}>
                <label
                  style={{
                    fontSize: "14px",
                    fontWeight: 500,
                    color: "var(--gh-text, #374151)",
                  }}>
                  {t("content")}
                </label>
                {/* ⭐  */}
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  style={{
                    padding: "2px 8px",
                    fontSize: "12px",
                    background: showPreview
                      ? "var(--gh-primary, #4285f4)"
                      : "var(--gh-hover, #f3f4f6)",
                    color: showPreview ? "white" : "var(--gh-text-secondary, #6b7280)",
                    border: "1px solid var(--gh-border, #d1d5db)",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}>
                  {t("promptMarkdownPreview") || ""}
                </button>
              </div>
              <textarea
                value={editingPrompt?.content || ""}
                onChange={(e) => setEditingPrompt({ ...editingPrompt, content: e.target.value })}
                style={{
                  width: "100%",
                  minHeight: "120px",
                  padding: "8px 12px",
                  border: "1px solid var(--gh-border, #d1d5db)",
                  borderRadius: "6px",
                  fontSize: "14px",
                  resize: "vertical",
                  boxSizing: "border-box",
                  fontFamily: "inherit",
                  background: "var(--gh-bg, #ffffff)",
                  color: "var(--gh-text, #1f2937)",
                  display: showPreview ? "none" : "block",
                }}
              />
              {/* ⭐ Markdown  */}
              {showPreview && (
                <>
                  <div
                    className="gh-markdown-preview"
                    style={{
                      width: "100%",
                      minHeight: "120px",
                      maxHeight: "200px",
                      padding: "8px 12px",
                      border: "1px solid var(--gh-border, #d1d5db)",
                      borderRadius: "6px",
                      fontSize: "14px",
                      boxSizing: "border-box",
                      background: "var(--gh-bg-secondary, #f9fafb)",
                      color: "var(--gh-text, #1f2937)",
                      overflowY: "auto",
                      lineHeight: 1.6,
                    }}
                    ref={editPreviewRef}
                    onClick={(e) => {
                      //  SVG 
                      const target = e.target as HTMLElement
                      const btn = target.closest(".gh-code-copy-btn") as HTMLElement
                      if (btn) {
                        const code = btn.nextElementSibling?.textContent || ""
                        navigator.clipboard
                          .writeText(code)
                          .then(() => {
                            showCopySuccess(btn, { size: 14 })
                          })
                          .catch(() => {
                            /* clipboard unavailable */
                          })
                      }
                    }}
                    dangerouslySetInnerHTML={{
                      __html: createSafeHTML(renderMarkdown(editingPrompt?.content || "")),
                    }}
                  />
                  <style>{getHighlightStyles()}</style>
                </>
              )}
            </div>
          </div>

          {/*  */}
          <div
            style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "24px" }}>
            <Button
              variant="ghost"
              onClick={closeEditModal}
              style={{ background: "var(--gh-hover, #f3f4f6)" }}>
              {t("cancel")}
            </Button>
            <Button variant="primary" onClick={handleSave}>
              {editingPrompt?.id ? t("save") : t("add")}
            </Button>
          </div>
        </div>
      </div>,
      document.body,
    )
  }

  // 
  const renderCategoryModal = () => {
    if (!isCategoryModalOpen) return null

    return createPortal(
      <div
        className="prompt-modal gh-interactive"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "var(--gh-overlay-bg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 2147483646,
          animation: "fadeIn 0.2s",
        }}>
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: "var(--gh-bg, white)",
            borderRadius: "12px",
            width: "90%",
            maxWidth: "400px",
            padding: "24px",
            animation: "slideUp 0.3s",
            boxShadow: "var(--gh-shadow-lg, 0 20px 50px rgba(0,0,0,0.3))",
          }}>
          <div
            style={{
              fontSize: "18px",
              fontWeight: 600,
              marginBottom: "20px",
              color: "var(--gh-text, #1f2937)",
            }}>
            {t("categoryManage") || ""}
          </div>

          <div style={{ maxHeight: "300px", overflowY: "auto" }}>
            {categories.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  color: "var(--gh-text-tertiary, #9ca3af)",
                  padding: "20px",
                }}>
                {t("categoryEmpty") || ""}
              </div>
            ) : (
              categories.map((cat) => {
                const count = prompts.filter((p) => p.category === cat).length
                return (
                  <div
                    key={cat}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 0",
                      borderBottom: "1px solid var(--gh-border, #e5e7eb)",
                    }}>
                    <div>
                      <div style={{ fontWeight: 500, color: "var(--gh-text, #374151)" }}>{cat}</div>
                      <div style={{ fontSize: "12px", color: "var(--gh-text-tertiary, #9ca3af)" }}>
                        {count} {t("promptCountSuffix") || " "}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <Tooltip content={t("rename") || ""}>
                        <Button
                          size="sm"
                          onClick={(e) => handleRenameCategory(cat, e)}
                          style={{ color: "var(--gh-primary, #4285f4)" }}>
                          {t("rename") || ""}
                        </Button>
                      </Tooltip>
                      <Tooltip content={t("delete") || ""}>
                        <Button
                          size="sm"
                          onClick={(e) => handleDeleteCategory(cat, e)}
                          style={{
                            border: "1px solid var(--gh-border-danger, #fecaca)",
                            background: "var(--gh-bg-danger, #fef2f2)",
                            color: "var(--gh-text-danger, #ef4444)",
                          }}>
                          {t("delete") || ""}
                        </Button>
                      </Tooltip>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <div style={{ marginTop: "20px", display: "flex", justifyContent: "flex-end" }}>
            <Button
              variant="ghost"
              onClick={closeCategoryModal}
              style={{ background: "var(--gh-hover, #f3f4f6)" }}>
              {t("close") || ""}
            </Button>
          </div>
        </div>
      </div>,
      document.body,
    )
  }

  // 
  const renderPreviewModal = () => {
    if (!previewModal.show || !previewModal.prompt) return null

    return createPortal(
      <div
        className="prompt-preview-modal gh-interactive"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            closePreviewModal()
          }
        }}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "var(--gh-overlay-bg, rgba(0, 0, 0, 0.5))",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10001,
          animation: "fadeIn 0.2s ease-out",
        }}>
        <div
          style={{
            width: "90%",
            maxWidth: "600px",
            maxHeight: "80vh",
            background: "var(--gh-bg, white)",
            borderRadius: "12px",
            boxShadow: "var(--gh-shadow-lg)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            animation: "slideUp 0.3s ease-out",
          }}>
          {/*  */}
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid var(--gh-border, #e5e7eb)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}>
            <div>
              <div style={{ fontSize: "16px", fontWeight: 600, color: "var(--gh-text, #1f2937)" }}>
                {previewModal.prompt.title}
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: "var(--gh-text-secondary, #6b7280)",
                  marginTop: "4px",
                }}>
                {previewModal.prompt.category}
              </div>
            </div>
            <button
              onClick={closePreviewModal}
              style={{
                width: "28px",
                height: "28px",
                border: "none",
                background: "var(--gh-hover, #f3f4f6)",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
              <ClearIcon size={16} />
            </button>
          </div>
          {/*  */}
          <div
            className="gh-markdown-preview"
            style={{
              flex: 1,
              padding: "20px",
              overflowY: "auto",
            }}
            ref={modalPreviewRef}
            onClick={(e) => {
              //  SVG 
              const target = e.target as HTMLElement
              const btn = target.closest(".gh-code-copy-btn") as HTMLElement
              if (btn) {
                const code = btn.nextElementSibling?.textContent || ""
                navigator.clipboard
                  .writeText(code)
                  .then(() => {
                    showCopySuccess(btn, { size: 14 })
                  })
                  .catch(() => {
                    /* clipboard unavailable */
                  })
              }
            }}
            dangerouslySetInnerHTML={{
              __html: createSafeHTML(renderMarkdown(previewModal.prompt.content)),
            }}
          />
          {/* highlight.js  */}
          <style>{getHighlightStyles()}</style>
        </div>
      </div>,
      document.body,
    )
  }

  // 
  const renderImportDialog = () => {
    if (!importDialogState.show) return null

    return createPortal(
      <div
        className="import-dialog gh-interactive"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            closeImportDialog()
          }
        }}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "var(--gh-overlay-bg, rgba(0, 0, 0, 0.5))",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10001,
        }}>
        <div
          style={{
            width: "90%",
            maxWidth: "400px",
            background: "var(--gh-bg, white)",
            borderRadius: "12px",
            boxShadow: "var(--gh-shadow-lg)",
            padding: "24px",
          }}>
          <div
            style={{
              fontSize: "16px",
              fontWeight: 600,
              marginBottom: "12px",
              color: "var(--gh-text)",
            }}>
            {t("promptImportTitle") || ""}
          </div>
          <div
            style={{
              fontSize: "14px",
              color: "var(--gh-text-secondary)",
              marginBottom: "20px",
              lineHeight: 1.6,
            }}>
            {(t("promptImportMessage2") || " {count} ").replace(
              "{count}",
              importDialogState.prompts.length.toString(),
            )}
            <ul style={{ margin: "8px 0 0 0", paddingLeft: "20px" }}>
              <li>{t("promptImportOverwriteDesc") || ""}</li>
              <li>{t("promptImportMergeDesc") || "IDID"}</li>
            </ul>
          </div>
          <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
            <Button
              variant="ghost"
              onClick={closeImportDialog}
              style={{ background: "var(--gh-hover, #f3f4f6)" }}>
              {t("cancel") || ""}
            </Button>
            <Button
              variant="ghost"
              onClick={handleImportMerge}
              style={{
                background: "var(--gh-primary-light, #e3f2fd)",
                color: "var(--gh-primary, #4285f4)",
              }}>
              {t("promptMerge") || ""}
            </Button>
            <Button variant="primary" onClick={handleImportOverwrite}>
              {t("promptOverwrite") || ""}
            </Button>
          </div>
        </div>
      </div>,
      document.body,
    )
  }

  return (
    <div
      className="gh-prompts-tab"
      style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/*  +  */}
      <div
        style={{
          padding: "12px",
          borderBottom: "1px solid var(--gh-border, #e5e7eb)",
          background: "var(--gh-bg-secondary, #f9fafb)",
          display: "flex",
          gap: "8px",
          alignItems: "center",
        }}>
        <input
          type="text"
          className="prompt-search-input"
          placeholder={t("searchPlaceholder")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            flex: 1,
            padding: "8px 12px",
            border: "1px solid var(--gh-border, #d1d5db)",
            borderRadius: "8px",
            fontSize: "14px",
            boxSizing: "border-box",
            background: "var(--gh-bg, #ffffff)",
            color: "var(--gh-text, #1f2937)",
          }}
        />
        {/*  */}
        <Tooltip content={t("promptImport") || ""}>
          <button
            onClick={handleImport}
            style={{
              width: "32px",
              height: "32px",
              border: "1px solid var(--gh-border, #d1d5db)",
              background: "var(--gh-bg, white)",
              borderRadius: "6px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "16px",
              flexShrink: 0,
            }}>
            <ImportIcon size={16} />
          </button>
        </Tooltip>
        {/*  */}
        <Tooltip content={t("promptExport") || ""}>
          <button
            onClick={handleExport}
            style={{
              width: "32px",
              height: "32px",
              border: "1px solid var(--gh-border, #d1d5db)",
              background: "var(--gh-bg, white)",
              borderRadius: "6px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "16px",
              flexShrink: 0,
            }}>
            <ExportIcon size={16} />
          </button>
        </Tooltip>
      </div>

      {/*  */}
      <div
        style={{
          padding: "8px 12px",
          display: "flex",
          gap: "6px",
          flexWrap: "wrap",
          background: "var(--gh-bg, white)",
          borderBottom: "1px solid var(--gh-border, #e5e7eb)",
          userSelect: "none", // 
        }}>
        <span
          onClick={() => setSelectedCategory(VIRTUAL_CATEGORY.ALL)}
          style={{
            padding: "4px 10px",
            background:
              selectedCategory === VIRTUAL_CATEGORY.ALL
                ? "var(--gh-primary, #4285f4)"
                : "var(--gh-hover, #f3f4f6)",
            borderRadius: "12px",
            fontSize: "12px",
            color: selectedCategory === VIRTUAL_CATEGORY.ALL ? "white" : "#4b5563",
            cursor: "pointer",
            border:
              selectedCategory === VIRTUAL_CATEGORY.ALL
                ? "1px solid var(--gh-primary, #4285f4)"
                : "1px solid transparent",
          }}>
          {t("allCategory")}
        </span>

        {categories.map((cat) => {
          const colorIndex = getCategoryColorIndex(cat)
          return (
            <Tooltip key={cat} content={cat}>
              <span
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: "4px 10px",
                  background:
                    selectedCategory === cat
                      ? "var(--gh-primary, #4285f4)"
                      : `var(--gh-category-${colorIndex})`,
                  borderRadius: "12px",
                  fontSize: "12px",
                  color: selectedCategory === cat ? "white" : "#4b5563",
                  cursor: "pointer",
                  border:
                    selectedCategory === cat
                      ? "1px solid var(--gh-primary, #4285f4)"
                      : "1px solid transparent",
                  maxWidth: "80px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                {cat}
              </span>
            </Tooltip>
          )
        })}

        {/* ⭐  */}
        <Tooltip content={t("promptRecentUsed") || ""}>
          <span
            onClick={() => setSelectedCategory(VIRTUAL_CATEGORY.RECENT)}
            style={{
              padding: "4px 8px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
              background:
                selectedCategory === VIRTUAL_CATEGORY.RECENT
                  ? "var(--gh-primary, #4285f4)"
                  : "var(--gh-hover, #f3f4f6)",
              borderRadius: "12px",
              fontSize: "12px",
              color: selectedCategory === VIRTUAL_CATEGORY.RECENT ? "white" : "#4b5563",
              cursor: "pointer",
              border:
                selectedCategory === VIRTUAL_CATEGORY.RECENT
                  ? "1px solid var(--gh-primary, #4285f4)"
                  : "1px solid transparent",
            }}>
            <TimeIcon size={14} />
          </span>
        </Tooltip>

        {categories.length > 0 && (
          <button
            onClick={() => setIsCategoryModalOpen(true)}
            style={{
              padding: "4px 8px",
              background: "transparent",
              border: "1px dashed var(--gh-border, #d1d5db)",
              borderRadius: "12px",
              fontSize: "11px",
              color: "var(--gh-text-secondary, #9ca3af)",
              cursor: "pointer",
            }}>
            {t("manageCategory") || ""}
          </button>
        )}
      </div>

      {/*  */}
      <div
        ref={promptListRef}
        style={{ flex: 1, overflowY: "auto", padding: "8px", scrollbarWidth: "none" }}>
        {filtered.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "40px 20px",
              color: "var(--gh-text-tertiary, #9ca3af)",
              fontSize: "14px",
            }}>
            
          </div>
        ) : (
          filtered.map((p) => {
            const isSelected = selectedPromptId === p.id
            const isLocated = locatedPromptId === p.id
            const isHighlighted = isSelected || isLocated

            return (
              <div
                key={p.id}
                data-prompt-id={p.id}
                className={`prompt-item ${isHighlighted ? "selected" : ""} ${isLocated ? "located" : ""} ${draggedId === p.id ? "dragging" : ""}`}
                onClick={() => handlePromptClick(p)}
                onDoubleClick={() => handlePromptDoubleClick(p)}
                draggable={false}
                onDragStart={(e) => handleDragStart(e, p.id, e.currentTarget as HTMLDivElement)}
                onDragOver={(e) => handleDragOver(e, p.id)}
                onDragEnd={handleDragEnd}
                onDrop={(e) => handleDrop(e, p.id)}
                style={{
                  background: isHighlighted
                    ? "linear-gradient(135deg, #e8f0fe 0%, #f1f8e9 100%)"
                    : "var(--gh-bg, white)",
                  border: isHighlighted
                    ? "1px solid var(--gh-primary, #4285f4)"
                    : "1px solid var(--gh-border, #e5e7eb)",
                  borderRadius: "8px",
                  padding: "12px",
                  marginBottom: "8px",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  position: "relative",
                  userSelect: "none",
                }}>
                {/*  */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: "8px",
                  }}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: "14px",
                      color: "var(--gh-text, #1f2937)",
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      paddingRight: "8px",
                    }}>
                    {p.title}
                  </div>
                  <span
                    style={{
                      fontSize: "11px",
                      padding: "2px 6px",
                      background: "var(--gh-hover, #f3f4f6)",
                      borderRadius: "4px",
                      color: "var(--gh-text-secondary, #6b7280)",
                      flexShrink: 0,
                    }}>
                    {p.category || t("uncategorized") || ""}
                  </span>
                </div>

                {/*  */}
                <div
                  style={{
                    fontSize: "13px",
                    color: "var(--gh-text-secondary, #6b7280)",
                    lineHeight: 1.4,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}>
                  {p.content}
                </div>

                {/*  */}
                <div
                  className="prompt-item-actions"
                  style={{ position: "absolute", top: "8px", right: "8px", gap: "4px" }}>
                  {/* ⭐  */}
                  <Tooltip
                    content={p.pinned ? t("promptUnpin") || "" : t("promptPin") || ""}>
                    <button
                      onClick={(e) => handleTogglePin(p.id, e)}
                      style={{
                        width: "24px",
                        height: "24px",
                        border: "1px solid var(--gh-border, #e5e7eb)",
                        background: p.pinned ? "var(--gh-primary, #4285f4)" : "var(--gh-bg, white)",
                        borderRadius: "4px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "var(--gh-shadow-sm, 0 1px 3px rgba(0,0,0,0.1))",
                        fontSize: "12px",
                        color: p.pinned ? "white" : "var(--gh-text-secondary, #6b7280)",
                      }}>
                      <PinIcon size={12} filled={p.pinned} />
                    </button>
                  </Tooltip>
                  <Tooltip content="">
                    <button
                      onMouseDown={(e) => {
                        e.stopPropagation()
                        const item = e.currentTarget.closest(".prompt-item") as HTMLDivElement
                        if (item) item.draggable = true
                      }}
                      onMouseUp={(e) => {
                        const item = e.currentTarget.closest(".prompt-item") as HTMLDivElement
                        if (item) item.draggable = false
                      }}
                      style={{
                        width: "24px",
                        height: "24px",
                        border: "1px solid var(--gh-border, #e5e7eb)",
                        background: "var(--gh-bg, white)",
                        borderRadius: "4px",
                        cursor: "grab",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "var(--gh-shadow-sm, 0 1px 3px rgba(0,0,0,0.1))",
                        fontSize: "12px",
                      }}>
                      <DragIcon size={14} />
                    </button>
                  </Tooltip>
                  {/* ⭐  */}
                  <Tooltip content={t("promptMarkdownPreview") || ""}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                        setPreviewModal({ show: true, prompt: p })
                      }}
                      style={{
                        width: "24px",
                        height: "24px",
                        border: "1px solid var(--gh-border, #e5e7eb)",
                        background: "var(--gh-bg, white)",
                        borderRadius: "4px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "var(--gh-shadow-sm, 0 1px 3px rgba(0,0,0,0.1))",
                        fontSize: "12px",
                      }}>
                      <EyeIcon size={14} />
                    </button>
                  </Tooltip>
                  <Tooltip content={t("copy")}>
                    <button
                      onClick={(e) => handleCopy(p.content, e)}
                      style={{
                        width: "24px",
                        height: "24px",
                        border: "1px solid var(--gh-border, #e5e7eb)",
                        background: "var(--gh-bg, white)",
                        borderRadius: "4px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "var(--gh-shadow-sm, 0 1px 3px rgba(0,0,0,0.1))",
                        fontSize: "12px",
                      }}>
                      <CopyIcon size={14} />
                    </button>
                  </Tooltip>
                  <Tooltip content={t("edit")}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                        openEditModal(p)
                      }}
                      style={{
                        width: "24px",
                        height: "24px",
                        border: "1px solid var(--gh-border, #e5e7eb)",
                        background: "var(--gh-bg, white)",
                        borderRadius: "4px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "var(--gh-shadow-sm, 0 1px 3px rgba(0,0,0,0.1))",
                        fontSize: "12px",
                      }}>
                      <EditIcon size={14} />
                    </button>
                  </Tooltip>
                  <Tooltip content={t("delete")}>
                    <button
                      onClick={(e) => handleDelete(p.id, e)}
                      style={{
                        width: "24px",
                        height: "24px",
                        border: "1px solid var(--gh-border, #e5e7eb)",
                        background: "var(--gh-bg, white)",
                        borderRadius: "4px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "var(--gh-shadow-sm, 0 1px 3px rgba(0,0,0,0.1))",
                        fontSize: "12px",
                        color: "var(--gh-text-danger, #ef4444)",
                      }}>
                      <DeleteIcon size={14} />
                    </button>
                  </Tooltip>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/*  */}
      <div style={{ padding: "12px" }}>
        <button
          onClick={() => openEditModal()}
          style={{
            width: "100%",
            padding: "10px",
            background: "var(--gh-header-bg)",
            color: "var(--gh-footer-text, var(--gh-text-on-primary, white))",
            border: "none",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: 500,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            boxShadow: "var(--gh-btn-shadow)",
            transition: "transform 0.2s, box-shadow 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-1px)"
            e.currentTarget.style.boxShadow = "var(--gh-btn-shadow-hover)"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)"
            e.currentTarget.style.boxShadow = "var(--gh-btn-shadow)"
          }}>
          <span>+</span>
          <span>{t("addPrompt")}</span>
        </button>
      </div>

      {/*  */}
      {renderEditModal()}
      {renderCategoryModal()}
      {renderPreviewModal()}
      {renderImportDialog()}

      {/*  */}
      {confirmState.show && (
        <ConfirmDialog
          title={confirmState.title}
          message={confirmState.message}
          danger
          closeOnOverlayClick={false}
          onConfirm={() => {
            closeConfirmDialog()
            confirmState.onConfirm()
          }}
          onCancel={closeConfirmDialog}
        />
      )}
      {promptInputState.show && (
        <InputDialog
          title={promptInputState.title}
          defaultValue={promptInputState.defaultValue}
          closeOnOverlayClick={false}
          onConfirm={(value) => {
            closePromptInputDialog()
            promptInputState.onConfirm(value)
          }}
          onCancel={closePromptInputDialog}
        />
      )}

      {/* ⭐  */}
      {variableDialogState.show && (
        <VariableInputDialog
          variables={variableDialogState.variables}
          onConfirm={handleVariableConfirm}
          onCancel={closeVariableDialog}
        />
      )}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
    </div>
  )
}
