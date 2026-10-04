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
| Land grid | "plots based on coordinates" | **Square grid** (~33 m plots, matches the design mockup). Grid math lives in `shared/src/grid.ts`, used by app and server. | Every place on Earth already has a plot ID, so **plots don't need to be stored until someone buys them**. |
| Rarity | stored per plot | **Rolled when you buy.** Every free plot costs the same; the exact odds are shown before buying (Apple 3.1.1). **Landmarks** (Old Town, Freedom Monument, Jūrmala beach…) give better odds. | Exciting reveal moment, fair for everyone, and location still matters. Odds are server config. |
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

### Money rules (decided)
- **Coins, plots, buildings, boosts and income are never sold for real money.** Real-money purchases are cosmetics only.
- **⭐ reward points** are the only cash-out currency: from land income (1 ⭐ per 50 coins collected, max 60/day), check-ins, the day-7 streak, weekly missions, level-ups and later partner offers; 150 ⭐/day total. 1,000 ⭐ = €1, cash-out from €5 via PayPal or gift card, reviewed by hand on the admin page. Points can't be traded.
- Income: rewarded ads + offerwall (cash-reward-friendly network, not AdMob), marketplace fees, cosmetics, sponsors.
- Before switching rewards on publicly: PayPal Business account + a short check with a Latvian accountant/lawyer (taxes, AML limits).

### Design (approved mockup, 12 screens)
The UI follows the user's mockup: dark green theme, rarity colours, isometric plot/building art drawn in code (SVG, swappable for PNG art later), Apple Maps satellite view.
Added to scope from the mockup: **gems** (second, premium currency), **email login + play as guest**, **weekly missions + achievements**, **marketplace favourites**.
iOS app ID: bundle `lv.landrush.app`, team `EYFA6K2Q5Y`.

## 2. Architecture

```
iPhone (Expo app) ──HTTPS──► Nginx (VPS) ──► NestJS API (Docker) ──► PostgreSQL (Docker)
                                                     │
                                       square grid (shared) + economy config in database
```
It runs on the user's existing OVH VPS next to PocketBase, through Docker Compose, on its own subdomain (e.g. `api.<domain>`). The grid math is shared, so the app draws plot squares itself and only asks the server who owns them.

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
`users`, `wallets`, `transactions` (ledger), `plots` (only bought plots: `row`+`col` PK, owner, building level, name), `listings`, `missions`, `user_missions`, `check_ins`, `hotspots`, `economy_config`, `audit_log`. (`iap_transactions` and `leaderboard_entries` come in later phases.)

### App screens (MVP)
Loading → Sign in → Tutorial (claim starter plot → collect → upgrade) → **Map** (hexes for owned / free / for-sale plots, balance, income/h, Collect button) → Plot sheet (buy / build / list / name) → My Lands → Marketplace → Missions → Profile → Settings (language LV/RU/EN, notifications, delete account).
Map: `react-native-maps` (Apple Maps, free). Only plots inside the visible area are loaded, and only when zoomed in enough.

---

## 3. Build order (milestones)

| # | Milestone | Contents |
|---|---|---|
| M0 ✅ | Foundation | Monorepo, Expo app skeleton + tabs + LV/RU/EN i18n, NestJS + Prisma + Postgres via Docker Compose, health endpoint, CLAUDE.md, CI (lint + tests) |
| UI ✅ | Mockup screens | All 12 mockup screens + Shop/More/Settings, built with mock data (`app/src/mock/data.ts`) |
| M1 ✅ | Accounts | Sign in with Apple (server verifies Apple's token), email + password, guest accounts (upgrade to Apple/email keeps progress), 15-min access JWT + rotating refresh tokens in the Keychain, `/me` GET/PATCH/DELETE, rate limits. **Later:** password reset (needs an email sender), revoking Apple tokens on account deletion (needs the Apple .p8 key on the server). |
| M2 ✅ | Map + plots | Square grid (shared JS), `GET /map/plots` (owned + free cells when zoomed in), plot details, buy (flat price +5% per plot owned, rarity rolled with shown odds), free starter plot at the player's GPS spot, wallet + ledger (moved here from M3, buying needs coins; welcome bonus 1,000 coins + 20 gems), My Lands and top-bar balance from the server |
| M3 ✅ | Economy | Income per plot = rarity base + building bonus, +5% per owned neighbour (max +40%); Collect all with 8 h storage (upgradeable to 12/16/24 h for coins); buildings Empty→House→Office→Hotel→Tower (500 / 2,500 / 10,000 / 40,000); buying/upgrading collects first so nothing earns for the past; per-player lock makes double-collect impossible. Balance: common plot 48/day (~3-day payback), all numbers in economy config |
| M4 ✅ | Retention | Daily + weekly missions (reset at Riga midnight / Monday) with Claim, 7-day login streak (coins/gems, resets after a missed day), XP + levels (5 gems per level), check-in bonus within 100 m of your own plot (25% of its daily income, once per plot per day, max 10/day), derived achievements + Badges screen, local "storage full" reminder (expo-notifications, no push server) |
| R ✅ | Rewards | ⭐ points (wallet + ledger, never negative), land income → ⭐ with caps, ⭐ for check-ins/streak/weekly missions/levels, Rewards screen, cash-out requests (real account, 7-day-old account, one at a time, points held/refunded), admin page with token (approve/reject/mark paid, warning signs, rewards on/off), cosmetics-only Shop |
| Map ✅ | Map redesign | Glowing rounded tiles in rarity colours with building icons, dark Apple map by default + satellite switch, floating level/balance pills, glowing Collect card, Missions dot, rounded tab bar. Grid columns now line up (one cell width per ~100 km zone; migration moves existing plots). Later option: own MapLibre + OpenStreetMap style. |
| Ads ✅ | Rewarded video ads | AdMob rewarded video (Google test ads until the AdMob account is set up, see `docs/ADS.md`): 2× last collect and +100 coins/+5 ⭐ bonus, 20 a day, 30 s apart. Server pays once per ad; with `requireSsv` only a Google-signed callback pays. EU consent form + Apple tracking question. ⭐ daily limits now grow with level (150 → 400 free-play, 60 → 250 from land). |
| M5 ✅ | Marketplace | List / cancel / buy between players in one transaction (both players' income collected first), 5% fee (coin sink), price 0.5×–20× of plot value, accounts ≥ 2 days old to sell, 20 listings / 10 buys a day, search by #number or seller, sort, favourites, trade history, gold icon on the map for plots on sale |
| M6 ✅ | Leaderboard | All time (land income), This month (coins collected; top 10 win gems when the month ends, paid once automatically), Near you (~10 km around your newest plot). Your own rank shown even outside the top 50. |
| next | TestFlight round 2 | Deploy server, ship build with ads + marketplace + leaderboard, friends test. Then: real AdMob IDs, offerwall partner, push notifications (needs Push capability on the App ID). |
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
