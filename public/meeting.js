const IS_MOBILE = window.__IS_MOBILE__ || false;
const roomId = location.pathname.split('/').pop();

// Beacon logger
function beacon(event, context = {}) {
  console.debug(event, { roomId, context })
  const blob = new Blob([JSON.stringify({ event, roomId, context })], { type: 'application/json' });
  navigator.sendBeacon('/log', blob);
}

const roomEl = document.getElementById('room-id');
const copyBtn = document.getElementById('copy');
const statusEl = document.getElementById('status');
const statusLandscapeEl = document.getElementById('status-landscape');
const statusBaseClasses = statusEl?.dataset.statusBase || statusLandscapeEl?.dataset.statusBase || '';
const localVideos = Array.from(document.querySelectorAll('[data-local-video]'));
const remoteVideo = document.querySelector('[data-remote-video]');
const toggleMic = document.getElementById('toggle-mic');
const toggleCam = document.getElementById('toggle-cam');
const toggleMicLandscape = document.getElementById('toggle-mic-landscape');
const toggleCamLandscape = document.getElementById('toggle-cam-landscape');
const swapCamera = document.getElementById('swap-camera');
const copyBtnLandscape = document.getElementById('copy-landscape');
const copyToast = document.getElementById('copy-toast');
const remotePlayButton = document.getElementById('remote-play-button')
const remotePlayButtonOverlay = document.getElementById('remote-play-overlay');
const unsupportedBrowserModal = document.getElementById('unsupported-browser-modal');
const modalShareLinkBtn = document.getElementById('modal-share-link');
const modalBrowserName = document.getElementById('browser-name');
const mobileHeader = document.getElementById('mobile-header');
const mobileStatusColumn = document.getElementById('mobile-status-column');
const mobileButtonsColumn = document.getElementById('mobile-buttons-column');
const mobileFooter = document.getElementById('mobile-footer');
const appRoot = document.getElementById('app-root');
let isReconnecting = false;
let isShuttingDown = false;
const mobileOverlay = IS_MOBILE ? document.querySelector('[data-mobile-overlay]') : null;
const desktopOverlay = !IS_MOBILE ? document.getElementById('desktop-overlay') : null;
const selfOverlay = mobileOverlay;
const overlayBoundary = mobileOverlay ? mobileOverlay.closest('[data-overlay-boundary]') : null;
let overlayDragState = null;
let overlayInitialized = false;
const overlayPointers = selfOverlay ? new Map() : null;
let overlayPinchState = null;
const PORTRAIT_OVERLAY_ASPECT = 12 / 9;
const LANDSCAPE_OVERLAY_ASPECT = 9 / 16;
const DESKTOP_OVERLAY_ASPECT = 9 / 16;
let overlayAspectRatio = PORTRAIT_OVERLAY_ASPECT;
const MIN_OVERLAY_WIDTH = 80;
const MIN_DESKTOP_OVERLAY_WIDTH = 120;
const orientationQuery = typeof window !== 'undefined' && 'matchMedia' in window ? window.matchMedia('(orientation: portrait)') : null;

