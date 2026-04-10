import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createVoteFingerprint, submitVotes } from "@/lib/store";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const formData = await request.formData();
  const ratings = [...formData.entries()]
    .filter(([key]) => key.startsWith("score:"))
    .map(([key, value]) => ({
      participantId: key.replace("score:", ""),
      score: Number.parseInt(String(value), 10),
    }))
    .filter((rating) => Number.isFinite(rating.score));

  const cookieStore = await cookies();
  const voterCookieName = `vote-${slug}`;

  let voterToken = cookieStore.get(voterCookieName)?.value;
  if (!voterToken) {
    voterToken = randomUUID();
  }

  const forwardedFor = request.headers.get("x-forwarded-for") ?? "";
  const ipAddress = forwardedFor.split(",")[0]?.trim() || "unknown-ip";
  const userAgent = request.headers.get("user-agent") ?? "unknown-user-agent";
  const acceptLanguage =
    request.headers.get("accept-language") ?? "unknown-language";
  const voterFingerprint = createVoteFingerprint({
    ipAddress,
    userAgent,
    acceptLanguage,
  });

  await submitVotes(slug, ratings, voterToken, voterFingerprint);

  cookieStore.set(voterCookieName, voterToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return NextResponse.redirect(new URL(`/vote/${slug}/done`, request.url));
}
