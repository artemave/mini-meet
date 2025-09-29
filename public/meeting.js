const roomId = location.pathname.split('/').pop();
const roomEl = document.getElementById('room-id');
const copyBtn = document.getElementById('copy');
const statusEl = document.getElementById('status');
const statusBaseClasses = statusEl?.dataset.statusBase || '';
const localVideos = Array.from(document.querySelectorAll('[data-local-video]'));
const remoteVideo = document.querySelector('[data-remote-video]');
const toggleMic = document.getElementById('toggle-mic');
const toggleCam = document.getElementById('toggle-cam');
const swapCamera = document.getElementById('swap-camera');
const copyToast = document.getElementById('copy-toast');
const remotePlayButton = document.getElementById('remote-play-button')
const remotePlayButtonOverlay = document.getElementById('remote-play-overlay');
let isReconnecting = false;
let isShuttingDown = false;
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
let copyToastVisibleTimer;
let pcReady
let localStream;
let isInitiator = false;
const wsProtocol = location.protocol === 'https:' ? 'wss' : 'ws';
let ws;


function showCopyToast() {
  clearTimeout(copyToastVisibleTimer);

  copyToast.classList.remove('opacity-0');
  copyToast.classList.add('opacity-100');
  copyToastVisibleTimer = setTimeout(() => {
    copyToast.classList.remove('opacity-100');
    copyToast.classList.add('opacity-0');
  }, 1600);
}

function scheduleReconnect(reason) {
  if (isShuttingDown || isReconnecting) return;
  isReconnecting = true;
  restartConnection(reason);
}

async function restartConnection(reason) {
  console.debug(`restartConnection: ${reason}`)

  try {
    if (isShuttingDown) return;

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      connectWebSocket();
      return;
    }
    await setupPeerConnection();

    setStatus('waiting', 'waiting');
    if (isInitiator) {
      await makeOffer();
    } else {
      send('ready');
    }
  } finally {
    isReconnecting = false;
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

function setStatus(key, mode) {
  if (!statusEl) return;
  const labels = {
    waiting: 'Waiting for peer',
    connecting: 'Waiting for peer',
    connected: 'Connected',
    failed: 'Connection failed',
    disconnected: 'Disconnected',
    room_is_full: 'Room is full',
    camera_mic_error: 'Camera/mic error',
  };
  const label = labels[key]
  if (!label) {
    throw new Error(`Unknown status ${key}`)
  }
  statusEl.textContent = label;

  const variants = {
    ok: 'border-emerald-400/40 bg-emerald-400/15 text-emerald-100 shadow-[0_0_14px_rgba(34,197,94,0.45)] animate-none',
    bad: 'border-rose-400/40 bg-rose-500/20 text-rose-100 animate-none',
    waiting: 'border-emerald-400/40 bg-emerald-400/15 text-emerald-100 shadow-[0_0_16px_rgba(34,197,94,0.5)] animate-pulse',
  };
  statusEl.className = `${statusBaseClasses} ${variants[mode]}`.trim();
}

async function startLocalMedia() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    for (const videoEl of localVideos) {
      videoEl.srcObject = localStream;
    }
    updateMicButton();
    updateCamButton();
  } catch (err) {
    setStatus('camera_mic_error', 'bad');

    throw err
  }
}

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
        setStatus('room_is_full', 'bad');
        try { ws.close(); } catch {}
        return;
      case 'welcome':
        isInitiator = !!msg.initiator;
        await setupPeerConnection();
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

function isLikelyRussianUser() {
  // Check timezone - Russia spans multiple timezones
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  const russianTimezones = [
    'Europe/Moscow', 'Europe/Kaliningrad', 'Europe/Volgograd', 'Europe/Saratov',
    'Asia/Yekaterinburg', 'Asia/Omsk', 'Asia/Novosibirsk', 'Asia/Novokuznetsk',
    'Asia/Krasnoyarsk', 'Asia/Irkutsk', 'Asia/Yakutsk', 'Asia/Vladivostok',
    'Asia/Magadan', 'Asia/Sakhalin', 'Asia/Kamchatka', 'Asia/Anadyr'
  ];

  // Check language preference
  const language = navigator.language || navigator.languages?.[0] || '';
  const isRussianLanguage = language.toLowerCase().startsWith('ru');

  // Consider user likely Russian if they have Russian timezone OR Russian language
  return russianTimezones.includes(timezone) || isRussianLanguage;
}

