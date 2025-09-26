const roomId = location.pathname.split('/').pop();
const roomEl = document.getElementById('room-id');
const copyBtn = document.getElementById('copy');
const statusEl = document.getElementById('status');
const statusBaseClasses = statusEl?.dataset.statusBase || '';
const localVideos = Array.from(document.querySelectorAll('[data-local-video]'));
const remoteVideo = document.querySelector('[data-remote-video]');
const toggleMic = document.getElementById('toggle-mic');
const toggleCam = document.getElementById('toggle-cam');
const copyToast = document.getElementById('copy-toast');
const remotePlayButton = document.getElementById('remote-play-button')
const remotePlayButtonOverlay = document.getElementById('remote-play-overlay');
let reconnectTimer;
let isShuttingDown = false;
let lastReconnectAttempt = 0;
const RECONNECT_THROTTLE = 200;
const selfOverlay = document.querySelector('[data-self-overlay]');
const overlayBoundary = selfOverlay ? selfOverlay.closest('[data-overlay-boundary]') : null;
const prefersCoarsePointer = typeof window !== 'undefined' && 'matchMedia' in window ? window.matchMedia('(pointer: coarse)').matches : false;
let overlayDragState = null;
let overlayInitialized = false;
const overlayPointers = selfOverlay ? new Map() : null;
let overlayPinchState = null;
const PORTRAIT_OVERLAY_ASPECT = 12 / 9;
const LANDSCAPE_OVERLAY_ASPECT = 9 / 16;
let overlayAspectRatio = PORTRAIT_OVERLAY_ASPECT;
const MIN_OVERLAY_WIDTH = 80;
const orientationQuery = typeof window !== 'undefined' && 'matchMedia' in window ? window.matchMedia('(orientation: portrait)') : null;

localStorage.setItem('mini-meet:last-room', roomId);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
}

roomEl.textContent = `Room: ${roomId}`;

copyBtn.addEventListener('click', async () => {
  try {
    if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('clipboard unsupported');
    await navigator.clipboard.writeText(location.href);
    showCopyToast();
  } catch (_) {
    window.prompt('Copy meeting link:', location.href);
  }
});

let copyToastVisibleTimer;
let copyToastResetTimer;
function showCopyToast() {
  clearTimeout(copyToastVisibleTimer);
  clearTimeout(copyToastResetTimer);

  copyToast.classList.remove('opacity-0');
  copyToast.classList.add('opacity-100');
  copyToastVisibleTimer = setTimeout(() => {
    copyToast.classList.remove('opacity-100');
    copyToast.classList.add('opacity-0');
    copyToastResetTimer = setTimeout(() => {
      if (copyToast) copyToast.hidden = true;
    }, 220);
  }, 1600);
}

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function scheduleReconnect(reason) {
  if (isShuttingDown || reconnectTimer) return;

  const now = Date.now();
  const timeSinceLastAttempt = now - lastReconnectAttempt;

  if (timeSinceLastAttempt >= RECONNECT_THROTTLE) {
    lastReconnectAttempt = now;
    restartConnection(reason).catch((err) => log('reconnect_error', { reason, message: err?.message }));
  } else {
    const delay = RECONNECT_THROTTLE - timeSinceLastAttempt;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      lastReconnectAttempt = Date.now();
      restartConnection(reason).catch((err) => log('reconnect_error', { reason, message: err?.message }));
    }, delay);
  }
}

async function restartConnection(reason) {
  if (isShuttingDown) return;
  log('reconnect_attempt', { reason, initiator: isInitiator });
  clearReconnectTimer();
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    log('reconnect_ws_closed', { state: ws?.readyState });
    connectWebSocket();
    return;
  }
  await setupPeerConnection();
  if (!localStream) {
    await start();
  }
  setStatus('waiting', 'waiting');
  if (isInitiator) {
    await makeOffer();
  } else {
    send('ready');
  }
}

function initializeOverlayPosition() {
  if (!selfOverlay || !overlayBoundary) return;
  if (overlayInitialized) {
    syncOverlayAspectForOrientation();
    clampOverlayToBounds();
    return;
  }
  const boundaryRect = overlayBoundary.getBoundingClientRect();
  const overlayRect = selfOverlay.getBoundingClientRect();
  const initialTop = Math.max(0, overlayRect.top - boundaryRect.top);
  const initialLeft = Math.max(0, overlayRect.left - boundaryRect.left);
  selfOverlay.style.bottom = 'auto';
  selfOverlay.style.right = 'auto';
  selfOverlay.style.top = `${initialTop}px`;
  selfOverlay.style.left = `${initialLeft}px`;
  overlayInitialized = true;
  syncOverlayAspectForOrientation(true);
}

