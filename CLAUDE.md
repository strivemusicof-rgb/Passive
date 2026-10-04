# LANDRUSH

Location-based land game. iOS first. Plan and milestones: `docs/PLAN.md` (update the milestone table when one is done).

## Layout
- `app/`: Expo SDK 57 + Expo Router (routes in `app/src/app/`). Read `app/AGENTS.md` before touching Expo APIs.
- `server/`: NestJS 12 (ESM, `.js` import suffixes) + Prisma 7 (`server/prisma/schema.prisma`, client generated to `server/src/generated/`, not committed).
- `shared/`: plain TypeScript types/constants with no runtime dependencies, imported as `@landrush/shared`.
- `deploy/`: Docker Compose stack for the OVH VPS (API on 127.0.0.1:3100 behind Nginx).

## Rules
- The server is the authority: the client never decides coins, income, ownership or rewards.
- Every coin change goes through the transaction ledger inside one DB transaction.
- Economy numbers live in the `economy_config` table, never hard-coded in the app.
- All user-facing text goes through i18n (`app/src/i18n/{en,lv,ru}.ts`); add all three languages.
- No paid third-party APIs. No secrets in the app.

## Commands (from repo root)
- `pnpm typecheck && pnpm lint && pnpm test && pnpm --filter server test:e2e`
- Expo commands in this cloud environment need `EXPO_OFFLINE=1` (api.expo.dev is blocked).
- `npx expo install <pkg>` (in `app/`) instead of `pnpm add` for app dependencies.
