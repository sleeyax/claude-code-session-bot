# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Telegram bot that manages Claude Code Pro 5-hour session cooldowns. Schedules automated warmups via `claude` CLI so you have remaining usage at a target time.

## Commands

```bash
pnpm dev            # run with tsx --watch (hot reload)
pnpm build          # tsc → dist/
pnpm start          # run compiled dist/main.js
docker compose up -d --build  # production deploy
```

No test or lint setup exists yet.

## Architecture

TypeScript (ES2022/CommonJS, strict), SQLite via better-sqlite3 (WAL mode), Telegram API via node-telegram-bot-api.

All source files are located in `src/`:

- **main.ts** — entry point; inits DB, bot, restores pending schedules
- **bot.ts** — Telegram command handlers (`/warmup`, `/schedule`, `/session`, `/cancel`, `/history`, `/schedules`)
- **warmup.ts** — spawns `claude -p "ready" --output-format json` subprocess; parses token usage
- **scheduler.ts** — in-memory `setTimeout` timers + DB persistence; restores timers on restart
- **db.ts** — SQLite CRUD for `sessions` and `schedules` tables
- **config.ts** — env var validation (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_ALLOWED_USER_IDS`, optional `TIMEZONE`, `DB_PATH`)
- **types.ts** — interfaces: `Session`, `Schedule`, `WarmupResult`

See [README.md](README.md) for full usage details.

## Key Details

- Session duration fixed at 5 hours (`SESSION_DURATION_MS`)
- Only tracks sessions the bot starts (no external session tracking)
- Auth: only Telegram user IDs in `TELEGRAM_ALLOWED_USER_IDS` can use commands
- Date parsing via chrono-node (natural language: "tomorrow 9am", "jan 30 8:00")
- Requires `claude` CLI installed and authenticated on host
