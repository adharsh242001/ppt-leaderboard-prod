import { notFound } from "next/navigation";
import { getSessionBySlug } from "@/lib/store";

export default async function VotePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await getSessionBySlug(slug);

  if (!session) {
    notFound();
  }

  return (
    <main className="stage-shell min-h-screen px-6 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="glass-panel-strong rounded-[2rem] px-8 py-8">
          <p className="eyebrow text-sm text-[var(--accent-strong)]">Vote now</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.06em] text-white">
            {session.title}
          </h1>
          <p className="mt-3 text-lg text-[var(--ink-soft)]">
            Rate each participant from 1 to 10.
          </p>

          <form action={`/vote/${session.slug}/submit`} method="post" className="mt-8 space-y-4">
            {session.participants.map((participant) => (
              <div
                key={participant.participantId}
                className="rounded-[1.6rem] border border-[rgba(255,255,255,0.05)] bg-white/[0.03] px-5 py-5"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-2xl font-semibold text-white">{participant.name}</p>
                    <p className="mt-1 text-sm text-[var(--ink-soft)]">Give a score</p>
                  </div>

                  <select
                    name={`score:${participant.participantId}`}
                    className="rounded-2xl border border-[var(--line)] bg-[#0b1628] px-4 py-3 text-lg text-white"
                    defaultValue=""
                    required
                  >
                    <option value="" disabled>
                      Score
                    </option>
                    {Array.from({ length: 10 }, (_, index) => index + 1).map((score) => (
                      <option key={score} value={score}>
                        {score}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}

            <button
              type="submit"
              className="w-full rounded-[1.6rem] bg-[var(--accent)] px-6 py-4 text-xl font-semibold text-[#20170a] transition hover:brightness-105"
            >
              Submit votes
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