function clampOverlayToBounds() {
  if (!selfOverlay || !overlayBoundary || !overlayInitialized) return;
  const ratio = overlayAspectRatio || PORTRAIT_OVERLAY_ASPECT;
  const boundaryWidth = overlayBoundary.clientWidth;
  const boundaryHeight = overlayBoundary.clientHeight;
  let maxWidth = null;
  if (boundaryWidth) maxWidth = boundaryWidth;
  if (boundaryHeight) {
    const heightLimited = boundaryHeight / ratio;
    maxWidth = maxWidth === null ? heightLimited : Math.min(maxWidth, heightLimited);
  }
  if (maxWidth !== null && Number.isFinite(maxWidth)) {
    const nextWidth = Math.max(MIN_OVERLAY_WIDTH, Math.min(selfOverlay.offsetWidth || maxWidth, maxWidth));
    if (!Number.isNaN(nextWidth)) {
      selfOverlay.style.width = `${nextWidth}px`;
      selfOverlay.style.height = '';
    }
  }
  const maxLeft = Math.max(0, overlayBoundary.clientWidth - selfOverlay.offsetWidth);
  const maxTop = Math.max(0, overlayBoundary.clientHeight - selfOverlay.offsetHeight);
  const currentLeft = parseFloat(selfOverlay.style.left || '0');
  const currentTop = parseFloat(selfOverlay.style.top || '0');
  const nextLeft = Math.min(Math.max(currentLeft, 0), maxLeft);
  const nextTop = Math.min(Math.max(currentTop, 0), maxTop);
  if (!Number.isNaN(nextLeft)) selfOverlay.style.left = `${nextLeft}px`;
  if (!Number.isNaN(nextTop)) selfOverlay.style.top = `${nextTop}px`;
}

function handleOverlayPointerDown(event) {
  if (!selfOverlay || !overlayBoundary) return;
  if (!canDragOverlay(event)) return;
  initializeOverlayPosition();
  if (overlayPointers) {
    overlayPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  }
  if (overlayPointers && overlayPointers.size === 2) {
    overlayDragState = null;
    startOverlayPinch();
  } else {
    overlayPinchState = null;
    overlayDragState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: selfOverlay.offsetLeft,
      startTop: selfOverlay.offsetTop,
      maxLeft: Math.max(0, overlayBoundary.clientWidth - selfOverlay.offsetWidth),
      maxTop: Math.max(0, overlayBoundary.clientHeight - selfOverlay.offsetHeight),
    };
  }
  selfOverlay.setPointerCapture(event.pointerId)
  event.preventDefault();
}

function handleOverlayPointerMove(event) {
  if (overlayPointers && overlayPointers.has(event.pointerId)) {
    overlayPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  }
  if (overlayPinchState) {
    updateOverlayPinch();
    event.preventDefault();
    return;
  }
  if (!overlayDragState || event.pointerId !== overlayDragState.pointerId) return;
  const deltaX = event.clientX - overlayDragState.startX;
  const deltaY = event.clientY - overlayDragState.startY;
  const nextLeft = Math.min(Math.max(overlayDragState.startLeft + deltaX, 0), overlayDragState.maxLeft);
  const nextTop = Math.min(Math.max(overlayDragState.startTop + deltaY, 0), overlayDragState.maxTop);
  selfOverlay.style.left = `${nextLeft}px`;
  selfOverlay.style.top = `${nextTop}px`;
  event.preventDefault();
}

function handleOverlayPointerUp(event) {
  let shouldClamp = false;
  if (overlayPointers) {
    overlayPointers.delete(event.pointerId);
  }
  if (overlayPinchState) {
    if (!overlayPointers || overlayPointers.size < 2) {
      overlayPinchState = null;
      shouldClamp = true;
    }
  }
  if (overlayDragState && event.pointerId === overlayDragState.pointerId) {
    selfOverlay.releasePointerCapture(event.pointerId)
    overlayDragState = null;
    shouldClamp = true;
  } else {
    selfOverlay.releasePointerCapture(event.pointerId)
  }
  if (shouldClamp) clampOverlayToBounds();
}

function canDragOverlay(event) {
  if (event.pointerType) {
    return event.pointerType === 'touch';
  }
  return prefersCoarsePointer;
}

