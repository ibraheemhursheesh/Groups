function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
      <path
        fill="#4285F4"
        d="M21.35 12.23c0-.71-.06-1.4-.18-2.05H12v3.88h5.24a4.48 4.48 0 0 1-1.94 2.94v2.44h3.14c1.84-1.69 2.91-4.18 2.91-7.21Z"
      />
      <path
        fill="#34A853"
        d="M12 21.67c2.63 0 4.84-.87 6.45-2.36l-3.14-2.44c-.87.58-1.98.93-3.31.93-2.54 0-4.69-1.72-5.46-4.03H3.3v2.52A9.74 9.74 0 0 0 12 21.67Z"
      />
      <path
        fill="#FBBC05"
        d="M6.54 13.77a5.85 5.85 0 0 1 0-3.54V7.71H3.3a9.75 9.75 0 0 0 0 8.58l3.24-2.52Z"
      />
      <path
        fill="#EA4335"
        d="M12 6.2c1.43 0 2.72.49 3.73 1.46l2.8-2.8C16.84 3.27 14.63 2.33 12 2.33a9.74 9.74 0 0 0-8.7 5.38l3.24 2.52C7.31 7.92 9.46 6.2 12 6.2Z"
      />
    </svg>
  );
}

export default function Home() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f7f8fc] px-6 py-12 text-slate-950">
      <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-indigo-200/40 blur-3xl" />
      <div className="absolute -bottom-40 -right-24 h-[28rem] w-[28rem] rounded-full bg-violet-200/40 blur-3xl" />

      <section className="relative w-full max-w-md rounded-3xl border border-white/80 bg-white/90 p-8 shadow-[0_24px_80px_-30px_rgba(49,46,129,0.45)] backdrop-blur sm:p-10">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-xl font-bold text-white shadow-lg shadow-indigo-600/25">
            G
          </div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">
            Welcome back
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Sign in to Groupss
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Connect with your team and keep every conversation in one place.
          </p>
        </div>

        <a
          href="/auth/google"
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:cursor-wait disabled:opacity-60"
        >
          <GoogleMark />
          Continue with Google
        </a>

        <p className="mt-8 text-center text-xs leading-5 text-slate-400">
          By continuing, you agree to the Groupss terms and privacy policy.
        </p>
      </section>
    </main>
  );
}
