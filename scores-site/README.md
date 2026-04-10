# PPT Leaderboard

This is a `Next.js` app for running live presentation voting sessions with:
- private admin pages
- public QR-based voting pages
- a private podium screen
- a private full ranking screen
- session history and per-session results

Right now the app is fully working with a lightweight local backend based on a JSON file. This README explains how it works today and how to replace that with a proper database later.

## Deployment Recommendation

You do **not** need a separate frontend repo and backend repo for this project.

A good production shape is:
- keep this as one Next.js application
- keep UI + server routes in the same codebase
- move storage from the local JSON file to a real database service

So the recommended architecture is:
- `same app repo`: yes
- `separate database service`: yes
- `same local JSON file in production`: no

For 100+ concurrent users, the current `data/app-data.json` storage is **not** production-ready. Dockerizing the app is useful, but Docker alone does not solve the real bottleneck. The main production upgrade needed is a proper database.

## What The App Does

The flow is:

1. Admin signs in.
2. Admin creates a presentation session.
3. Admin adds participants to that session.
4. Admin optionally uploads participant photos.
5. Admin opens voting for that session.
6. Audience scans a QR and votes on the public session page.
7. Private scoreboard pages show podium and ranking views.
8. Admin can review session history and per-session results later.

## Current Routes

Private:
- `/login`
- `/admin`
- `/admin/history`
- `/admin/sessions/[id]`
- `/admin/results/[id]`
- `/`
- `/scoreboard`
- `/ranking`

Public:
- `/vote/[slug]`
- `/vote/[slug]/done`

Background/action routes:
- `/auth/login`
- `/logout`
- `/admin/sessions/create`
- `/admin/sessions/[id]/participants`
- `/admin/sessions/[id]/participants/[participantId]/delete`
- `/admin/sessions/[id]/participants/[participantId]/photo`
- `/admin/sessions/[id]/status`
- `/vote/[slug]/submit`
- `/api/leaderboard`
- `/api/photos`

## Current Architecture

### Frontend

Main UI:
- `src/components/Scoreboard.tsx`

Admin pages:
- `src/app/admin/...`

Public voting pages:
- `src/app/vote/...`

Login page:
- `src/app/login/page.tsx`

### Backend

This project already has backend behavior inside Next.js using route handlers and server-side utilities.

Current backend pieces:
- `src/lib/store.ts`
- `src/lib/auth.ts`
- route handlers under `src/app/.../route.ts`

So this is already a frontend + backend app, but the backend is still a lightweight file-based implementation.

## Current Data Storage

App data is stored in:

`data/app-data.json`

The current store shape is defined in:

`src/lib/store.ts`

Current entities:
- `people`
- `sessions`
- `sessionParticipants`
- `votes`

Current TypeScript records:
- `PersonRecord`
- `SessionRecord`
- `SessionParticipantRecord`
- `VoteRecord`

## Current Auth

Auth lives in:

`src/lib/auth.ts`

Current auth is intentionally simple:
- one admin password
- one signed cookie session

Environment variables:
- `ADMIN_PASSWORD`
- `SESSION_SECRET`

If not set, development fallback values are used.

## Vote Fairness

The app currently uses a simple one-submission-per-device approach.

For each session it checks:
- a per-session cookie token
- a hashed fingerprint from:
  - IP address
  - user agent
  - accept-language

This logic lives in:
- `src/lib/store.ts`
- `src/app/vote/[slug]/submit/route.ts`

This is practical for internal event fairness, but it is not strong anti-fraud.

## Photo Handling

Photos are stored in:

`public/photos`

They are matched automatically using normalized names.

Photo helpers:
- `src/lib/photoMatching.ts`

Photo index endpoint:
- `src/app/api/photos/route.ts`

Admin photo upload route:
- `src/app/admin/sessions/[id]/participants/[participantId]/photo/route.ts`

## Local Development

Run from this folder:

```bash
cd scores-site
npm install
npm run dev
```

Useful commands:

```bash
npm run dev
npm run lint
npm run build
npm run start
```

## Docker

This repo now includes:
- `Dockerfile`
- `.dockerignore`
- `docker-compose.yml`
- `.env.example`

### Build the image

```bash
docker build -t ppt-leaderboard .
```

### Run with Docker Compose

```bash
cp .env.example .env
docker compose up --build -d
```

The app will be available at:

`http://localhost:3000`

### Important Docker Notes

The compose file mounts:
- `./data` to `/app/data`
- `./public/photos` to `/app/public/photos`

That means:
- votes and sessions survive container restarts
- uploaded photos survive container restarts

### Required environment variables

Set these for production:

- `ADMIN_PASSWORD`
- `SESSION_SECRET`

The compose file includes defaults only for local/dev convenience. Replace them before real deployment.

### Health check

The container exposes:

`/api/health`

The Docker Compose setup uses this endpoint as a health check so hosting platforms and restarts can detect whether the app is actually up.

## How To Replace The Local Store With A Proper Database

