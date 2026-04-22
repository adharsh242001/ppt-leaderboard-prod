import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getSessionById, getSessionLeaderboard } from "@/lib/store";

export default async function SessionResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const session = await getSessionById(id);

  if (!session) {
    notFound();
  }

  const rows = await getSessionLeaderboard(id);

  return (
    <main className="stage-shell min-h-screen px-6 py-8">
      <div className="mx-auto max-w-[96rem] space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow text-sm text-[var(--accent-strong)]">Session Results</p>
            <h1 className="mt-3 text-5xl font-semibold tracking-[-0.06em] text-white">
              {session.title}
            </h1>
            <p className="mt-3 text-lg text-[var(--ink-soft)]">
              {session.voteCount} total votes
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href={`/admin/sessions/${session.id}`}
              className="rounded-full border border-[var(--line)] bg-white/5 px-5 py-3 text-sm font-semibold text-[var(--ink-soft)] transition hover:bg-white/10"
            >
              Session
            </Link>
            <Link
              href="/admin/history"
              className="rounded-full border border-[var(--line)] bg-white/5 px-5 py-3 text-sm font-semibold text-[var(--ink-soft)] transition hover:bg-white/10"
            >
              History
            </Link>
          </div>
        </div>

        <div className="glass-panel rounded-[2rem] p-6">
          <div className="mb-4 grid grid-cols-[96px_minmax(0,1.4fr)_1fr_1fr_1fr] gap-4 px-4 text-[11px] text-[var(--ink-soft)]">
            <div className="eyebrow">Rank</div>
            <div className="eyebrow">Participant</div>
            <div className="eyebrow text-right">Score</div>
            <div className="eyebrow text-right">Avg</div>
            <div className="eyebrow text-right">Votes</div>
          </div>

          <div className="space-y-3">
            {rows.map((row, index) => (
              <div
                key={row.name}
                className="grid grid-cols-[96px_minmax(0,1.4fr)_1fr_1fr_1fr] items-center gap-4 rounded-[1.5rem] border border-[rgba(255,255,255,0.04)] bg-white/[0.03] px-4 py-4"
              >
                <div className="text-lg font-semibold text-white">#{index + 1}</div>
                <div className="truncate text-2xl font-semibold text-white">{row.name}</div>
                <div className="text-right text-3xl font-semibold text-white">{row.sum}</div>
                <div className="text-right text-2xl text-[var(--ink-soft)]">{row.avg}</div>
                <div className="text-right text-2xl text-[var(--ink-soft)]">{row.count}</div>
              </div>
            ))}
            {rows.length === 0 ? (
              <div className="rounded-[1.5rem] border border-[rgba(255,255,255,0.04)] bg-white/[0.03] px-6 py-10 text-center text-lg text-[var(--ink-soft)]">
                No votes recorded for this session yet.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