function currentOverlayOrientationAspect() {
  if (orientationQuery && typeof orientationQuery.matches === 'boolean') {
    return orientationQuery.matches ? PORTRAIT_OVERLAY_ASPECT : LANDSCAPE_OVERLAY_ASPECT;
  }
  if (typeof window !== 'undefined') {
    return window.innerHeight >= window.innerWidth ? PORTRAIT_OVERLAY_ASPECT : LANDSCAPE_OVERLAY_ASPECT;
  }
  return PORTRAIT_OVERLAY_ASPECT;
}

function syncOverlayAspectForOrientation(force = false) {
  if (!selfOverlay || !overlayBoundary) return;
  if (!overlayInitialized && !force) return;
  const nextAspect = currentOverlayOrientationAspect();
  const ratioChanged = Math.abs(nextAspect - overlayAspectRatio) > 0.0001;
  if (!force && !ratioChanged) {
    clampOverlayToBounds();
    return;
  }
  overlayAspectRatio = nextAspect;
  const aspectCss = overlayAspectRatio > 0 ? 1 / overlayAspectRatio : 1;
  if (Number.isFinite(aspectCss) && aspectCss > 0) {
    selfOverlay.style.aspectRatio = `${aspectCss}`;
  }
  const rect = selfOverlay.getBoundingClientRect();
  let width = rect.width || parseFloat(selfOverlay.style.width) || MIN_OVERLAY_WIDTH;
  const boundaryWidth = overlayBoundary.clientWidth || width;
  const boundaryHeight = overlayBoundary.clientHeight || width * overlayAspectRatio;
  let maxWidth = boundaryWidth || null;
  if (boundaryHeight) {
    const heightWidth = boundaryHeight / overlayAspectRatio;
    maxWidth = maxWidth === null ? heightWidth : Math.min(maxWidth, heightWidth);
  }
  if (maxWidth === null || !Number.isFinite(maxWidth)) {
    maxWidth = width;
  }
  const nextWidth = Math.max(MIN_OVERLAY_WIDTH, Math.min(width, maxWidth));
  selfOverlay.style.width = `${nextWidth}px`;
  selfOverlay.style.height = '';
  clampOverlayToBounds();
}

function startOverlayPinch() {
  if (!selfOverlay || !overlayBoundary || !overlayPointers || overlayPointers.size < 2) return;
  const points = Array.from(overlayPointers.values());
  const [a, b] = points;
  const distance = Math.hypot(a.x - b.x, a.y - b.y);
  if (!distance) return;
  overlayPinchState = {
    baseDistance: distance,
    startWidth: selfOverlay.offsetWidth || parseFloat(selfOverlay.style.width) || MIN_OVERLAY_WIDTH,
  };
  if (!Number.isFinite(overlayPinchState.startWidth) || overlayPinchState.startWidth <= 0) {
    overlayPinchState.startWidth = MIN_OVERLAY_WIDTH;
  }
}

function updateOverlayPinch() {
  if (!selfOverlay || !overlayBoundary || !overlayPointers || overlayPointers.size < 2 || !overlayPinchState) return;
  const points = Array.from(overlayPointers.values()).slice(0, 2);
  const [a, b] = points;
  const distance = Math.hypot(a.x - b.x, a.y - b.y);
  if (!distance || !overlayPinchState.baseDistance) return;
  const scale = distance / overlayPinchState.baseDistance;
  const rawWidth = overlayPinchState.startWidth * scale;
  const ratio = overlayAspectRatio || PORTRAIT_OVERLAY_ASPECT;
  const boundaryWidth = overlayBoundary.clientWidth || rawWidth;
  const boundaryHeight = overlayBoundary.clientHeight || (rawWidth * ratio);
  let maxWidth = boundaryWidth || null;
  if (boundaryHeight) {
    const fromHeight = boundaryHeight / ratio;
    maxWidth = maxWidth === null ? fromHeight : Math.min(maxWidth, fromHeight);
  }
  if (maxWidth === null || !Number.isFinite(maxWidth)) {
    maxWidth = rawWidth;
  }
  const newWidth = Math.max(MIN_OVERLAY_WIDTH, Math.min(rawWidth, maxWidth));
  selfOverlay.style.width = `${newWidth}px`;
  selfOverlay.style.height = '';
  clampOverlayToBounds();
}

