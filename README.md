# PPT Leaderboard

A live presentation voting and leaderboard app built with **Next.js 15**, **React 19**, **TypeScript**, **Tailwind CSS v4**, and **PostgreSQL** (via **Prisma**).

## Overview

Three user interfaces in a single app:

| Role | Routes | Description |
|---|---|---|
| **Admin** | `/admin/*`, `/login` | Create sessions, add participants, upload photos, manage voting lifecycle, view results |
| **Voter** | `/vote/[slug]` | Public — scan QR code, rate participants 1–10, submit once per device per session |
| **Display** | `/`, `/scoreboard`, `/ranking` | Private — live podium scoreboard with champion, top 3, and full ranking list |

## Architecture

```
Browser ──► Next.js App (Node.js 22)
              ├── App Router pages    (admin, vote, scoreboard, ranking)
              ├── API routes          (/api/health, /api/leaderboard, /api/photos)
              └── lib/store.ts        (data access layer)
                       │
              Prisma Client (lib/db.ts)
                       │
              PostgreSQL 16 (Docker)
```

- **Monolith**: Frontend + backend in a single Next.js deployable unit.
- **No separate API server**: All logic lives in Next.js server actions, API routes, and utility modules.
- **Dockerized**: App + PostgreSQL in one Compose stack, optional Nginx + Let's Encrypt.

## Tech Stack

