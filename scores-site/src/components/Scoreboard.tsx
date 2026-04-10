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

function formatWholeNumber(value: string): string {
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
        width={240}
        height={240}
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
}: {
  title: string;
  logoSrc?: string;
  lastUpdated?: Date;
}) {
  return (
    <header className="mx-auto max-w-7xl">
      <div className="glass-panel flex items-center justify-between rounded-[2rem] px-6 py-4">
        <div className="eyebrow text-[11px] text-[var(--accent-strong)]">
          Presentation Awards
        </div>
        <div className="flex items-center gap-3 rounded-full border border-[var(--line)] bg-white/5 px-4 py-2">
          <div className="h-2.5 w-2.5 rounded-full bg-[var(--accent-strong)] shadow-[0_0_16px_rgba(255,217,120,0.9)]" />
          <span className="eyebrow text-[11px] text-[var(--ink-soft)]">Live</span>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
        <div className="flex items-center gap-5">
          {logoSrc ? (
            <div className="glass-panel-strong flex h-28 w-28 items-center justify-center rounded-[2rem] p-4">
              <Image
                src={logoSrc}
                alt="Event logo"
                width={96}
                height={96}
                className="h-20 w-20 object-contain"
                unoptimized
              />
            </div>
          ) : null}

          <div>
            <p className="eyebrow text-sm text-[var(--accent-strong)]">Leaderboard</p>
            <h1 className="mt-3 text-5xl font-semibold leading-none tracking-[-0.08em] sm:text-7xl">
              <span className="metal-text">{title}</span>
            </h1>
          </div>
        </div>

        <div className="glass-panel-strong rounded-[2rem] px-6 py-5 text-right">
          <p className="eyebrow text-[11px] text-[var(--ink-soft)]">Last update</p>
          <p className="mt-3 text-3xl font-semibold tracking-[-0.05em]">
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
    <section className="glass-panel-strong rounded-[2.5rem] px-8 py-8">
      <p className="eyebrow text-sm text-[var(--accent-strong)]">Champion</p>
      <div className="mt-6 grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <div>
          <h2 className="text-6xl font-semibold leading-[0.92] tracking-[-0.08em] sm:text-7xl">
            {participant.name}
          </h2>
          <div className="mt-6 flex flex-wrap gap-3">
            <div className="rounded-full border border-[var(--line)] bg-white/5 px-4 py-2 text-lg">
              Rank #{participant.rank}
            </div>
            <div className="rounded-full border border-[var(--line)] bg-white/5 px-4 py-2 text-lg">
              Avg {formatAverage(participant.avg)}
            </div>
            <div className="rounded-full border border-[var(--line)] bg-white/5 px-4 py-2 text-lg">
              Count {formatCount(participant.count)}
            </div>
          </div>

          <div className="mt-10">
            <p className="eyebrow text-[11px] text-[var(--ink-soft)]">Total Score</p>
            <p className="mt-2 text-[7rem] font-semibold leading-none tracking-[-0.12em] sm:text-[8.5rem]">
              <span className="metal-text">{formatWholeNumber(participant.sum)}</span>
            </p>
          </div>
        </div>

        <div className="relative flex justify-center">
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,_rgba(241,199,101,0.2),_transparent_60%)] blur-3xl" />
          <Avatar
            participant={participant}
            sizeClass="relative h-56 w-56 rounded-[2.8rem] border-4 border-[var(--accent-strong)] shadow-[0_24px_70px_rgba(0,0,0,0.45)] sm:h-64 sm:w-64"
            fallbackClassName="relative flex items-center justify-center bg-[var(--accent)] text-7xl font-semibold text-[#20170a]"
          />
        </div>
      </div>
    </section>
  );
}

function PodiumSideCard({
  participant,
  label,
  accentColor,
}: {
  participant: RankedParticipant;
  label: string;
  accentColor: string;
}) {
  return (
    <article className="glass-panel rounded-[2rem] px-6 py-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow text-[11px]" style={{ color: accentColor }}>
            {label}
          </p>
          <h3 className="mt-3 text-4xl font-semibold tracking-[-0.05em]">
            {participant.name}
          </h3>
        </div>
        <div className="rounded-full border border-[var(--line)] px-4 py-2 text-sm">
          #{participant.rank}
        </div>
      </div>

      <div className="mt-6 flex items-center gap-5">
        <Avatar
          participant={participant}
          sizeClass="h-24 w-24 rounded-[1.8rem] border-2"
          fallbackClassName="flex items-center justify-center rounded-[1.8rem] bg-[var(--accent)] text-3xl font-semibold text-[#20170a]"
        />
        <div>
          <p className="text-6xl font-semibold leading-none tracking-[-0.08em]">
            {formatWholeNumber(participant.sum)}
          </p>
          <p className="mt-3 text-lg text-[var(--ink-soft)]">
            Avg {formatAverage(participant.avg)} • Count {formatCount(participant.count)}
          </p>
        </div>
      </div>
    </article>
  );
}

