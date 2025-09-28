import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import url from 'url';
import express from 'express';
import { WebSocketServer } from 'ws';
import crypto from 'crypto';
import Rollbar from 'rollbar';
import indexView from './views/index.html.js';
import meetingView from './views/meeting.html.js';
import morgan from 'morgan'

// Basic Express server + WS signaling for 1:1 rooms.
const app = express();
let server;
if (process.env.SSL_CERT_PATH && process.env.SSL_KEY_PATH) {
  try {
    const options = {
      cert: fs.readFileSync(process.env.SSL_CERT_PATH),
      key: fs.readFileSync(process.env.SSL_KEY_PATH),
    };
    server = https.createServer(options, app);
    console.log('HTTPS enabled');
  } catch (e) {
    console.warn('Failed to load SSL cert/key, falling back to HTTP:', e.message);
    server = http.createServer(app);
  }
} else {
  server = http.createServer(app);
}

const PORT = process.env.PORT || 3003;
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const rollbar = new Rollbar({
  accessToken: process.env.ROLLBAR_SERVER_ACCESS_TOKEN,
  captureUncaught: true,
  captureUnhandledRejections: true,
  environment: process.env.ROLLBAR_ENVIRONMENT || 'development',
});

// Disable all caching
app.use((req, res, next) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Surrogate-Control': 'no-store'
  });
  next();
});

// Static files
const publicDir = path.join(__dirname, '..', 'public');
app.use(morgan('tiny'))
app.use(express.static(publicDir));
app.use(express.json({ limit: '200kb' }));

// Create new meeting and redirect to unique URL
app.get('/new', (req, res) => {
  const id = crypto.randomBytes(6).toString('base64url'); // short, URL-safe
  res.redirect(`/m/${id}`);
});

// Serve meeting page
app.get('/m/:id', (req, res) => {
  const html = meetingView({ roomId: req.params.id });
  res.send(String(html));
});

// Root: simple landing page
app.get('/', (req, res) => {
  const html = indexView();
  res.send(String(html));
});

// TURN REST credentials endpoint
// Returns short-lived credentials for clients to use with a TURN server (coturn).
// Env:
// - TURN_URLS: comma-separated list of turn/turns URLs (e.g., turns:turn.example.com:5349?transport=tcp,turn:turn.example.com:3478?transport=udp)
// - TURN_SECRET: shared secret configured in coturn (static-auth-secret)
// - TURN_TTL: seconds until expiration (default 900)
app.get('/turn', (req, res) => {
  const urlsEnv = process.env.TURN_URLS || '';
  const secret = process.env.TURN_SECRET || '';
  const ttl = Math.max(60, parseInt(process.env.TURN_TTL || '900', 10));
  const urls = urlsEnv
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean);

  res.set('Cache-Control', 'no-store');

  if (!urls.length || !secret) {
    return res.json({ iceServers: [] });
  }

  const usernameTs = Math.floor(Date.now() / 1000) + ttl;
  const tag = crypto.randomBytes(4).toString('base64url');
  const username = `${usernameTs}:${tag}`;
  const credential = crypto.createHmac('sha1', secret).update(username).digest('base64');

  return res.json({
    iceServers: [
      {
        urls,
        username,
        credential,
      },
    ],
    ttl,
  });
});

app.use(rollbar.errorHandler());

// In-memory room registry: roomId -> Set of ws
const rooms = new Map();

function getRoom(id) {
  if (!rooms.has(id)) rooms.set(id, new Set());
  return rooms.get(id);
}

function broadcastToRoom(roomId, fromWs, payload) {
  const peers = rooms.get(roomId);
  if (!peers) return;
  for (const ws of peers) {
    if (ws !== fromWs && ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }
}

const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (ws, request) => {
  const { searchParams } = new URL(request.url, 'http://localhost');
  const roomId = searchParams.get('roomId');
  if (!roomId) {
    ws.close(1008, 'roomId required');
    return;
  }
  const room = getRoom(roomId);
  // Enforce 1:1 cap: if two peers already, reject.
  if (room.size >= 2) {
    try { ws.send(JSON.stringify({ type: 'room_full' })); } catch {}
    ws.close(1008, 'room full');
    return;
  }
  room.add(ws);

  const initiator = room.size === 1; // first in room becomes initiator
  ws.send(JSON.stringify({ type: 'welcome', initiator, peers: room.size }));

  ws.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(data.toString()); } catch {
      return;
    }
    const { type, payload } = msg || {};
    if (!type) return;
    switch (type) {
      case 'ready':
      case 'offer':
      case 'answer':
      case 'candidate':
      case 'bye':
        broadcastToRoom(roomId, ws, { type, payload });
        break;
      default:
        break;
    }
  });

  ws.on('close', () => {
    const peers = rooms.get(roomId);
    if (peers) {
      peers.delete(ws);
      if (peers.size === 0) rooms.delete(roomId);
      else {
        // Notify remaining peer of disconnect
        for (const other of peers) {
          if (other.readyState === other.OPEN) {
            other.send(JSON.stringify({ type: 'bye' }));
          }
        }
      }
    }
  });
});

server.on('upgrade', (request, socket, head) => {
  const { pathname } = new URL(request.url, 'http://localhost');
  if (pathname === '/ws') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

server.listen(PORT, () => {
  const proto = server instanceof https.Server ? 'https' : 'http';
  console.log(`Server listening on ${proto}://localhost:${PORT}`);
});
