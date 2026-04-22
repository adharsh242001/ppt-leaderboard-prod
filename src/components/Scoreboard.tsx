"use client";

import Image from "next/image";
import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { normalizeParticipantName } from "@/lib/photoMatching";

const REFRESH_MS = 10_000;
const NAME_COL = "Name";
const SCORE_COL = "Sum";
const COUNT_COL = "Count";
const AVG_COL = "Avg";

type ScoreboardProps = {
  title?: string;
  logoSrc?: string;
  brandColor?: string;
  csvUrl?: string;
  apiKey?: string;
  sheetId?: string;
  range?: string;
  showRankingList?: boolean;
};

type RawParticipantRow = {
  name: string;
  sum: string;
  count: string;
  avg: string;
};

type RankedParticipant = RawParticipantRow & {
  scoreNum: number;
  rank: number;
  photoSrc?: string;
};

type PhotoIndexResponse = {
  photos?: Record<string, string>;
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((segment) => segment[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Failed to load data";
}

function formatScore(value: string): string {
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed)) {
    return value || "0";
  }

  return Math.round(parsed).toString();
}

function formatAverage(value: string): string {
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed)) {
    return value || "0.00";
  }

  return parsed.toFixed(2);
}

function formatCount(value: string): string {
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed)) {
    return value || "0";
  }

  return Math.round(parsed).toString();
}

function resolvePhotoSrc(
  participantName: string,
  photoIndex: Record<string, string>
): string | undefined {
  const normalizedName = normalizeParticipantName(participantName);
  if (!normalizedName) {
    return undefined;
  }

  return photoIndex[normalizedName];
}

function parseCSV(csvText: string): string[][] {
  const firstLine = csvText.split(/\r?\n/)[0] ?? "";
  const useSemicolon = firstLine.includes(";") && !firstLine.includes(",");
  const delimiter = useSemicolon ? ";" : ",";

  const rows: string[][] = [];
  let currentValue = "";
  let currentRow: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const character = csvText[index];

    if (inQuotes) {
      if (character === '"') {
        if (csvText[index + 1] === '"') {
          currentValue += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        currentValue += character;
      }
      continue;
    }

    if (character === '"') {
      inQuotes = true;
      continue;
    }

    if (character === delimiter) {
      currentRow.push(currentValue);
      currentValue = "";
      continue;
    }

    if (character === "\n") {
      currentRow.push(currentValue);
      rows.push(currentRow);
      currentRow = [];
      currentValue = "";
      continue;
    }

    if (character !== "\r") {
      currentValue += character;
    }
  }

  currentRow.push(currentValue);
  rows.push(currentRow);

  return rows.filter((row) => row.some((cell) => cell.trim() !== ""));
}

function getHeaderIndex(header: string[]): Record<string, number> {
  const headerIndex: Record<string, number> = {};

  header.forEach((value, index) => {
    headerIndex[value.trim().toLowerCase()] = index;
  });

  return headerIndex;
}

function mapRowsToParticipants(rows: string[][]): RawParticipantRow[] {
  if (!rows.length) {
    return [];
  }

  const [header, ...data] = rows;
  const headerIndex = getHeaderIndex(header);
  const nameIndex = headerIndex[NAME_COL.toLowerCase()];
  const sumIndex = headerIndex[SCORE_COL.toLowerCase()];
  const countIndex = headerIndex[COUNT_COL.toLowerCase()];
  const avgIndex = headerIndex[AVG_COL.toLowerCase()];

  if (nameIndex === undefined || sumIndex === undefined) {
    return [];
  }

  return data.map((row) => ({
    name: (row[nameIndex] ?? "").trim(),
    sum: (row[sumIndex] ?? "").trim(),
    count: (row[countIndex] ?? "").trim(),
    avg: (row[avgIndex] ?? "").trim(),
  }));
}

async function fetchFromCSV(csvUrl: string): Promise<RawParticipantRow[]> {
  const response = await fetch(csvUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`CSV fetch failed: ${response.status}`);
  }

  const text = await response.text();
  return mapRowsToParticipants(parseCSV(text));
}

