# Mini Meet (WebRTC 1:1)

A minimal Google‑Meet–style 1:1 video chat. Users create a meeting, get a unique URL, and share it with one person. Built with Express + WebSocket signaling and browser WebRTC.

## Features
- Unique meeting links (`/new` → `/m/:id`)
- 1:1 P2P calls (STUN by default; optional TURN)
- Simple UI with mute/video toggles and status indicator
- Basic diagnostics and client log export (Phase 1)

## Stack & Structure
- Server: Node.js (Express, `ws`) — `src/server.js`
- Client: static HTML/CSS/JS — `public/`
- Scripts: package.json scripts (`dev`, `start`)

## Requirements
- Node.js 18+ (ESM) and npm

## Setup
- Install deps: `npm install`
- Optional: copy `.env.example` to `.env` and set `PORT`, `TURN_*`, `SSL_*` as needed.

## Run
- Dev (HTTP on localhost): `node --run dev` or `npm run dev` (defaults to `http://localhost:3000`)
- Custom port: `PORT=3003 node --run dev`
- Local HTTPS (recommended for mobile/LAN tests): provide cert/key via env
  - Generate with mkcert (Fedora): `sudo dnf install mkcert nss-tools && mkcert -install && mkdir -p certs && mkcert -key-file certs/key.pem -cert-file certs/cert.pem 192.168.x.x localhost 127.0.0.1 ::1`
  - Run: `PORT=3003 SSL_CERT_PATH=certs/cert.pem SSL_KEY_PATH=certs/key.pem npm run dev`

## Use
- Create a room: open `/new` (e.g., `http://localhost:3003/new`)
- Share the resulting `/m/:id` link with the other participant

## TURN (optional, for reliability)
- Server issues short‑lived REST credentials at `/turn` when env is set:
  - `TURN_URLS` (comma‑sep): `turns:turn.example.com:5349?transport=tcp,turn:turn.example.com:3478?transport=udp`
  - `TURN_SECRET`: shared secret from coturn (`static-auth-secret`)
  - `TURN_TTL`: seconds (e.g., `900`)
- Client auto‑fetches `/turn` and appends servers to STUN.

## Troubleshooting
- “mediaDevices undefined” or copy API missing: use `http://localhost` or HTTPS (browsers require secure context).
- No connection: check ICE states (status pill/logs), consider enabling TURN.

## Security Notes
- Do not commit real secrets. Keep `TURN_SECRET` server‑side; clients receive only short‑lived derived credentials.

## Deploy on Dokku (Dockerfile deploy)
1) Create app and domain
   - `dokku apps:create mini-meet`
   - `dokku domains:set mini-meet meet.example.com`
2) Configure env
   - `dokku config:set mini-meet NODE_ENV=production`
   - Optional TURN: `dokku config:set mini-meet TURN_URLS="turns:turn.example.com:5349?transport=tcp,turn:turn.example.com:3478?transport=udp" TURN_SECRET=REDACTED TURN_TTL=900`
3) Enable HTTPS
   - `dokku letsencrypt:enable mini-meet` (after DNS points to the host)
4) Deploy
   - `git remote add dokku dokku@YOUR_HOST:mini-meet`
   - `git push dokku main`

Notes
- The Dockerfile listens on `$PORT` (default 3000). Dokku sets this automatically.
- TURN must run separately (managed provider or your own coturn instance). Configure `TURN_*` as above.