function applyMobileLandscapeLayout() {
  if (!IS_MOBILE || !appRoot) return;

  const isPortrait = orientationQuery ? orientationQuery.matches : window.innerHeight > window.innerWidth;

  if (isPortrait) {
    // Portrait mode: show header and footer, hide landscape columns
    appRoot.classList.remove('flex-row');
    appRoot.classList.add('flex-col');
    if (mobileHeader) mobileHeader.classList.remove('hidden');
    if (mobileFooter) mobileFooter.classList.remove('hidden');
    if (mobileStatusColumn) mobileStatusColumn.classList.add('hidden');
    if (mobileButtonsColumn) mobileButtonsColumn.classList.add('hidden');

    // Portrait overlay: default size (w-24)
    if (mobileOverlay) {
      mobileOverlay.classList.remove('!w-40');
      mobileOverlay.classList.add('!w-24');
    }
  } else {
    // Landscape mode: show columns, hide header and footer
    appRoot.classList.remove('flex-col');
    appRoot.classList.add('flex-row');
    if (mobileHeader) mobileHeader.classList.add('hidden');
    if (mobileFooter) mobileFooter.classList.add('hidden');
    if (mobileStatusColumn) mobileStatusColumn.classList.remove('hidden');
    if (mobileStatusColumn) mobileStatusColumn.classList.add('flex');
    if (mobileButtonsColumn) mobileButtonsColumn.classList.remove('hidden');
    if (mobileButtonsColumn) mobileButtonsColumn.classList.add('flex');

    // Landscape overlay: bigger (w-40)
    if (mobileOverlay) {
      mobileOverlay.classList.remove('!w-24');
      mobileOverlay.classList.add('!w-40');
    }
  }
}
let copyToastVisibleTimer;
let pcReady
let localStream;
let isInitiator = false;
const wsProtocol = location.protocol === 'https:' ? 'wss' : 'ws';
let ws;
const videoContainer = document.getElementById('video-container');
const localVideoContainer = document.getElementById('local-video-container');
const remoteVideoContainer = document.getElementById('remote-video-container');
const toggleLayoutBtn = document.getElementById('toggle-layout');
let desktopLayout = 'side-by-side'; // 'side-by-side' or 'overlay'
let desktopOverlayDragState = null;
let desktopOverlayInitialized = false;
const desktopOverlayPointers = desktopOverlay ? new Map() : null;

function detectUnsupportedBrowser() {
  const ua = navigator.userAgent || '';

  // Check for known in-app browsers
  const isTelegramWebview = /TelegramWebview|Telegram/i.test(ua);
  const isInstagramWebview = /Instagram/i.test(ua);
  const isFacebookWebview = /FB_IAB|FBAN|FBAV/i.test(ua);
  const isWhatsAppWebview = /WhatsApp/i.test(ua);
  const isMessengerWebview = /Messenger/i.test(ua);
  const isLineWebview = /Line/i.test(ua);
  const isTwitterWebview = /Twitter/i.test(ua);
  const isLinkedInWebview = /LinkedInApp/i.test(ua);

  const isKnownInAppBrowser = isTelegramWebview || isInstagramWebview || isFacebookWebview ||
                               isWhatsAppWebview || isMessengerWebview || isLineWebview ||
                               isTwitterWebview || isLinkedInWebview;

  // Check if getUserMedia is available
  const hasGetUserMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

  // Return detection result
  return {
    isUnsupported: isKnownInAppBrowser || !hasGetUserMedia,
    reason: isKnownInAppBrowser ? 'in-app-browser' : (!hasGetUserMedia ? 'no-webrtc' : null),
    browserName: isTelegramWebview ? 'Telegram' :
                 isInstagramWebview ? 'Instagram' :
                 isFacebookWebview ? 'Facebook' :
                 isWhatsAppWebview ? 'WhatsApp' :
                 isMessengerWebview ? 'Messenger' :
                 isLineWebview ? 'Line' :
                 isTwitterWebview ? 'Twitter' :
                 isLinkedInWebview ? 'LinkedIn' :
                 'this app'
  };
}

function showCopyToast() {
  clearTimeout(copyToastVisibleTimer);

  copyToast.classList.remove('opacity-0');
  copyToast.classList.add('opacity-100');
  copyToastVisibleTimer = setTimeout(() => {
    copyToast.classList.remove('opacity-100');
    copyToast.classList.add('opacity-0');
  }, 1600);
}

async function shareMeetingLink() {
  try {
    // Try Web Share API first
    if (navigator.share) {
      await navigator.share({
        title: 'Mini Meet',
        text: 'Join my video call',
        url: location.href
      });
      return;
    }

    // Fallback to clipboard
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(location.href);
      showCopyToast();
      return;
    }

    // Last resort: prompt
    window.prompt('Copy meeting link:', location.href);
  } catch (err) {
    // If share was cancelled or failed, try clipboard as fallback
    if (err.name === 'AbortError') {
      // User cancelled share dialog, do nothing
      return;
    }

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(location.href);
        showCopyToast();
      } else {
        window.prompt('Copy meeting link:', location.href);
      }
    } catch (_) {
      window.prompt('Copy meeting link:', location.href);
    }
  }
}

