const STORAGE_KEY = 'mini-meet:last-room';
const installHint = /** @type {HTMLElement | null} */ (document.querySelector('[data-install-hint]'));
const lastMeetingBtn = /** @type {HTMLAnchorElement | null} */ (document.querySelector('[data-last-meeting]'));

function getInstallHintMessage() {
  if (!navigator) return 'Tip: open your browser menu and choose Add to Home Screen.';

  const ua = navigator.userAgent || '';
  const platform = (/** @type {any} */ (navigator).userAgentData)?.platform;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(ua);
  const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|Edg|OPR|Android/.test(ua);
  const isFirefox = /Firefox|FxiOS/.test(ua);
  const isEdge = /Edg/.test(ua);
  const isChrome = (/Chrome|Chromium|CriOS/.test(ua) || (/** @type {any} */ (navigator).userAgentData)?.brands?.some((/** @type {any} */ b) => /Chrom(e|ium)/i.test(b.brand))) && !isEdge;
  const isSamsung = /SamsungBrowser/i.test(ua);
  const isDesktop = !isIOS && !isAndroid;

  if (isIOS) {
    return 'Tip: tap <span class="font-semibold text-slate-200">Share</span>, then choose <span class="font-semibold text-slate-200">Add to Home Screen</span>.';
  }
  if (isAndroid && (isChrome || isEdge || isSamsung)) {
    return 'Tip: open your browser menu and choose <span class="font-semibold text-slate-200">Add to Home Screen</span>.';
  }
  if (isDesktop && (isChrome || isEdge)) {
    return '';
  }
  if (isDesktop && isSafari) {
    return '';
  }
  if (isFirefox) {
    if (isAndroid) {
      return 'Tip: open the browser menu and look for <span class="font-semibold text-slate-200">Install</span> to pin Mini Meet.';
    }
    return '';
  }
  if (isDesktop) {
    return '';
  }
  return 'Tip: open your browser menu and choose <span class="font-semibold text-slate-200">Install</span> to keep Mini Meet handy.';
}

if (installHint) {
  const hintMessage = getInstallHintMessage();
  if (hintMessage) {
    installHint.innerHTML = hintMessage;
    installHint.hidden = false;
    installHint.classList.remove('hidden');
  } else {
    installHint.hidden = true;
    installHint.classList.add('hidden');
  }
}

function hydrateLastMeeting() {
  if (!lastMeetingBtn) return;
  let roomId = '';
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (typeof raw === 'string') roomId = raw.trim();
  } catch (_) {
    roomId = '';
  }
  if (!roomId) {
    lastMeetingBtn.hidden = true;
    lastMeetingBtn.classList.add('hidden');
    return;
  }
  const safeId = roomId.replace(/[^-\w]/g, '');
  if (!safeId) {
    lastMeetingBtn.hidden = true;
    lastMeetingBtn.classList.add('hidden');
    return;
  }

  lastMeetingBtn.href = `/m/${encodeURIComponent(safeId)}`;
  lastMeetingBtn.hidden = false;
  lastMeetingBtn.classList.remove('hidden');
}

hydrateLastMeeting();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
}

window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEY) hydrateLastMeeting();
});
