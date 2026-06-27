// DrawBattle — static UI server (front-end only, no game backend yet).
// Zero dependencies: serves the repo's static files so the UI can be viewed
// locally or on a host like Railway. Binds to the platform-provided PORT.

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.ico':  'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.map':  'application/json; charset=utf-8',
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

const server = http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(req.url.split('?')[0]);
  } catch {
    return send(res, 400, 'Bad request');
  }

  // Health check for the platform.
  if (urlPath === '/healthz') {
    return send(res, 200, 'ok', { 'Content-Type': 'text/plain' });
  }

  // The game UI is the home page.
  if (urlPath === '/' || urlPath === '/index.html') {
    urlPath = '/web/index.html';
  }

  // Resolve + block path traversal and dot-directories (e.g. .git).
  const filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT) || urlPath.split('/').some(s => s.startsWith('.') && s.length > 1)) {
    return send(res, 403, 'Forbidden');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      return send(res, 404, '<h1 style="font-family:sans-serif">404 — Not Found</h1>',
        { 'Content-Type': 'text/html; charset=utf-8' });
    }
    const ext = path.extname(filePath).toLowerCase();
    send(res, 200, data, { 'Content-Type': TYPES[ext] || 'application/octet-stream' });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`DrawBattle UI listening on http://0.0.0.0:${PORT}`);
  console.log(`  game UI:       /`);
  console.log(`  asset gallery: /assets/preview.html`);
});