If you want to build a separate proper DB-backed version, the easiest path is:

1. Keep the UI and routes.
2. Replace only the storage/auth layer.
3. Move from `data/app-data.json` to a real database.

This is the key step that makes the app actually suitable for 100+ concurrent users.

### Recommended Stack

For this codebase, the cleanest production path is:
- PostgreSQL
- Prisma
- proper admin auth/session storage

Good alternatives:
- Supabase
- Neon + Prisma
- Railway/Postgres + Prisma

## Recommended Database Tables

Use these as your real schema:

### `people`
- `id`
- `name`
- `created_at`

### `sessions`
- `id`
- `title`
- `slug`
- `status` (`draft`, `live`, `closed`)
- `created_at`
- `updated_at`

### `session_participants`
- `id`
- `session_id`
- `person_id`
- `display_order`
- `created_at`

### `votes`
- `id`
- `session_id`
- `participant_id`
- `person_id`
- `score`
- `voter_token`
- `voter_fingerprint`
- `ip_address` optional
- `user_agent` optional
- `created_at`

Optional admin tables:

### `admins`
- `id`
- `username` or `email`
- `password_hash`
- `created_at`

### `admin_sessions`
- `id`
- `admin_id`
- `session_token_hash`
- `expires_at`
- `created_at`

## What To Replace In Code

If you migrate to a DB, these are the main replacement points:

### Replace file storage logic

Current file:
- `src/lib/store.ts`

What to do:
- keep the exported function names if possible
- change internals to DB queries

Important existing functions to preserve:
- `listSessions`
- `getSessionById`
- `getSessionBySlug`
- `createSession`
- `updateSessionStatus`
- `addParticipantToSession`
- `removeParticipantFromSession`
- `submitVotes`
- `getGlobalLeaderboard`
- `getSessionLeaderboard`

If you preserve these function names and return shapes, the UI pages will need far fewer changes.

### Replace simple auth

Current file:
- `src/lib/auth.ts`

What to do:
- replace password comparison with hashed password validation
- replace signed cookie-only logic with DB-backed admin sessions or a proper auth provider

### Keep route structure

These routes can stay mostly the same:
- admin routes
- vote routes
- leaderboard routes

Only their internals need to change from JSON-file reads/writes to DB calls.

## Suggested Migration Strategy

Do it in this order:

1. Add Prisma + database connection.
2. Create real schema/tables.
3. Re-implement `src/lib/store.ts` using Prisma.
4. Re-implement `src/lib/auth.ts` using hashed admin credentials.
5. Keep the same route and page structure.
6. Test vote flow, session flow, and leaderboard aggregation.

This avoids rewriting the UI.

## Suggested Prisma Models

Very rough equivalent:

```prisma
model Person {
  id          String   @id @default(cuid())
  name        String   @unique
  createdAt   DateTime @default(now())
  participants SessionParticipant[]
  votes       Vote[]
}

model Session {
  id           String   @id @default(cuid())
  title        String
  slug         String   @unique
  status       String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  participants SessionParticipant[]
  votes        Vote[]
}

model SessionParticipant {
  id           String   @id @default(cuid())
  sessionId     String
  personId      String
  displayOrder  Int
  createdAt     DateTime @default(now())
  session       Session  @relation(fields: [sessionId], references: [id])
  person        Person   @relation(fields: [personId], references: [id])
  votes         Vote[]
}

model Vote {
  id               String   @id @default(cuid())
  sessionId         String
  participantId     String
  personId          String
  score             Int
  voterToken        String
  voterFingerprint  String?
  createdAt         DateTime @default(now())
  session           Session  @relation(fields: [sessionId], references: [id])
  participant       SessionParticipant @relation(fields: [participantId], references: [id])
  person            Person   @relation(fields: [personId], references: [id])
}
```

You would likely also add uniqueness/indexes for vote fairness rules.

## Production Notes

If you move this to a proper DB, also consider:
- stronger duplicate-vote protection
- rate limiting on vote submission
- proper admin password hashing with bcrypt/argon2
- audit logs for session actions
- photo storage outside local disk if deploying across multiple instances
- reverse proxy / HTTPS in front of the app
- database backups
- health checks and monitoring
- horizontal scaling only after moving off local file storage

## Recommendation For Your Deployment

For your use case, the best next architecture is:
- keep the frontend and backend logic in this same Next.js app
- move persistence to a real PostgreSQL database
- keep Docker for packaging and deployment

You do **not** need a separate backend repo just to handle 100+ concurrent users.

What you **do** need:
- a real database
- proper environment secrets
- Dockerized deployment
- health checks
- backups/monitoring

So the practical answer is:
- `same codebase`: yes
- `same deployable app`: yes
- `same local JSON file`: no
- `separate database service`: yes

## Current Status

Right now:
- the app works
- the backend is local/file-based
- it is good for prototyping and internal demos
- it is not the final production-grade database architecture

This README should give you a clean map for building that next step.
