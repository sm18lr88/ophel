/**
 * Site adapter factory
 *
 * Automatically selects the appropriate adapter based on the current page URL
 */

import { AIStudioAdapter } from "./aistudio"
import { SiteAdapter } from "./base"
import { ChatGPTAdapter } from "./chatgpt"
import { ClaudeAdapter } from "./claude"
import { GeminiAdapter } from "./gemini"
import { GeminiEnterpriseAdapter } from "./gemini-enterprise"
import { GrokAdapter } from "./grok"

// All available adapters
const adapters: SiteAdapter[] = [
  new GeminiEnterpriseAdapter(),
  new GeminiAdapter(),
  new ChatGPTAdapter(),
  new GrokAdapter(),
  new AIStudioAdapter(),
  new ClaudeAdapter(),
]

/**
 * Get the adapter matching the current page
 */
export function getAdapter(): SiteAdapter | null {
  for (const adapter of adapters) {
    if (adapter.match()) {
      return adapter
    }
  }
  return null
}

/**
 * Get all registered adapters
 */
export function getAllAdapters(): SiteAdapter[] {
  return [...adapters]
}

// Export types and base class
export { SiteAdapter } from "./base"
export type {
  OutlineItem,
  ConversationInfo,
  ConversationDeleteTarget,
  NetworkMonitorConfig,
  ModelSwitcherConfig,
  ExportConfig,
  ConversationObserverConfig,
  SiteDeleteConversationResult,
  AnchorData,
} from "./base"
