import { notFound } from "next/navigation";
import { getSessionBySlug } from "@/lib/store";

export default async function VotePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ p?: string }>;
}) {
  const { slug } = await params;
  const { p: highlightParticipantId } = await searchParams;
  const session = await getSessionBySlug(slug);

  if (!session) {
    notFound();
  }

  return (
    <main className="stage-shell min-h-screen px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <div className="glass-panel-strong rounded-xl px-5 py-6 sm:px-6">
          <p className="eyebrow text-[11px] text-[var(--accent-strong)]">Vote now</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white sm:text-3xl">
            {session.title}
          </h1>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            Rate each participant from 1 to 10.
          </p>

          <form action={`/vote/${session.slug}/submit`} method="post" className="mt-5 space-y-2">
            {session.participants.map((participant) => {
              const isHighlighted = highlightParticipantId === participant.participantId;
              return (
                <div
                  key={participant.participantId}
                  id={`p-${participant.participantId}`}
                  className={`rounded-xl border px-4 py-3 transition ${
                    isHighlighted
                      ? "border-[var(--accent)] bg-[rgba(212,175,55,0.06)]"
                      : "border-[rgba(255,255,255,0.05)] bg-white/[0.03]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-white">
                        {isHighlighted && (
                          <span className="inline-block mr-2 rounded bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-bold text-[#20170a] uppercase">
                            Now voting
                          </span>
                        )}
                        {participant.name}
                      </p>
                    </div>

                    <select
                      name={`score:${participant.participantId}`}
                      className={`shrink-0 rounded-xl border px-3 py-2 text-base text-white outline-none ${
                        isHighlighted
                          ? "border-[var(--accent)] bg-[#0b1628]"
                          : "border-[var(--line)] bg-[#0b1628]"
                      }`}
                      defaultValue=""
                      required
                    >
                      <option value="" disabled>Score</option>
                      {Array.from({ length: 10 }, (_, i) => i + 1).map((score) => (
                        <option key={score} value={score}>{score}</option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })}

            <button
              type="submit"
              className="mt-4 w-full rounded-xl bg-[var(--accent)] px-5 py-3 text-base font-semibold text-[#20170a] transition hover:brightness-105"
            >
              Submit votes
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
