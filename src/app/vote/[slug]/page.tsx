import { notFound } from "next/navigation";
import { getSessionBySlug } from "@/lib/store";

function VoteFormShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="bg-float-circle w-80 h-80 bg-indigo-200 -top-24 -right-24" />
        <div className="bg-float-circle w-56 h-56 bg-purple-200 bottom-12 -left-20" />
      </div>
      <div className="max-w-lg mx-auto relative animate-fade-in">
        <div className="card-strong rounded-2xl p-6 sm:p-8">
          {children}
        </div>
      </div>
    </main>
  );
}

export default async function VotePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ p?: string; retry?: string }>;
}) {
  const { slug } = await params;
  const { p: targetParticipantId, retry } = await searchParams;

  let session;
  try {
    session = await getSessionBySlug(slug);
  } catch {
    return (
      <VoteFormShell>
        <div className="text-center py-8">
          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Unable to load voting</h1>
          <p className="text-sm text-gray-500 mt-2 mb-6">Please try again in a moment.</p>
          <a
            href={`/vote/${slug}`}
            className="inline-block rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:shadow-lg hover:brightness-110 transition"
          >
            Retry
          </a>
        </div>
      </VoteFormShell>
    );
  }

  if (!session) notFound();

  const participants = targetParticipantId
    ? session.participants.filter((p) => p.participantId === targetParticipantId)
    : session.participants;

  const targetName = targetParticipantId
    ? session.participants.find((p) => p.participantId === targetParticipantId)?.name
    : null;

  if (targetParticipantId && participants.length === 0) notFound();

  const isRetry = retry === "1";

  return (
    <VoteFormShell>
      <div className="flex items-center gap-3 mb-1">
        <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
        <p className="text-xs font-semibold text-green-600 tracking-wide uppercase">Vote now</p>
      </div>

      <h1 className="text-xl font-bold text-gray-900 sm:text-2xl mt-1">
        {targetName ? `${targetName}` : session.title}
      </h1>
      {!targetName && (
        <p className="text-sm text-gray-500 mt-1">Rate each participant from 1 to 10.</p>
      )}

      {isRetry && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Something went wrong. Please try submitting your vote again.
        </div>
      )}

      <form action={`/vote/${session.slug}/submit`} method="post" className="mt-6 space-y-3">
        {participants.map((participant) => (
          <div
            key={participant.participantId}
            className={`rounded-xl border p-4 ${targetParticipantId
              ? "border-indigo-200 bg-indigo-50/50"
              : "border-gray-100 bg-white/50"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-gray-900">
                  {participant.name}
                </p>
                {!targetParticipantId && (
                  <p className="text-xs text-gray-400 mt-0.5">Give a score</p>
                )}
              </div>
              <select
                name={`score:${participant.participantId}`}
                className="shrink-0 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition"
                defaultValue=""
                required
              >
                <option value="" disabled>Score</option>
                {Array.from({ length: 10 }, (_, i) => i + 1).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
        ))}

        <button
          type="submit"
          className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-5 py-3 text-base font-semibold text-white shadow-md hover:shadow-lg hover:brightness-110 transition"
        >
          Submit vote{participants.length > 1 ? "s" : ""}
        </button>
      </form>
    </VoteFormShell>
  );
}
