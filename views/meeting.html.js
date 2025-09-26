import html from 'nanohtml';
import layout from './layout.html.js';

export default function meetingView({ roomId }) {
  const body = html`
    <div
      class="relative flex min-h-screen flex-col overflow-x-hidden bg-slate-950 font-sans text-slate-100"
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
          class="relative mx-auto flex w-full flex-1 flex-col gap-0 md:grid md:grid-cols-2 md:gap-6 md:flex-none md:my-auto"
        >
          <div
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
            class="relative flex-1 min-h-0 w-full overflow-hidden rounded-none border-none bg-slate-950 shadow-none md:aspect-video md:h-auto md:overflow-hidden md:rounded-2xl md:border md:border-slate-500/30 md:shadow-2xl md:shadow-cyan-500/20"
            data-overlay-boundary
          >
            <video
              data-remote-video
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
          aria-label="Copy link"
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
            <path
              d="M8.25 7.5a3.75 3.75 0 013.75-3.75h3a3.75 3.75 0 013.75 3.75v3a3.75 3.75 0 01-3.75 3.75h-3"
            />
            <path
              d="M15.75 16.5a3.75 3.75 0 01-3.75 3.75h-3a3.75 3.75 0 01-3.75-3.75v-3A3.75 3.75 0 019 9.75h3"
            />
          </svg>
          <span class="sr-only">Copy link</span>
        </button>
        <button
          id="toggle-mic"
          type="button"
          data-state="on"
          aria-label="Mute microphone"
          class="inline-flex h-11 w-11 items-center justify-center rounded-full border border-emerald-500/40 bg-gradient-to-br from-emerald-500 to-emerald-400 text-emerald-950 shadow-lg shadow-emerald-500/20 transition duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 data-[state=off]:border-slate-600/60 data-[state=off]:bg-none data-[state=off]:bg-slate-800/90 data-[state=off]:text-slate-100 data-[state=off]:shadow-none"
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
            <path d="M15 9.75V6a3 3 0 10-6 0v1.5" />
            <path d="M9 12.75V12a3 3 0 003-3" />
            <path d="M19.5 12a7.5 7.5 0 01-4.522 6.864" />
            <path d="M12 18.75v2.25" />
            <path d="M12 21h3" />
            <path d="M4.5 12a7.5 7.5 0 007.5 7.5h.75" />
            <path d="M3 3l18 18" />
          </svg>
          <span class="sr-only" data-label>Mute microphone</span>
        </button>
        <button
          id="toggle-cam"
          type="button"
          data-state="on"
          aria-label="Stop video"
          class="inline-flex h-11 w-11 items-center justify-center rounded-full border border-emerald-500/40 bg-gradient-to-br from-emerald-500 to-emerald-400 text-emerald-950 shadow-lg shadow-emerald-500/20 transition duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 data-[state=off]:border-slate-600/60 data-[state=off]:bg-none data-[state=off]:bg-slate-800/90 data-[state=off]:text-slate-100 data-[state=off]:shadow-none"
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
            <path d="M21 16.5l-4.2-2.4" />
            <path d="M3 3l18 18" />
            <path d="M9.75 9.75L3 6.75" />
            <path d="M12 18.75h-6A2.25 2.25 0 013.75 16.5v-9a2.25 2.25 0 013.402-1.947" />
            <path d="M15 13.5v3a2.25 2.25 0 01-2.25 2.25" />
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
    <script src="/meeting.js" type="module"></script>
  `;

  return layout({ title: `Meeting - ${roomId}`, body });
}
