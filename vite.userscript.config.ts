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

const scriptName = "Ophel Atlas - AI Chat Organizer & Navigator (Support Gemini, ChatGPT, Claude, Grok, AI Studio)"
const scriptDescription =
  "Turn AI chats into readable, navigable knowledge. Use outlines, folders, and prompts to organize your workflow and stop scrolling. | Features: Real-time Outline, Conversation Manager (Folders/Pin/Export), Prompt Library, Immersion/Widescreen/Scroll Lock, Theme Switcher, Markdown Fix, LaTeX/Table Copy, WebDAV Sync, Privacy, Shortcuts, Tab Renamer, History Restore, Watermark Remover"

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    monkey({
      entry: "src/platform/userscript/entry.tsx",
      userscript: {
        name: scriptName,
        description: scriptDescription,
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
        autoGrant: true,
      },
    }),
  ],
  resolve: {
    alias: {
      "@plasmohq/storage": path.resolve(__dirname, "src/platform/userscript/storage-polyfill.ts"),
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
    __PLATFORM__: JSON.stringify("userscript"),
  },
  build: {
    outDir: "build/userscript",
    minify: "terser",
    terserOptions: {
      format: {
        comments: /==\/?UserScript==|@/,
        ascii_only: true,
      },
    },
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.message.includes("dynamic import will not move module into another chunk"))
          return
        warn(warning)
      },
    },
  },
})
