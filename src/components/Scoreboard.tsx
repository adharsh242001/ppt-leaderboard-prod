"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

const REFRESH_MS = 10_000;
const NAME_COL = "Name";
const SCORE_COL = "Sum";
const COUNT_COL = "Count";
const AVG_COL = "Avg";

const PHOTO_BY_NAME: Record<string, string> = {};

function BackgroundElements() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      <div className="bg-float-circle w-80 h-80 bg-indigo-200 -top-32 -right-32" />
      <div className="bg-float-circle w-56 h-56 bg-blue-200 top-1/2 -left-20" style={{ animationDelay: "-2s" }} />
      <div className="bg-float-circle w-40 h-40 bg-purple-200 bottom-10 right-1/4" style={{ animationDelay: "-4s" }} />
    </div>
  );
}

type RawRow = { name: string; sum: string; count: string; avg: string };

function parseCSV(text: string): string[][] {
  const firstLine = text.split(/\r?\n/)[0] ?? "";
  const useSemicolon = firstLine.includes(";") && !firstLine.includes(",");
  const delim = useSemicolon ? ";" : ",";
  const rows: string[][] = [];
  let cur = "", row: string[] = [], inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i+1] === '"') { cur += '"'; i++; } else inQ = false; }
      else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === delim) { row.push(cur); cur = ""; }
    else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
    else if (c !== "\r") cur += c;
  }
  row.push(cur); rows.push(row);
  return rows.filter(r => r.some(c => (c ?? "").trim() !== ""));
}

function mapRows(rows: string[][]): RawRow[] {
  if (!rows.length) return [];
  const [header, ...data] = rows;
  const idx: Record<string, number> = {};
  header.forEach((h, i) => { idx[(h ?? "").trim().toLowerCase()] = i; });
  const n = idx[NAME_COL.toLowerCase()], s = idx[SCORE_COL.toLowerCase()];
  const c = idx[COUNT_COL.toLowerCase()], a = idx[AVG_COL.toLowerCase()];
  if (n === undefined || s === undefined) return [];
  return data.map(r => ({
    name: (r[n] ?? "").trim(),
    sum: (r[s] ?? "").trim(),
    count: (r[c] ?? "").trim(),
    avg: (r[a] ?? "").trim(),
  }));
}

async function fetchFromCSV(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`CSV fetch failed: ${res.status}`);
  return mapRows(parseCSV(await res.text()));
}

