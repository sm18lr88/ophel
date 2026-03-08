# Ophel Atlas

## Overview

Ophel Atlas is a browser extension and userscript for organizing AI conversations into a more structured workflow.

Supported targets:

- ChatGPT
- Gemini
- Gemini Enterprise
- Claude
- Grok
- AI Studio

## Stack

- TypeScript
- React
- Zustand
- Plasmo
- Vite
- vite-plugin-monkey

## Key Paths

- `src/adapters/`: site adapters
- `src/components/`: React UI
- `src/core/`: runtime managers and orchestration
- `src/stores/`: Zustand state
- `src/platform/`: extension/userscript platform abstraction
- `src/utils/`: shared utilities
- `src/tabs/`: standalone pages
- `docs/`: English VitePress docs

## Common Commands

```bash
pnpm install
pnpm dev
pnpm build
pnpm build:firefox
pnpm build:userscript
pnpm docs:dev
pnpm docs:build
```

## Security

- All dependencies are vendored locally in `vendor/deps/` as `file:` references.
- Outbound connections are restricted to an allowlist of American LLM provider domains.
- WebDAV sync is gated behind explicit user opt-in, HTTPS-only, with method/header allowlists.
- Non-American LLM provider support (Doubao/ByteDance) has been removed.
- See `SECURITY_AUDIT.md` for the full findings log (SA-001 through SA-030).

## Notes

- The repository is English-only.
- Runtime localization has been reduced to English resources only.
- Manifest locale assets beyond English have been removed.
