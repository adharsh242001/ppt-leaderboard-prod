import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";

export type SessionStatus = "draft" | "live" | "closed";

export type PersonRecord = {
  id: string;
  name: string;
  createdAt: string;
};

export type SessionRecord = {
  id: string;
  title: string;
  slug: string;
  status: SessionStatus;
  createdAt: string;
  updatedAt: string;
};

export type SessionParticipantRecord = {
  id: string;
  sessionId: string;
  personId: string;
  displayOrder: number;
  createdAt: string;
};

export type VoteRecord = {
  id: string;
  sessionId: string;
  participantId: string;
  personId: string;
  score: number;
  voterToken: string;
  voterFingerprint?: string;
  createdAt: string;
};

type AppStore = {
  people: PersonRecord[];
  sessions: SessionRecord[];
  sessionParticipants: SessionParticipantRecord[];
  votes: VoteRecord[];
};

export type SessionParticipantView = {
  participantId: string;
  personId: string;
  name: string;
  displayOrder: number;
};

export type SessionWithParticipants = SessionRecord & {
  participants: SessionParticipantView[];
  voteCount: number;
};

const STORE_DIR = path.join(process.cwd(), "data");
const STORE_FILE = path.join(STORE_DIR, "app-data.json");

const EMPTY_STORE: AppStore = {
  people: [],
  sessions: [],
  sessionParticipants: [],
  votes: [],
};

async function ensureStoreFile() {
  await mkdir(STORE_DIR, { recursive: true });

  try {
    await readFile(STORE_FILE, "utf8");
  } catch {
    await writeFile(STORE_FILE, JSON.stringify(EMPTY_STORE, null, 2), "utf8");
  }
}

async function readStore(): Promise<AppStore> {
  await ensureStoreFile();
  const raw = await readFile(STORE_FILE, "utf8");
  return JSON.parse(raw) as AppStore;
}

