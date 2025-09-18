const roomId = location.pathname.split('/').pop();
const roomEl = document.getElementById('room-id');
const copyBtn = document.getElementById('copy');
const statusEl = document.getElementById('status');
const exportBtn = document.getElementById('export-logs');
const localVideo = document.getElementById('local');
const remoteVideo = document.getElementById('remote');
const toggleMic = document.getElementById('toggle-mic');
const toggleCam = document.getElementById('toggle-cam');

roomEl.textContent = `Room: ${roomId}`;
copyBtn.addEventListener('click', async () => {
  try {
    if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('clipboard unsupported');
    await navigator.clipboard.writeText(location.href);
    copyBtn.textContent = 'Copied!';
  } catch (_) {
    window.prompt('Copy meeting link:', location.href);
  } finally {
    setTimeout(() => (copyBtn.textContent = 'Copy link'), 1500);
  }
});
exportBtn.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ roomId, events: logs }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `webrtc-logs-${roomId}-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
});

let pc;
const logs = [];
function log(type, data) {
  const entry = { t: new Date().toISOString(), type, data };
  logs.push(entry);
  console.debug('[webrtc]', type, data);
}
function setStatus(text, mode) {
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.classList.remove('ok', 'bad');
  if (mode) statusEl.classList.add(mode);
}

let localStream;
let isInitiator = false;

window.addEventListener('beforeunload', () => send('bye'));

async function start() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setStatus('Needs HTTPS or localhost', 'bad');
    log('error', 'mediaDevices unavailable (insecure context)');
    return;
  }
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
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
      // Remote left; reset remote video
      remoteVideo.srcObject = null;
      break;
  }
};

async function setupPeerConnection() {
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
  setStatus('connecting');
  pc.ontrack = (e) => {
    if (remoteVideo.srcObject !== e.streams[0]) {
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
  if (!localStream) return;
  const enabled = localStream.getAudioTracks().every((t) => t.enabled);
  toggleMic.textContent = enabled ? 'Mute' : 'Unmute';
  toggleMic.classList.toggle('off', !enabled);
  toggleMic.setAttribute('aria-pressed', String(!enabled));
}
function updateCamButton() {
  if (!localStream) return;
  const enabled = localStream.getVideoTracks().every((t) => t.enabled);
  toggleCam.textContent = enabled ? 'Stop Video' : 'Start Video';
  toggleCam.classList.toggle('off', !enabled);
  toggleCam.setAttribute('aria-pressed', String(!enabled));
}

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