let pc;
const logs = [];
function log(type, data) {
  const entry = { t: new Date().toISOString(), type, data };
  logs.push(entry);
  console.debug('[webrtc]', type, data);
}
function setStatus(text, mode) {
  if (!statusEl) return;
  const key = (text || '').toLowerCase();
  const labels = {
    waiting: 'Waiting for peer',
    connecting: 'Waiting for peer',
    connected: 'Connected',
    failed: 'Connection failed',
    disconnected: 'Disconnected',
    idle: 'Idle',
    'room is full': 'Room is full',
    'needs https or localhost': 'HTTPS required',
    'camera/mic error': 'Camera/mic error',
  };
  const baseLabel = labels[key] || text || 'Idle';
  statusEl.textContent = baseLabel;

  const variants = {
    ok: 'border-emerald-400/40 bg-emerald-400/15 text-emerald-100 shadow-[0_0_14px_rgba(34,197,94,0.45)] animate-none',
    bad: 'border-rose-400/40 bg-rose-500/20 text-rose-100 animate-none',
    waiting: 'border-emerald-400/40 bg-emerald-400/15 text-emerald-100 shadow-[0_0_16px_rgba(34,197,94,0.5)] animate-pulse',
  };
  const fallback = 'border-white/10 bg-slate-900/70 text-slate-200 animate-none';
  statusEl.className = `${statusBaseClasses} ${variants[mode] || fallback}`.trim();

}

let localStream;
let isInitiator = false;

async function start() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    for (const videoEl of localVideos) {
      videoEl.srcObject = localStream;
    }
    localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));
    updateMicButton();
    updateCamButton();
  } catch (err) {
    setStatus('Camera/mic error', 'bad');
    log('getUserMediaError', { name: err?.name, message: err?.message });

    throw err
  }
}

const wsProtocol = location.protocol === 'https:' ? 'wss' : 'ws';
let ws;

function connectWebSocket() {
  if (ws) {
    try { ws.close(); } catch (_) {}
  }

  ws = new WebSocket(`${wsProtocol}://${location.host}/ws?roomId=${encodeURIComponent(roomId)}`);

  ws.addEventListener('close', () => {
    if (!isShuttingDown) scheduleReconnect('ws-closed');
  });

  ws.onmessage = async (event) => {
    const msg = JSON.parse(event.data);
    switch (msg.type) {
      case 'room_full':
        setStatus('room is full', 'bad');
        try { ws.close(); } catch {}
        return;
      case 'welcome':
        isInitiator = !!msg.initiator;
        await setupPeerConnection();
        await start();
        if (!isInitiator) send('ready');
        break;
      case 'ready':
        if (isInitiator) await makeOffer();
        break;
      case 'offer':
        await onOffer(msg.payload);
        break;
      case 'answer':
        await onAnswer(msg.payload);
        break;
      case 'candidate':
        await onCandidate(msg.payload);
        break;
      case 'bye':
        clearReconnectTimer();
        if (remoteVideo) {
          remoteVideo.srcObject = null;
        }
        isInitiator = true;
        await setupPeerConnection();
        setStatus('waiting', 'waiting');
        break;
    }
  };
}

connectWebSocket();

async function setupPeerConnection() {
  if (pc) {
    try {
      pc.ontrack = null;
      pc.onicecandidate = null;
      pc.onicegatheringstatechange = null;
      pc.oniceconnectionstatechange = null;
      pc.onconnectionstatechange = null;
      pc.onsignalingstatechange = null;
      pc.close();
    } catch (_) {}
    pc = null;
  }
  const iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
  const resp = await fetch('/turn', { cache: 'no-store' });
  const data = await resp.json();
  if (Array.isArray(data.iceServers) && data.iceServers.length) {
    iceServers.push(...data.iceServers);
  }

  pc = new RTCPeerConnection({ iceServers });
  setStatus('waiting', 'waiting');
  pc.ontrack = (e) => {
    if (remoteVideo && remoteVideo.srcObject !== e.streams[0]) {
      remoteVideo.srcObject = e.streams[0];
      remoteVideo.play().catch(e => {
        remotePlayButtonOverlay.classList.remove('hidden')
      })
    }
  };
  pc.onicecandidate = (e) => {
    if (e.candidate) {
      const parts = e.candidate.candidate.split(' typ ');
      const type = (parts[1] || '').split(' ')[0];
      log('candidate', { candidateType: type });
      send('candidate', e.candidate);
    }
  };
  pc.onicegatheringstatechange = () => {
    log('iceGatheringState', pc.iceGatheringState);
  };
  pc.oniceconnectionstatechange = () => {
    log('iceConnectionState', pc.iceConnectionState);
    if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
      clearReconnectTimer();
      setStatus('connected', 'ok');
    }
    if (pc.iceConnectionState === 'failed') {
      setStatus('failed', 'bad');
      scheduleReconnect('ice-failed');
    }
    if (pc.iceConnectionState === 'disconnected') {
      setStatus('disconnected', 'bad');
      scheduleReconnect('ice-disconnected');
    }
    if (pc.iceConnectionState === 'closed') {
      scheduleReconnect('ice-closed');
    }
  };
  pc.onconnectionstatechange = () => {
    log('connectionState', pc.connectionState);
    if (pc.connectionState === 'failed') scheduleReconnect('connection-failed');
  };
  pc.onsignalingstatechange = () => {
    log('signalingState', pc.signalingState);
  };
  if (localStream) {
    localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));
  }
}