async function writeStore(store: AppStore) {
  await ensureStoreFile();
  await writeFile(STORE_FILE, JSON.stringify(store, null, 2), "utf8");
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function getUniqueSessionSlug(store: AppStore, title: string) {
  const base = slugify(title) || "session";
  let candidate = base;
  let counter = 2;

  while (store.sessions.some((session) => session.slug === candidate)) {
    candidate = `${base}-${counter}`;
    counter += 1;
  }

  return candidate;
}

export async function listSessions(): Promise<SessionWithParticipants[]> {
  const store = await readStore();

  return store.sessions
    .map((session) => {
      const participants = store.sessionParticipants
        .filter((participant) => participant.sessionId === session.id)
        .sort((left, right) => left.displayOrder - right.displayOrder)
        .map((participant) => {
          const person = store.people.find((entry) => entry.id === participant.personId);
          return {
            participantId: participant.id,
            personId: participant.personId,
            name: person?.name ?? "Unknown",
            displayOrder: participant.displayOrder,
          };
        });

      const voteCount = store.votes.filter((vote) => vote.sessionId === session.id).length;

      return {
        ...session,
        participants,
        voteCount,
      };
    })
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function getSessionById(
  sessionId: string
): Promise<SessionWithParticipants | null> {
  const sessions = await listSessions();
  return sessions.find((session) => session.id === sessionId) ?? null;
}

export async function getSessionBySlug(
  slug: string
): Promise<SessionWithParticipants | null> {
  const sessions = await listSessions();
  return sessions.find((session) => session.slug === slug) ?? null;
}

export async function createSession(title: string) {
  const trimmed = title.trim();
  if (!trimmed) {
    throw new Error("Session title is required.");
  }

  const store = await readStore();
  const now = new Date().toISOString();

  const session: SessionRecord = {
    id: randomUUID(),
    title: trimmed,
    slug: await getUniqueSessionSlug(store, trimmed),
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };

  store.sessions.push(session);
  await writeStore(store);
  return session;
}

export async function updateSessionStatus(
  sessionId: string,
  status: SessionStatus
) {
  const store = await readStore();
  const session = store.sessions.find((entry) => entry.id === sessionId);

  if (!session) {
    throw new Error("Session not found.");
  }

  if (status === "live") {
    store.sessions = store.sessions.map((entry) =>
      entry.id === sessionId
        ? { ...entry, status: "live", updatedAt: new Date().toISOString() }
        : entry.status === "live"
          ? { ...entry, status: "closed", updatedAt: new Date().toISOString() }
          : entry
    );
  } else {
    session.status = status;
    session.updatedAt = new Date().toISOString();
  }

  await writeStore(store);
}

async function getOrCreatePerson(store: AppStore, name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Participant name is required.");
  }

  const existing = store.people.find(
    (person) => person.name.toLowerCase() === trimmed.toLowerCase()
  );
  if (existing) {
    return existing;
  }

  const person: PersonRecord = {
    id: randomUUID(),
    name: trimmed,
    createdAt: new Date().toISOString(),
  };

  store.people.push(person);
  return person;
}

export async function addParticipantToSession(sessionId: string, name: string) {
  const store = await readStore();
  const session = store.sessions.find((entry) => entry.id === sessionId);

  if (!session) {
    throw new Error("Session not found.");
  }

  const person = await getOrCreatePerson(store, name);
  const participantCount = store.sessionParticipants.filter(
    (participant) => participant.sessionId === sessionId
  ).length;

  const alreadyExists = store.sessionParticipants.find(
    (participant) =>
      participant.sessionId === sessionId && participant.personId === person.id
  );

  if (alreadyExists) {
    throw new Error("Participant already added to this session.");
  }

  store.sessionParticipants.push({
    id: randomUUID(),
    sessionId,
    personId: person.id,
    displayOrder: participantCount + 1,
    createdAt: new Date().toISOString(),
  });

  session.updatedAt = new Date().toISOString();
  await writeStore(store);
}

export async function submitVotes(
  sessionSlug: string,
  ratings: Array<{ participantId: string; score: number }>,
  voterToken: string,
  voterFingerprint?: string
) {
  const store = await readStore();
  const session = store.sessions.find((entry) => entry.slug === sessionSlug);

  if (!session) {
    throw new Error("Session not found.");
  }

  if (session.status !== "live") {
    throw new Error("Voting is not open for this session.");
  }

  const existingVotes = store.votes.filter((vote) => {
    if (vote.sessionId !== session.id) {
      return false;
    }

    if (vote.voterToken === voterToken) {
      return true;
    }

    return Boolean(
      voterFingerprint && vote.voterFingerprint === voterFingerprint
    );
  });

  if (existingVotes.length > 0) {
    throw new Error("This device has already voted for this session.");
  }

  for (const rating of ratings) {
    const participant = store.sessionParticipants.find(
      (entry) => entry.id === rating.participantId && entry.sessionId === session.id
    );

    if (!participant) {
      continue;
    }

    store.votes.push({
      id: randomUUID(),
      sessionId: session.id,
      participantId: participant.id,
      personId: participant.personId,
      score: rating.score,
      voterToken,
      voterFingerprint,
      createdAt: new Date().toISOString(),
    });
  }

  session.updatedAt = new Date().toISOString();
  await writeStore(store);
}

export function createVoteFingerprint(input: {
  ipAddress: string;
  userAgent: string;
  acceptLanguage: string;
}) {
  const raw = [
    input.ipAddress.trim(),
    input.userAgent.trim(),
    input.acceptLanguage.trim(),
  ].join("|");

  return createHash("sha256").update(raw).digest("hex");
}

export async function getGlobalLeaderboard() {
  const store = await readStore();
  const aggregates = new Map<
    string,
    {
      name: string;
      sum: number;
      count: number;
    }
  >();

  for (const vote of store.votes) {
    const person = store.people.find((entry) => entry.id === vote.personId);
    if (!person) {
      continue;
    }

    const current = aggregates.get(vote.personId) ?? {
      name: person.name,
      sum: 0,
      count: 0,
    };

    current.sum += vote.score;
    current.count += 1;
    aggregates.set(vote.personId, current);
  }

  return [...aggregates.values()]
    .map((entry) => ({
      name: entry.name,
      sum: entry.sum.toString(),
      count: entry.count.toString(),
      avg: (entry.sum / entry.count).toFixed(2),
    }))
    .sort((left, right) => Number.parseFloat(right.sum) - Number.parseFloat(left.sum));
}
