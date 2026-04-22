# PPT Leaderboard

This is a single `Next.js` app for running live presentation voting with:
- private admin pages
- public QR-based voting sessions
- a private podium screen
- a private full ranking screen
- PostgreSQL persistence through Prisma
- Docker deployment with the app and database in one stack

The app is now structured the production-friendly way for this project:
- `same repo for frontend + backend`: yes
- `same deployable app`: yes
- `separate PostgreSQL database service`: yes

## What It Does

The workflow is:

1. Admin signs in.
2. Admin creates a presentation session.
3. Admin adds participants.
4. Admin uploads participant photos if needed.
5. Admin opens voting for that session.
6. Audience scans the QR and votes on `/vote/[slug]`.
7. Private scoreboard pages show the overall leaderboard.
8. Admin can review history and session-level results.

## Architecture

### Frontend

Main UI:
- `src/components/Scoreboard.tsx`

Admin pages:
- `src/app/admin/...`

Public vote pages:
- `src/app/vote/...`

Private display pages:
- `src/app/page.tsx`
- `src/app/scoreboard/page.tsx`
- `src/app/ranking/page.tsx`

### Backend

The backend lives inside the same Next.js app using server routes and server utilities.

Core backend files:
- `src/lib/store.ts`
- `src/lib/auth.ts`
- `src/lib/db.ts`
- `prisma/schema.prisma`

### Database

The app now uses:
- PostgreSQL
- Prisma Client
- Prisma schema in `prisma/schema.prisma`

Main tables/models:
- `Admin`
- `AdminSession`
- `Person`
- `Session`
- `SessionParticipant`
- `VoteSubmission`
- `Vote`

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

Action/API routes:
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
- `/api/health`

## Auth

Auth is handled in `src/lib/auth.ts`.

Current behavior:
- one admin account is bootstrapped from environment variables
- login creates a DB-backed admin session
- the browser stores only the raw session token in a secure cookie
- the database stores only the hashed session token

Environment variables used:
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `SESSION_SECRET`

If the configured admin does not exist yet, the app creates it automatically on first auth use.

## Vote Fairness

The app currently allows one submission per device per session using:
- a per-session voter cookie token
- a hashed fingerprint based on IP address, user agent, and accept-language

That data is stored through:
- `VoteSubmission`
- `Vote`

This is a practical fairness layer for live events, but it is not full anti-fraud protection.

## Photo Handling

Photos are stored in:

`public/photos`

Matching is automatic:
- participant names are normalized
- photo filenames are normalized
- if a photo matches, it appears on the scoreboard
- if not, initials are shown

Relevant files:
- `src/lib/photoMatching.ts`
- `src/app/api/photos/route.ts`
- `src/app/admin/sessions/[id]/participants/[participantId]/photo/route.ts`

## Environment Variables

Copy the template first:

```bash
cp .env.example .env
```

For a real VPS deployment, use:

```bash
cp .env.production.example .env
```

Important values:

- `DATABASE_URL`
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `SESSION_SECRET`

Notes:
- `DATABASE_URL` in `.env` is meant for local CLI usage from your machine.
- inside Docker Compose, the app container gets its own internal `DATABASE_URL` that points to the `postgres` service.

## Local Development

Run from `scores-site`.

### Option 1: run the database in Docker and the app locally

Start Postgres:

```bash
cp .env.example .env
docker compose up -d postgres
```

Push the schema:

```bash
npm install
npm run prisma:push
```

Run the app:

```bash
npm run dev
```

### Option 2: run the whole stack in Docker

```bash
cp .env.example .env
docker compose up --build -d
```

App:

`http://localhost:3000`

## Useful Commands

```bash
npm install
npm run prisma:generate
npm run prisma:push
npm run dev
npm run lint
npm run build
docker compose up --build -d
docker compose down
```

## Docker

Included files:
- `Dockerfile`
- `docker-compose.yml`
- `docker-compose.proxy.yml`
- `.dockerignore`
- `docker-entrypoint.sh`
- `deploy.sh`
- `.env.example`
- `.env.production.example`

### What Docker Compose runs

Services:
- `postgres`
- `app`

Important behavior:
- Postgres uses a named Docker volume for persistence
- uploaded photos are mounted from `./public/photos`
- the app waits for the database
- the app runs `prisma db push` on startup before starting the server
- the app exposes `/api/health` for health checks
- the runtime image is kept slim by copying only the standalone Next output and the Prisma runtime pieces it needs
- the default Compose profile is tuned for a small server footprint

### 2 GB server profile

The included Docker setup is tuned to be reasonable on a `2 GB` VPS:
- app container memory limit: `768 MB`
- postgres container memory limit: `768 MB`
- remaining memory stays available for Docker, kernel, filesystem cache, and burst usage

That is a practical starting point for:
- 100+ concurrent voters
- one admin user
- one live event screen

This is still a small-server setup, so for best results:
- keep only one app instance
- keep photos on local disk only if you are running a single node
- avoid other heavy processes on the same server
- use managed backups if this becomes important event infrastructure

### Production deployment shape

