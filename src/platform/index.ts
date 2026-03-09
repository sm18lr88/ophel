import { platform as extensionPlatform } from "./extension"
import type { Platform } from "./types"
import { platform as userscriptPlatform } from "./userscript"

declare const __PLATFORM__: "extension" | "userscript"

let platform: Platform

if (typeof __PLATFORM__ !== "undefined" && __PLATFORM__ === "userscript") {
  platform = userscriptPlatform
} else {
  platform = extensionPlatform
}

export { platform }
export type {
  Platform,
  PlatformStorage,
  PlatformCapability,
  FetchOptions,
  FetchResponse,
  NotifyOptions,
} from "./types"
