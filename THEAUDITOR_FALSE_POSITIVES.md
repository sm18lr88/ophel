# TheAuditor False Positive Report

This document records findings from TheAuditor that were assessed as false positives in this codebase, to help tune detection rules.

## CWE-79: dangerouslySetInnerHTML (All FALSE POSITIVE)

**Pattern**: TheAuditor flags all uses of `dangerouslySetInnerHTML` as XSS risks.

**Why false positive**: Every `dangerouslySetInnerHTML` in this codebase wraps content through `createSafeHTML()` (defined in `src/utils/trusted-types.ts`), which:

1. Calls `sanitizeHTML()` with a strict tag allowlist (no `<script>`, `<iframe>`, `<object>`, `<embed>`, `<style>`, `<link>`, `<meta>`)
2. Strips all `on*` event handler attributes and inline `style` attributes
3. Validates `href` values (only `http:`, `https:`, `mailto:`, relative paths)
4. Creates a Trusted Types policy when the browser supports it

**Affected locations**:

- `src/components/App.tsx:3187` — `createSafeHTML(renderMarkdown(globalSearchPromptPreview.content, false))`
- `src/components/PromptsTab.tsx:1142` — `createSafeHTML(renderMarkdown(editingPrompt?.content || ""))`
- `src/components/PromptsTab.tsx:1380` — `createSafeHTML(renderMarkdown(previewModal.prompt.content))`

**Suggested rule improvement**: Suppress CWE-79 when `dangerouslySetInnerHTML.__html` is wrapped in a known sanitization function (e.g., `createSafeHTML`, `DOMPurify.sanitize`, `sanitizeHTML`).

## CWE-248: new Promise() with resolve only (All FALSE POSITIVE)

**Pattern**: TheAuditor flags `new Promise((resolve) => ...)` (without a `reject` parameter) as "errors will be swallowed."

**Why false positive**: These are all intentional DOM-wait / timeout patterns where rejection is semantically impossible:

- `setTimeout(() => resolve(...), ms)` — timer callbacks cannot fail
- `MutationObserver` callbacks that `resolve()` when a DOM element appears — either the element appears or the Promise stays pending (no error to reject with)
- `requestAnimationFrame(() => resolve())` — frame callbacks cannot fail

In these patterns, adding `reject` would be dead code with no caller to trigger it.

**Affected locations** (25 instances):

- `src/adapters/aistudio.ts:659,663,1401` — MutationObserver/timer waits
- `src/adapters/chatgpt.ts:725` — MutationObserver wait
- `src/adapters/claude.ts:770` — MutationObserver wait
- `src/adapters/gemini-enterprise.ts:741,1681` — MutationObserver/timer waits
- `src/adapters/gemini.ts:797` — MutationObserver wait
- `src/adapters/grok.ts:111,124,984` — MutationObserver/timer waits
- `src/components/ConversationsTab.tsx:994,1185` — requestAnimationFrame/timer waits
- `src/core/conversation/manager.ts:944` — timer wait
- `src/core/policy-retry-manager.ts:86` — timer wait
- `src/core/prompt-manager.ts:107,234,313` — MutationObserver/timer waits
- `src/platform/userscript/index.ts:188` — timer wait
- `src/stores/chrome-adapter.ts:52,72,81` — chrome API callbacks (error via chrome.runtime.lastError, not rejection)
- `src/tabs/options/pages/ClaudeSettings.tsx:195` — timer wait
- `src/utils/dom-toolkit.ts:433` — MutationObserver wait
- `src/utils/history-loader.ts:271` — MutationObserver wait
- `src/utils/scroll-helper.ts:112` — requestAnimationFrame wait
- `src/utils/storage.ts:567,616` — chrome.storage callbacks

**Suggested rule improvement**: Suppress CWE-248 "resolve-only" when the Promise body contains only `setTimeout`, `requestAnimationFrame`, `MutationObserver`, or Chrome extension API callbacks (`chrome.storage.*`, `chrome.runtime.*`). These are inherently resolve-only patterns.

## CWE-248: Promise .then() without .catch() (Mostly FALSE POSITIVE)

**Pattern**: TheAuditor flags `.then()` chains that lack a corresponding `.catch()`.

**Why mostly false positive**: Many are fire-and-forget UI operations where failure is non-critical:

- Theme application (`theme-manager.ts:697,797`) — cosmetic, non-critical
- Module initialization (`modules-init.ts:280`) — wrapped in outer try/catch
- Settings store persistence (`settings-store.ts:236`) — best-effort save
- Copy-manager clipboard operations (`copy-manager.ts:135,328`) — UI feedback only
- User-query-markdown rescan (`user-query-markdown.ts:337`) — background refresh

**One true positive**: `App.tsx:506` was flagged but actually HAS a `.catch()` on line 509 — the auditor missed the chained `.catch()`.

**Two true positives fixed**: `PromptsTab.tsx:1137,1375` — clipboard `writeText().then()` without `.catch()`. These were fixed with added `.catch()` handlers.

**Suggested rule improvement**:

1. Check for `.catch()` on subsequent lines (chained), not just the same line.
2. Consider suppressing for fire-and-forget UI patterns (clipboard, toast, theme apply) where the caller doesn't need the result.

## CWE-477: Non-null assertion (!) (All FALSE POSITIVE for security)

**Pattern**: TheAuditor flags TypeScript `!` (non-null assertion) as potentially hiding null errors.

**Why false positive for security**: Non-null assertions are a TypeScript type-narrowing feature, not a security vulnerability. CWE-477 ("Use of Obsolete Function") is a poor mapping. These are code quality concerns, not exploitable weaknesses:

- `src/adapters/claude.ts:939,940` — DOM element access after null check on prior line
- `src/components/OutlineTab.tsx:985` — Element guaranteed to exist in render context
- `src/core/watermark-remover.ts:356,370` — Match result access after regex test
- `src/utils/exporter.ts:194` — Array access after length check

**Suggested rule improvement**: Do not flag non-null assertions under CWE-477. If flagging is desired, use a code-quality category rather than a security CWE.

## CWE-477: @ts-ignore → @ts-expect-error (All FALSE POSITIVE for security)

**Pattern**: TheAuditor flags `@ts-ignore` as suppressing all errors.

**Why false positive for security**: `@ts-ignore` vs `@ts-expect-error` is a TypeScript development best-practice, not a security vulnerability. CWE-477 is not applicable. The flagged instances:

- `src/components/MainPanel.tsx:337` — Plasmo framework type mismatch
- `src/core/network-monitor.ts:187,189,191,196` — PerformanceObserver API type gaps
- `src/core/webdav-sync.ts:585,614` — Chrome extension API type overrides

**Suggested rule improvement**: Flag `@ts-ignore` under a "code quality" category, not CWE-477.
