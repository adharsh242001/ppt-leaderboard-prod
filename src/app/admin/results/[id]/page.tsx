import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getSessionById, getSessionLeaderboard } from "@/lib/store";
import { getParticipantPhotoUrl } from "@/lib/photoMatching";

const PODIUM_COLORS = ["#FFD700", "#C0C0C0", "#CD7F32"];
const PODIUM_HEIGHTS = ["h-36 sm:h-40", "h-28 sm:h-32", "h-24 sm:h-28"];

function getInitials(name: string) {
  return name.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();
}

type EnrichedRow = {
  name: string;
  sum: string;
  count: string;
  avg: string;
  rank: number;
  initials: string;
  photoUrl: string | null;
};

async function getEnrichedRows(sessionId: string): Promise<EnrichedRow[]> {
  const rows = await getSessionLeaderboard(sessionId);
  const photoUrls = await Promise.all(
    rows.map((row) => getParticipantPhotoUrl(row.name))
  );
  return rows.map((row, i) => ({
    ...row,
    rank: i + 1,
    initials: getInitials(row.name),
    photoUrl: photoUrls[i],
  }));
}

function PodiumSection({
  top3,
}: {
  top3: Awaited<ReturnType<typeof getEnrichedRows>>;
}) {
  return (
    <section className="animate-fade-in animate-fade-in-d1">
      <h2 className="text-xl font-bold text-gray-900 mb-8 text-center">Top Performers</h2>
      <div className="flex justify-center items-end gap-4 sm:gap-6 max-w-2xl mx-auto">
        {top3.map((p, i) => {
          const order = i === 0 ? 1 : i === 1 ? 2 : 3;
          const idx = order === 1 ? 0 : order === 2 ? 1 : 2;

          return (
            <div key={p.name} className="flex flex-col items-center">
              <div className="mb-3 relative">
                {p.photoUrl ? (
                  <img
                    src={p.photoUrl}
                    alt={p.name}
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-4 shadow-lg"
                    style={{ borderColor: PODIUM_COLORS[idx] }}
                  />
                ) : (
                  <div
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center text-white font-bold text-lg border-4 shadow-lg"
                    style={{ backgroundColor: "#6366f1", borderColor: PODIUM_COLORS[idx] }}
                  >
                    {p.initials}
                  </div>
                )}
                {order === 1 && (
                  <span className="absolute -top-1 -right-1 text-xl">&#x1F451;</span>
                )}
              </div>
              <div className="text-center mb-3">
                <p className="font-bold text-gray-900 text-sm sm:text-base">{p.name}</p>
                <p className="text-xl sm:text-2xl font-bold text-indigo-600">{p.sum}</p>
                <p className="text-xs text-gray-500">avg {p.avg}</p>
              </div>
              <div
                className={`w-20 sm:w-24 ${PODIUM_HEIGHTS[idx]} rounded-t-lg flex items-center justify-center text-white font-bold text-lg shadow-lg`}
                style={{ backgroundColor: PODIUM_COLORS[idx] }}
              >
                {order}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default async function SessionResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const session = await getSessionById(id);

  if (!session) notFound();

  const allRows = await getEnrichedRows(id);
  const top3 = allRows.slice(0, 3);
  const remaining = allRows.slice(3);

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="bg-float-circle w-80 h-80 bg-indigo-200 -top-32 -right-32" />
        <div className="bg-float-circle w-56 h-56 bg-blue-200 bottom-20 -left-20" />
        <div className="bg-float-circle w-40 h-40 bg-purple-200 top-1/3 right-1/4" />
      </div>

      <div className="max-w-6xl mx-auto relative space-y-8">
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

        {allRows.length === 0 && (
          <div className="card rounded-2xl p-10 text-center text-sm text-gray-400 animate-fade-in">
            No votes recorded for this session yet.
          </div>
        )}

        {top3.length >= 3 && <PodiumSection top3={top3} />}

        {remaining.length > 0 && (
          <section className="animate-fade-in animate-fade-in-d2">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              All Participants ({allRows.length})
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {remaining.map((p) => (
                <div
                  key={p.name}
                  className="card rounded-xl p-4 hover:border-gray-300 transition flex items-center gap-4"
                >
                  <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-500 text-xs font-bold shrink-0">
                    #{p.rank}
                  </div>
                  {p.photoUrl ? (
                    <img src={p.photoUrl} alt={p.name} className="w-11 h-11 rounded-xl object-cover shadow-sm shrink-0" />
                  ) : (
                    <div className="w-11 h-11 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-400 text-xs font-bold shrink-0">
                      {p.initials}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 truncate text-sm">{p.name}</p>
                    <div className="flex gap-3 mt-1 text-xs text-gray-500">
                      <span><strong className="text-gray-700">{p.sum}</strong> score</span>
                      <span><strong className="text-gray-700">{p.count}</strong> votes</span>
                      <span><strong className="text-gray-700">{p.avg}</strong> avg</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {top3.length < 3 && top3.length > 0 && (
          <section className="animate-fade-in animate-fade-in-d2">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Results</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {top3.map((p) => (
                <div
                  key={p.name}
                  className="card rounded-xl p-4 hover:border-gray-300 transition flex items-center gap-4"
                >
                  <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-500 text-xs font-bold shrink-0">
                    #{(top3.indexOf(p) + 1)}
                  </div>
                  {p.photoUrl ? (
                    <img src={p.photoUrl} alt={p.name} className="w-11 h-11 rounded-xl object-cover shadow-sm shrink-0" />
                  ) : (
                    <div className="w-11 h-11 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-400 text-xs font-bold shrink-0">
                      {p.initials}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 truncate text-sm">{p.name}</p>
                    <div className="flex gap-3 mt-1 text-xs text-gray-500">
                      <span><strong className="text-gray-700">{p.sum}</strong> score</span>
                      <span><strong className="text-gray-700">{p.count}</strong> votes</span>
                      <span><strong className="text-gray-700">{p.avg}</strong> avg</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