async function makeOffer() {
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  send('offer', offer);
}

async function onOffer(offer) {
  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  send('answer', answer);
}

async function onAnswer(answer) {
  await pc.setRemoteDescription(new RTCSessionDescription(answer));
}

async function onCandidate(candidate) {
  await pc.addIceCandidate(new RTCIceCandidate(candidate));
}

function send(type, payload) {
  ws.send(JSON.stringify({ type, payload }));
}

function markShuttingDown() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  clearReconnectTimer();
}

function updateMicButton() {
  if (!toggleMic) return;
  if (!localStream) return;
  const enabled = localStream.getAudioTracks().every((t) => t.enabled);
  toggleMic.dataset.state = enabled ? 'on' : 'off';
  toggleMic.setAttribute('aria-pressed', String(!enabled));
  const label = enabled ? 'Mute microphone' : 'Unmute microphone';
  toggleMic.setAttribute('aria-label', label);
  const sr = toggleMic.querySelector('[data-label]');
  if (sr) sr.textContent = label;
  const iconOn = toggleMic.querySelector('[data-icon="mic-on"]');
  const iconOff = toggleMic.querySelector('[data-icon="mic-off"]');
  if (iconOn) iconOn.classList.toggle('hidden', !enabled);
  if (iconOff) iconOff.classList.toggle('hidden', enabled);
}
function updateCamButton() {
  if (!toggleCam) return;
  if (!localStream) return;
  const enabled = localStream.getVideoTracks().every((t) => t.enabled);
  toggleCam.dataset.state = enabled ? 'on' : 'off';
  toggleCam.setAttribute('aria-pressed', String(!enabled));
  const label = enabled ? 'Stop video' : 'Start video';
  toggleCam.setAttribute('aria-label', label);
  const sr = toggleCam.querySelector('[data-label]');
  if (sr) sr.textContent = label;
  const iconOn = toggleCam.querySelector('[data-icon="cam-on"]');
  const iconOff = toggleCam.querySelector('[data-icon="cam-off"]');
  if (iconOn) iconOn.classList.toggle('hidden', !enabled);
  if (iconOff) iconOff.classList.toggle('hidden', enabled);
}

toggleMic?.addEventListener('click', () => {
  if (!localStream) return;
  const enabled = localStream.getAudioTracks().every((t) => t.enabled);
  localStream.getAudioTracks().forEach((t) => (t.enabled = !enabled));
  updateMicButton();
});

toggleCam?.addEventListener('click', () => {
  if (!localStream) return;
  const enabled = localStream.getVideoTracks().every((t) => t.enabled);
  localStream.getVideoTracks().forEach((t) => (t.enabled = !enabled));
  updateCamButton();
});

remotePlayButton.addEventListener('click', () => {
  remoteVideo.play().then(() => {
    remotePlayButtonOverlay.classList.add('hidden')
  });
});

if (selfOverlay && overlayBoundary && prefersCoarsePointer) {
  const reflowOverlay = () => requestAnimationFrame(() => syncOverlayAspectForOrientation());
  requestAnimationFrame(() => {
    initializeOverlayPosition();
  });
  selfOverlay.addEventListener('pointerdown', handleOverlayPointerDown, { passive: false });
  selfOverlay.addEventListener('pointermove', handleOverlayPointerMove, { passive: false });
  selfOverlay.addEventListener('pointerup', handleOverlayPointerUp);
  selfOverlay.addEventListener('pointercancel', handleOverlayPointerUp);
  window.addEventListener('resize', reflowOverlay);
  window.addEventListener('orientationchange', reflowOverlay);
  if (orientationQuery) {
    const orientationHandler = () => syncOverlayAspectForOrientation();
    orientationQuery.addEventListener('change', orientationHandler);
  }
}

// Send logs to server periodically and on unload
function flushLogs(reason) {
  if (!logs.length) return;
  const payload = JSON.stringify({ roomId, reason, events: logs.splice(0, logs.length) });
  navigator.sendBeacon('/log', payload);
}
setInterval(() => flushLogs('interval'), 10000);
window.addEventListener('pagehide', markShuttingDown);
window.addEventListener('beforeunload', () => {
  markShuttingDown();
  try { send('bye'); } catch (_) {}
  flushLogs('unload');
});
