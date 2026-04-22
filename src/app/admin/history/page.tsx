import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { listSessions } from "@/lib/store";

export default async function AdminHistoryPage() {
  await requireAdmin();
  const sessions = await listSessions();
  const closedSessions = sessions.filter((session) => session.status === "closed");

  return (
    <main className="stage-shell min-h-screen px-6 py-8">
      <div className="mx-auto max-w-[96rem] space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow text-sm text-[var(--accent-strong)]">Admin</p>
            <h1 className="mt-3 text-5xl font-semibold tracking-[-0.06em] text-white">
              Session history
            </h1>
          </div>
          <Link
            href="/admin"
            className="rounded-full border border-[var(--line)] bg-white/5 px-5 py-3 text-sm font-semibold text-[var(--ink-soft)] transition hover:bg-white/10"
          >
            Back to admin
          </Link>
        </div>

        <div className="glass-panel rounded-[2rem] p-6">
          <div className="space-y-4">
            {closedSessions.map((session) => (
              <div
                key={session.id}
                className="rounded-[1.6rem] border border-[rgba(255,255,255,0.05)] bg-white/[0.03] px-5 py-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-2xl font-semibold text-white">{session.title}</p>
                    <p className="mt-2 text-sm text-[var(--ink-soft)]">
                      {session.participants.length} participants • {session.voteCount} votes
                    </p>
                    <p className="mt-2 text-sm text-[var(--ink-soft)]">
                      Closed session • /vote/{session.slug}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={`/admin/results/${session.id}`}
                      className="rounded-full border border-[var(--line)] bg-white/5 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
                    >
                      Results
                    </Link>
                    <Link
                      href={`/admin/sessions/${session.id}`}
                      className="rounded-full border border-[var(--line)] bg-white/5 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
                    >
                      Session
                    </Link>
                  </div>
                </div>
              </div>
            ))}
            {closedSessions.length === 0 ? (
              <p className="text-lg text-[var(--ink-soft)]">No closed sessions yet.</p>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