| Category | Choice |
|---|---|
| Framework | Next.js 15.5.6 (App Router, Turbopack) |
| Language | TypeScript 5 |
| UI | React 19, Tailwind CSS v4 |
| Fonts | Manrope (sans), IBM Plex Mono (mono) via next/font |
| Database | PostgreSQL 16 (via `postgres:16-alpine`) |
| ORM | Prisma 6 + Prisma Client |
| Auth | bcryptjs (password hash), SHA-256 HMAC (session tokens), HTTP-only cookies |
| QR | `qrcode` npm package (server-side generation) |
| Container | Docker multi-stage build (`node:22-bookworm-slim`) |
| Proxy (opt.) | nginx-proxy + acme-companion (auto Let's Encrypt) |

## Project Structure

```
.
├── prisma/
│   └── schema.prisma              # Database schema (7 models, 1 enum)
├── public/
│   ├── Logo.png                   # Brand logo for scoreboard
│   └── photos/                    # Uploaded participant photos
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── admin/                 #   Admin pages & action routes
│   │   ├── api/                   #   JSON API routes (health, leaderboard, photos)
│   │   ├── auth/login/route.ts    #   Login form POST handler
│   │   ├── login/page.tsx         #   Login page
│   │   ├── logout/route.ts        #   Logout POST handler
│   │   ├── vote/[slug]/           #   Public voting pages & submit handler
│   │   ├── scoreboard/page.tsx    #   Podium scoreboard
│   │   ├── ranking/page.tsx       #   Full ranking list
│   │   ├── page.tsx               #   Home (scoreboard, admin-protected)
│   │   ├── layout.tsx             #   Root layout
│   │   ├── globals.css            #   Tailwind + custom dark theme
│   │   └── not-found.tsx          #   404 page
│   ├── components/
│   │   └── Scoreboard.tsx         # Client-side live scoreboard (auto-refresh)
│   ├── lib/
│   │   ├── auth.ts                # Admin auth (bcrypt, session tokens, cookies)
│   │   ├── db.ts                  # Prisma client singleton
│   │   ├── store.ts               # Data access layer (all DB queries)
│   │   └── photoMatching.ts       # Photo filename normalization
│   └── types/
│       └── qrcode.d.ts            # TypeScript declaration for qrcode
├── Dockerfile                     # Multi-stage Docker build
├── docker-compose.yml             # App + PostgreSQL stack
├── docker-compose.proxy.yml       # Optional Nginx + HTTPS layer
├── docker-entrypoint.sh           # Waits for DB, runs prisma db push, starts server
├── deploy.sh                      # One-command deployment script
└── .env.example                   # Environment variables template
```

## Database Schema

7 models in `prisma/schema.prisma`:

| Model | Purpose | Key Constraints |
|---|---|---|
| **Admin** | Single admin account | `username` unique |
| **AdminSession** | Login sessions (7-day expiry) | `tokenHash` unique; cascade delete on Admin |
| **Person** | Global participant registry | `normalizedName` unique |
| **Session** | Presentation voting session | `slug` unique; status in draft/live/closed |
| **SessionParticipant** | Links Person to Session | `[sessionId, personId]` unique; `[sessionId, displayOrder]` unique |
| **VoteSubmission** | One device's submission per session | `[sessionId, voterToken]` unique; `[sessionId, voterFingerprint]` unique |
| **Vote** | Individual score for one participant | Indexed on sessionId, participantId, personId, submissionId |

**SessionStatus enum**: `draft` → `live` → `closed`

## Routes

### Page Routes

| Path | Auth | Description |
|---|---|---|
| `/login` | None | Admin login form |
| `/admin` | Admin | Dashboard — create sessions, manage existing ones |
| `/admin/history` | Admin | View closed sessions |
| `/admin/sessions/[id]` | Admin | Session detail — QR code, participants, photo upload |
| `/admin/results/[id]` | Admin | Per-session leaderboard with scores |
| `/` | Admin | Home page (podium scoreboard) |
| `/scoreboard` | Admin | Podium scoreboard |
| `/ranking` | Admin | Full ranking list with scrollable table |
| `/vote/[slug]` | None | Public voting form |
| `/vote/[slug]/done` | None | "Thank you" confirmation |

### Action Routes (form POST handlers)

| Path | Method | Purpose |
|---|---|---|
| `/auth/login` | POST | Authenticate admin, set session cookie |
| `/logout` | POST | Destroy session, clear cookie |
| `/admin/sessions/create` | POST | Create a new session |
| `/admin/sessions/[id]/status` | POST | Update session status (draft/live/closed) |
| `/admin/sessions/[id]/participants` | POST | Add a participant |
| `/admin/sessions/[id]/participants/[pid]/delete` | POST | Remove a participant |
| `/admin/sessions/[id]/participants/[pid]/photo` | POST | Upload a participant photo |
| `/vote/[slug]/submit` | POST | Submit votes (with fairness enforcement) |

### API Routes (JSON)

| Path | Method | Auth | Purpose |
|---|---|---|---|
| `/api/health` | GET | None | Health check (DB connectivity + timestamp) |
| `/api/leaderboard` | GET | Admin cookie | Global leaderboard (all sessions aggregated) |
| `/api/photos` | GET | None | Photo index map (normalized name → URL path) |

## Authentication

Handled in `src/lib/auth.ts`.

- **Bootstrap**: On first use, a single admin account is upserted from `ADMIN_USERNAME` / `ADMIN_PASSWORD` env vars (password hashed with bcrypt cost 12).
- **Login**: Admin submits password → verified against bcrypt hash → random 32-byte token generated → SHA-256 HMAC-hashed (with `SESSION_SECRET` pepper) → stored in `AdminSession` table → raw token set as HTTP-only cookie (`ppt-admin-session`).
- **Validation**: Protected pages call `requireAdmin()` → reads cookie → hashes it → looks up in DB → checks expiry (7 days). Expired sessions are auto-deleted.
- **Logout**: POST to `/logout` → destroys session in DB → deletes cookie.

## Voting Fairness

Each device can vote once per session via two mechanisms:

1. **Voter cookie**: A per-session UUID (`vote-{slug}`) set on first submission. Subsequent submissions with the same cookie are rejected (unique constraint on `[sessionId, voterToken]`).
2. **Browser fingerprint**: SHA-256 hash of IP + User-Agent + Accept-Language. Unique constraint on `[sessionId, voterFingerprint]` prevents abuse even if cookies are cleared.

Votes are only accepted for sessions with `live` status.

## Scoreboard Component

`src/components/Scoreboard.tsx` — the main client-side display component:

- **Data sources** (in priority order):
  1. CSV URL (if `csvUrl` prop provided) — fetches and parses CSV
  2. Google Sheets API (if `apiKey` + `sheetId` + `range` provided)
  3. Internal API (`/api/leaderboard`) — defaults to global aggregation
- **Auto-refresh**: Polls every 10 seconds
- **Photo matching**: Fetches `/api/photos` → normalizes names → matches participant to photo
- **Ranking**: Standard competition ranking (ties share same rank, next rank skips ahead)
- **Rendering**: Champion card (gold), 2nd place (silver), 3rd place (bronze), plus optional scrollable ranking table

## Photo Handling

- Photos stored in `public/photos/` (mounted as a Docker volume for persistence)
- Upload via admin session page (multipart form POST to `/admin/sessions/[id]/participants/[pid]/photo`)
- Matching: participant names and photo filenames are normalized (strip spaces, dots, underscores, parentheses, hyphens) → matched via `/api/photos` index
- Supported formats: avif, gif, jpg, jpeg, png, webp
- On re-upload: old photos matching the same normalized name are automatically cleaned up

## Environment Variables

### Required

| Variable | Description |
|---|---|
| `DATABASE_URL` | Prisma connection string (used outside Docker) |
| `POSTGRES_DB` | PostgreSQL database name |
| `POSTGRES_USER` | PostgreSQL user |
| `POSTGRES_PASSWORD` | PostgreSQL password |
| `ADMIN_USERNAME` | Admin login username |
| `ADMIN_PASSWORD` | Admin login password |
| `SESSION_SECRET` | Pepper for session token hashing (min 32 chars, use random) |

### Optional

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `production` | Controls Prisma log level & cookie `secure` flag |
| `PORT` | `3000` | Internal port for Next.js server |
| `HOSTNAME` | `0.0.0.0` | Bind address |
| `APP_PORT_BIND` | `3000` | Host port mapping for Docker (use `127.0.0.1:3000` behind Nginx) |
| `PUBLIC_DOMAIN` | — | Domain for Nginx reverse proxy & HTTPS |
| `LETSENCRYPT_EMAIL` | — | Email for Let's Encrypt certificate registration |

## Local Development

### Option 1: Postgres in Docker, app locally

```bash
cp .env.example .env
docker compose up -d postgres
npm install
npm run prisma:push
npm run dev
```

### Option 2: Full stack in Docker

```bash
cp .env.example .env
docker compose up --build -d
```

App at `http://localhost:3000`.

### Useful Commands

```bash
npm run dev             # Start dev server with Turbopack
npm run build           # Build for production
npm run lint            # Run ESLint
npm run prisma:generate # Regenerate Prisma client after schema changes
npm run prisma:push     # Push schema to database (safe for prototyping)
```

## Docker Deployment

### Included files

| File | Purpose |
|---|---|
| `Dockerfile` | Multi-stage build (base → deps → builder → runner) |
| `docker-compose.yml` | App + PostgreSQL services |
| `docker-compose.proxy.yml` | Nginx + Let's Encrypt proxy stack |
| `docker-entrypoint.sh` | Startup script (retries DB, runs `prisma db push`, starts server) |
| `deploy.sh` | One-command deploy (validates env, builds, starts stacks) |
| `.dockerignore` | Excludes build artifacts from Docker context |

### Docker Compose services

- **postgres**: PostgreSQL 16 Alpine, 768MB mem limit, named volume for persistence, health check via `pg_isready`
- **app**: Next.js standalone build, 768MB mem limit, 512MB Node.js heap, health check via `/api/health`
- **nginx-proxy** (optional): Reverse proxy on ports 80/443
- **letsencrypt** (optional): Auto SSL certificate management

The default Compose profile is tuned for a **2 GB VPS** (100+ concurrent voters).

### Production Deployment

```bash
# 1. Prepare server (Ubuntu/Debian, Docker, ports 80/443 open)

# 2. Copy project and configure
cp .env.production.example .env
# Edit .env: POSTGRES_PASSWORD, ADMIN_PASSWORD, SESSION_SECRET,
#            PUBLIC_DOMAIN, LETSENCRYPT_EMAIL

# 3. Deploy
mkdir -p public/photos
chmod +x deploy.sh
./deploy.sh
```

### With HTTPS

Set `PUBLIC_DOMAIN` and `LETSENCRYPT_EMAIL` in `.env`. The `deploy.sh` script automatically includes the proxy stack. DNS must already point to the server.

### Without Domain

Leave `PUBLIC_DOMAIN` and `LETSENCRYPT_EMAIL` empty — `deploy.sh` starts only the app + database.

## Production Considerations

- **Backups**: Use managed PostgreSQL backups or automate `pg_dump`.
- **Photos**: For multi-node deployments, move photos to object storage (S3-compatible).
- **Rate limiting**: Consider adding rate limiting on `/vote/[slug]/submit` for production events.
- **Audit logging**: No admin action logging exists yet.
- **Secrets**: Rotate `SESSION_SECRET` and `ADMIN_PASSWORD` periodically.
- **HTTPS**: Always terminate TLS at the reverse proxy (included proxy stack does this).
- **Tests**: No test suite exists — manual testing only.

## License

Private project — internal use.
