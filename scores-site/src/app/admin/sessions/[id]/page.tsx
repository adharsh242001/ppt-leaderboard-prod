import Image from "next/image";
import Link from "next/link";
import QRCode from "qrcode";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getSessionById } from "@/lib/store";

export default async function SessionPage({
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

  const headerStore = await headers();
  const host = headerStore.get("host") ?? "localhost:3000";
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  const voteUrl = `${protocol}://${host}/vote/${session.slug}`;
  const qrDataUrl = await QRCode.toDataURL(voteUrl, {
    margin: 1,
    color: {
      dark: "#f1c765",
      light: "#07111f",
    },
    width: 260,
  });

  return (
    <main className="stage-shell min-h-screen px-6 py-8">
      <div className="mx-auto max-w-[96rem] space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow text-sm text-[var(--accent-strong)]">Session</p>
            <h1 className="mt-3 text-5xl font-semibold tracking-[-0.06em] text-white">
              {session.title}
            </h1>
            <p className="mt-3 text-lg text-[var(--ink-soft)]">Status: {session.status}</p>
          </div>
          <Link
            href="/admin"
            className="rounded-full border border-[var(--line)] bg-white/5 px-5 py-3 text-sm font-semibold text-[var(--ink-soft)] transition hover:bg-white/10"
          >
            Back
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="glass-panel-strong rounded-[2rem] p-6">
            <p className="eyebrow text-sm text-[var(--accent-strong)]">Voting QR</p>
            <div className="mt-5 rounded-[1.8rem] border border-[var(--line)] bg-[#07111f] p-4">
              <Image src={qrDataUrl} alt="Voting QR" width={260} height={260} className="h-auto w-full rounded-2xl" unoptimized />
            </div>
            <p className="mt-4 break-all text-sm text-[var(--ink-soft)]">{voteUrl}</p>
            <div className="mt-5 flex gap-3">
              <form action={`/admin/sessions/${session.id}/status`} method="post">
                <input type="hidden" name="status" value="live" />
                <button className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[#20170a]">
                  Open voting
                </button>
              </form>
              <form action={`/admin/sessions/${session.id}/status`} method="post">
                <input type="hidden" name="status" value="closed" />
                <button className="rounded-full border border-[var(--line)] bg-white/5 px-4 py-2 text-sm font-semibold text-white">
                  Close voting
                </button>
              </form>
              <Link
                href={`/admin/results/${session.id}`}
                className="rounded-full border border-[var(--line)] bg-white/5 px-4 py-2 text-sm font-semibold text-white"
              >
                View results
              </Link>
            </div>
          </div>

          <div className="glass-panel rounded-[2rem] p-6">
            <p className="eyebrow text-sm text-[var(--accent-strong)]">Participants</p>
            <form action={`/admin/sessions/${session.id}/participants`} method="post" className="mt-5 flex gap-4">
              <input
                type="text"
                name="name"
                placeholder="Participant name"
                className="flex-1 rounded-2xl border border-[var(--line)] bg-white/5 px-4 py-4 text-lg text-white outline-none placeholder:text-[var(--ink-soft)]"
                required
              />
              <button
                type="submit"
                className="rounded-2xl bg-[var(--accent)] px-6 py-4 text-lg font-semibold text-[#20170a]"
              >
                Add
              </button>
            </form>

            <div className="mt-6 space-y-3">
              {session.participants.map((participant) => (
                <div
                  key={participant.participantId}
                  className="rounded-[1.5rem] border border-[rgba(255,255,255,0.05)] bg-white/[0.03] px-5 py-4 text-lg text-white"
                >
                  {participant.displayOrder}. {participant.name}
                </div>
              ))}
              {session.participants.length === 0 ? (
                <p className="text-lg text-[var(--ink-soft)]">No participants yet.</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
