// @ts-nocheck
import * as fs from "fs"
import * as path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import monkey from "vite-plugin-monkey"

// ========== Dynamic Metadata Loading ==========
const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, "package.json"), "utf-8"))
const author: string = pkg.author
const version: string = pkg.version
const license: string = pkg.license

const localeMapping: Record<string, string> = {
  en: "en",
}

// Read name and description from locale files
function loadLocalizedMetadata(): {
  name: Record<string, string>
  description: Record<string, string>
} {
  const seoNameEN = " (Support Gemini, ChatGPT, Claude, Grok, AI Studio)"
  const seoKeywordsEN =
    " | Features: Real-time Outline, Conversation Manager (Folders/Pin/Export), Prompt Library, Immersion/Widescreen/Scroll Lock, Theme Switcher, Markdown Fix, LaTeX/Table Copy, WebDAV Sync, Privacy, Shortcuts, Tab Renamer, History Restore, Watermark Remover"
  const defaultDescription =
    "Turn AI chats into readable, navigable knowledge. Use outlines, folders, and prompts to organize your workflow and stop scrolling." +
    seoKeywordsEN

  const name: Record<string, string> = { "": "Ophel Atlas - AI Chat Organizer & Navigator" + seoNameEN }
  const description: Record<string, string> = {
    "": defaultDescription.substring(0, 500),
  }

  const localesDir = path.resolve(__dirname, "locales")
  for (const [dirName, localeCode] of Object.entries(localeMapping)) {
    const messagesPath = path.join(localesDir, dirName, "messages.json")
    if (fs.existsSync(messagesPath)) {
      try {
        const messages = JSON.parse(fs.readFileSync(messagesPath, "utf-8"))
        if (messages.extensionName?.message) {
          let extensionName = messages.extensionName.message
          extensionName += seoNameEN
          name[localeCode] = extensionName
        }
        if (messages.extensionDescription?.message) {
          let desc = messages.extensionDescription.message
          desc += seoKeywordsEN
          description[localeCode] = desc
        }
      } catch {
        console.warn(`Failed to parse ${messagesPath}`)
      }
    }
  }
  return { name, description }
}

const { name: localizedName, description: localizedDescription } = loadLocalizedMetadata()

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    monkey({
      entry: "src/platform/userscript/entry.tsx",
      userscript: {
        name: localizedName,
        description: localizedDescription,
        version: version,
        author: author,
        namespace: "https://github.com/sm18lr88/ophel",
        license: license,
        match: [
          "https://gemini.google.com/*",
          "https://business.gemini.google/*",
          "https://aistudio.google.com/*",
          "https://grok.com/*",
          "https://chat.openai.com/*",
          "https://chatgpt.com/*",
          "https://claude.ai/*",
        ],
        grant: [
          "GM_getValue",
          "GM_setValue",
          "GM_deleteValue",
          "GM_addValueChangeListener",
          "GM_removeValueChangeListener",
          "GM_xmlhttpRequest",
          "GM_notification",
          "GM_cookie",
          "unsafeWindow",
          "window.focus",
        ],
        connect: [
          "gemini.google.com",
          "business.gemini.google",
          "aistudio.google.com",
          "lh3.googleusercontent.com",
          "chatgpt.com",
          "chat.openai.com",
          "grok.com",
          "claude.ai",
        ],
        "run-at": "document-idle",
        noframes: true,
        homepageURL: "https://github.com/sm18lr88/ophel",
        supportURL: "https://github.com/sm18lr88/ophel/issues",
      },
      build: {
        // CSS 自动注入到 head
        autoGrant: true,
      },
    }),
  ],
  resolve: {
    alias: {
      // ========== Userscript Polyfills ==========
      // 替换 @plasmohq/storage 为 GM_* 实现
      "@plasmohq/storage": path.resolve(__dirname, "src/platform/userscript/storage-polyfill.ts"),
      // 注意：chrome-adapter.ts 已内置跨平台支持（通过 __PLATFORM__ 判断），无需 alias 替换

      // ========== 路径别名（与 Plasmo 的 ~ 别名一致）==========
      "~adapters": path.resolve(__dirname, "src/adapters"),
      "~components": path.resolve(__dirname, "src/components"),
      "~constants": path.resolve(__dirname, "src/constants"),
      "~contents": path.resolve(__dirname, "src/contents"),
      "~contexts": path.resolve(__dirname, "src/contexts"),
      "~core": path.resolve(__dirname, "src/core"),
      "~hooks": path.resolve(__dirname, "src/hooks"),
      "~locales": path.resolve(__dirname, "src/locales"),
      "~platform": path.resolve(__dirname, "src/platform"),
      "~stores": path.resolve(__dirname, "src/stores"),
      "~styles": path.resolve(__dirname, "src/styles"),
      "~tabs": path.resolve(__dirname, "src/tabs"),
      "~types": path.resolve(__dirname, "src/types"),
      "~utils": path.resolve(__dirname, "src/utils"),
      "~style.css": path.resolve(__dirname, "src/style.css"),
      "~": path.resolve(__dirname, "src"),
    },
  },
  define: {
    // 注入平台标识
    __PLATFORM__: JSON.stringify("userscript"),
  },
  build: {
    outDir: "build/userscript",
    minify: "terser",
    terserOptions: {
      format: {
        // 保留油猴 meta 注释
        comments: /==\/?UserScript==|@/,
      },
    },
    rollupOptions: {
      // 构建警告抑制
      onwarn(warning, warn) {
        if (warning.message.includes("dynamic import will not move module into another chunk"))
          return
        warn(warning)
      },
    },
  },
})
