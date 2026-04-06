"use client";

import Image from "next/image";
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

function AvatarImage({
  src,
  alt,
  className,
  width,
  height,
  style,
}: {
  src: string;
  alt: string;
  className: string;
  width: number;
  height: number;
  style?: React.CSSProperties;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      style={style}
      unoptimized
    />
  );
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
  const indexByHeader: Record<string, number> = {};

  header.forEach((value, index) => {
    indexByHeader[value.trim().toLowerCase()] = index;
  });

  return indexByHeader;
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

function BrandHeader({
  title,
  logoSrc,
  brandColor,
  lastUpdated,
}: {
  title: string;
  logoSrc?: string;
  brandColor: string;
  lastUpdated?: Date;
}) {
  return (
    <header className="relative">
      <div className="glass-panel mx-auto flex max-w-7xl items-center justify-center rounded-full px-5 py-3 text-sm text-[var(--ink-soft)]">
        <div
          className="rounded-full px-4 py-1 font-mono text-[11px] tracking-[0.24em] text-white"
          style={{ backgroundColor: brandColor }}
        >
          AWARDS SHOWCASE
        </div>
      </div>

      <div className="mx-auto mt-6 flex max-w-7xl flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="eyebrow text-sm text-[var(--accent-deep)]">Presentation awards</p>
          <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-center">
            {logoSrc ? (
              <div className="glass-panel-strong w-fit rounded-[1.8rem] p-3">
                <AvatarImage
                  src={logoSrc}
                  alt="Event logo"
                  width={112}
                  height={112}
                  className="h-20 w-20 object-contain"
                />
              </div>
            ) : null}
            <div>
              <h1 className="text-5xl font-semibold tracking-[-0.06em] text-[var(--foreground)] sm:text-6xl">
                {title}
              </h1>
              <p className="mt-4 text-lg font-medium tracking-[0.02em] text-[var(--ink-soft)]">
                Leaderboard • Spotlight • Recognition
              </p>
            </div>
          </div>
        </div>

        <div className="glass-panel-strong w-full max-w-sm rounded-[2rem] p-5">
          <p className="eyebrow text-[11px] text-[var(--ink-soft)]">Live status</p>
          <div className="mt-3 flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-lg font-semibold">On stage</span>
          </div>
          <p className="mt-4 text-sm leading-6 text-[var(--ink-soft)]">
            Last updated {lastUpdated ? lastUpdated.toLocaleTimeString() : "waiting for first sync"}.
          </p>
        </div>
      </div>
    </header>
  );
}

function PodiumSpotlight({
  participant,
  position,
  accent,
  brandColor,
}: {
  participant: RankedParticipant;
  position: number;
  accent: string;
  brandColor: string;
}) {
  const initials = getInitials(participant.name);
  const sizeClass =
    position === 1
      ? "h-28 w-28 sm:h-32 sm:w-32"
      : "h-20 w-20 sm:h-24 sm:w-24";

  return (
    <article
      className={`glass-panel-strong rounded-[2.2rem] p-5 ${position === 1 ? "lg:min-h-[29rem]" : "lg:min-h-[24rem]"}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="eyebrow text-[11px]" style={{ color: accent }}>
            Rank 0{position}
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-[-0.05em]">
            {participant.name}
          </p>
          <p className="mt-2 text-sm text-[var(--ink-soft)]">
            Average {participant.avg || "0"} from {participant.count || "0"} entries
          </p>
        </div>
        <div
          className="rounded-full px-3 py-1 font-mono text-xs text-white"
          style={{ backgroundColor: accent }}
        >
          #{participant.rank}
        </div>
      </div>

      <div className="mt-6 flex items-end justify-between gap-4">
        {participant.photoSrc ? (
          <AvatarImage
            src={participant.photoSrc}
            alt={participant.name}
            width={position === 1 ? 128 : 96}
            height={position === 1 ? 128 : 96}
            className={`${sizeClass} rounded-[2rem] object-cover shadow-xl`}
            style={{ border: `4px solid ${accent}` }}
          />
        ) : (
          <div
            className={`${sizeClass} flex items-center justify-center rounded-[2rem] text-3xl font-semibold text-white shadow-xl`}
            style={{ backgroundColor: brandColor }}
          >
            {initials}
          </div>
        )}

        <div className="flex-1">
          <p className="eyebrow text-[11px] text-[var(--ink-soft)]">Total score</p>
          <p className="mt-2 text-6xl font-semibold tracking-[-0.09em]">
            {participant.sum || "0"}
          </p>
        </div>
      </div>

      <div
        className="mt-6 rounded-[1.7rem] px-4 py-4 text-sm"
        style={{ backgroundColor: `${accent}14` }}
      >
        <div className="flex items-center justify-between text-[var(--ink-soft)]">
          <span>Consistency</span>
          <span className="font-mono">{participant.avg || "0"} avg</span>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/70">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.max(12, Math.min(100, participant.scoreNum * 2))}%`,
              backgroundColor: accent,
            }}
          />
        </div>
      </div>
    </article>
  );
}

