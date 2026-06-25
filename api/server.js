import { createServer } from 'http';
import { readFileSync } from 'fs';

const API_KEY = process.env.API_KEY;

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

function send(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function auth(req, res) {
  const key = req.headers['x-api-key'];
  if (!key || key !== API_KEY) {
    send(res, 401, { error: 'Unauthorized: invalid or missing API key' });
    return false;
  }
  return true;
}

async function main() {
  let handler, jobStore;

  if (process.env.VERCEL) {
    handler = (await import('./comments/index.js')).default;
  } else {
    const { default: h } = await import('./comments/index.js');
    handler = h;
    jobStore = (await import('../lib/vercel-job-store.js')).jobStore;
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const method = req.method;

    if (url.pathname === '/health') {
      send(res, 200, { status: 'ok', timestamp: new Date().toISOString() });
      return;
    }

    if (url.pathname === '/api/comments' && method === 'POST') {
      req.body = await parseBody(req);
      const mockRes = {
        status(code) { this.statusCode = code; return this; },
        json(data) { send(res, this.statusCode || 200, data); },
      };
      await handler(req, mockRes);
      return;
    }

    if (url.pathname.startsWith('/api/comments/') && method === 'GET') {
      const jobId = url.pathname.replace('/api/comments/', '');
      req.query = { jobId };
      req.body = {};
      const mockRes = {
        status(code) { this.statusCode = code; return this; },
        json(data) { send(res, this.statusCode || 200, data); },
      };
      await handler(req, mockRes);
      return;
    }

    send(res, 404, { error: 'Not found' });
  });

  const PORT = parseInt(process.env.PORT || '3000', 10);
  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`POST /api/comments — submit scrape job`);
    console.log(`GET  /api/comments/:jobId — poll results`);
    console.log(`GET  /health — health check`);
  });
}

main().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
