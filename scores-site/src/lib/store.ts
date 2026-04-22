import { createHash } from "node:crypto";
import { SessionStatus as PrismaSessionStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { normalizeParticipantName } from "@/lib/photoMatching";

export type SessionStatus = "draft" | "live" | "closed";

export type SessionParticipantView = {
  participantId: string;
  personId: string;
  name: string;
  displayOrder: number;
};

export type SessionWithParticipants = {
  id: string;
  title: string;
  slug: string;
  status: SessionStatus;
  createdAt: string;
  updatedAt: string;
  participants: SessionParticipantView[];
  voteCount: number;
};

export type LeaderboardRow = {
  name: string;
  sum: string;
  count: string;
  avg: string;
};

type SessionWithGraph = Prisma.SessionGetPayload<{
  include: {
    participants: {
      orderBy: {
        displayOrder: "asc";
      };
      include: {
        person: true;
      };
    };
    _count: {
      select: {
        votes: true;
      };
    };
  };
}>;

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function getUniqueSessionSlug(title: string) {
  const base = slugify(title) || "session";
  let candidate = base;
  let counter = 2;

  while (
    await prisma.session.findUnique({
      where: { slug: candidate },
      select: { id: true },
    })
  ) {
    candidate = `${base}-${counter}`;
    counter += 1;
  }

  return candidate;
}

function mapSession(session: SessionWithGraph): SessionWithParticipants {
  return {
    id: session.id,
    title: session.title,
    slug: session.slug,
    status: session.status,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    participants: session.participants.map((participant) => ({
      participantId: participant.id,
      personId: participant.personId,
      name: participant.person.name,
      displayOrder: participant.displayOrder,
    })),
    voteCount: session._count.votes,
  };
}

async function getOrCreatePerson(
  tx: Prisma.TransactionClient,
  name: string
) {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Participant name is required.");
  }

  const normalizedName = normalizeParticipantName(trimmed);
  if (!normalizedName) {
    throw new Error("Participant name is required.");
  }

  const existing = await tx.person.findUnique({
    where: {
      normalizedName,
    },
  });

  if (existing) {
    if (existing.name !== trimmed) {
      return tx.person.update({
        where: { id: existing.id },
        data: { name: trimmed },
      });
    }

    return existing;
  }

  return tx.person.create({
    data: {
      name: trimmed,
      normalizedName,
    },
  });
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

async function loadSessionWithParticipantsById(sessionId: string) {
  return prisma.session.findUnique({
    where: {
      id: sessionId,
    },
    include: {
      participants: {
        orderBy: {
          displayOrder: "asc",
        },
        include: {
          person: true,
        },
      },
      _count: {
        select: {
          votes: true,
        },
      },
    },
  });
}

async function loadSessionWithParticipantsBySlug(slug: string) {
  return prisma.session.findUnique({
    where: {
      slug,
    },
    include: {
      participants: {
        orderBy: {
          displayOrder: "asc",
        },
        include: {
          person: true,
        },
      },
      _count: {
        select: {
          votes: true,
        },
      },
    },
  });
}

export async function listSessions(): Promise<SessionWithParticipants[]> {
  const sessions = await prisma.session.findMany({
    orderBy: {
      createdAt: "desc",
    },
    include: {
      participants: {
        orderBy: {
          displayOrder: "asc",
        },
        include: {
          person: true,
        },
      },
      _count: {
        select: {
          votes: true,
        },
      },
    },
  });

  return sessions.map(mapSession);
}

export async function getSessionById(
  sessionId: string
): Promise<SessionWithParticipants | null> {
  const session = await loadSessionWithParticipantsById(sessionId);
  return session ? mapSession(session) : null;
}

export async function getParticipantFromSession(
  sessionId: string,
  participantId: string
): Promise<SessionParticipantView | null> {
  const participant = await prisma.sessionParticipant.findFirst({
    where: {
      id: participantId,
      sessionId,
    },
    include: {
      person: true,
    },
  });

  if (!participant) {
    return null;
  }

  return {
    participantId: participant.id,
    personId: participant.personId,
    name: participant.person.name,
    displayOrder: participant.displayOrder,
  };
}

export async function getSessionBySlug(
  slug: string
): Promise<SessionWithParticipants | null> {
  const session = await loadSessionWithParticipantsBySlug(slug);
  return session ? mapSession(session) : null;
}

export async function createSession(title: string) {
  const trimmed = title.trim();
  if (!trimmed) {
    throw new Error("Session title is required.");
  }

  return prisma.session.create({
    data: {
      title: trimmed,
      slug: await getUniqueSessionSlug(trimmed),
    },
  });
}

export async function updateSessionStatus(
  sessionId: string,
  status: SessionStatus
) {
  const nextStatus = status as PrismaSessionStatus;

  await prisma.$transaction(async (tx) => {
    const session = await tx.session.findUnique({
      where: { id: sessionId },
      select: { id: true },
    });

    if (!session) {
      throw new Error("Session not found.");
    }

    if (nextStatus === PrismaSessionStatus.live) {
      await tx.session.updateMany({
        where: {
          status: PrismaSessionStatus.live,
          id: {
            not: sessionId,
          },
        },
        data: {
          status: PrismaSessionStatus.closed,
        },
      });
    }

    await tx.session.update({
      where: { id: sessionId },
      data: {
        status: nextStatus,
      },
    });
  });
}

export async function addParticipantToSession(sessionId: string, name: string) {
  await prisma.$transaction(async (tx) => {
    const session = await tx.session.findUnique({
      where: { id: sessionId },
      select: { id: true },
    });

    if (!session) {
      throw new Error("Session not found.");
    }

    const person = await getOrCreatePerson(tx, name);
    const participantCount = await tx.sessionParticipant.count({
      where: {
        sessionId,
      },
    });

    const alreadyExists = await tx.sessionParticipant.findUnique({
      where: {
        sessionId_personId: {
          sessionId,
          personId: person.id,
        },
      },
      select: {
        id: true,
      },
    });

    if (alreadyExists) {
      throw new Error("Participant already added to this session.");
    }

    await tx.sessionParticipant.create({
      data: {
        sessionId,
        personId: person.id,
        displayOrder: participantCount + 1,
      },
    });

    await tx.session.update({
      where: { id: sessionId },
      data: {
        updatedAt: new Date(),
      },
    });
  });
}

export async function removeParticipantFromSession(
  sessionId: string,
  participantId: string
) {
  await prisma.$transaction(async (tx) => {
    const participant = await tx.sessionParticipant.findFirst({
      where: {
        id: participantId,
        sessionId,
      },
      select: {
        id: true,
        displayOrder: true,
      },
    });

    if (!participant) {
      throw new Error("Participant not found.");
    }

    await tx.vote.deleteMany({
      where: {
        participantId,
      },
    });

    await tx.sessionParticipant.delete({
      where: {
        id: participantId,
      },
    });

    await tx.sessionParticipant.updateMany({
      where: {
        sessionId,
        displayOrder: {
          gt: participant.displayOrder,
        },
      },
      data: {
        displayOrder: {
          decrement: 1,
        },
      },
    });

    await tx.session.update({
      where: { id: sessionId },
      data: {
        updatedAt: new Date(),
      },
    });
  });
}

export async function submitVotes(
  sessionSlug: string,
  ratings: Array<{ participantId: string; score: number }>,
  voterToken: string,
  voterFingerprint?: string,
  requestMeta?: {
    ipAddress?: string;
    userAgent?: string;
    acceptLanguage?: string;
  }
) {
  const cleanedRatings = ratings
    .map((rating) => ({
      participantId: rating.participantId,
      score: Math.max(1, Math.min(10, Math.round(rating.score))),
    }))
    .filter((rating) => Number.isFinite(rating.score));

  if (cleanedRatings.length === 0) {
    throw new Error("No valid ratings submitted.");
  }

  await prisma.$transaction(async (tx) => {
    const session = await tx.session.findUnique({
      where: {
        slug: sessionSlug,
      },
      include: {
        participants: true,
      },
    });

    if (!session) {
      throw new Error("Session not found.");
    }

    if (session.status !== PrismaSessionStatus.live) {
      throw new Error("Voting is not open for this session.");
    }

    const participantsById = new Map(
      session.participants.map((participant) => [participant.id, participant])
    );

    const validVotes = cleanedRatings
      .map((rating) => {
        const participant = participantsById.get(rating.participantId);
        if (!participant) {
          return null;
        }

        return {
          sessionId: session.id,
          participantId: participant.id,
          personId: participant.personId,
          score: rating.score,
        };
      })
      .filter((vote): vote is NonNullable<typeof vote> => vote !== null);

    if (validVotes.length === 0) {
      throw new Error("No valid ratings submitted.");
    }

    let submission;
    try {
      submission = await tx.voteSubmission.create({
        data: {
          sessionId: session.id,
          voterToken,
          voterFingerprint,
          ipAddress: requestMeta?.ipAddress,
          userAgent: requestMeta?.userAgent,
          acceptLanguage: requestMeta?.acceptLanguage,
        },
      });
    } catch (error: unknown) {
      if (isUniqueConstraintError(error)) {
        throw new Error("This device has already voted for this session.");
      }
      throw error;
    }

    await tx.vote.createMany({
      data: validVotes.map((vote) => ({
        ...vote,
        submissionId: submission.id,
      })),
    });

    await tx.session.update({
      where: {
        id: session.id,
      },
      data: {
        updatedAt: new Date(),
      },
    });
  });
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

async function buildLeaderboardRows(
  aggregateRows: Array<{
    personId: string;
    _sum: {
      score: number | null;
    };
    _count: {
      score: number;
    };
  }>
): Promise<LeaderboardRow[]> {
  const people = await prisma.person.findMany({
    where: {
      id: {
        in: aggregateRows.map((entry) => entry.personId),
      },
    },
    select: {
      id: true,
      name: true,
    },
  });

  const namesById = new Map(people.map((person) => [person.id, person.name]));

  return aggregateRows
    .map((entry) => {
      const sum = entry._sum.score ?? 0;
      const count = entry._count.score;

      return {
        name: namesById.get(entry.personId) ?? "Unknown",
        sum: sum.toString(),
        count: count.toString(),
        avg: count ? (sum / count).toFixed(2) : "0.00",
      };
    })
    .sort((left, right) => Number.parseFloat(right.sum) - Number.parseFloat(left.sum));
}

export async function getGlobalLeaderboard() {
  const aggregateRows = await prisma.vote.groupBy({
    by: ["personId"],
    _sum: {
      score: true,
    },
    _count: {
      score: true,
    },
    orderBy: {
      _sum: {
        score: "desc",
      },
    },
  });

  return buildLeaderboardRows(aggregateRows);
}

export async function getSessionLeaderboard(sessionId: string): Promise<LeaderboardRow[]> {
  const session = await prisma.session.findUnique({
    where: {
      id: sessionId,
    },
    select: {
      id: true,
    },
  });

  if (!session) {
    throw new Error("Session not found.");
  }

  const aggregateRows = await prisma.vote.groupBy({
    by: ["personId"],
    where: {
      sessionId,
    },
    _sum: {
      score: true,
    },
    _count: {
      score: true,
    },
    orderBy: {
      _sum: {
        score: "desc",
      },
    },
  });

  return buildLeaderboardRows(aggregateRows);
}