function showUnsupportedBrowserModal(browserName) {
  if (!unsupportedBrowserModal) return;
  if (browserName) {
    modalBrowserName.textContent = browserName;
  }
  unsupportedBrowserModal.classList.remove('hidden');
}

function scheduleReconnect(reason) {
  if (isShuttingDown || isReconnecting) return;
  isReconnecting = true;
  beacon('reconnect_scheduled', { reason });
  restartConnection();
}

async function restartConnection() {
  try {
    if (isShuttingDown) return;

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      connectWebSocket();
      return;
    }
    await setupPeerConnection('restartConnection');

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
  return IS_MOBILE;
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
  // Remove conflicting Tailwind classes
  selfOverlay.classList.remove('!w-24', '!w-40');
  selfOverlay.style.width = `${newWidth}px`;
  selfOverlay.style.height = '';
  clampOverlayToBounds();
}

function toggleDesktopLayout() {
  if (!videoContainer || !toggleLayoutBtn) return;

  desktopLayout = desktopLayout === 'side-by-side' ? 'overlay' : 'side-by-side';
  applyDesktopLayout();

  // Save preference
  try {
    localStorage.setItem('mini-meet:desktop-layout', desktopLayout);
  } catch (_) {}
}

function applyDesktopLayout() {
  if (!videoContainer || !toggleLayoutBtn) return;

  videoContainer.dataset.layout = desktopLayout;

  const gridIcon = toggleLayoutBtn.querySelector('[data-icon="layout-grid"]');
  const overlayIcon = toggleLayoutBtn.querySelector('[data-icon="layout-overlay"]');

  if (desktopLayout === 'overlay') {
    // Overlay mode: hide side-by-side local video, show overlay
    videoContainer.classList.remove('md:grid', 'md:grid-cols-2', 'md:gap-6');
    videoContainer.classList.add('md:flex', 'md:flex-col');

    if (localVideoContainer) {
      localVideoContainer.classList.add('md:hidden');
    }

    if (remoteVideoContainer) {
      remoteVideoContainer.classList.remove('md:aspect-video');
      remoteVideoContainer.classList.add('md:flex-1', 'md:min-h-0');
    }

    if (desktopOverlay) {
      desktopOverlay.classList.remove('md:hidden');
      desktopOverlay.classList.add('md:block');
      if (!desktopOverlayInitialized) {
        initializeDesktopOverlayPosition();
      }
    }

    if (gridIcon) gridIcon.classList.add('hidden');
    if (overlayIcon) overlayIcon.classList.remove('hidden');
  } else {
    // Side-by-side mode
    videoContainer.classList.add('md:grid', 'md:grid-cols-2', 'md:gap-6');
    videoContainer.classList.remove('md:flex', 'md:flex-col');

    if (localVideoContainer) {
      localVideoContainer.classList.remove('md:hidden');
    }

    if (remoteVideoContainer) {
      remoteVideoContainer.classList.add('md:aspect-video');
      remoteVideoContainer.classList.remove('md:flex-1', 'md:min-h-0');
    }

    if (desktopOverlay) {
      desktopOverlay.classList.add('md:hidden');
      desktopOverlay.classList.remove('md:block');
    }

    if (gridIcon) gridIcon.classList.remove('hidden');
    if (overlayIcon) overlayIcon.classList.add('hidden');
  }
}

function initializeDesktopOverlayPosition() {
  if (!desktopOverlay || !remoteVideoContainer) return;
  if (desktopOverlayInitialized) return;

  const boundaryRect = remoteVideoContainer.getBoundingClientRect();
  const overlayRect = desktopOverlay.getBoundingClientRect();
  const initialTop = Math.max(0, overlayRect.top - boundaryRect.top);
  const initialLeft = Math.max(0, overlayRect.left - boundaryRect.left);

  desktopOverlay.style.bottom = 'auto';
  desktopOverlay.style.right = 'auto';
  desktopOverlay.style.top = `${initialTop}px`;
  desktopOverlay.style.left = `${initialLeft}px`;

  desktopOverlayInitialized = true;
}

