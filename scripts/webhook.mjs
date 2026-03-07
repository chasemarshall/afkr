import { createServer } from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PORT = process.env.WEBHOOK_PORT || 9000;
const SECRET = process.env.WEBHOOK_SECRET;
const MAX_BODY_BYTES = 1024 * 1024;
const REQUEST_TIMEOUT_MS = 15_000;

if (!SECRET) {
  console.error('WEBHOOK_SECRET environment variable is required');
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const deployScript = join(__dirname, 'deploy.sh');

let deploying = false;

function getHeaderAsString(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value[0];
  return undefined;
}

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
    const contentLength = Number.parseInt(getHeaderAsString(req.headers['content-length']) || '', 10);
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      res.writeHead(413, { Connection: 'close' });
      res.end('payload too large', () => req.destroy());
      return;
    }

    const chunks = [];
    let totalBytes = 0;
    let responded = false;

    const respond = (status, body, destroy = false) => {
      if (responded) return;
      responded = true;
      res.writeHead(status, { Connection: 'close' });
      res.end(body, () => {
        if (destroy) req.destroy();
      });
    };

    req.on('error', () => {
      respond(400, 'bad request');
    });

    req.on('data', (chunk) => {
      if (responded) return;
      totalBytes += chunk.length;
      if (totalBytes > MAX_BODY_BYTES) {
        respond(413, 'payload too large', true);
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (responded) return;

      const body = Buffer.concat(chunks, totalBytes);
      const signature = getHeaderAsString(req.headers['x-hub-signature-256']);

      if (!verifySignature(body, signature)) {
        console.warn('Invalid signature, rejecting');
        respond(401, 'unauthorized');
        return;
      }

      let payload;
      try {
        payload = JSON.parse(body.toString());
      } catch {
        respond(400, 'bad request');
        return;
      }

      if (payload.ref === 'refs/heads/main') {
        console.log(`Push to main by ${payload.pusher?.name || 'unknown'}`);
        runDeploy();
        respond(200, 'deploying');
      } else {
        respond(200, 'ignored (not main)');
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

server.requestTimeout = REQUEST_TIMEOUT_MS;
server.headersTimeout = REQUEST_TIMEOUT_MS + 1000;
server.keepAliveTimeout = 5000;

server.listen(PORT, () => {
  console.log(`Webhook listener running on port ${PORT}`);
});
