/// <reference types="vite/client" />

/**
 * Vite 
 *
 *  ?inline 
 */

declare module "*?inline" {
  const content: string
  export default content
}

declare module "*.css?inline" {
  const content: string
  export default content
}

declare const __PLATFORM__: "extension" | "userscript"

declare const GM_info: {
  script: {
    version: string
  }
}
