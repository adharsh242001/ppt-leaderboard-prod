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

  if (!session) notFound();

  const rows = await getSessionLeaderboard(id);

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="bg-float-circle w-80 h-80 bg-indigo-200 -top-24 -right-24" />
        <div className="bg-float-circle w-56 h-56 bg-blue-200 bottom-16 -left-20" />
      </div>

      <div className="max-w-4xl mx-auto relative space-y-6">
        <div className="flex items-start justify-between gap-4 animate-fade-in">
          <div>
            <p className="text-sm font-semibold text-indigo-600 tracking-wide uppercase">Session Results</p>
            <h1 className="text-2xl font-bold text-gray-900 mt-0.5">{session.title}</h1>
            <p className="text-sm text-gray-500 mt-1">{session.voteCount} total vote{session.voteCount !== 1 ? "s" : ""}</p>
          </div>
          <div className="flex gap-2">
            <Link href={`/admin/sessions/${session.id}`} className="card rounded-xl px-3.5 py-2 text-xs font-semibold text-gray-600 hover:text-indigo-600">
              Session
            </Link>
            <Link href="/admin/history" className="card rounded-xl px-3.5 py-2 text-xs font-semibold text-gray-600 hover:text-indigo-600">
              History
            </Link>
          </div>
        </div>

        <div className="card rounded-2xl p-5 animate-fade-in animate-fade-in-d1">
          <div className="grid grid-cols-[56px_1fr_80px_80px_72px] gap-3 px-1 pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
            <div>Rank</div>
            <div>Participant</div>
            <div className="text-right">Score</div>
            <div className="text-right">Avg</div>
            <div className="text-right">Votes</div>
          </div>

          <div className="mt-2 space-y-1">
            {rows.map((row, i) => (
              <div
                key={row.name}
                className="grid grid-cols-[56px_1fr_80px_80px_72px] gap-3 items-center rounded-xl px-1 py-3 hover:bg-gray-50 transition"
              >
                <div className={`text-sm font-bold ${i === 0 ? "text-yellow-500" : i === 1 ? "text-gray-400" : i === 2 ? "text-orange-400" : "text-gray-600"}`}>
                  #{i + 1}
                </div>
                <div className="truncate text-sm font-semibold text-gray-900">{row.name}</div>
                <div className="text-right text-sm font-bold text-gray-900">{row.sum}</div>
                <div className="text-right text-sm text-gray-500">{row.avg}</div>
                <div className="text-right text-sm text-gray-500">{row.count}</div>
              </div>
            ))}
            {rows.length === 0 && (
              <div className="text-center py-10 text-sm text-gray-400">No votes recorded for this session yet.</div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
