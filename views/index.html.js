import html from 'nanohtml';
import layout from './layout.html.js';

export default function indexView() {
  const body = html`
    <div
      class="relative min-h-screen overflow-x-hidden bg-slate-950 font-sans text-slate-100"
    >
      <div class="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          class="absolute -left-40 -top-32 h-80 w-80 rounded-full bg-emerald-500/30 blur-3xl"
        ></div>
        <div
          class="absolute -bottom-48 -right-32 h-96 w-96 rounded-full bg-cyan-500/25 blur-3xl"
        ></div>
      </div>
      <main class="relative flex min-h-screen items-center justify-center px-6 py-16 sm:py-24">
        <section
          class="relative z-10 flex w-full max-w-3xl flex-col items-center gap-6 rounded-3xl border border-slate-500/20 bg-slate-900/70 p-8 text-center shadow-emeraldGlow backdrop-blur-xl md:gap-8 md:p-12"
        >
          <span
            class="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.32em] text-emerald-300"
          >
            Quick &amp; private
          </span>
          <h1 class="text-4xl font-bold tracking-tight text-slate-50 sm:text-5xl md:text-6xl">
            Mini Meet
          </h1>
          <p class="max-w-xl text-balance text-base text-slate-300 sm:text-lg">
            Spin up a private 1:1 video room in seconds. Share the link and you are
            ready.
          </p>
          <div class="flex w-full flex-col gap-4 sm:flex-row sm:justify-center">
            <a
              class="inline-flex w-full items-center justify-center gap-2 rounded-full border border-emerald-500/40 bg-gradient-to-br from-emerald-500 to-emerald-400 px-6 py-3 text-base font-semibold text-emerald-950 shadow-lg shadow-emerald-500/20 transition duration-150 hover:-translate-y-0.5 hover:from-emerald-400 hover:to-emerald-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 sm:w-auto"
              href="/new"
            >
              Start a meeting
            </a>
            <a
              class="hidden w-full items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-6 py-3 text-base font-semibold text-emerald-100 shadow-lg shadow-emerald-500/10 transition duration-150 hover:-translate-y-0.5 hover:bg-emerald-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 sm:w-auto"
              data-last-meeting
              href="#"
              hidden
            >
              Open last meeting
            </a>
          </div>
          <p class="text-xs text-slate-400 sm:text-sm" data-install-hint hidden>
            Tip: open your browser menu and choose <span class="font-semibold text-slate-200">Add to Home Screen</span>.
          </p>
        </section>
      </main>
      <script src="/index.js" type="module"></script>
    </div>
  `;

  return layout({ title: 'Mini Meet', body });
}
