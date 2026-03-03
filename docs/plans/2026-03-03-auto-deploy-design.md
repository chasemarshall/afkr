# Auto-Deploy on GitHub Push

## Overview

Automatically redeploy the afkr app on the Raspberry Pi whenever code is pushed to `main` on GitHub.

## Components

### 1. PM2 Process Manager

- Runs the built server (`node server/dist/index.js`) in production
- Also manages the webhook listener process
- Configured via `ecosystem.config.cjs` at project root
- Loads env vars from `.env`

### 2. GitHub Webhook Listener

- Small standalone Express server on port 9000
- Validates GitHub webhook signature (HMAC SHA-256 with shared secret)
- Only triggers on pushes to `main` branch
- Runs the deploy script on valid requests
- Lives at `scripts/webhook.mjs`

### 3. Deploy Script

- `scripts/deploy.sh`
- Steps: `git pull` → `pnpm install --frozen-lockfile` → `pnpm build` → `pm2 restart afkr-server`
- Logs output for debugging failed deploys

## Flow

```
Push to main → GitHub POST to Pi:9000/webhook → validate signature → deploy.sh → PM2 restart
```

## Files to Create

- `ecosystem.config.cjs` — PM2 config for server + webhook processes
- `scripts/deploy.sh` — build and restart script
- `scripts/webhook.mjs` — webhook listener
- Update `.env.example` with `WEBHOOK_SECRET`

## GitHub Setup

User adds webhook in repo settings:
- URL: `http://<pi-ip>:9000/webhook`
- Content type: `application/json`
- Secret: matches `WEBHOOK_SECRET` in `.env`
- Events: Just the push event

## Client Serving

The built client (`client/dist/`) should be served by the Express server or nginx. This design does not change client serving — that's a separate concern.