function StandingsRow({
  participant,
  brandColor,
}: {
  participant: RankedParticipant;
  brandColor: string;
}) {
  const initials = getInitials(participant.name);

  return (
    <article className="glass-panel rounded-[1.9rem] px-5 py-5">
      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr] lg:items-center">
        <div className="flex items-center gap-4">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full text-lg font-semibold text-[#20170a]"
            style={{ backgroundColor: brandColor }}
          >
            #{participant.rank}
          </div>

          {participant.photoSrc ? (
            <Image
              src={participant.photoSrc}
              alt={participant.name}
              width={84}
              height={84}
              className="h-[84px] w-[84px] rounded-[1.6rem] object-cover"
              unoptimized
            />
          ) : (
            <div
              className="flex h-[84px] w-[84px] items-center justify-center rounded-[1.6rem] text-2xl font-semibold text-[#20170a]"
              style={{ backgroundColor: brandColor }}
            >
              {initials}
            </div>
          )}

          <div className="min-w-0">
            <p className="text-3xl font-semibold tracking-[-0.05em]">{participant.name}</p>
            <p className="mt-2 text-base text-[var(--ink-soft)]">Rank #{participant.rank}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-[1.4rem] border border-[var(--line)] bg-white/5 px-4 py-4 text-center">
            <p className="eyebrow text-[10px] text-[var(--ink-soft)]">Score</p>
            <p className="mt-3 text-4xl font-semibold leading-none tracking-[-0.08em]">
              {formatWholeNumber(participant.sum)}
            </p>
          </div>
          <div className="rounded-[1.4rem] border border-[var(--line)] bg-white/5 px-4 py-4 text-center">
            <p className="eyebrow text-[10px] text-[var(--ink-soft)]">Avg</p>
            <p className="mt-3 text-4xl font-semibold leading-none tracking-[-0.08em]">
              {formatAverage(participant.avg)}
            </p>
          </div>
          <div className="rounded-[1.4rem] border border-[var(--line)] bg-white/5 px-4 py-4 text-center">
            <p className="eyebrow text-[10px] text-[var(--ink-soft)]">Count</p>
            <p className="mt-3 text-4xl font-semibold leading-none tracking-[-0.08em]">
              {formatCount(participant.count)}
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
  brandColor = "#f1c765",
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
  const remaining = useMemo(() => rows.slice(3), [rows]);

  return (
    <main className="stage-shell relative overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
      <div className="absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(circle_at_50%_0%,_rgba(241,199,101,0.18),_transparent_26%)]" />

      <Header title={title} logoSrc={logoSrc} lastUpdated={lastUpdated} />

      {loading ? (
        <section className="mx-auto mt-10 max-w-7xl">
          <div className="glass-panel-strong rounded-[2.5rem] px-6 py-16 text-center">
            <div className="mx-auto h-16 w-16 rounded-full border-4 border-[rgba(241,199,101,0.18)] border-t-[var(--accent-strong)] animate-spin" />
            <p className="mt-6 text-2xl font-semibold">Loading leaderboard...</p>
          </div>
        </section>
      ) : null}

      {error ? (
        <section className="mx-auto mt-10 max-w-7xl">
          <div className="glass-panel-strong rounded-[2.4rem] border border-[rgba(255,120,120,0.28)] px-6 py-8">
            <p className="eyebrow text-[11px] text-[#ffc0c0]">Data issue</p>
            <p className="mt-3 text-3xl font-semibold">Unable to load live scores.</p>
            <p className="mt-4 text-lg text-[var(--ink-soft)]">{error}</p>
          </div>
        </section>
      ) : null}

      {!loading && rows.length > 0 ? (
        <>
          {top3[0] ? (
            <section className="mx-auto mt-10 grid max-w-7xl gap-5 lg:grid-cols-[1.25fr_0.75fr]">
              <ChampionCard participant={top3[0]} />
              <div className="grid gap-5">
                {top3[1] ? (
                  <PodiumSideCard
                    participant={top3[1]}
                    label="Second Place"
                    accentColor="var(--silver)"
                  />
                ) : null}
                {top3[2] ? (
                  <PodiumSideCard
                    participant={top3[2]}
                    label="Third Place"
                    accentColor="var(--bronze)"
                  />
                ) : null}
              </div>
            </section>
          ) : null}

          <section className="mx-auto mt-10 max-w-7xl">
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <p className="eyebrow text-sm text-[var(--accent-strong)]">Standings</p>
                <h2 className="mt-2 text-4xl font-semibold tracking-[-0.06em]">
                  Full Ranking
                </h2>
              </div>
              <div className="rounded-full border border-[var(--line)] bg-white/5 px-4 py-2 text-xs font-mono tracking-[0.18em] text-[var(--ink-soft)]">
                LIVE RESULTS
              </div>
            </div>

            <div className="grid gap-4">
              {top3.map((participant) => (
                <StandingsRow
                  key={`${participant.rank}-${participant.name}`}
                  participant={participant}
                  brandColor={brandColor}
                />
              ))}
              {remaining.map((participant) => (
                <StandingsRow
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
          <div className="glass-panel-strong rounded-[2.4rem] px-6 py-16 text-center">
            <p className="eyebrow text-sm text-[var(--accent-strong)]">No results yet</p>
            <p className="mt-4 text-4xl font-semibold tracking-[-0.05em]">
              Waiting for the first score
            </p>
          </div>
        </section>
      ) : null}
    </main>
  );
}
