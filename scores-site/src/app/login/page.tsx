export default function LoginPage() {
  return (
    <main className="stage-shell flex min-h-screen items-center justify-center px-6 py-12">
      <div className="glass-panel-strong w-full max-w-md rounded-[2rem] px-8 py-10">
        <p className="eyebrow text-sm text-[var(--accent-strong)]">Admin Access</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.06em] text-white">
          Sign in
        </h1>
        <form action="/auth/login" method="post" className="mt-8 space-y-4">
          <input
            type="password"
            name="password"
            placeholder="Admin password"
            className="w-full rounded-2xl border border-[var(--line)] bg-white/5 px-4 py-4 text-lg text-white outline-none placeholder:text-[var(--ink-soft)]"
            required
          />
          <button
            type="submit"
            className="w-full rounded-2xl bg-[var(--accent)] px-4 py-4 text-lg font-semibold text-[#20170a] transition hover:brightness-105"
          >
            Enter admin area
          </button>
        </form>
      </div>
    </main>
  );
}
