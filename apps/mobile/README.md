# @wathba/mobile

Wathba mobile — Expo (React Native, TypeScript). RTL forced, dual theme,
Arabic-first.

## Setup

```bash
# from monorepo root
pnpm install
cd apps/mobile
pnpm dev      # opens Expo dev server
# scan QR with Expo Go (Android) or Camera (iOS), or press 'w' for web
```

API base URL defaults to `http://localhost:4000`; override via the
`EXPO_PUBLIC_API_BASE_URL` env var.

## Conventions

- Money is always halalas (integer); display via `formatSAR` from
  `@wathba/types`.
- Force RTL via `ensureRtl()` (called from `app/_layout.tsx`).
- Use design tokens from `@wathba/ui-tokens` — never hard-code colors.
- Strings live in `src/i18n/ar.ts`. Add new strings there.
