import html from 'nanohtml';
import layout from './layout.html.js';

export default function meetingView({ roomId }) {
  const body = html`
    <div
      class="relative flex h-screen flex-col overflow-hidden bg-slate-950 font-sans text-slate-100 supports-[height:100dvh]:h-dvh"
    >
      <div class="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          class="absolute -left-40 -top-32 h-72 w-72 rounded-full bg-emerald-500/25 blur-3xl"
        ></div>
        <div
          class="absolute -bottom-48 -right-24 h-96 w-96 rounded-full bg-cyan-500/20 blur-[120px]"
        ></div>
      </div>
      <header
        class="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-white/5 bg-slate-950/80 px-4 py-3 backdrop-blur-xl md:gap-4 md:px-6"
        style="padding-top: calc(env(safe-area-inset-top, 0px) + 12px);"
      >
        <a class="text-lg font-semibold text-slate-100 md:text-xl" href="/">Mini Meet</a>
        <div id="room-id" class="hidden text-sm text-slate-400 md:block"></div>
        <div class="flex-1"></div>
        <button
          id="toggle-layout"
          type="button"
          aria-label="Toggle layout"
          title="Toggle layout"
          class="hidden md:inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-slate-900/70 text-slate-300 transition hover:border-white/20 hover:bg-slate-800/90 hover:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
        >
          <svg
            data-icon="layout-grid"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="h-4 w-4"
          >
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
          </svg>
          <svg
            data-icon="layout-overlay"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="hidden h-4 w-4"
          >
            <rect x="2" y="2" width="20" height="20" rx="2" />
            <rect x="13" y="13" width="8" height="8" rx="1" />
          </svg>
        </button>
        <span
          id="status"
          data-status-base="inline-flex items-center justify-center rounded-full border px-3 py-1 text-xs font-medium tracking-wide text-slate-200 transition"
          class="inline-flex items-center justify-center rounded-full border border-white/10 bg-slate-900/70 px-3 py-1 text-xs font-medium tracking-wide text-slate-200"
        >
          Idle
        </span>
      </header>
      <main class="relative z-10 flex flex-1 flex-col overflow-hidden px-0 pt-0 md:justify-center md:px-6 md:pb-6 md:pt-4">
        <div
          id="video-container"
          data-layout="side-by-side"
          class="relative mx-auto flex w-full flex-1 flex-col gap-0 md:grid md:grid-cols-2 md:gap-6 md:flex-none md:my-auto"
        >
          <div
            id="local-video-container"
            class="hidden w-full overflow-hidden rounded-2xl border border-slate-500/30 bg-slate-950 shadow-2xl shadow-emerald-500/20 md:block md:aspect-video"
          >
            <video
              data-local-video
              autoplay
              playsinline
              muted
              class="h-full w-full object-cover"
            ></video>
          </div>
          <div
            id="remote-video-container"
            class="relative flex-1 min-h-0 w-full overflow-hidden rounded-none border-none bg-slate-950 shadow-none md:aspect-video md:h-auto md:overflow-hidden md:rounded-2xl md:border md:border-slate-500/30 md:shadow-2xl md:shadow-cyan-500/20"
            data-overlay-boundary
          >
            <video
              data-remote-video
              autoplay
              playsinline
              class="h-full w-full object-cover"
            ></video>
            <div
              id="remote-play-overlay"
              class="absolute inset-0 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm z-10 hidden"
            >
              <button
                id="remote-play-button"
                type="button"
                class="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-emerald-950 shadow-lg hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-900"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-5 w-5">
                  <path d="M8 5v14l11-7z"/>
                </svg>
                Join
              </button>
            </div>
            <div
              class="absolute aspect-[9/12] w-24 overflow-hidden rounded-xl border border-slate-500/60 bg-slate-950/80 shadow-lg shadow-slate-900/60 md:hidden lg:w-28"
              data-self-overlay
              data-mobile-overlay
              style="bottom:1rem; right:1rem; touch-action:none;"
            >
              <video
                data-local-video
                autoplay
                playsinline
                muted
                class="h-full w-full object-cover"
              ></video>
              <button
                id="swap-camera"
                type="button"
                aria-label="Swap camera"
                class="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-transparent text-white shadow-sm transition-opacity hover:bg-white/10 focus:outline-none focus:ring-1 focus:ring-white/40"
                style="pointer-events: auto; flex-shrink: 0;"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="h-6 w-6"
                >
                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                  <path d="M21 3v5h-5" />
                  <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                  <path d="M3 21v-5h5" />
                </svg>
                <span class="sr-only">Swap camera</span>
              </button>
            </div>
            <div
              id="desktop-overlay"
              class="hidden md:hidden absolute aspect-video w-64 overflow-hidden rounded-xl border border-slate-500/60 bg-slate-950/80 shadow-lg shadow-slate-900/60"
              data-self-overlay
              data-desktop-overlay
              style="bottom:1rem; right:1rem; touch-action:none;"
            >
              <video
                data-local-video
                autoplay
                playsinline
                muted
                class="h-full w-full object-cover"
              ></video>
            </div>
          </div>
        </div>
      </main>
      <div
        id="unsupported-browser-modal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-4 hidden"
        role="dialog"
        aria-labelledby="modal-title"
        aria-modal="true"
      >
        <div class="relative max-w-md w-full rounded-2xl border border-slate-500/30 bg-slate-900 p-6 shadow-2xl">
          <div class="mb-4">
            <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="h-6 w-6 text-amber-400"
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
          </div>
          <h3 id="modal-title" class="mb-2 text-center text-lg font-semibold text-slate-100">
            Browser Not Supported
          </h3>
          <p id="modal-message" class="mb-6 text-center text-sm text-slate-300">
            Video calls don't work in <span id="browser-name" class="font-semibold">this app</span>'s built-in browser. Please open this link in your default browser (Safari, Chrome, Firefox, etc.).
          </p>
          <div class="flex flex-col gap-3">
            <button
              id="modal-share-link"
              type="button"
              class="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-500/40 bg-gradient-to-br from-emerald-500 to-emerald-400 px-4 py-2.5 text-sm font-semibold text-emerald-950 shadow-lg shadow-emerald-500/20 transition hover:from-emerald-400 hover:to-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-900"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="h-4 w-4"
              >
                <circle cx="18" cy="5" r="3"/>
                <circle cx="6" cy="12" r="3"/>
                <circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
              Share Link
            </button>
          </div>
        </div>
      </div>
      <footer
        class="relative sticky bottom-0 z-20 flex items-center justify-center gap-3 border-t border-white/5 bg-slate-950/80 px-4 py-3 backdrop-blur-xl md:px-6"
        style="padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 12px);"
      >
        <div
          id="copy-toast"
          class="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 rounded-full bg-slate-900/95 px-3 py-1.5 text-xs font-semibold text-slate-100 shadow-lg shadow-emerald-500/20 opacity-0 transition duration-200 ease-out md:-top-16"
          role="status"
          aria-live="polite"
        >
          Link copied to clipboard
        </div>
        <button
          id="copy"
          type="button"
          aria-label="Share link"
          class="inline-flex h-11 w-11 items-center justify-center rounded-full border border-emerald-500/40 bg-gradient-to-br from-emerald-500 to-emerald-400 text-emerald-950 shadow-lg shadow-emerald-500/20 transition duration-150 hover:-translate-y-0.5 hover:from-emerald-400 hover:to-emerald-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="h-5 w-5"
          >
            <circle cx="18" cy="5" r="3"/>
            <circle cx="6" cy="12" r="3"/>
            <circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
          <span class="sr-only">Share link</span>
        </button>
        <button
          id="toggle-mic"
          type="button"
          data-state="on"
          aria-label="Mute microphone"
          class="inline-flex h-11 w-11 items-center justify-center rounded-full border border-emerald-500/40 bg-gradient-to-br from-emerald-500 to-emerald-400 text-emerald-950 shadow-lg shadow-emerald-500/20 transition duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 data-[state=off]:border-slate-600/60 data-[state=off]:bg-none data-[state=off]:bg-slate-800/90 data-[state=off]:text-slate-100 data-[state=off]:shadow-none hover:-translate-y-0.5"
        >
          <svg
            data-icon="mic-on"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="h-5 w-5"
          >
            <path d="M12 18a4 4 0 004-4V6a4 4 0 10-8 0v8a4 4 0 004 4z" />
            <path d="M19.5 10.5a7.5 7.5 0 01-15 0" />
            <path d="M12 18v3m0 0H9m3 0h3" />
          </svg>
          <svg
            data-icon="mic-off"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="hidden h-5 w-5"
          >
            <path d="M12 18a4 4 0 004-4V6a4 4 0 10-8 0v8a4 4 0 004 4z" />
            <path d="M19.5 10.5a7.5 7.5 0 01-15 0" />
            <path d="M12 18v3m0 0H9m3 0h3" />
            <path d="M3 3l18 18" />
          </svg>
          <span class="sr-only" data-label>Mute microphone</span>
        </button>
        <button
          id="toggle-cam"
          type="button"
          data-state="on"
          aria-label="Stop video"
          class="inline-flex h-11 w-11 items-center justify-center rounded-full border border-emerald-500/40 bg-gradient-to-br from-emerald-500 to-emerald-400 text-emerald-950 shadow-lg shadow-emerald-500/20 transition duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 data-[state=off]:border-slate-600/60 data-[state=off]:bg-none data-[state=off]:bg-slate-800/90 data-[state=off]:text-slate-100 data-[state=off]:shadow-none hover:-translate-y-0.5"
        >
          <svg
            data-icon="cam-on"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="h-5 w-5"
          >
            <path d="M15 10.5l3.553-2.132A1 1 0 0120 9.24v5.52a1 1 0 01-1.447.872L15 13.5" />
            <rect x="3" y="6" width="12" height="12" rx="2.25" />
          </svg>
          <svg
            data-icon="cam-off"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="hidden h-5 w-5"
          >
            <path d="M15 10.5l3.553-2.132A1 1 0 0120 9.24v5.52a1 1 0 01-1.447.872L15 13.5" />
            <rect x="3" y="6" width="12" height="12" rx="2.25" />
            <path d="M3 3l18 18" />
          </svg>
          <span class="sr-only" data-label>Stop video</span>
        </button>
        <a
          href="/"
          aria-label="Leave meeting"
          class="inline-flex h-11 w-11 items-center justify-center rounded-full border border-rose-500/50 bg-gradient-to-br from-rose-500 to-orange-400 text-rose-50 shadow-lg shadow-rose-500/30 transition duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400 hover:-translate-y-0.5"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="h-5 w-5"
          >
            <path d="M15.75 9v-1.5A2.25 2.25 0 0013.5 5.25h-6a2.25 2.25 0 00-2.25 2.25v9A2.25 2.25 0 007.5 18.75h6a2.25 2.25 0 002.25-2.25V15" />
            <path d="M21 12h-8.25" />
            <path d="M15.75 15.75L21 12l-5.25-3.75" />
          </svg>
          <span class="sr-only">Leave meeting</span>
        </a>
      </footer>
    </div>
    <script src="/meeting.js"></script>
  `;

  return layout({ title: `Meeting - ${roomId}`, body });
}