async function fetchFromSheetsApi(
  apiKey: string,
  sheetId: string,
  range: string
): Promise<RawParticipantRow[]> {
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/` +
    `${encodeURIComponent(range)}?key=${apiKey}`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Sheets API fetch failed: ${response.status}`);
  }

  const json = (await response.json()) as { values?: string[][] };
  return mapRowsToParticipants(json.values ?? []);
}

async function fetchPhotoIndex(): Promise<Record<string, string>> {
  try {
    const response = await fetch("/api/photos", { cache: "no-store" });
    if (!response.ok) {
      return {};
    }

    const json = (await response.json()) as PhotoIndexResponse;
    return json.photos ?? {};
  } catch {
    return {};
  }
}

async function fetchInternalLeaderboard(): Promise<RawParticipantRow[]> {
  const response = await fetch("/api/leaderboard", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Leaderboard fetch failed: ${response.status}`);
  }

  const json = (await response.json()) as { rows?: RawParticipantRow[] };
  return json.rows ?? [];
}

function withRanks<T extends { scoreNum: number }>(
  items: T[]
): Array<T & { rank: number }> {
  const sorted = [...items].sort((left, right) => right.scoreNum - left.scoreNum);
  let lastScore: number | null = null;
  let lastRank = 0;

  return sorted.map((item, index) => {
    const rank = lastScore === item.scoreNum ? lastRank : index + 1;
    lastScore = item.scoreNum;
    lastRank = rank;
    return { ...item, rank };
  });
}

function Avatar({
  participant,
  sizeClass,
  fallbackClassName,
}: {
  participant: RankedParticipant;
  sizeClass: string;
  fallbackClassName: string;
}) {
  const initials = getInitials(participant.name);

  if (participant.photoSrc) {
    return (
      <Image
        src={participant.photoSrc}
        alt={participant.name}
        width={256}
        height={256}
        className={`${sizeClass} object-cover`}
        unoptimized
      />
    );
  }

  return <div className={`${sizeClass} ${fallbackClassName}`}>{initials}</div>;
}

function Header({
  title,
  logoSrc,
  lastUpdated,
  showRankingList,
}: {
  title: string;
  logoSrc?: string;
  lastUpdated?: Date;
  showRankingList: boolean;
}) {
  return (
    <header className="mx-auto max-w-[96rem] animate-[fadeIn_.6s_ease-out]">
      <div className="grid gap-5 lg:grid-cols-[1.28fr_0.72fr] lg:items-center">
        <div className="glass-panel-strong flex items-center gap-5 rounded-[1.6rem] px-6 py-5">
          {logoSrc ? (
            <div className="stat-slab flex h-24 w-24 items-center justify-center rounded-[1rem] p-3">
              <Image
                src={logoSrc}
                alt="Event logo"
                width={84}
                height={84}
                className="h-16 w-16 object-contain"
                unoptimized
              />
            </div>
          ) : null}

          <div className="min-w-0">
            <div className="mb-3 flex items-center gap-3">
              <span className="eyebrow text-[11px] text-[var(--accent-strong)]">Live Presentation Awards</span>
              <span className="inline-flex items-center gap-2 rounded-md border border-[rgba(255,90,90,0.2)] bg-[rgba(255,70,70,0.08)] px-3 py-1.5 text-[11px] font-semibold tracking-[0.22em] text-white">
                <span className="h-2 w-2 rounded-full bg-[#ff4d4d] animate-pulse" />
                LIVE
              </span>
            </div>
            <h1 className="text-5xl font-semibold leading-none tracking-[-0.08em] sm:text-7xl">
              <span className="metal-text">{title}</span>
            </h1>
          </div>
        </div>

        <div className="glass-panel rounded-[1.6rem] px-6 py-5 text-right">
          <div className="flex items-center justify-between gap-4">
            <p className="eyebrow text-[11px] text-[var(--ink-soft)]">Updated</p>
            <Link
              href={showRankingList ? "/scoreboard" : "/ranking"}
              className="stat-slab rounded-md px-4 py-2 text-[11px] font-semibold tracking-[0.18em] text-[var(--ink-soft)] transition hover:border-[var(--line-strong)]"
            >
              {showRankingList ? "PODIUM" : "RANKING"}
            </Link>
          </div>
          <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-white">
            {lastUpdated ? lastUpdated.toLocaleTimeString() : "--:--:--"}
          </p>
        </div>
      </div>
    </header>
  );
}

function ChampionCard({
  participant,
}: {
  participant: RankedParticipant;
}) {
  return (
    <section className="glass-panel-strong relative overflow-hidden rounded-[1.8rem] px-8 py-8 animate-[fadeIn_.75s_ease-out]">
      <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent_0%,rgba(212,175,55,0.64)_45%,transparent_100%)]" />
      <div className="relative grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <div>
          <p className="eyebrow text-sm text-[var(--accent-strong)]">Champion</p>
          <h2 className="mt-4 text-6xl font-semibold leading-[0.92] tracking-[-0.08em] text-white sm:text-7xl">
            {participant.name}
          </h2>

          <div className="mt-10">
            <p className="eyebrow text-[11px] text-[var(--ink-soft)]">Score</p>
            <p className="mt-2 text-[7rem] font-semibold leading-none tracking-[-0.13em] sm:text-[9rem]">
              <span className="metal-text">{formatScore(participant.sum)}</span>
            </p>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="stat-slab rounded-[1rem] px-4 py-4">
              <p className="eyebrow text-[10px] text-[var(--ink-soft)]">Rank</p>
              <p className="mt-3 text-3xl font-semibold text-white">#1</p>
            </div>
            <div className="stat-slab rounded-[1rem] px-4 py-4">
              <p className="eyebrow text-[10px] text-[var(--ink-soft)]">Average</p>
              <p className="mt-3 text-3xl font-semibold text-white">{formatAverage(participant.avg)}</p>
            </div>
            <div className="stat-slab rounded-[1rem] px-4 py-4">
              <p className="eyebrow text-[10px] text-[var(--ink-soft)]">Votes</p>
              <p className="mt-3 text-3xl font-semibold text-white">{formatCount(participant.count)}</p>
            </div>
          </div>
        </div>

        <div className="relative flex justify-center">
          <div className="absolute inset-6 bg-[radial-gradient(circle,_rgba(212,175,55,0.22),_transparent_65%)] blur-3xl" />
          <Avatar
            participant={participant}
            sizeClass="relative h-60 w-52 rounded-[1.6rem] border border-[rgba(255,255,255,0.08)] shadow-[0_24px_60px_rgba(0,0,0,0.4),0_0_0_1px_rgba(212,175,55,0.18)] transition-transform duration-500 hover:scale-[1.02] sm:h-72 sm:w-60"
            fallbackClassName="relative flex items-center justify-center bg-[linear-gradient(180deg,#e2c45f_0%,#b5892e_100%)] text-7xl font-semibold text-[#1d1607]"
          />
        </div>
      </div>
    </section>
  );
}

function TopCompactCard({
  participant,
  label,
  accentColor,
}: {
  participant: RankedParticipant;
  label: string;
  accentColor: string;
}) {
  return (
    <article className="glass-panel rounded-[1.35rem] px-5 py-5 transition duration-300 hover:translate-y-[-2px] hover:border-[rgba(212,175,55,0.28)] animate-[fadeIn_.85s_ease-out]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="eyebrow text-[11px]" style={{ color: accentColor }}>
            {label}
          </p>
          <h3 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-white">
            {participant.name}
          </h3>
        </div>
        <div className="stat-slab rounded-md px-4 py-2 text-sm text-white">
          #{participant.rank}
        </div>
      </div>

      <div className="mt-5 flex items-center gap-4">
        <Avatar
          participant={participant}
          sizeClass="h-22 w-18 rounded-[1rem] border border-[rgba(255,255,255,0.08)]"
          fallbackClassName="flex items-center justify-center rounded-[1rem] bg-[linear-gradient(180deg,#e2c45f_0%,#b5892e_100%)] text-3xl font-semibold text-[#1d1607]"
        />

        <div>
          <p className="text-5xl font-semibold leading-none tracking-[-0.08em] text-white">
            {formatScore(participant.sum)}
          </p>
          <p className="mt-3 text-base text-[var(--ink-soft)]">
            Avg {formatAverage(participant.avg)}
          </p>
        </div>
      </div>
    </article>
  );
}

function TableRow({
  participant,
  brandColor,
}: {
  participant: RankedParticipant;
  brandColor: string;
}) {
  const initials = getInitials(participant.name);

  return (
    <div className="grid grid-cols-[88px_minmax(0,1.6fr)_1fr_0.9fr_0.9fr] items-center gap-4 rounded-[1rem] border border-[rgba(255,255,255,0.06)] bg-[linear-gradient(180deg,rgba(26,30,40,0.94),rgba(16,19,27,0.96))] px-4 py-4 transition duration-300 hover:border-[rgba(212,175,55,0.22)]">
      <div className="flex items-center gap-3">
        <div
          className="flex h-12 min-w-12 items-center justify-center rounded-md text-base font-semibold text-[#161106]"
          style={{ backgroundColor: brandColor }}
        >
          #{participant.rank}
        </div>
      </div>

      <div className="flex min-w-0 items-center gap-4">
        {participant.photoSrc ? (
          <Image
            src={participant.photoSrc}
            alt={participant.name}
            width={64}
            height={64}
            className="h-16 w-14 rounded-[0.9rem] object-cover"
            unoptimized
          />
        ) : (
          <div
            className="flex h-16 w-14 items-center justify-center rounded-[0.9rem] text-xl font-semibold text-[#1d1607]"
            style={{ backgroundColor: brandColor }}
          >
            {initials}
          </div>
        )}

        <p className="truncate text-2xl font-semibold tracking-[-0.04em] text-white">
          {participant.name}
        </p>
      </div>

      <div className="text-right">
        <p className="eyebrow text-[10px] text-[var(--ink-soft)]">Score</p>
        <p className="mt-2 text-4xl font-semibold leading-none tracking-[-0.08em] text-white">
          {formatScore(participant.sum)}
        </p>
      </div>

      <div className="text-right">
        <p className="eyebrow text-[10px] text-[var(--ink-soft)]">Avg</p>
        <p className="mt-2 text-3xl font-semibold leading-none tracking-[-0.06em] text-[var(--ink-soft)]">
          {formatAverage(participant.avg)}
        </p>
      </div>

      <div className="text-right">
        <p className="eyebrow text-[10px] text-[var(--ink-soft)]">Count</p>
        <p className="mt-2 text-3xl font-semibold leading-none tracking-[-0.06em] text-[var(--ink-soft)]">
          {formatCount(participant.count)}
        </p>
      </div>
    </div>
  );
}

export default function Scoreboard({
  title = "Live Scores",
  logoSrc,
  brandColor = "#d4af37",
  csvUrl,
  apiKey,
  sheetId,
  range,
  showRankingList = false,
}: ScoreboardProps) {
  const [rows, setRows] = useState<RankedParticipant[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | undefined>();

  useEffect(() => {
    let isActive = true;

    async function loadData() {
      try {
        setError(null);

        const [photoIndex, rawRows] = await Promise.all([
          fetchPhotoIndex(),
          csvUrl
            ? fetchFromCSV(csvUrl)
            : apiKey && sheetId && range
              ? fetchFromSheetsApi(apiKey, sheetId, range)
              : fetchInternalLeaderboard(),
        ]);

        if (!isActive) {
          return;
        }

        const rankedRows = withRanks(
          rawRows.map((row) => ({
            ...row,
            scoreNum: Number.parseFloat(row.sum) || 0,
            photoSrc: resolvePhotoSrc(row.name, photoIndex),
          }))
        );

        setRows(rankedRows);
        setLastUpdated(new Date());
      } catch (loadError: unknown) {
        if (!isActive) {
          return;
        }

        setError(getErrorMessage(loadError));
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    }

    void loadData();
    const intervalId = window.setInterval(() => {
      void loadData();
    }, REFRESH_MS);

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
    };
  }, [apiKey, csvUrl, range, sheetId]);

  const top3 = useMemo(() => rows.slice(0, 3), [rows]);
  const remaining = useMemo(() => rows.slice(3), [rows]);
  return (
    <main className="stage-shell relative min-h-screen overflow-hidden px-4 py-10 sm:px-6 sm:py-12 lg:px-8 lg:py-14">
      <div className="absolute inset-x-0 top-0 h-[24rem] bg-[linear-gradient(180deg,rgba(212,175,55,0.08),transparent_70%)]" />

      <Header
        title={title}
        logoSrc={logoSrc}
        lastUpdated={lastUpdated}
        showRankingList={showRankingList}
      />

      {loading ? (
        <section className="mx-auto mt-10 max-w-[96rem]">
          <div className="glass-panel-strong rounded-[1.8rem] px-6 py-16 text-center">
            <div className="mx-auto h-1.5 w-28 overflow-hidden rounded-full bg-white/8">
              <div className="h-full w-1/2 animate-[fadeIn_1.2s_ease-in-out_infinite_alternate] bg-[linear-gradient(90deg,var(--accent),var(--accent-strong))]" />
            </div>
            <p className="mt-6 text-2xl font-semibold text-white">Loading leaderboard...</p>
          </div>
        </section>
      ) : null}

      {error ? (
        <section className="mx-auto mt-10 max-w-[96rem]">
          <div className="glass-panel-strong rounded-[1.6rem] border border-[rgba(255,120,120,0.28)] px-6 py-8">
            <p className="eyebrow text-[11px] text-[#ffc0c0]">Data issue</p>
            <p className="mt-3 text-3xl font-semibold text-white">Unable to load live scores.</p>
            <p className="mt-4 text-lg text-[var(--ink-soft)]">{error}</p>
          </div>
        </section>
      ) : null}

      {!loading && rows.length > 0 ? (
        <>
          {top3[0] ? (
            <section className="mx-auto mt-10 grid max-w-[96rem] gap-5 lg:grid-cols-[1.2fr_0.8fr]">
              <ChampionCard participant={top3[0]} />
              <div className="grid gap-5">
                {top3[1] ? (
                  <TopCompactCard
                    participant={top3[1]}
                    label="Second Place"
                    accentColor="var(--silver)"
                  />
                ) : null}
                {top3[2] ? (
                  <TopCompactCard
                    participant={top3[2]}
                    label="Third Place"
                    accentColor="var(--bronze)"
                  />
                ) : null}
              </div>
            </section>
          ) : null}

          {showRankingList ? (
            <section className="mx-auto mt-10 max-w-[96rem] animate-[fadeIn_1s_ease-out]">
              <div className="mb-6 flex items-end justify-between gap-4">
                <div>
                  <p className="eyebrow text-sm text-[var(--accent-strong)]">Leaderboard</p>
                  <h2 className="mt-2 text-4xl font-semibold tracking-[-0.06em] text-white">
                    Full Ranking List
                  </h2>
                </div>
                <div className="stat-slab rounded-md px-4 py-2 text-xs font-mono tracking-[0.18em] text-[var(--ink-soft)]">
                  SCROLLABLE
                </div>
              </div>

              <div className="glass-panel rounded-[1.4rem] p-4">
                <div className="mb-3 grid grid-cols-[88px_minmax(0,1.6fr)_1fr_0.9fr_0.9fr] gap-4 px-4 pb-3 text-[11px] text-[var(--ink-soft)]">
                  <div className="eyebrow">Rank</div>
                  <div className="eyebrow">Participant</div>
                  <div className="eyebrow text-right">Score</div>
                  <div className="eyebrow text-right">Avg</div>
                  <div className="eyebrow text-right">Count</div>
                </div>

                <div className="max-h-[36rem] space-y-3 overflow-y-auto pr-2">
                  {(showRankingList ? rows : remaining).map((participant) => (
                    <TableRow
                      key={`${participant.rank}-${participant.name}`}
                      participant={participant}
                      brandColor={brandColor}
                    />
                  ))}
                  {(showRankingList ? rows : remaining).length === 0 ? (
                    <div className="rounded-[1.5rem] border border-[rgba(255,255,255,0.04)] bg-white/[0.03] px-6 py-10 text-center text-lg text-[var(--ink-soft)]">
                      No ranking entries available right now.
                    </div>
                  ) : null}
                </div>
              </div>
            </section>
          ) : null}
        </>
      ) : null}

      {!loading && rows.length === 0 && !error ? (
        <section className="mx-auto mt-10 max-w-[96rem]">
          <div className="glass-panel-strong rounded-[1.6rem] px-6 py-16 text-center">
            <p className="eyebrow text-sm text-[var(--accent-strong)]">No results yet</p>
            <p className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-white">
              Waiting for the first score
            </p>
          </div>
        </section>
      ) : null}
    </main>
  );
}
