import Image from "next/image";
import Link from "next/link";
import QRCode from "qrcode";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getSessionById } from "@/lib/store";

function QrDownload({ dataUrl, fileName }: { dataUrl: string; fileName: string }) {
  return (
    <a
      href={dataUrl}
      download={fileName}
      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-500 hover:text-gray-800 hover:border-gray-300 shadow-sm transition"
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

  if (!session) notFound();

  const headerStore = await headers();
  const host = headerStore.get("host") ?? "localhost:3000";
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  const baseUrl = `${protocol}://${host}`;
  const voteUrl = `${baseUrl}/vote/${session.slug}`;

  const sessionQrDataUrl = await QRCode.toDataURL(voteUrl, {
    margin: 1, color: { dark: "#4f46e5", light: "#ffffff" }, width: 200,
  });

  const participantQrs = await Promise.all(
    session.participants.map(async (p) => {
      const url = `${voteUrl}?p=${p.participantId}`;
      const dataUrl = await QRCode.toDataURL(url, {
        margin: 1, color: { dark: "#4f46e5", light: "#ffffff" }, width: 140,
      });
      return { ...p, qrDataUrl: dataUrl, qrUrl: url };
    })
  );

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="bg-float-circle w-96 h-96 bg-indigo-200 -top-32 -right-32" />
        <div className="bg-float-circle w-64 h-64 bg-blue-200 bottom-20 -left-20" />
      </div>

      <div className="max-w-6xl mx-auto relative space-y-6">
        <div className="flex items-start justify-between gap-4 animate-fade-in">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-indigo-600 tracking-wide uppercase">Session</p>
            <h1 className="text-2xl font-bold text-gray-900 mt-0.5 truncate sm:text-3xl">{session.title}</h1>
            <p className="text-sm text-gray-500 mt-1">
              <span className={`font-semibold ${session.status === "live" ? "text-green-600" : session.status === "closed" ? "text-gray-400" : "text-yellow-600"}`}>
                {session.status}
              </span>
              {" · "}{session.participants.length} participant{session.participants.length !== 1 ? "s" : ""}
              {" · "}{session.voteCount} vote{session.voteCount !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Link href={`/admin/results/${session.id}`} className="card rounded-xl px-3.5 py-2 text-xs font-semibold text-gray-600 hover:text-indigo-600">
              Results
            </Link>
            <Link href="/admin" className="card rounded-xl px-3.5 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900">
              Back
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 animate-fade-in animate-fade-in-d1">
          <form action={`/admin/sessions/${session.id}/status`} method="post">
            <input type="hidden" name="status" value="live" />
            <button className={`rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition ${
              session.status === "live"
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:brightness-110"
            }`}>
              {session.status === "live" ? "● Live" : "Open voting"}
            </button>
          </form>
          {session.status !== "closed" && (
            <form action={`/admin/sessions/${session.id}/status`} method="post">
              <input type="hidden" name="status" value="closed" />
              <button className="card rounded-xl px-4 py-2 text-sm font-semibold text-gray-600 hover:text-red-600">
                Close voting
              </button>
            </form>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr] animate-fade-in animate-fade-in-d2">
          <div className="card rounded-2xl p-5">
            <p className="text-sm font-semibold text-indigo-600 tracking-wide uppercase">Session QR</p>
            <p className="mt-1 text-xs text-gray-400 break-all">{voteUrl}</p>
            <div className="mt-4 flex items-start gap-5">
              <div className="shrink-0 rounded-xl border border-gray-200 bg-white p-2 shadow-sm">
                <Image src={sessionQrDataUrl} alt="QR" width={200} height={200} className="h-28 w-28 rounded-lg" unoptimized />
              </div>
              <div className="space-y-2 pt-1">
                <p className="text-sm text-gray-500">Point your audience here to vote</p>
                <QrDownload dataUrl={sessionQrDataUrl} fileName={`session-${session.slug}.png`} />
              </div>
            </div>
          </div>

          <div className="card rounded-2xl p-5">
            <p className="text-sm font-semibold text-indigo-600 tracking-wide uppercase">Add participant</p>
            <form action={`/admin/sessions/${session.id}/participants`} method="post" className="mt-4 flex gap-2">
              <input
                type="text"
                name="name"
                placeholder="Participant name"
                className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition"
                required
              />
              <button
                type="submit"
                className="shrink-0 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-110 transition"
              >
                Add
              </button>
            </form>
          </div>
        </div>

        <div className="animate-fade-in animate-fade-in-d3">
          <p className="text-sm font-semibold text-indigo-600 tracking-wide uppercase mb-3">Participants</p>

          {session.participants.length === 0 ? (
            <div className="card rounded-2xl p-8 text-center text-sm text-gray-400">No participants yet. Add one above.</div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {participantQrs.map((participant) => (
                <div key={participant.participantId} className="card rounded-xl p-4 hover:border-gray-300 transition">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-gray-900 truncate text-sm">
                      <span className="text-gray-400 font-normal">{participant.displayOrder}.</span>{" "}
                      {participant.name}
                    </p>
                    <form
                      action={`/admin/sessions/${session.id}/participants/${participant.participantId}/delete`}
                      method="post"
                    >
                      <button className="shrink-0 rounded-lg border border-red-100 bg-red-50 px-2 py-1 text-xs font-semibold text-red-400 hover:text-red-600 hover:bg-red-100 transition">
                        Remove
                      </button>
                    </form>
                  </div>

                  <div className="mt-3 flex items-start gap-4">
                    <div className="shrink-0 rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
                      <Image src={participant.qrDataUrl} alt={`${participant.name} QR`} width={140} height={140} className="h-16 w-16 rounded-md" unoptimized />
                    </div>
                    <div className="min-w-0 space-y-2 pt-0.5">
                      <a href={participant.qrUrl} target="_blank" className="block truncate text-xs text-gray-400 hover:text-indigo-600">
                        {participant.qrUrl}
                      </a>
                      <div className="flex flex-wrap gap-1.5">
                        <QrDownload dataUrl={participant.qrDataUrl} fileName={`${participant.name.replace(/\s+/g, "-")}-qr.png`} />
                        <form action={`/admin/sessions/${session.id}/participants/${participant.participantId}/photo`} method="post" encType="multipart/form-data" className="inline-flex">
                          <label className="cursor-pointer rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-500 hover:text-gray-800 hover:border-gray-300 shadow-sm transition">
                            <input type="file" name="photo" accept=".jpg,.jpeg,.png,.webp,.gif,.avif" className="hidden" required />
                            Photo
                          </label>
                          <button className="ml-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-500 hover:text-gray-800 hover:border-gray-300 shadow-sm transition">
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
