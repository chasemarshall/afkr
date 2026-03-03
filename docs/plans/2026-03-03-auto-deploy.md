# Auto-Deploy Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Auto-redeploy afkr on the Raspberry Pi whenever code is pushed to `main` on GitHub.

**Architecture:** PM2 manages two processes: the afkr server and a lightweight webhook listener. GitHub sends a push event to the webhook listener, which runs a deploy script that pulls, builds, and restarts the server via PM2.

**Tech Stack:** PM2, Node.js (built-in `node:http` + `node:crypto`), Bash

---

### Task 1: Install PM2 globally

**Step 1: Install PM2**

Run: `sudo npm install -g pm2`

**Step 2: Verify installation**

Run: `pm2 --version`
Expected: Version number printed (e.g. `5.x.x`)

---

### Task 2: Create the deploy script

**Files:**
- Create: `scripts/deploy.sh`

**Step 1: Create the script**

```bash
#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG="$PROJECT_DIR/deploy.log"

echo "=== Deploy started at $(date -Iseconds) ===" | tee -a "$LOG"

cd "$PROJECT_DIR"

echo "Pulling latest code..." | tee -a "$LOG"
git pull origin main 2>&1 | tee -a "$LOG"

echo "Installing dependencies..." | tee -a "$LOG"
pnpm install --frozen-lockfile 2>&1 | tee -a "$LOG"

echo "Building..." | tee -a "$LOG"
pnpm build 2>&1 | tee -a "$LOG"

echo "Restarting server..." | tee -a "$LOG"
pm2 restart afkr-server 2>&1 | tee -a "$LOG"

echo "=== Deploy finished at $(date -Iseconds) ===" | tee -a "$LOG"
```

**Step 2: Make it executable**

Run: `chmod +x scripts/deploy.sh`

---

### Task 3: Create the webhook listener

**Files:**
- Create: `scripts/webhook.mjs`

This is a standalone Node script using only built-in modules (no dependencies to install).

**Step 1: Write the webhook listener**

```javascript
import { createServer } from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PORT = process.env.WEBHOOK_PORT || 9000;
const SECRET = process.env.WEBHOOK_SECRET;

if (!SECRET) {
  console.error('WEBHOOK_SECRET environment variable is required');
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const deployScript = join(__dirname, 'deploy.sh');

let deploying = false;

function verifySignature(payload, signature) {
  if (!signature) return false;
  const expected = 'sha256=' + createHmac('sha256', SECRET).update(payload).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

function runDeploy() {
  if (deploying) {
    console.log('Deploy already in progress, skipping');
    return;
  }
  deploying = true;
  console.log(`[${new Date().toISOString()}] Starting deploy...`);

  execFile('bash', [deployScript], { cwd: join(__dirname, '..') }, (err, stdout, stderr) => {
    deploying = false;
    if (err) {
      console.error('Deploy failed:', err.message);
      if (stderr) console.error(stderr);
    } else {
      console.log('Deploy succeeded');
    }
    if (stdout) console.log(stdout);
  });
}

const server = createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/webhook') {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      const signature = req.headers['x-hub-signature-256'];

      if (!verifySignature(body, signature)) {
        console.warn('Invalid signature, rejecting');
        res.writeHead(401);
        res.end('unauthorized');
        return;
      }

      let payload;
      try {
        payload = JSON.parse(body.toString());
      } catch {
        res.writeHead(400);
        res.end('bad request');
        return;
      }

      if (payload.ref === 'refs/heads/main') {
        console.log(`Push to main by ${payload.pusher?.name || 'unknown'}`);
        runDeploy();
        res.writeHead(200);
        res.end('deploying');
      } else {
        res.writeHead(200);
        res.end('ignored (not main)');
      }
    });
  } else if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200);
    res.end('ok');
  } else {
    res.writeHead(404);
    res.end('not found');
  }
});

server.listen(PORT, () => {
  console.log(`Webhook listener running on port ${PORT}`);
});
```

---

### Task 4: Create PM2 ecosystem config

**Files:**
- Create: `ecosystem.config.cjs`

**Step 1: Write the config**

```javascript
module.exports = {
  apps: [
    {
      name: 'afkr-server',
      script: 'server/dist/index.js',
      cwd: __dirname,
      env_file: '.env',
      node_args: '--env-file=.env',
      watch: false,
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
    },
    {
      name: 'afkr-webhook',
      script: 'scripts/webhook.mjs',
      cwd: __dirname,
      node_args: '--env-file=.env',
      watch: false,
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
    },
  ],
};
```

---

### Task 5: Update .env.example with webhook vars

**Files:**
- Modify: `.env.example`

**Step 1: Append webhook config**

Add to the end of `.env.example`:

```
# Webhook listener for GitHub auto-deploy
WEBHOOK_SECRET=
WEBHOOK_PORT=9000
```

---

### Task 6: Add production scripts to root package.json

**Files:**
- Modify: `package.json`

**Step 1: Add start/stop scripts**

Add to `scripts`:

```json
"start": "pm2 start ecosystem.config.cjs",
"stop": "pm2 stop ecosystem.config.cjs",
"restart": "pm2 restart ecosystem.config.cjs",
"logs": "pm2 logs"
```

---

### Task 7: First build and PM2 startup

**Step 1: Build the project**

Run: `pnpm build`
Expected: Compiles without errors, creates `server/dist/` and `client/dist/`

**Step 2: Start with PM2**

Run: `pm2 start ecosystem.config.cjs`
Expected: Both `afkr-server` and `afkr-webhook` show `online` status

**Step 3: Verify processes**

Run: `pm2 status`
Expected: Two processes listed as `online`

**Step 4: Set PM2 to start on boot**

Run: `pm2 save && pm2 startup`
Expected: PM2 prints a command to run with sudo. Run that command.

---

### Task 8: Commit all deploy infrastructure

**Step 1: Stage and commit**

```bash
git add ecosystem.config.cjs scripts/deploy.sh scripts/webhook.mjs .env.example package.json
git commit -m "feat: add PM2 + webhook auto-deploy on push to main"
```

---

### Post-Implementation: GitHub Setup (manual)

User must:
1. Go to GitHub repo → Settings → Webhooks → Add webhook
2. Payload URL: `http://<pi-ip>:9000/webhook`
3. Content type: `application/json`
4. Secret: same value as `WEBHOOK_SECRET` in `.env`
5. Events: Just the `push` event
6. Save