function clampDesktopOverlayToBounds() {
  if (!desktopOverlay || !remoteVideoContainer || !desktopOverlayInitialized) return;

  const maxLeft = Math.max(0, remoteVideoContainer.clientWidth - desktopOverlay.offsetWidth);
  const maxTop = Math.max(0, remoteVideoContainer.clientHeight - desktopOverlay.offsetHeight);
  const currentLeft = parseFloat(desktopOverlay.style.left || '0');
  const currentTop = parseFloat(desktopOverlay.style.top || '0');
  const nextLeft = Math.min(Math.max(currentLeft, 0), maxLeft);
  const nextTop = Math.min(Math.max(currentTop, 0), maxTop);

  if (!Number.isNaN(nextLeft)) desktopOverlay.style.left = `${nextLeft}px`;
  if (!Number.isNaN(nextTop)) desktopOverlay.style.top = `${nextTop}px`;
}

function handleDesktopOverlayPointerDown(event) {
  if (!desktopOverlay || !remoteVideoContainer) return;

  initializeDesktopOverlayPosition();

  if (desktopOverlayPointers) {
    desktopOverlayPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  }

  desktopOverlayDragState = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    startLeft: desktopOverlay.offsetLeft,
    startTop: desktopOverlay.offsetTop,
    maxLeft: Math.max(0, remoteVideoContainer.clientWidth - desktopOverlay.offsetWidth),
    maxTop: Math.max(0, remoteVideoContainer.clientHeight - desktopOverlay.offsetHeight),
  };

  desktopOverlay.setPointerCapture(event.pointerId);
  event.preventDefault();
}

function handleDesktopOverlayPointerMove(event) {
  if (!desktopOverlayDragState || event.pointerId !== desktopOverlayDragState.pointerId) return;

  const deltaX = event.clientX - desktopOverlayDragState.startX;
  const deltaY = event.clientY - desktopOverlayDragState.startY;
  const nextLeft = Math.min(Math.max(desktopOverlayDragState.startLeft + deltaX, 0), desktopOverlayDragState.maxLeft);
  const nextTop = Math.min(Math.max(desktopOverlayDragState.startTop + deltaY, 0), desktopOverlayDragState.maxTop);

  desktopOverlay.style.left = `${nextLeft}px`;
  desktopOverlay.style.top = `${nextTop}px`;

  event.preventDefault();
}

function handleDesktopOverlayPointerUp(event) {
  if (desktopOverlayPointers) {
    desktopOverlayPointers.delete(event.pointerId);
  }

  if (desktopOverlayDragState && event.pointerId === desktopOverlayDragState.pointerId) {
    desktopOverlay.releasePointerCapture(event.pointerId);
    desktopOverlayDragState = null;
    clampDesktopOverlayToBounds();
  } else {
    desktopOverlay.releasePointerCapture(event.pointerId);
  }
}

