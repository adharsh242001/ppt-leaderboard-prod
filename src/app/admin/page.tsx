import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { listSessions } from "@/lib/store";

export default async function AdminPage() {
  await requireAdmin();
  const sessions = await listSessions();
  const liveSession = sessions.find((s) => s.status === "live");

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="bg-float-circle w-96 h-96 bg-indigo-200 -top-32 -right-32" />
        <div className="bg-float-circle w-64 h-64 bg-blue-200 bottom-20 -left-20" />
        <div className="bg-float-circle w-48 h-48 bg-purple-200 top-1/2 right-1/4" />
      </div>

      <div className="max-w-6xl mx-auto relative space-y-8">
        <div className="flex items-start justify-between gap-4 animate-fade-in">
          <div>
            <p className="text-sm font-semibold text-indigo-600 tracking-wide uppercase">Admin</p>
            <h1 className="text-3xl font-bold text-gray-900 mt-1">Session control</h1>
          </div>
          <div className="flex gap-3">
            <Link
              href="/admin/history"
              className="card rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-900"
            >
              History
            </Link>
            <form action="/logout" method="post">
              <button className="card rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-600 hover:text-red-600">
                Log out
              </button>
            </form>
          </div>
        </div>

        <div className="card rounded-2xl p-6 animate-fade-in animate-fade-in-d1">
          <p className="text-sm font-semibold text-indigo-600 tracking-wide uppercase">Create session</p>
          <form action="/admin/sessions/create" method="post" className="mt-4 flex gap-3">
            <input
              type="text"
              name="title"
              placeholder="Presentation title"
              className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-base text-gray-900 outline-none placeholder:text-gray-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition"
              required
            />
            <button
              type="submit"
              className="shrink-0 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-3 text-base font-semibold text-white shadow-md hover:shadow-lg hover:brightness-110 transition"
            >
              Create
            </button>
          </form>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr] animate-fade-in animate-fade-in-d2">
          <div className="card rounded-2xl p-6">
            <p className="text-sm font-semibold text-indigo-600 tracking-wide uppercase">Current live session</p>
            {liveSession ? (
              <div className="mt-4">
                <h2 className="text-xl font-bold text-gray-900">{liveSession.title}</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {liveSession.participants.length} participant{liveSession.participants.length !== 1 ? "s" : ""}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  QR: <span className="text-gray-700 font-mono">/vote/{liveSession.slug}</span>
                </p>
                <div className="flex gap-2 mt-4">
                  <Link
                    href={`/admin/sessions/${liveSession.id}`}
                    className="rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-2 text-sm font-semibold text-white shadow hover:brightness-110 transition"
                  >
                    Manage
                  </Link>
                  <Link
                    href="/scoreboard"
                    className="card rounded-xl px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900"
                  >
                    Podium
                  </Link>
                  <Link
                    href="/ranking"
                    className="card rounded-xl px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900"
                  >
                    Ranking
                  </Link>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-gray-500">No live session yet.</p>
            )}
          </div>

          <div className="card rounded-2xl p-6">
            <p className="text-sm font-semibold text-indigo-600 tracking-wide uppercase">All sessions</p>
            <h2 className="text-xl font-bold text-gray-900 mt-3">Manage presentations</h2>

            <div className="mt-5 space-y-3">
              {sessions.map((session) => (
                <div key={session.id} className="card rounded-xl p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{session.title}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {session.participants.length} participant{session.participants.length !== 1 ? "s" : ""}
                        {" · "}{session.voteCount} vote{session.voteCount !== 1 ? "s" : ""}
                        {" · "}
                        <span className={`font-medium ${session.status === "live" ? "text-green-600" : session.status === "closed" ? "text-gray-400" : "text-yellow-600"}`}>
                          {session.status}
                        </span>
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5 shrink-0">
                      <form action={`/admin/sessions/${session.id}/status`} method="post">
                        <input type="hidden" name="status" value="live" />
                        <button className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:text-green-600 hover:border-green-300 transition">
                          Go live
                        </button>
                      </form>
                      <form action={`/admin/sessions/${session.id}/status`} method="post">
                        <input type="hidden" name="status" value="closed" />
                        <button className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:text-red-600 hover:border-red-300 transition">
                          Close
                        </button>
                      </form>
                      <Link
                        href={`/admin/sessions/${session.id}`}
                        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:text-indigo-600 hover:border-indigo-300 transition"
                      >
                        Manage
                      </Link>
                      <Link
                        href={`/admin/results/${session.id}`}
                        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:text-indigo-600 hover:border-indigo-300 transition"
                      >
                        Results
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
              {sessions.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-6">No sessions created yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