function PodiumSection({
  top3,
  brandColor,
}: {
  top3: RankedParticipant[];
  brandColor: string;
}) {
  const accents = ["#d5a021", "#6f8ca6", "#b56c4a"];

  return (
    <section className="mx-auto mt-10 max-w-7xl">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-sm text-[var(--accent-deep)]">Spotlight</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em]">
            Awards podium
          </h2>
        </div>
        <div className="hidden rounded-full border border-[var(--line)] bg-white/55 px-4 py-2 text-xs font-mono tracking-[0.2em] text-[var(--ink-soft)] md:block">
          TOP 3 HONOURS
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.2fr_0.9fr]">
        {top3[1] ? (
          <PodiumSpotlight
            participant={top3[1]}
            position={2}
            accent={accents[1]}
            brandColor={brandColor}
          />
        ) : null}
        {top3[0] ? (
          <PodiumSpotlight
            participant={top3[0]}
            position={1}
            accent={accents[0]}
            brandColor={brandColor}
          />
        ) : null}
        {top3[2] ? (
          <PodiumSpotlight
            participant={top3[2]}
            position={3}
            accent={accents[2]}
            brandColor={brandColor}
          />
        ) : null}
      </div>
    </section>
  );
}

function ParticipantRow({
  participant,
  brandColor,
}: {
  participant: RankedParticipant;
  brandColor: string;
}) {
  const initials = getInitials(participant.name);

  return (
    <article className="glass-panel rounded-[1.9rem] p-4 transition hover:translate-y-[-2px] hover:bg-[rgba(255,251,245,0.92)] sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full text-sm font-semibold text-white shadow-md"
            style={{ backgroundColor: brandColor }}
          >
            #{participant.rank}
          </div>

          {participant.photoSrc ? (
            <AvatarImage
              src={participant.photoSrc}
              alt={participant.name}
              width={68}
              height={68}
              className="h-[68px] w-[68px] rounded-[1.4rem] object-cover shadow-md"
            />
          ) : (
            <div
              className="flex h-[68px] w-[68px] items-center justify-center rounded-[1.4rem] text-xl font-semibold text-white shadow-md"
              style={{ backgroundColor: `${brandColor}bb` }}
            >
              {initials}
            </div>
          )}

          <div className="min-w-0">
            <p className="text-xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
              {participant.name}
            </p>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">Rank #{participant.rank}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 sm:min-w-[18rem]">
          <div className="rounded-[1.3rem] bg-white/60 px-4 py-3 text-center">
            <p className="eyebrow text-[10px] text-[var(--ink-soft)]">Score</p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.06em]">
              {participant.sum || "0"}
            </p>
          </div>
          <div className="rounded-[1.3rem] bg-white/60 px-4 py-3 text-center">
            <p className="eyebrow text-[10px] text-[var(--ink-soft)]">Count</p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.06em]">
              {participant.count || "0"}
            </p>
          </div>
          <div className="rounded-[1.3rem] bg-white/60 px-4 py-3 text-center">
            <p className="eyebrow text-[10px] text-[var(--ink-soft)]">Avg</p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.06em]">
              {participant.avg || "0"}
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function Scoreboard({
  title = "Live Scores",
  logoSrc,
  brandColor = "#c56a3d",
  csvUrl,
  apiKey,
  sheetId,
  range,
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
              : Promise.reject(
                  new Error("Provide csvUrl OR apiKey+sheetId+range")
                ),
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
  const rest = useMemo(() => rows.slice(3), [rows]);

  return (
    <main className="grain relative overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
      <div className="absolute left-0 top-0 h-[28rem] w-full bg-[radial-gradient(circle_at_12%_12%,_rgba(197,106,61,0.24),_transparent_26%),radial-gradient(circle_at_85%_10%,_rgba(141,185,171,0.28),_transparent_24%)]" />

      <BrandHeader
        title={title}
        logoSrc={logoSrc}
        brandColor={brandColor}
        lastUpdated={lastUpdated}
      />

      {loading ? (
        <section className="mx-auto mt-10 max-w-7xl">
          <div className="glass-panel-strong rounded-[2.4rem] px-6 py-12 text-center">
            <div className="mx-auto h-14 w-14 rounded-full border-4 border-[var(--mint)] border-t-[var(--accent)] animate-spin" />
            <p className="mt-5 text-lg font-medium">Syncing scores from the sheet...</p>
          </div>
        </section>
      ) : null}

      {error ? (
        <section className="mx-auto mt-10 max-w-7xl">
          <div className="glass-panel-strong rounded-[2.2rem] border border-red-200 bg-red-50/80 p-6">
            <p className="eyebrow text-[11px] text-red-700">Data issue</p>
            <p className="mt-3 text-2xl font-semibold text-red-900">
              The board could not load live scores.
            </p>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-red-700">{error}</p>
          </div>
        </section>
      ) : null}

      {!loading && rows.length > 0 ? (
        <>
          {top3.length > 0 ? <PodiumSection top3={top3} brandColor={brandColor} /> : null}

          <section className="mx-auto mt-10 max-w-7xl">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="eyebrow text-sm text-[var(--accent-deep)]">Standings</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em]">
                  Full ranking
                </h2>
              </div>
              <div className="rounded-full border border-[var(--line)] bg-white/55 px-4 py-2 text-xs font-mono tracking-[0.2em] text-[var(--ink-soft)]">
                LIVE RESULTS
              </div>
            </div>

            <div className="grid gap-4">
              {top3[0] ? (
                <ParticipantRow participant={top3[0]} brandColor={brandColor} />
              ) : null}
              {top3[1] ? (
                <ParticipantRow participant={top3[1]} brandColor={brandColor} />
              ) : null}
              {top3[2] ? (
                <ParticipantRow participant={top3[2]} brandColor={brandColor} />
              ) : null}
              {rest.map((participant) => (
                <ParticipantRow
                  key={`${participant.rank}-${participant.name}`}
                  participant={participant}
                  brandColor={brandColor}
                />
              ))}
            </div>
          </section>
        </>
      ) : null}

      {!loading && rows.length === 0 && !error ? (
        <section className="mx-auto mt-10 max-w-7xl">
          <div className="glass-panel-strong rounded-[2.4rem] px-6 py-12 text-center">
            <p className="eyebrow text-sm text-[var(--accent-deep)]">No scoreboard data</p>
            <p className="mt-4 text-4xl font-semibold tracking-[-0.05em]">Nothing to rank yet</p>
            <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-[var(--ink-soft)]">
              Check the sheet headers and published CSV source, then reload the board.
            </p>
          </div>
        </section>
      ) : null}

      <footer className="mx-auto mt-12 max-w-7xl pb-6 text-sm text-[var(--ink-soft)]">
        <div className="glass-panel flex flex-col gap-3 rounded-[1.8rem] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="eyebrow text-[11px]">Live refresh</p>
          <p className="font-mono text-xs">{REFRESH_MS / 1000}s cadence</p>
        </div>
      </footer>
    </main>
  );
}
