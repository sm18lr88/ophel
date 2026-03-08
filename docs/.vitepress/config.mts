// @ts-nocheck
import { defineConfig } from "vitepress"

const guideSidebar = [
  {
    text: "Getting Started",
    items: [{ text: "Quick Start", link: "/guide/getting-started" }],
  },
  {
    text: "Core Features",
    items: [
      { text: "Overview", link: "/guide/features/" },
      { text: "Smart Outline", link: "/guide/features/outline" },
      { text: "Conversation Manager", link: "/guide/features/conversation" },
      { text: "Prompt Library", link: "/guide/features/prompt" },
    ],
  },
  {
    text: "Settings",
    items: [
      { text: "Overview", link: "/guide/enhancements" },
      { text: "Appearance", link: "/guide/appearance" },
      { text: "Shortcuts", link: "/guide/shortcuts" },
      { text: "Data & Permissions", link: "/guide/privacy" },
    ],
  },
  {
    text: "Help",
    items: [{ text: "FAQ", link: "/guide/faq" }],
  },
]

export default defineConfig({
  title: "Ophel",
  description: "AI conversation enhancement for ChatGPT, Gemini, Claude, Grok, AI Studio, and Doubao",
  head: [
    ["link", { rel: "icon", href: "/ophel/logo.png" }],
    [
      "meta",
      {
        name: "google-site-verification",
        content: "kZpWtKdWmStJ_vaL2dPQR9S3knmmRGCSy11w6fTyQ5g",
      },
    ],
  ],
  base: "/ophel/",
  srcExclude: ["**/i18n/**", "zh/**", "en/**"],
  themeConfig: {
    logo: "/logo.png",
    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      {
        text: "Features",
        items: [
          { text: "Overview", link: "/guide/features/" },
          { text: "Smart Outline", link: "/guide/features/outline" },
          { text: "Conversation Manager", link: "/guide/features/conversation" },
          { text: "Prompt Library", link: "/guide/features/prompt" },
        ],
      },
      { text: "FAQ", link: "/guide/faq" },
      {
        text: "Download",
        items: [
          { text: "GitHub Releases", link: "https://github.com/urzeye/ophel/releases" },
          {
            text: "Chrome Web Store",
            link: "https://chromewebstore.google.com/detail/ophel-ai-chat-enhancer/lpcohdfbomkgepfladogodgeoppclakd",
          },
          {
            text: "Firefox Add-ons",
            link: "https://addons.mozilla.org/firefox/addon/ophel-ai-chat-enhancer/",
          },
          {
            text: "Greasy Fork",
            link: "https://greasyfork.org/scripts/563646-ophel-ai-chat-page-enhancer",
          },
        ],
      },
    ],
    sidebar: {
      "/guide/": guideSidebar,
    },
    socialLinks: [{ icon: "github", link: "https://github.com/urzeye/ophel" }],
    footer: {
      message: "Released under the CC BY-NC-SA 4.0 License.",
      copyright: "Copyright © 2024-present Ophel",
    },
    search: { provider: "local" },
    docFooter: { prev: "Previous", next: "Next" },
    outline: { label: "On this page", level: [2, 3] },
    lastUpdated: { text: "Last updated" },
    returnToTopLabel: "Back to top",
    sidebarMenuLabel: "Menu",
    darkModeSwitchLabel: "Theme",
    lightModeSwitchTitle: "Switch to light mode",
    darkModeSwitchTitle: "Switch to dark mode",
    editLink: {
      pattern: "https://github.com/urzeye/ophel/edit/main/docs/:path",
      text: "Edit this page on GitHub",
    },
  },
  markdown: {
    lineNumbers: true,
  },
})
