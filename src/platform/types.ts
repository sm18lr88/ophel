export interface PlatformStorage {
  get<T>(key: string): Promise<T | undefined>

  set<T>(key: string, value: T): Promise<void>

  remove(key: string): Promise<void>

  watch<T>(
    key: string,
    callback: (newValue: T | undefined, oldValue: T | undefined) => void,
  ): () => void
}

export interface FetchOptions {
  method?: string
  headers?: Record<string, string>
  body?: string
  credentials?: "include" | "omit" | "same-origin"
}

export interface FetchResponse {
  ok: boolean
  status: number
  statusText: string
  text(): Promise<string>
  json<T>(): Promise<T>
  blob(): Promise<Blob>
}

export interface NotifyOptions {
  title: string
  message: string
  timeout?: number
  silent?: boolean
}

export interface ClaudeKeyResult {
  success: boolean
  sessionKey?: string
  error?: string
}

export interface ClaudeTestResult {
  success: boolean
  isValid: boolean
  accountType?: string
  error?: string
}

export interface Platform {
  readonly type: "extension" | "userscript"

  readonly storage: PlatformStorage

  fetch(url: string, options?: FetchOptions): Promise<FetchResponse>

  notify(options: NotifyOptions): void

  focusWindow(): void

  openTab(url: string): void

  hasCapability(cap: PlatformCapability): boolean

  getClaudeSessionKey(): Promise<ClaudeKeyResult>

  testClaudeSessionKey(sessionKey: string): Promise<ClaudeTestResult>

  setClaudeSessionKey(sessionKey: string): Promise<{ success: boolean; error?: string }>

  switchNextClaudeKey(): Promise<{ success: boolean; keyName?: string; error?: string }>
}

export type PlatformCapability =
  | "cookies"
  | "permissions"
  | "tabs"
  | "declarativeNetRequest"
  | "commands"
