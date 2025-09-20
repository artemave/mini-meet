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

if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('/sw.js')
    .catch((err) => console.warn('SW registration failed', err));
}

if (roomEl) {
  roomEl.textContent = `Room: ${roomId}`;
}

copyBtn?.addEventListener('click', async () => {
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
  if (!copyToast) return;
  clearTimeout(copyToastVisibleTimer);
  clearTimeout(copyToastResetTimer);
  copyToast.hidden = false;
  // Force reflow so transition runs after removing hidden
  void copyToast.offsetWidth;
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
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setStatus('Needs HTTPS or localhost', 'bad');
    log('error', 'mediaDevices unavailable (insecure context)');
    return;
  }
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    for (const videoEl of localVideos) {
      if (!videoEl) continue;
      videoEl.srcObject = localStream;
      try {
        videoEl.play();
      } catch (_) {
        // Autoplay might be blocked until the user interacts; ignore.
      }
    }
    localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));
    updateMicButton();
    updateCamButton();
  } catch (err) {
    setStatus('Camera/mic error', 'bad');
    log('getUserMediaError', { name: err?.name, message: err?.message });
  }
}

const wsProtocol = location.protocol === 'https:' ? 'wss' : 'ws';
const ws = new WebSocket(`${wsProtocol}://${location.host}/ws?roomId=${encodeURIComponent(roomId)}`);

ws.onmessage = async (event) => {
  const msg = JSON.parse(event.data);
  switch (msg.type) {
    case 'room_full':
      setStatus('room is full', 'bad');
      alert('This room already has 2 participants.');
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
      if (remoteVideo) {
        remoteVideo.srcObject = null;
      }
      isInitiator = true;
      await setupPeerConnection();
      setStatus('waiting', 'waiting');
      break;
  }
};

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
  try {
    const resp = await fetch('/turn', { cache: 'no-store' });
    if (resp.ok) {
      const data = await resp.json();
      if (Array.isArray(data.iceServers) && data.iceServers.length) {
        iceServers.push(...data.iceServers);
      }
    }
  } catch (_) {
    // ignore and fallback to STUN only
  }
  pc = new RTCPeerConnection({ iceServers });
  setStatus('waiting', 'waiting');
  pc.ontrack = (e) => {
    if (remoteVideo && remoteVideo.srcObject !== e.streams[0]) {
      remoteVideo.srcObject = e.streams[0];
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
    if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') setStatus('connected', 'ok');
    if (pc.iceConnectionState === 'failed') setStatus('failed', 'bad');
    if (pc.iceConnectionState === 'disconnected') setStatus('disconnected', 'bad');
  };
  pc.onconnectionstatechange = () => {
    log('connectionState', pc.connectionState);
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
  try {
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (e) {
    console.error('Error adding ICE candidate', e);
  }
}

function send(type, payload) {
  ws.send(JSON.stringify({ type, payload }));
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

// Send logs to server periodically and on unload
function flushLogs(reason) {
  if (!logs.length) return;
  const payload = JSON.stringify({ roomId, reason, events: logs.splice(0, logs.length) });
  try {
    navigator.sendBeacon('/log', payload);
  } catch (_) {
    // ignore
  }
}
setInterval(() => flushLogs('interval'), 10000);
window.addEventListener('beforeunload', () => { send('bye'); flushLogs('unload'); });
