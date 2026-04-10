import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { listSessions } from "@/lib/store";

export default async function AdminPage() {
  await requireAdmin();
  const sessions = await listSessions();
  const liveSession = sessions.find((session) => session.status === "live");

  return (
    <main className="stage-shell min-h-screen px-6 py-8">
      <div className="mx-auto max-w-[96rem] space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow text-sm text-[var(--accent-strong)]">Admin</p>
            <h1 className="mt-3 text-5xl font-semibold tracking-[-0.06em] text-white">
              Session control
            </h1>
          </div>
          <div className="flex gap-3">
            <Link
              href="/admin/history"
              className="rounded-full border border-[var(--line)] bg-white/5 px-5 py-3 text-sm font-semibold text-[var(--ink-soft)] transition hover:bg-white/10"
            >
              History
            </Link>
            <form action="/logout" method="post">
              <button className="rounded-full border border-[var(--line)] bg-white/5 px-5 py-3 text-sm font-semibold text-[var(--ink-soft)] transition hover:bg-white/10">
                Log out
              </button>
            </form>
          </div>
        </div>

        <div className="glass-panel-strong rounded-[2rem] p-6">
          <p className="eyebrow text-sm text-[var(--accent-strong)]">Create session</p>
          <form action="/admin/sessions/create" method="post" className="mt-5 flex gap-4">
            <input
              type="text"
              name="title"
              placeholder="Presentation title"
              className="flex-1 rounded-2xl border border-[var(--line)] bg-white/5 px-4 py-4 text-lg text-white outline-none placeholder:text-[var(--ink-soft)]"
              required
            />
            <button
              type="submit"
              className="rounded-2xl bg-[var(--accent)] px-6 py-4 text-lg font-semibold text-[#20170a] transition hover:brightness-105"
            >
              Create
            </button>
          </form>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="glass-panel rounded-[2rem] p-6">
            <p className="eyebrow text-sm text-[var(--accent-strong)]">Current live session</p>
            {liveSession ? (
              <div className="mt-5">
                <h2 className="text-3xl font-semibold text-white">{liveSession.title}</h2>
                <p className="mt-2 text-lg text-[var(--ink-soft)]">
                  {liveSession.participants.length} participants
                </p>
                <p className="mt-2 text-lg text-[var(--ink-soft)]">
                  QR link: <span className="text-white">/vote/{liveSession.slug}</span>
                </p>
                <div className="mt-5 flex gap-3">
                  <Link
                    href={`/admin/sessions/${liveSession.id}`}
                    className="rounded-full border border-[var(--line)] bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    Manage
                  </Link>
                  <Link
                    href="/scoreboard"
                    className="rounded-full border border-[var(--line)] bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    Podium
                  </Link>
                  <Link
                    href="/ranking"
                    className="rounded-full border border-[var(--line)] bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    Ranking
                  </Link>
                </div>
              </div>
            ) : (
              <p className="mt-5 text-lg text-[var(--ink-soft)]">No live session yet.</p>
            )}
          </div>

          <div className="glass-panel rounded-[2rem] p-6">
            <div className="flex items-end justify-between">
              <div>
                <p className="eyebrow text-sm text-[var(--accent-strong)]">All sessions</p>
                <h2 className="mt-3 text-3xl font-semibold text-white">Manage presentations</h2>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="rounded-[1.6rem] border border-[rgba(255,255,255,0.05)] bg-white/[0.03] px-5 py-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-2xl font-semibold text-white">{session.title}</p>
                      <p className="mt-2 text-sm text-[var(--ink-soft)]">
                        {session.participants.length} participants • {session.voteCount} votes •{" "}
                        {session.status}
                      </p>
                      <p className="mt-2 text-sm text-[var(--ink-soft)]">/vote/{session.slug}</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <form action={`/admin/sessions/${session.id}/status`} method="post">
                        <input type="hidden" name="status" value="live" />
                        <button className="rounded-full border border-[var(--line)] bg-white/5 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/10">
                          Go live
                        </button>
                      </form>
                      <form action={`/admin/sessions/${session.id}/status`} method="post">
                        <input type="hidden" name="status" value="closed" />
                        <button className="rounded-full border border-[var(--line)] bg-white/5 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/10">
                          Close
                        </button>
                      </form>
                      <Link
                        href={`/admin/sessions/${session.id}`}
                        className="rounded-full border border-[var(--line)] bg-white/5 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
                      >
                        Manage
                      </Link>
                      <Link
                        href={`/admin/results/${session.id}`}
                        className="rounded-full border border-[var(--line)] bg-white/5 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
                      >
                        Results
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
              {sessions.length === 0 ? (
                <p className="text-lg text-[var(--ink-soft)]">No sessions created yet.</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
