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

function BackgroundElements() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-purple-100 opacity-30 animate-pulse"></div>
      <div
        className="absolute top-1/2 -left-20 h-60 w-60 rounded-full bg-blue-100 opacity-20 animate-bounce"
        style={{ animationDuration: "3s" }}
      ></div>
      <div
        className="absolute right-1/4 bottom-10 h-40 w-40 rounded-full bg-green-100 opacity-25 animate-pulse"
        style={{ animationDelay: "1s" }}
      ></div>

      <div
        className="absolute top-1/4 left-1/4 h-6 w-6 rotate-45 bg-purple-200 opacity-40 animate-spin"
        style={{ animationDuration: "8s" }}
      ></div>
      <div
        className="absolute top-3/4 right-1/3 h-4 w-4 rounded-full bg-blue-200 opacity-30 animate-bounce"
        style={{ animationDuration: "4s", animationDelay: "2s" }}
      ></div>
      <div
        className="absolute bottom-1/3 left-1/3 h-2 w-8 bg-green-200 opacity-30 animate-pulse"
        style={{ animationDelay: "3s" }}
      ></div>

      <div className="absolute top-20 right-1/3 h-32 w-32 rounded-full bg-gradient-to-br from-purple-200 to-transparent opacity-20 animate-pulse"></div>
      <div
        className="absolute bottom-40 left-1/4 h-24 w-24 rounded-full bg-gradient-to-br from-blue-200 to-transparent opacity-15 animate-bounce"
        style={{ animationDuration: "5s" }}
      ></div>
    </div>
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
    <header className="relative z-10 border-b border-gray-100 bg-white/95 shadow-sm backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {logoSrc ? (
              <AvatarImage
                src={logoSrc}
                alt="Logo"
                width={120}
                height={90}
                className="h-12 w-[4.5rem] rounded-xl object-cover shadow-md"
              />
            ) : null}
            <div>
              <h1 className="text-3xl font-bold text-gray-900 md:text-4xl">
                {title}
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Real-time presentation scores
              </p>
            </div>
          </div>

          <div className="text-right">
            <div className="flex items-center space-x-2 rounded-full bg-green-50 px-3 py-2 text-green-600">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-sm font-medium">LIVE</span>
            </div>
            {lastUpdated ? (
              <p className="mt-1 text-xs text-gray-400">
                Updated {lastUpdated.toLocaleTimeString()}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}

function Podium({
  top3,
  brandColor,
}: {
  top3: RankedParticipant[];
  brandColor: string;
}) {
  const podiumColors = ["#FFD700", "#C0C0C0", "#CD7F32"];
  const podiumHeights = ["h-32", "h-24", "h-20"];

  return (
    <section className="relative z-10 mb-12">
      <h2 className="mb-8 text-center text-2xl font-bold text-gray-900">
        🏆 Top Performers
      </h2>
      <div className="mx-auto flex max-w-4xl items-end justify-center space-x-4">
        {top3.map((performer, index) => {
          const initials = getInitials(performer.name);
          const position = index === 0 ? 1 : index === 1 ? 2 : 3;
          const colorIndex = position === 1 ? 0 : position === 2 ? 1 : 2;

          return (
            <div key={performer.name} className="flex flex-col items-center">
              <div className="relative mb-4">
                {performer.photoSrc ? (
                  <AvatarImage
                    src={performer.photoSrc}
                    alt={performer.name}
                    width={80}
                    height={80}
                    className="h-20 w-20 rounded-full border-4 object-cover shadow-lg"
                    style={{ borderColor: podiumColors[colorIndex] }}
                  />
                ) : (
                  <div
                    className="flex h-20 w-20 items-center justify-center rounded-full border-4 text-white font-bold shadow-lg"
                    style={{
                      backgroundColor: brandColor,
                      borderColor: podiumColors[colorIndex],
                    }}
                  >
                    {initials}
                  </div>
                )}
                {position === 1 ? (
                  <div className="absolute -top-2 -right-2 text-2xl">👑</div>
                ) : null}
              </div>

              <div className="mb-4 text-center">
                <h3 className="font-bold text-gray-900">{performer.name}</h3>
                <p className="text-2xl font-bold" style={{ color: brandColor }}>
                  {performer.sum}
                </p>
                <p className="text-sm text-gray-500">Avg: {performer.avg}</p>
              </div>

              <div
                className={`flex w-24 items-center justify-center rounded-t-lg text-xl font-bold text-white shadow-lg ${podiumHeights[colorIndex]}`}
                style={{ backgroundColor: podiumColors[colorIndex] }}
              >
                {position}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ParticipantCard({
  participant,
  brandColor,
}: {
  participant: RankedParticipant;
  brandColor: string;
}) {
  const initials = getInitials(participant.name);

  return (
    <div className="group rounded-2xl border border-gray-100 bg-white/90 p-6 shadow-lg backdrop-blur-sm transition-all duration-300 hover:border-gray-200 hover:shadow-xl">
      <div className="flex items-center space-x-4">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full text-white font-bold shadow-md"
          style={{ backgroundColor: brandColor }}
        >
          #{participant.rank}
        </div>

        {participant.photoSrc ? (
          <AvatarImage
            src={participant.photoSrc}
            alt={participant.name}
            width={64}
            height={64}
            className="h-16 w-16 rounded-xl object-cover shadow-md transition-transform group-hover:scale-105"
          />
        ) : (
          <div
            className="flex h-16 w-16 items-center justify-center rounded-xl text-white font-semibold shadow-md transition-transform group-hover:scale-105"
            style={{ backgroundColor: `${brandColor}80` }}
          >
            {initials}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-bold text-gray-900">
            {participant.name}
          </h3>
          <div className="mt-2 flex space-x-4">
            <div className="text-center">
              <p className="text-xs text-gray-500">Score</p>
              <p className="text-lg font-bold" style={{ color: brandColor }}>
                {participant.sum}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">Count</p>
              <p className="font-semibold text-gray-700">{participant.count}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">Average</p>
              <p className="font-semibold text-gray-700">{participant.avg}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Scoreboard({
  title = "Live Scores",
  logoSrc,
  brandColor = "#6366f1",
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
      } catch (error: unknown) {
        if (!isActive) {
          return;
        }

        setError(getErrorMessage(error));
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

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <BackgroundElements />

      <Header title={title} logoSrc={logoSrc} lastUpdated={lastUpdated} />

      <main className="relative z-10 mx-auto max-w-7xl px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="mx-auto mb-4 h-12 w-12 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin"></div>
              <p className="text-gray-600">Loading scores...</p>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="mb-8 rounded-r-lg border-l-4 border-red-400 bg-red-50 p-4">
            <div className="flex">
              <div className="ml-3">
                <p className="font-medium text-red-700">Error loading data</p>
                <p className="text-sm text-red-600">{error}</p>
              </div>
            </div>
          </div>
        ) : null}

        {rows.length > 0 ? (
          <>
            {top3.length >= 3 ? (
              <Podium top3={top3} brandColor={brandColor} />
            ) : null}

            <section className="relative z-10">
              <h2 className="mb-6 text-2xl font-bold text-gray-900">
                📊 All Participants ({rows.length})
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {rows.map((participant) => (
                  <ParticipantCard
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
          <div className="py-20 text-center">
            <div className="mb-4 text-6xl">📊</div>
            <p className="mb-2 text-xl text-gray-600">No data found</p>
            <p className="text-gray-500">
              Check your sheet headers and data source
            </p>
          </div>
        ) : null}

        <footer className="mt-16 text-center text-sm text-gray-500">
          <p>Updates automatically every {REFRESH_MS / 1000} seconds</p>
        </footer>
      </main>
    </div>
  );
}