async function setupPeerConnection() {
  let resolvePcReady;
  const oldPcReady = pcReady;
  pcReady = new Promise((resolve) => {
    resolvePcReady = resolve;
  });

  // Clean up old connection if it exists
  if (oldPcReady) {
    const oldPc = await oldPcReady;
    oldPc.ontrack = null;
    oldPc.onicecandidate = null;
    oldPc.onicegatheringstatechange = null;
    oldPc.oniceconnectionstatechange = null;
    oldPc.onconnectionstatechange = null;
    oldPc.onsignalingstatechange = null;
    oldPc.close();
  }

  const iceServers = [];

  // Only include Google STUN server for non-Russian users
  if (!isLikelyRussianUser()) {
    iceServers.push({ urls: 'stun:stun.l.google.com:19302' });
  }
  const resp = await fetch('/turn', { cache: 'no-store' });
  const data = await resp.json();
  data.iceServers.forEach(iceServer => {
    if (isLikelyRussianUser()) {
      iceServers.push({
        ...iceServer,
        ...{ urls: iceServer.urls.filter(url => !url.match('transport=udp')) }
      })
    } else {
      iceServers.push(iceServer)
    }
  })

  const pc = new RTCPeerConnection({ iceServers });
  setStatus('waiting', 'waiting');
  pc.ontrack = (e) => {
    if (remoteVideo && remoteVideo.srcObject !== e.streams[0]) {
      remoteVideo.srcObject = e.streams[0];
    }
  };
  pc.onicecandidate = (e) => {
    if (e.candidate) {
      send('candidate', e.candidate);
    }
  };
  pc.oniceconnectionstatechange = () => {
    if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
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
    if (pc.connectionState === 'failed') scheduleReconnect('connection-failed');
  };

  localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));

  resolvePcReady(pc);
}

async function makeOffer() {
  const pc = await pcReady;
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  send('offer', offer);
}

async function onOffer(offer) {
  const pc = await pcReady;
  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  send('answer', answer);
}

async function onAnswer(answer) {
  const pc = await pcReady;
  await pc.setRemoteDescription(new RTCSessionDescription(answer));
}

async function onCandidate(candidate) {
  const pc = await pcReady;
  await pc.addIceCandidate(new RTCIceCandidate(candidate));
}

function send(type, payload) {
  ws.send(JSON.stringify({ type, payload }));
}

function markShuttingDown() {
  if (isShuttingDown) return;
  isShuttingDown = true;
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

async function swapCameraFacing() {
  if (!localStream) return;

  const videoTracks = localStream.getVideoTracks();
  if (videoTracks.length === 0) return;

  const currentTrack = videoTracks[0];
  const currentFacingMode = currentTrack.getSettings().facingMode;
  const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';

  // Stop current video track
  currentTrack.stop();

  // Get new stream with different camera
  const newStream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: newFacingMode },
    audio: true
  });

  // Replace video track in existing stream
  const newVideoTrack = newStream.getVideoTracks()[0];
  const audioTracks = localStream.getAudioTracks();

  // Create new stream with new video track and existing audio tracks
  localStream = new MediaStream([newVideoTrack, ...audioTracks]);

  // Update video elements
  for (const videoEl of localVideos) {
    videoEl.srcObject = localStream;
  }

  // Update peer connection if it exists
  if (pcReady) {
    const pc = await pcReady;
    const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
    if (sender) {
      await sender.replaceTrack(newVideoTrack);
    }
  }

  // Stop the temporary audio track from new stream since we're keeping the original
  newStream.getAudioTracks().forEach(track => track.stop());
}

window.addEventListener('load', () => {
  if (window.meetingJsLoaded) {
    return
  }
  window.meetingJsLoaded = true

  swapCamera.addEventListener('click', swapCameraFacing);

  remoteVideo.addEventListener('error', (e) => {
    console.error('remote video error', e);

    if (e?.message && e.message.includes('play() can only be initiated by a user gesture')) {
      remotePlayButtonOverlay.classList.remove('hidden');
    }
  })

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

  window.addEventListener('pagehide', markShuttingDown);

  window.addEventListener('beforeunload', () => {
    markShuttingDown();
    try { send('bye'); } catch (_) {}
  });

  localStorage.setItem('mini-meet:last-room', roomId);

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

  toggleMic.addEventListener('click', () => {
    if (!localStream) return;
    const enabled = localStream.getAudioTracks().every((t) => t.enabled);
    localStream.getAudioTracks().forEach((t) => (t.enabled = !enabled));
    updateMicButton();
  });

  toggleCam.addEventListener('click', () => {
    if (!localStream) return;
    const enabled = localStream.getVideoTracks().every((t) => t.enabled);
    localStream.getVideoTracks().forEach((t) => (t.enabled = !enabled));
    updateCamButton();
  });

  startLocalMedia().then(connectWebSocket)
})
