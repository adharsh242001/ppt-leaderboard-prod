import { NextResponse } from "next/server";
import { processPendingVotes } from "@/lib/store";

export async function GET() {
  const count = await processPendingVotes(10);
  return NextResponse.json({ processed: count });
}
