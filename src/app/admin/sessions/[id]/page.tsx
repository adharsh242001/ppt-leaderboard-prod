import Image from "next/image";
import Link from "next/link";
import QRCode from "qrcode";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getSessionById } from "@/lib/store";

function QrDownloadButton({ dataUrl, fileName }: { dataUrl: string; fileName: string }) {
  return (
    <a
      href={dataUrl}
      download={fileName}
      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-white/5 px-2.5 py-1.5 text-[11px] font-semibold text-[var(--ink-soft)] transition hover:bg-white/10 hover:text-white"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      Download
    </a>
  );
}

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
  const baseUrl = `${protocol}://${host}`;
  const voteUrl = `${baseUrl}/vote/${session.slug}`;

  const sessionQrDataUrl = await QRCode.toDataURL(voteUrl, {
    margin: 1,
    color: { dark: "#f1c765", light: "#07111f" },
    width: 200,
  });

  const participantQrs = await Promise.all(
    session.participants.map(async (p) => {
      const url = `${voteUrl}?p=${p.participantId}`;
      const dataUrl = await QRCode.toDataURL(url, {
        margin: 1,
        color: { dark: "#f1c765", light: "#07111f" },
        width: 120,
      });
      return { ...p, qrDataUrl: dataUrl, qrUrl: url };
    })
  );

  return (
    <main className="stage-shell min-h-screen px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="eyebrow text-[11px] text-[var(--accent-strong)]">Session</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-white sm:text-3xl truncate">
              {session.title}
            </h1>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">
              Status: <span className="text-white capitalize">{session.status}</span>
              {" · "}{session.participants.length} participant{session.participants.length !== 1 ? "s" : ""}
              {" · "}{session.voteCount} vote{session.voteCount !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Link
              href={`/admin/results/${session.id}`}
              className="rounded-lg border border-[var(--line)] bg-white/5 px-3 py-2 text-xs font-semibold text-[var(--ink-soft)] transition hover:bg-white/10 hover:text-white"
            >
              Results
            </Link>
            <Link
              href="/admin"
              className="rounded-lg border border-[var(--line)] bg-white/5 px-3 py-2 text-xs font-semibold text-[var(--ink-soft)] transition hover:bg-white/10 hover:text-white"
            >
              Back
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <form action={`/admin/sessions/${session.id}/status`} method="post">
            <input type="hidden" name="status" value="live" />
            <button
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                session.status === "live"
                  ? "bg-[rgba(255,70,70,0.12)] text-[#ffc0c0] border border-[rgba(255,120,120,0.28)]"
                  : "bg-[var(--accent)] text-[#20170a] hover:brightness-105"
              }`}
            >
              {session.status === "live" ? "● Live" : "Open voting"}
            </button>
          </form>
          {session.status !== "closed" && (
            <form action={`/admin/sessions/${session.id}/status`} method="post">
              <input type="hidden" name="status" value="closed" />
              <button className="rounded-lg border border-[var(--line)] bg-white/5 px-4 py-2 text-sm font-semibold text-[var(--ink-soft)] transition hover:bg-white/10 hover:text-white">
                Close voting
              </button>
            </form>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr]">
          <div className="glass-panel rounded-xl p-4">
            <p className="eyebrow text-[11px] text-[var(--accent-strong)]">Session QR</p>
            <p className="mt-1 text-xs text-[var(--ink-soft)] break-all">{voteUrl}</p>
            <div className="mt-3 flex items-start gap-4">
              <div className="shrink-0 rounded-xl border border-[var(--line)] bg-[#07111f] p-2">
                <Image src={sessionQrDataUrl} alt="Voting QR" width={200} height={200} className="h-28 w-28 rounded-lg" unoptimized />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs text-[var(--ink-soft)]">Point your audience here</p>
                <div className="flex gap-2">
                  <QrDownloadButton dataUrl={sessionQrDataUrl} fileName={`session-${session.slug}.png`} />
                </div>
              </div>
            </div>
          </div>

          <div className="glass-panel rounded-xl p-4">
            <p className="eyebrow text-[11px] text-[var(--accent-strong)]">Add participant</p>
            <form action={`/admin/sessions/${session.id}/participants`} method="post" className="mt-3 flex gap-2">
              <input
                type="text"
                name="name"
                placeholder="Participant name"
                className="min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-[var(--ink-soft)]"
                required
              />
              <button
                type="submit"
                className="shrink-0 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[#20170a] transition hover:brightness-105"
              >
                Add
              </button>
            </form>
          </div>
        </div>

        <div>
          <p className="eyebrow mb-3 text-[11px] text-[var(--accent-strong)]">Participants</p>

          {session.participants.length === 0 ? (
            <div className="glass-panel rounded-xl p-6 text-center text-sm text-[var(--ink-soft)]">
              No participants yet. Add one above.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {participantQrs.map((participant) => (
                <div
                  key={participant.participantId}
                  className="glass-panel rounded-xl p-3 transition hover:border-[rgba(255,255,255,0.12)]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-white truncate">
                        <span className="text-[var(--ink-soft)] font-normal">{participant.displayOrder}.</span>{" "}
                        {participant.name}
                      </p>
                    </div>
                    <form
                      action={`/admin/sessions/${session.id}/participants/${participant.participantId}/delete`}
                      method="post"
                    >
                      <button className="shrink-0 rounded-lg border border-[rgba(255,120,120,0.2)] bg-[rgba(255,70,70,0.06)] px-2 py-1 text-[11px] font-semibold text-[#ffa0a0] transition hover:bg-[rgba(255,70,70,0.14)]">
                        Remove
                      </button>
                    </form>
                  </div>

                  <div className="mt-3 flex items-start gap-3">
                    <div className="shrink-0 rounded-lg border border-[var(--line)] bg-[#07111f] p-1">
                      <Image src={participant.qrDataUrl} alt={`${participant.name} QR`} width={120} height={120} className="h-16 w-16 rounded-md" unoptimized />
                    </div>
                    <div className="min-w-0 space-y-1.5">
                      <a
                        href={participant.qrUrl}
                        className="block truncate text-[11px] text-[var(--ink-soft)] hover:text-white"
                        target="_blank"
                      >
                        {participant.qrUrl}
                      </a>
                      <div className="flex flex-wrap gap-1.5">
                        <QrDownloadButton dataUrl={participant.qrDataUrl} fileName={`${participant.name.replace(/\s+/g, "-")}-qr.png`} />
                        <form
                          action={`/admin/sessions/${session.id}/participants/${participant.participantId}/photo`}
                          method="post"
                          encType="multipart/form-data"
                          className="inline-flex items-center gap-1.5"
                        >
                          <label className="cursor-pointer rounded-lg border border-[var(--line)] bg-white/5 px-2.5 py-1.5 text-[11px] font-semibold text-[var(--ink-soft)] transition hover:bg-white/10 hover:text-white">
                            Photo
                            <input type="file" name="photo" accept=".jpg,.jpeg,.png,.webp,.gif,.avif" className="hidden" required />
                          </label>
                          <button className="rounded-lg border border-[var(--line)] bg-white/5 px-2.5 py-1.5 text-[11px] font-semibold text-[var(--ink-soft)] transition hover:bg-white/10 hover:text-white">
                            Upload
                          </button>
                        </form>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
