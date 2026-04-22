export default function NotFound() {
  return (
    <main className="stage-shell flex min-h-screen items-center justify-center px-6 py-12">
      <div className="glass-panel-strong rounded-[2rem] px-10 py-12 text-center">
        <p className="eyebrow text-sm text-[var(--accent-strong)]">Not Found</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.06em] text-white">
          This page does not exist
        </h1>
      </div>
    </main>
  );
}
