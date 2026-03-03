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
