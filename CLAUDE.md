# LANDRUSH

Location-based land game. iOS first. Plan and milestones: `docs/PLAN.md` (update the milestone table when one is done).

## Layout
- `app/`: Expo SDK 57 + Expo Router (routes in `app/src/app/`). Read `app/AGENTS.md` before touching Expo APIs.
- `server/`: NestJS 12 (ESM, `.js` import suffixes) + Prisma 7 (`server/prisma/schema.prisma`, client generated to `server/src/generated/`, not committed).
- `shared/`: runtime code is plain `.js` with `.d.ts` types (no build step; Node runs it from node_modules, Metro bundles it). `@landrush/shared` = constants + API types, `@landrush/shared/grid` = plot grid math.
- `deploy/`: Docker Compose stack for the OVH VPS (API on 127.0.0.1:3100 behind Nginx).

## Rules
- The server is the authority: the client never decides coins, income, ownership or rewards.
- Every coin change goes through the transaction ledger inside one DB transaction.
- Economy numbers live in the `economy_config` table, never hard-coded in the app.
- All user-facing text goes through i18n (`app/src/i18n/{en,lv,ru}.ts`); add all three languages.
- No paid third-party APIs. No secrets in the app.
- **Never sell coins, plots, buildings, boosts or anything that raises income for real money** (directly or via gems). Land income turns into ⭐ reward points that can be cashed out, so selling income would turn the game into gambling / a pay-in-pay-out scheme. Real-money purchases may only be cosmetic.
- ⭐ points are earned only through the capped `RewardsService.award` (daily caps in economy config, growing with level) and can't be traded between players.
- Rewarded ads pay out only through `AdsService` (one payout per ad view; Google's signed SSV callback when `ads.requireSsv` is on). AdMob setup: `docs/ADS.md`.

## Commands (from repo root)
- `pnpm typecheck && pnpm lint && pnpm test && pnpm --filter server test:e2e`
- Expo commands in this cloud environment need `EXPO_OFFLINE=1` (api.expo.dev is blocked).
- `npx expo install <pkg>` (in `app/`) instead of `pnpm add` for app dependencies.
