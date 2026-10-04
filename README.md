# LANDRUSH

iOS game: buy virtual land on a real-world map, build on it, earn passive coins, trade plots with other players.

See [`docs/PLAN.md`](docs/PLAN.md) for the full plan and milestones.

## Repo layout

| Folder | What |
|---|---|
| `app/` | iPhone app: Expo SDK 57, Expo Router, TypeScript, LV/RU/EN |
| `server/` | API: NestJS + Prisma + PostgreSQL |
| `shared/` | TypeScript types used by both |
| `deploy/` | Docker Compose, Nginx and backup files for the VPS |

## Local development

Requires Node 22 and pnpm (`corepack enable`).

```bash
pnpm install

# Server (needs a PostgreSQL database, see server/.env.example)
cp server/.env.example server/.env
pnpm --filter server db:migrate
pnpm server            # http://localhost:3000/health

# App
cp app/.env.example app/.env
pnpm app               # then open in Expo Go / a development build
```

Checks: `pnpm typecheck`, `pnpm lint`, `pnpm test`, and
`DATABASE_URL=postgresql://landrush:landrush@localhost:5432/landrush_test pnpm --filter server test:e2e`
(e2e tests wipe tables, so they refuse to run unless the database name ends in `_test`).