function setStatus(key, mode) {
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

  const variants = {
    ok: 'border-emerald-400/40 bg-emerald-400/15 text-emerald-100 shadow-[0_0_14px_rgba(34,197,94,0.45)] animate-none',
    bad: 'border-rose-400/40 bg-rose-500/20 text-rose-100 animate-none',
    waiting: 'border-emerald-400/40 bg-emerald-400/15 text-emerald-100 shadow-[0_0_16px_rgba(34,197,94,0.5)] animate-pulse',
  };

  // Update both portrait and landscape status elements
  if (statusEl) {
    statusEl.textContent = label;
    statusEl.className = `${statusBaseClasses} ${variants[mode]}`.trim();
  }
  if (statusLandscapeEl) {
    statusLandscapeEl.textContent = label;
    const landscapeClasses = statusLandscapeEl.dataset.statusBase || '';
    statusLandscapeEl.className = `${landscapeClasses} ${variants[mode]} [writing-mode:vertical-lr] rotate-180`.trim();
  }
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

  ws.addEventListener('open', () => {
    beacon('ws_connected');
  });

  ws.addEventListener('close', (event) => {
    beacon('ws_closed', { code: event.code, reason: event.reason });
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
        // Only recreate peer connection if it doesn't exist or is in bad state
        const pc = pcReady ? await pcReady : null;
        if (!pc || !['connected', 'completed'].includes(pc.iceConnectionState)) {
          await setupPeerConnection('ws:welcome');
        }
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
        const pcBye = pcReady ? await pcReady : null;
        // Only tear down if peer connection is actually dead
        if (!pcBye || !['connected', 'completed'].includes(pcBye.iceConnectionState)) {
          remoteVideo.srcObject = null;
          isInitiator = true;
          await setupPeerConnection('ws:bye');
          setStatus('waiting', 'waiting');
        }
        break;
      case 'leave':
        // Peer explicitly left - always tear down
        beacon('peer_left');
        remoteVideo.srcObject = null;
        isInitiator = true;
        await setupPeerConnection('ws:leave');
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

async function setupPeerConnection(reason) {
  beacon('setup_peer_connection', { reason });

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
    remoteVideo.srcObject = null;
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
    if (remoteVideo.srcObject !== e.streams[0]) {
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
      beacon('ice_state_change:peer_connected', { state: pc.iceConnectionState });
    }
    if (pc.iceConnectionState === 'failed') {
      setStatus('failed', 'bad', { state: 'failed' });
      scheduleReconnect('ice-failed');
    }
    if (pc.iceConnectionState === 'closed') {
      beacon('peer_disconnected', { state: 'closed' });
      scheduleReconnect('ice_state_change:ice-closed');
    }
  };
  pc.onconnectionstatechange = () => {
    beacon('connection_state_change', { state: pc.connectionState });
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
  if (!localStream) return;
  const enabled = localStream.getAudioTracks().every((t) => t.enabled);
  const label = enabled ? 'Mute microphone' : 'Unmute microphone';

  // Update portrait button
  if (toggleMic) {
    toggleMic.dataset.state = enabled ? 'on' : 'off';
    toggleMic.setAttribute('aria-pressed', String(!enabled));
    toggleMic.setAttribute('aria-label', label);
    const sr = toggleMic.querySelector('[data-label]');
    if (sr) sr.textContent = label;
    const iconOn = toggleMic.querySelector('[data-icon="mic-on"]');
    const iconOff = toggleMic.querySelector('[data-icon="mic-off"]');
    if (iconOn) iconOn.classList.toggle('hidden', !enabled);
    if (iconOff) iconOff.classList.toggle('hidden', enabled);
  }

  // Update landscape button
  if (toggleMicLandscape) {
    toggleMicLandscape.dataset.state = enabled ? 'on' : 'off';
    toggleMicLandscape.setAttribute('aria-pressed', String(!enabled));
    toggleMicLandscape.setAttribute('aria-label', label);
    const sr = toggleMicLandscape.querySelector('[data-label]');
    if (sr) sr.textContent = label;
    const iconOn = toggleMicLandscape.querySelector('[data-icon="mic-on"]');
    const iconOff = toggleMicLandscape.querySelector('[data-icon="mic-off"]');
    if (iconOn) iconOn.classList.toggle('hidden', !enabled);
    if (iconOff) iconOff.classList.toggle('hidden', enabled);
  }
}

function updateCamButton() {
  if (!localStream) return;
  const enabled = localStream.getVideoTracks().every((t) => t.enabled);
  const label = enabled ? 'Stop video' : 'Start video';

  // Update portrait button
  if (toggleCam) {
    toggleCam.dataset.state = enabled ? 'on' : 'off';
    toggleCam.setAttribute('aria-pressed', String(!enabled));
    toggleCam.setAttribute('aria-label', label);
    const sr = toggleCam.querySelector('[data-label]');
    if (sr) sr.textContent = label;
    const iconOn = toggleCam.querySelector('[data-icon="cam-on"]');
    const iconOff = toggleCam.querySelector('[data-icon="cam-off"]');
    if (iconOn) iconOn.classList.toggle('hidden', !enabled);
    if (iconOff) iconOff.classList.toggle('hidden', enabled);
  }

  // Update landscape button
  if (toggleCamLandscape) {
    toggleCamLandscape.dataset.state = enabled ? 'on' : 'off';
    toggleCamLandscape.setAttribute('aria-pressed', String(!enabled));
    toggleCamLandscape.setAttribute('aria-label', label);
    const sr = toggleCamLandscape.querySelector('[data-label]');
    if (sr) sr.textContent = label;
    const iconOn = toggleCamLandscape.querySelector('[data-icon="cam-on"]');
    const iconOff = toggleCamLandscape.querySelector('[data-icon="cam-off"]');
    if (iconOn) iconOn.classList.toggle('hidden', !enabled);
    if (iconOff) iconOff.classList.toggle('hidden', enabled);
  }
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

  // Check for unsupported browser
  const browserCheck = detectUnsupportedBrowser();
  if (browserCheck.isUnsupported) {
    showUnsupportedBrowserModal(browserCheck.browserName);
  }

  modalShareLinkBtn.addEventListener('click', shareMeetingLink);

  if (swapCamera) {
    swapCamera.addEventListener('click', swapCameraFacing);
  }

  // Mobile landscape layout
  if (IS_MOBILE) {
    applyMobileLandscapeLayout();
    window.addEventListener('resize', applyMobileLandscapeLayout);
    window.addEventListener('orientationchange', applyMobileLandscapeLayout);
    if (orientationQuery) {
      orientationQuery.addEventListener('change', applyMobileLandscapeLayout);
    }
  }

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

  if (selfOverlay && overlayBoundary && IS_MOBILE) {
    const reflowOverlay = () => requestAnimationFrame(() => syncOverlayAspectForOrientation());
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

  // Desktop-only features
  if (!IS_MOBILE) {
    // Desktop overlay drag handlers
    if (desktopOverlay) {
      desktopOverlay.addEventListener('pointerdown', handleDesktopOverlayPointerDown, { passive: false });
      desktopOverlay.addEventListener('pointermove', handleDesktopOverlayPointerMove, { passive: false });
      desktopOverlay.addEventListener('pointerup', handleDesktopOverlayPointerUp);
      desktopOverlay.addEventListener('pointercancel', handleDesktopOverlayPointerUp);
    }

    // Layout toggle button
    if (toggleLayoutBtn) {
      // Load saved layout preference
      try {
        const savedLayout = localStorage.getItem('mini-meet:desktop-layout');
        if (savedLayout === 'overlay') {
          desktopLayout = 'overlay';
        }
      } catch (_) {}

      // Apply initial layout
      applyDesktopLayout();

      // Add click handler
      toggleLayoutBtn.addEventListener('click', toggleDesktopLayout);
    }
  }

  window.addEventListener('pagehide', () => {
    markShuttingDown();
    try { send('bye'); } catch (_) {}
  });

  localStorage.setItem('mini-meet:last-room', roomId);

  if (roomEl) {
    roomEl.textContent = `Room: ${roomId}`;
  }

  copyBtn.addEventListener('click', shareMeetingLink);

  const toggleMicHandler = () => {
    if (!localStream) return;
    const enabled = localStream.getAudioTracks().every((t) => t.enabled);
    localStream.getAudioTracks().forEach((t) => (t.enabled = !enabled));
    updateMicButton();
  };

  const toggleCamHandler = () => {
    if (!localStream) return;
    const enabled = localStream.getVideoTracks().every((t) => t.enabled);
    localStream.getVideoTracks().forEach((t) => (t.enabled = !enabled));
    updateCamButton();
  };

  if (toggleMic) {
    toggleMic.addEventListener('click', toggleMicHandler);
  }

  if (toggleCam) {
    toggleCam.addEventListener('click', toggleCamHandler);
  }

  // Landscape button listeners
  if (toggleMicLandscape) {
    toggleMicLandscape.addEventListener('click', toggleMicHandler);
  }

  if (toggleCamLandscape) {
    toggleCamLandscape.addEventListener('click', toggleCamHandler);
  }

  if (copyBtnLandscape) {
    copyBtnLandscape.addEventListener('click', shareMeetingLink);
  }

  // Send leave message when user navigates away
  // Use pagehide instead of beforeunload for iOS Safari compatibility
  window.addEventListener('pagehide', () => {
    beacon('user_leaving');
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: 'leave' }));
      } catch (e) {
        // Ignore errors during page unload
      }
    }
  });

  // Only start local media if browser is supported
  if (!browserCheck.isUnsupported) {
    startLocalMedia().then(connectWebSocket).catch((err) => {
      console.error('Failed to start local media:', err);
    });
  }
})
