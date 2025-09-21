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
- Server issues short-lived REST credentials at `/turn` when env is set:
  - `TURN_URLS` (comma-sep): `turns:turn.artem.rocks:5349?transport=tcp,turn:turn.artem.rocks:3478?transport=udp`
  - `TURN_SECRET`: shared secret from coturn (`static-auth-secret`)
  - `TURN_TTL`: seconds (e.g., `900`)
- Client auto-fetches `/turn` and appends servers to STUN.

### Self-hosted TURN with Docker Compose
1. Export a long random `TURN_SECRET` and a `LETSENCRYPT_EMAIL` in your shell (direnv, systemd unit, etc.) before running Compose. They are baked into the image / used by certbot.
2. Ensure DNS points `turn.artem.rocks` (or your chosen hostname) to the VPS and open ports 80, 443, 3478/UDP+TCP, and the relay range 49152–49252/UDP.
3. Build the coturn image so it captures the exported secret:
   - `docker compose -f coturn/docker-compose.yml build coturn`
4. Start the stack once; certbot will issue the initial certificate automatically, keep renewing, and HUP coturn when certs update:
   - `docker compose -f coturn/docker-compose.yml up -d`
5. Configure the Node server with matching env vars:
   - `TURN_URLS="turn:turn.artem.rocks:3478?transport=udp,turns:turn.artem.rocks:443?transport=tcp"`
   - `TURN_SECRET=<same value exported for compose>`
   - `TURN_TTL=900` (adjust as needed)
6. Deploy mini-meet so `/turn` returns the new relay credentials.

> Tip: if the VPS has multiple network interfaces, set `relay-ip` in `coturn/turnserver.conf` to the public IPv4 address.

> Cert renewals run inside the `certbot` container; it talks to the Docker socket (requires the host user to have Docker access) and sends `HUP` to `coturn`, so the service keeps existing calls alive. If you rotate `TURN_SECRET`, rebuild the image (`docker compose -f coturn/docker-compose.yml build coturn`) and redeploy.

## Troubleshooting
- “mediaDevices undefined” or copy API missing: use `http://localhost` or HTTPS (browsers require secure context).
- No connection: check ICE states (status pill/logs), consider enabling TURN.

## Security Notes
- Do not commit real secrets. Keep `TURN_SECRET` server‑side; clients receive only short‑lived derived credentials.

## Deploy on Dokku (Dockerfile deploy)
1) Create app and domain
   - `dokku apps:create mini-meet`
   - `dokku domains:set meet.example.com`
2) Configure env
   - `dokku config:set NODE_ENV=production`
   - Optional TURN: `dokku config:set TURN_URLS="turns:turn.artem.rocks:443?transport=tcp,turn:turn.artem.rocks:3478?transport=udp" TURN_SECRET=$TURN_SECRET TURN_TTL=900`
3) Enable HTTPS
   - `dokku letsencrypt:enable mini-meet` (after DNS points to the host)
4) Deploy
   - `git remote add dokku dokku@YOUR_HOST:mini-meet`
   - `git push dokku main`

Notes
- The Dockerfile listens on `$PORT` (default 3000). Dokku sets this automatically.
- TURN must run separately (managed provider or your own coturn instance). Configure `TURN_*` as above.
