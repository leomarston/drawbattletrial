// DrawBattle — static UI server (front-end only, no game backend yet).
// Zero dependencies. Serves the `web/` folder as the site root (so the app's
// relative asset paths resolve correctly), and also exposes the `assets/`
// gallery. Binds to the platform-provided PORT.

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const APP_DIR = path.join(ROOT, 'web');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
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

const send = (res, status, body, headers = {}) => { res.writeHead(status, headers); res.end(body); };

function serveFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) return send(res, 404, '<h1 style="font-family:sans-serif">404 — Not Found</h1>',
      { 'Content-Type': 'text/html; charset=utf-8' });
    const ext = path.extname(filePath).toLowerCase();
    send(res, 200, data, { 'Content-Type': TYPES[ext] || 'application/octet-stream' });
  });
}

const server = http.createServer((req, res) => {
  let urlPath;
  try { urlPath = decodeURIComponent(req.url.split('?')[0]); }
  catch { return send(res, 400, 'Bad request'); }

  if (urlPath === '/healthz') return send(res, 200, 'ok', { 'Content-Type': 'text/plain' });

  // Block traversal and dot-directories (e.g. .git).
  if (urlPath.split('/').some(s => s.length > 1 && s.startsWith('.'))) return send(res, 403, 'Forbidden');

  if (urlPath === '/' || urlPath === '/index.html') urlPath = '/index.html';

  // The asset gallery lives outside the app dir, at repo root.
  if (urlPath === '/assets' || urlPath.startsWith('/assets/')) {
    const p = path.normalize(path.join(ROOT, urlPath));
    if (!p.startsWith(ROOT)) return send(res, 403, 'Forbidden');
    return serveFile(res, p);
  }

  // Everything else is served from web/ as the site root.
  const p = path.normalize(path.join(APP_DIR, urlPath));
  if (!p.startsWith(APP_DIR)) return send(res, 403, 'Forbidden');
  serveFile(res, p);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`DrawBattle UI listening on http://0.0.0.0:${PORT}`);
  console.log(`  game UI:       /`);
  console.log(`  asset gallery: /assets/preview.html`);
});
