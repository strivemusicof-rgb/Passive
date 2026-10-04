# LANDRUSH: improved plan and first build

## Context
The user wants a new iOS game, **LANDRUSH**. Players buy virtual land plots on a real-world map, put buildings on them, earn passive coins and trade plots with other players. Their roadmap document (31 sections) is solid. This plan keeps it, fixes the risky parts, adds features that should help players come back, and sets the build order for the first TestFlight build.

Decisions made with the user:
- **Backend:** NestJS + PostgreSQL, as the document suggests. (PocketBase was offered and declined.)
- **Location:** players can buy land anywhere. The free starter plot is placed where the player is, and walking to an owned plot gives a daily check-in bonus.
- **First TestFlight build:** the core loop only. Ads and in-app purchases (IAP) come after friends have tested it and said it's fun.
- Same app stack as the user's other apps: Expo SDK 57, Expo Router, TypeScript, EAS → TestFlight, LV/RU/EN, no paid APIs.

Repo: `strivemusicof-rgb/Passive` (empty right now, cloned at `/home/user/passive`).

---

## 1. Changes to the document (what I'd improve)

| Topic | Document says | Change | Why |
|---|---|---|---|
| Land grid | "plots based on coordinates" | **H3 hexagons** (Uber's free library, `h3-js`, runs on the server). Resolution 11 (about 25 m edges, roughly the size of a building). We test res 10 vs 11 on the real map in M2 and lock it before launch. | Every place on Earth already has a plot ID, so **plots don't need to be stored until someone buys them**. Hexagons also make "connected plots" (districts) simple. |
| Rarity | stored per plot | **Calculated from the plot ID** (hash of ID + secret seed), plus admin-defined **hotspots** (Old Town, Jūrmala beach, Freedom Monument) that raise the odds of rarer plots | Nothing needs to be generated for the whole world, and famous places feel special. |
| Income collection | collect each plot | **One "Collect all" button + a storage limit** (8 h at the start, upgradeable) | Short sessions, and "your storage is full!" is the push notification that brings players back. |
| Coin sinks | not covered | Each new plot costs a bit more than the last (soft cap), upgrades, 5% market fee, cosmetic name/skin changes | Without ways to spend coins, prices inflate and the economy breaks within weeks. |
| Marketplace anti-fraud | "anti-fraud limits" | Price must stay within **0.5×–20× of the plot's base value**. Accounts under 3 days old can't list. Daily trade limit. | Stops people moving coins between their own accounts and blocks bots. |
| Redis | needed from day 1 | **Left out of the MVP.** Postgres handles leaderboards for a Latvia launch. Redis is added when needed. | One less service to run. |
| Admin panel | custom web app | MVP: protected admin API routes + **Adminer** (a free database UI, reachable only through an SSH tunnel). A proper admin web app comes in Phase 9. | Saves weeks of work before we know players like the game. |
| Login | Apple + email + guest | MVP: **Sign in with Apple** + a developer login for testing. Email login comes later (it needs an email sender). | Apple login is free and required anyway. |

### New features to add (ranked by value / effort)
1. **Check-in bonus.** Stand within about 100 m of a plot you own to collect a daily bonus. Rewards stay small, because GPS can be faked. *(MVP)*
2. **Neighbour bonus.** Owning plots next to each other gives +5% each. This is the first step towards districts. *(MVP)*
3. **"Someone bought next to you!" notification.** Creates a bit of competition with nearby players. *(MVP+)*
4. **Plot names** shown on the map ("Kārlis' Garden"). Cheap to build and makes plots feel owned. *(MVP+)*
5. **Make an offer** on a plot that isn't listed for sale. Gets more trading going. *(Phase 7)*
6. **Founder badges.** "First owner in Old Town", and similar. *(Phase 8)*
7. **Seasons.** Leaderboards reset every 2–3 months and the best players get a cosmetic reward, so new players can still win. *(Phase 8)*
8. **Abandoned land.** If an owner is inactive for 90+ days, their plots stop earning and get an "abandoned" tag. They are not taken away. *(later)*

### Legal / App Store points the document doesn't cover
- If "land tickets" give a **random rarity**, Apple requires the odds to be shown (guideline 3.1.1).
- EU consumer rules on in-game currency: show the **real € price** next to coin packs, and no misleading "limited time" pressure.
- AdMob needs the App Tracking Transparency (ATT) prompt and privacy labels. This comes with the monetization phase.
- **Check the "LANDRUSH" name** on the App Store and for trademarks before using it in branding.
- Never use the words "invest", "returns" or "earn money" in the App Store listing (the document already says this, and I'll keep to it).

---

## 2. Architecture

```
iPhone (Expo app) ──HTTPS──► Nginx (VPS) ──► NestJS API (Docker) ──► PostgreSQL (Docker)
                                                     │
                                       h3-js grid + economy config in database
```
It runs on the user's existing OVH VPS next to PocketBase, through Docker Compose, on its own subdomain (e.g. `api.<domain>`). The server sends the hexagon shapes to the app, so the iPhone app doesn't need `h3-js` (it can be unreliable on React Native).

### Repo layout (pnpm monorepo)
```
/app        Expo SDK 57 + Expo Router + TypeScript (iOS)
/server     NestJS + Prisma + PostgreSQL
/shared     shared TypeScript types + API request/response shapes
/deploy     docker-compose.yml, nginx config, backup script, README for the VPS
```

### Key server rules (server-authoritative)
- Every coin change happens inside **one database transaction**: lock the wallet row → check → write to the `transactions` ledger → update the balance.
- Wallet balance can't go below zero (database check). Each plot can have only one active listing (unique index).
- Income = Σ(plot rate × neighbour bonus) × min(time since last collect, storage cap). Calculated only on the server.
- All economy numbers live in an `economy_config` table, so balance can change **without a new iOS build**.

### Database (Prisma schema)
`users`, `wallets`, `transactions` (ledger), `plots` (only bought plots: `h3_index` PK, owner, building level, name), `listings`, `missions`, `user_missions`, `check_ins`, `hotspots`, `economy_config`, `audit_log`. (`iap_transactions` and `leaderboard_entries` come in later phases.)

### App screens (MVP)
Loading → Sign in → Tutorial (claim starter plot → collect → upgrade) → **Map** (hexes for owned / free / for-sale plots, balance, income/h, Collect button) → Plot sheet (buy / build / list / name) → My Lands → Marketplace → Missions → Profile → Settings (language LV/RU/EN, notifications, delete account).
Map: `react-native-maps` (Apple Maps, free). Only plots inside the visible area are loaded, and only when zoomed in enough.

---

## 3. Build order (milestones)

| # | Milestone | Contents |
|---|---|---|
| M0 ✅ | Foundation | Monorepo, Expo app skeleton + tabs + LV/RU/EN i18n, NestJS + Prisma + Postgres via Docker Compose, health endpoint, CLAUDE.md, CI (lint + tests) |
| M1 | Accounts | Sign in with Apple (server checks Apple's token), JWT access/refresh, `/me`, developer login, account deletion |
| M2 | Map + plots | H3 grid service, `GET /map/plots?bbox`, rarity + hotspots, starter plot from GPS, plot sheet, buy plot |
| M3 | Economy | Wallet + ledger, buildings 0–4 (Empty→Tower) from config, upgrade, collect all + storage cap, neighbour bonus |
| M4 | Retention | Daily missions, 7-day login streak, XP/levels, check-in bonus, local push "storage full" |
| M5 | Marketplace | List / cancel / buy (atomic), 5% fee, price limits, history, My Lands |
| M6 | TestFlight beta | Leaderboard (plots / net worth, LV), tutorial, VPS deploy + HTTPS + daily backups, EAS build → TestFlight for friends |
| later | Phase 6+ from the document | Rewarded ads (AdMob with server-side checks), IAP, admin web app, districts, events, Baltic expansion, Android |

After each milestone I commit and push to a branch on `strivemusicof-rgb/Passive`.

### What I'll need from the user (later, not now)
- A domain or subdomain pointed at the VPS (for HTTPS). I'll give exact steps at M6.
- They run the deploy commands on the VPS themselves. I'll write a copy-paste guide. No passwords or keys in chat.
- Apple Developer setup for Sign in with Apple (bundle ID). I'll give exact steps at M1.

---

## 4. Verification
- **Server:** Jest unit tests for income math, storage cap, neighbour bonus and marketplace fees. Integration tests (supertest + a real Postgres in Docker) for buy / collect / list / buy-listing, including **two buyers at the same time → only one wins** and balances always match the ledger.
- **App:** TypeScript strict + ESLint. The user tests each milestone through an EAS development build on their iPhone; from M6 it goes through TestFlight.
- **End-to-end check before TestFlight:** new account → starter plot appears where the user is → wait → collect → upgrade → list plot → second test account buys it → both wallets and the ledger are correct.