This stack is designed so you can:
- build one app image
- run one Postgres service
- mount the photos folder
- set env vars
- host it without splitting the project into separate frontend and backend repos

### Optional Nginx + HTTPS layer

For domain + HTTPS, the repo now also includes:
- `docker-compose.proxy.yml`
- `deploy.sh`

The proxy stack uses:
- `nginxproxy/nginx-proxy`
- `nginxproxy/acme-companion`

That gives you:
- Nginx reverse proxy
- automatic Let's Encrypt certificates
- HTTPS termination in front of the app

## VPS Deployment Checklist

Use this for a small production server.

### 1. Prepare the server

- use a clean Ubuntu/Debian VPS with at least `2 GB RAM`
- install Docker and Docker Compose
- open only the ports you need, usually `80`, `443`, and optionally `22`
- do not run other heavy apps on the same server

### 2. Copy the project

```bash
git clone <your-repo-url>
cd scores-site
```

Or copy the project files directly onto the server.

### 3. Create the production env file

```bash
cp .env.production.example .env
```

Then edit `.env` and set:
- `POSTGRES_PASSWORD`
- `ADMIN_PASSWORD`
- `SESSION_SECRET`
- `PUBLIC_DOMAIN`
- `LETSENCRYPT_EMAIL`

Use strong secrets.

Recommended production value:
- `APP_PORT_BIND=127.0.0.1:3000`

That keeps the app port local to the server while Nginx handles public traffic.

### 4. Prepare uploaded photos

Make sure this folder exists:

```bash
mkdir -p public/photos
```

### 5. Start the stack

```bash
chmod +x deploy.sh
./deploy.sh
```

This script automatically:
- creates `public/photos` if needed
- loads `.env`
- starts the normal app stack
- starts the Nginx + HTTPS stack when `PUBLIC_DOMAIN` and `LETSENCRYPT_EMAIL` are set

### 6. Check that containers are healthy

```bash
docker compose -f docker-compose.yml -f docker-compose.proxy.yml ps
docker compose -f docker-compose.yml -f docker-compose.proxy.yml logs app --tail 100
docker compose -f docker-compose.yml -f docker-compose.proxy.yml logs postgres --tail 100
docker compose -f docker-compose.yml -f docker-compose.proxy.yml logs nginx-proxy --tail 100
docker compose -f docker-compose.yml -f docker-compose.proxy.yml logs letsencrypt --tail 100
```

### 7. Test the app

- open `https://your-domain`
- open `https://your-domain/login`
- sign in with the admin credentials from `.env`
- create a session
- add participants
- open voting
- scan the QR from a phone
- verify votes appear on the private board

### 8. Before the event

- restart the stack once before the event day:

```bash
docker compose -f docker-compose.yml -f docker-compose.proxy.yml down
./deploy.sh
```

- test with multiple phones on the real network
- keep one backup copy of participant photos
- keep the `.env` file backed up securely

## One-Command VPS Deploy

After the server is prepared and `.env` is ready, the main deploy command is:

```bash
./deploy.sh
```

Useful follow-up commands:

```bash
docker compose -f docker-compose.yml -f docker-compose.proxy.yml ps
docker compose -f docker-compose.yml -f docker-compose.proxy.yml logs app --tail 100
docker compose -f docker-compose.yml -f docker-compose.proxy.yml logs postgres --tail 100
docker compose -f docker-compose.yml -f docker-compose.proxy.yml logs nginx-proxy --tail 100
docker compose -f docker-compose.yml -f docker-compose.proxy.yml logs letsencrypt --tail 100
docker compose -f docker-compose.yml -f docker-compose.proxy.yml restart app
docker compose -f docker-compose.yml -f docker-compose.proxy.yml down
```

## DNS And HTTPS Notes

Before using the proxy setup:
- point your domain's `A` record to your server IP
- wait for DNS propagation
- make sure ports `80` and `443` are open on the VPS firewall

The HTTPS setup works only when:
- the domain resolves to the VPS
- Let's Encrypt can reach the server on port `80`

If you want to run without domain + HTTPS first, leave `PUBLIC_DOMAIN` and `LETSENCRYPT_EMAIL` empty and `deploy.sh` will start only the app + database stack.

## Prisma Notes

Schema:
- `prisma/schema.prisma`

Client singleton:
- `src/lib/db.ts`

Data/query layer:
- `src/lib/store.ts`

Auth/session layer:
- `src/lib/auth.ts`

If you need to evolve the schema later:

1. update `prisma/schema.prisma`
2. run `npm run prisma:generate`
3. run `npm run prisma:push`

## Production Notes

This is much closer to a real deployable architecture now, but for a stronger production setup you should still consider:
- using managed Postgres backups
- moving photos to object storage if you ever run multiple app instances
- adding rate limiting on vote submission
- adding audit logs for admin actions
- rotating secrets properly
- putting HTTPS/reverse proxy in front of the app

## Current Status

Right now the app is:
- Next.js frontend + backend in one repo
- PostgreSQL-backed
- Prisma-powered
- Dockerized
- suitable to deploy as one clean stack

That means you no longer need the old JSON-file storage model for the main app path.
