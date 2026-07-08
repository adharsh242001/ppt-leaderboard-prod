import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { listSessions } from "@/lib/store";

export default async function AdminHistoryPage() {
  await requireAdmin();
  const sessions = await listSessions();
  const closedSessions = sessions.filter((s) => s.status === "closed");

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="bg-float-circle w-80 h-80 bg-indigo-200 -top-24 -right-24" />
        <div className="bg-float-circle w-56 h-56 bg-gray-200 bottom-16 -left-20" />
      </div>

      <div className="max-w-4xl mx-auto relative space-y-6">
        <div className="flex items-start justify-between gap-4 animate-fade-in">
          <div>
            <p className="text-sm font-semibold text-indigo-600 tracking-wide uppercase">Admin</p>
            <h1 className="text-2xl font-bold text-gray-900 mt-0.5">Session history</h1>
            <p className="text-sm text-gray-500 mt-1">{closedSessions.length} closed session{closedSessions.length !== 1 ? "s" : ""}</p>
          </div>
          <Link href="/admin" className="card rounded-xl px-3.5 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900">
            Back to admin
          </Link>
        </div>

        <div className="card rounded-2xl p-5 animate-fade-in animate-fade-in-d1">
          <div className="space-y-3">
            {closedSessions.map((session) => (
              <div key={session.id} className="card rounded-xl p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">{session.title}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {session.participants.length} participant{session.participants.length !== 1 ? "s" : ""}
                      {" · "}{session.voteCount} vote{session.voteCount !== 1 ? "s" : ""}
                      {" · "}Closed
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Link
                      href={`/admin/results/${session.id}`}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:text-indigo-600 hover:border-indigo-300 transition"
                    >
                      Results
                    </Link>
                    <Link
                      href={`/admin/sessions/${session.id}`}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:text-indigo-600 hover:border-indigo-300 transition"
                    >
                      Session
                    </Link>
                  </div>
                </div>
              </div>
            ))}
            {closedSessions.length === 0 && (
              <p className="text-center py-10 text-sm text-gray-400">No closed sessions yet.</p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
