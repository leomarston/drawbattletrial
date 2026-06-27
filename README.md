# DrawBattle

A draw-and-guess party game. **This is a UI preview only** — front-end design,
no game backend wired up yet.

## What's here
```
web/                 the game-screen UI (HTML + CSS + inline SVG)
assets/              the original art kit + style guide + asset gallery
server.js            tiny zero-dependency static server (serves the UI)
package.json         npm start → node server.js
railway.json         Railway deploy config (Nixpacks, /healthz check)
Procfile             web: node server.js
```

## Run locally
No dependencies to install — it's plain Node.
```bash
npm start
# → open http://localhost:3000
```
Routes:
- `/` — the game UI
- `/assets/preview.html` — the full asset gallery
- `/healthz` — health check (returns `ok`)

## Deploy on Railway
1. Push this repo to GitHub (already on the feature branch).
2. In Railway: **New Project → Deploy from GitHub repo** → pick this repo.
3. Railway auto-detects Node (via `package.json`), builds with Nixpacks, and
   runs `node server.js`. No environment variables required — the server reads
   the `PORT` Railway provides automatically.
4. Open the generated **public domain** under the service's *Settings → Networking*
   (click *Generate Domain* if one isn't shown) to see the UI.

That's it — what you'll see is the static game screen. Gameplay/networking
comes later.
