import cssText from "data-text:~style.css"
import conversationsCssText from "data-text:~styles/conversations.css"
import settingsCssText from "data-text:~styles/settings.css"
import type { PlasmoCSConfig, PlasmoMountShadowHost } from "plasmo"
import React from "react"

import { App } from "~components/App"

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
}

export const getStyle = () => {
  const style = document.createElement("style")
  style.textContent = cssText + "\n" + conversationsCssText + "\n" + settingsCssText
  return style
}

/**
 *
 */
export const mountShadowHost: PlasmoMountShadowHost = ({
  shadowHost,
  anchor: _anchor,
  mountState: _mountState,
}) => {
  const hostname = window.location.hostname
  const needsDelayedMount =
    hostname.includes("chatgpt.com") ||
    hostname.includes("chat.openai.com") ||
    hostname.includes("grok.com") ||
    hostname.includes("claude.ai")

  const doMount = () => {
    if (!shadowHost.parentElement) {
      document.body.appendChild(shadowHost)
    }
  }

  if (needsDelayedMount) {
    const delays = [500, 1000, 2000, 3000]
    delays.forEach((delay) => {
      setTimeout(doMount, delay)
    })

    const observer = new MutationObserver(() => {
      if (!shadowHost.parentElement) {
        doMount()
      }
    })
    observer.observe(document.body, { childList: true, subtree: false })
  } else {
    doMount()
  }
}

const PlasmoApp = () => {
  return <App />
}

export default PlasmoApp
