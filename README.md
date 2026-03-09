# Ophel Atlas

Turn AI chats into documents you can read, navigate, and reuse.

## What It Does

Ophel Atlas adds structure on top of AI chat products: ChatGPT, Claude, Gemini, Gemini Enterprise, Grok, and AI Studio.

- Real-time outlines for long conversations
- Conversation folders, tags, and search
- Prompt library with variables and previews
- Theme customization and layout controls
- Reading-history restore and export tools
- WebDAV sync (optional)

## Local Development

Requirements:

- Node.js 20+
- pnpm 9+

```bash
git clone https://github.com/sm18lr88/ophel.git
cd ophel
pnpm install
pnpm dev
```

Useful scripts:

- `pnpm build`
- `pnpm build:firefox`
- `pnpm build:userscript`
- `pnpm typecheck`

## Stack

- Plasmo
- React
- TypeScript
- Zustand
- Vite
- vite-plugin-monkey

## Security

This fork has been hardened against supply-chain and network-layer threats. All dependencies are vendored locally. Outbound connections are restricted to an explicit allowlist of American LLM provider domains. See [SECURITY_AUDIT.md](./SECURITY_AUDIT.md) for the full findings and remediation log.

## Credits

Originally created by [urzeye](https://github.com/urzeye/ophel). This fork applies security hardening, dependency vendoring, and English-only simplification.

## License

GPL-3.0-only. See [LICENSE](./LICENSE).
