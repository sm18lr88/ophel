import type { PlasmoCSConfig } from "plasmo"

import { initNetworkMonitor } from "../core/network-monitor"

export const config: PlasmoCSConfig = {
  matches: [
    "https://gemini.google.com/*",
    "https://business.gemini.google/*",
    "https://aistudio.google.com/*",
    "https://grok.com/*",
    "https://chat.openai.com/*",
    "https://chatgpt.com/*",
    "https://claude.ai/*",
  ],
  world: "MAIN",
}

initNetworkMonitor()