async function fetchFromSheets(apiKey: string, sheetId: string, range: string) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?key=${apiKey}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Sheets fetch failed: ${res.status}`);
  const json = await res.json();
  return mapRows((json.values || []) as string[][]);
}

async function fetchInternal() {
  const res = await fetch("/api/leaderboard", { cache: "no-store" });
  if (!res.ok) throw new Error(`Leaderboard fetch failed: ${res.status}`);
  const json = await res.json();
  return (json.rows ?? []) as RawRow[];
}

async function fetchPhotos(): Promise<Record<string, string>> {
  try {
    const res = await fetch("/api/photos", { cache: "no-store" });
    if (!res.ok) return {};
    const json = await res.json();
    return json.photos ?? {};
  } catch { return {}; }
}

function withRanks<T extends { scoreNum: number }>(items: T[]) {
  const sorted = [...items].sort((a, b) => b.scoreNum - a.scoreNum);
  let last: number | null = null, lastRank = 0;
  return sorted.map((item, i) => {
    const rank = last === item.scoreNum ? lastRank : i + 1;
    last = item.scoreNum; lastRank = rank;
    return { ...item, rank, photoSrc: undefined as string | undefined };
  });
}

function getInitials(name: string) {
  return name.split(" ").map(s => s[0]).join("").slice(0, 2).toUpperCase();
}

function Header({ title, logoSrc, lastUpdated, showRankingList, onToggle }: {
  title: string; logoSrc?: string; lastUpdated?: Date;
  showRankingList: boolean; onToggle: () => void;
}) {
  return (
    <header className="relative z-10 animate-fade-in">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {logoSrc && (
              <img src={logoSrc} alt="" className="h-12 w-12 rounded-xl object-cover shadow-md" />
            )}
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
              <p className="text-sm text-gray-500 mt-0.5">Real-time presentation scores</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={onToggle}
              className="card rounded-xl px-4 py-2 text-sm font-semibold text-gray-600 hover:text-indigo-600"
            >
              {showRankingList ? "Podium" : "Ranking"}
            </button>
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-full px-3.5 py-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-semibold text-green-700 tracking-wide">LIVE</span>
            </div>
          </div>
        </div>
        {lastUpdated && (
          <p className="text-xs text-gray-400 mt-3 text-right">Updated {lastUpdated.toLocaleTimeString()}</p>
        )}
      </div>
    </header>
  );
}

function Podium({ top3, brandColor }: { top3: any[]; brandColor: string }) {
  const colors = ["#FFD700", "#C0C0C0", "#CD7F32"];
  const heights = ["h-36 sm:h-40", "h-28 sm:h-32", "h-24 sm:h-28"];

  return (
    <section className="mb-12 animate-fade-in animate-fade-in-d1">
      <h2 className="text-xl font-bold text-gray-900 mb-8 text-center">Top Performers</h2>
      <div className="flex justify-center items-end gap-4 sm:gap-6 max-w-2xl mx-auto">
        {top3.map((p, i) => {
          const initials = getInitials(p.name);
          const photo = p.photoSrc || PHOTO_BY_NAME[p.name];
          const order = i === 0 ? 1 : i === 1 ? 2 : 3;
          const idx = order === 1 ? 0 : order === 2 ? 1 : 2;
          return (
            <div key={p.name} className="flex flex-col items-center">
              <div className="mb-3 relative">
                {photo ? (
                  <img src={photo} alt={p.name} className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-4 shadow-lg" style={{ borderColor: colors[idx] }} />
                ) : (
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center text-white font-bold text-lg border-4 shadow-lg" style={{ backgroundColor: brandColor, borderColor: colors[idx] }}>
                    {initials}
                  </div>
                )}
                {order === 1 && <div className="absolute -top-1 -right-1 text-xl">👑</div>}
              </div>
              <div className="text-center mb-3">
                <p className="font-bold text-gray-900 text-sm sm:text-base">{p.name}</p>
                <p className="text-xl sm:text-2xl font-bold" style={{ color: brandColor }}>{p.sum}</p>
                <p className="text-xs text-gray-500">avg {p.avg}</p>
              </div>
              <div className={`w-20 sm:w-24 ${heights[idx]} rounded-t-lg flex items-center justify-center text-white font-bold text-lg shadow-lg`} style={{ backgroundColor: colors[idx] }}>
                {order}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ParticipantCard({ participant, brandColor }: { participant: any; brandColor: string }) {
  const initials = getInitials(participant.name);
  const photo = participant.photoSrc || PHOTO_BY_NAME[participant.name];

  return (
    <div className="card rounded-2xl p-5 hover:border-gray-300 transition animate-fade-in">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow" style={{ backgroundColor: brandColor }}>
          #{participant.rank}
        </div>
        {photo ? (
          <img src={photo} alt={participant.name} className="w-14 h-14 rounded-xl object-cover shadow" />
        ) : (
          <div className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-semibold shadow" style={{ backgroundColor: `${brandColor}80` }}>
            {initials}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 truncate">{participant.name}</p>
          <div className="flex gap-4 mt-1.5 text-xs text-gray-500">
            <span><strong className="text-gray-700">{participant.sum}</strong> score</span>
            <span><strong className="text-gray-700">{participant.count}</strong> votes</span>
            <span><strong className="text-gray-700">{participant.avg}</strong> avg</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Scoreboard(props: {
  title?: string;
  logoSrc?: string;
  brandColor?: string;
  csvUrl?: string;
  apiKey?: string;
  sheetId?: string;
  range?: string;
  showRankingList?: boolean;
}) {
  const {
    title = "Live Scores",
    logoSrc,
    brandColor = "#6366f1",
    csvUrl,
    apiKey,
    sheetId,
    range,
    showRankingList: initialShowRanking = false,
  } = props;

  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | undefined>();
  const [showRanking, setShowRanking] = useState(initialShowRanking);

  const loadData = async () => {
    try {
      setError(null);

      const [photoIndex, rawRows] = await Promise.all([
        fetchPhotos(),
        csvUrl
          ? fetchFromCSV(csvUrl)
          : apiKey && sheetId && range
            ? fetchFromSheets(apiKey, sheetId, range)
            : fetchInternal(),
      ]);

      const processed = withRanks(
        rawRows.map(r => ({
          ...r,
          scoreNum: parseFloat(r.sum) || 0,
          photoSrc: photoIndex[r.name.toLowerCase().replace(/[\s._\-()]+/g, "")] || undefined,
        }))
      );

      setRows(processed);
      setLastUpdated(new Date());
    } catch (e: any) {
      setError(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const id = window.setInterval(loadData, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [csvUrl, apiKey, sheetId, range]);

  const top3 = useMemo(() => rows.slice(0, 3), [rows]);
  const remaining = useMemo(() => rows.slice(3), [rows]);

  return (
    <div className="min-h-screen relative overflow-hidden">
      <BackgroundElements />

      <Header
        title={title}
        logoSrc={logoSrc}
        lastUpdated={lastUpdated}
        showRankingList={showRanking}
        onToggle={() => setShowRanking(v => !v)}
      />

      <main className="relative z-10 max-w-6xl mx-auto px-4 pb-12">
        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="text-center">
              <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-500 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-500 text-sm">Loading scores...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 mb-8 animate-fade-in">
            <p className="text-red-700 font-semibold">Error loading data</p>
            <p className="text-red-500 text-sm mt-1">{error}</p>
          </div>
        )}

        {rows.length > 0 && (
          <>
            {top3.length >= 3 && <Podium top3={top3} brandColor={brandColor} />}

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-5">
                {showRanking ? `All Participants (${rows.length})` : "Rankings"}
              </h2>

              {showRanking || remaining.length === 0 ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {(showRanking ? rows : remaining).map((p: any) => (
                    <ParticipantCard key={`${p.rank}-${p.name}`} participant={p} brandColor={brandColor} />
                  ))}
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {remaining.map((p: any) => (
                    <ParticipantCard key={`${p.rank}-${p.name}`} participant={p} brandColor={brandColor} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {!loading && rows.length === 0 && !error && (
          <div className="text-center py-24">
            <p className="text-xl text-gray-600 mb-2">No data found</p>
            <p className="text-gray-500 text-sm">Waiting for votes to come in...</p>
          </div>
        )}

        <footer className="mt-16 text-center text-xs text-gray-400">
          Auto-refresh every {REFRESH_MS / 1000}s
        </footer>
      </main>
    </div>
  );
}
