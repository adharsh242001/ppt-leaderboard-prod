# Hosting & Test-Run Guide

## 1. Quick Test Run (Local Development)

### Prerequisites

- Node.js 22+
- Docker (for the database)
- npm

### Steps

```bash
# 1. Clone and enter the project
git clone <repo-url>
cd ppt-leaderboard-prod

# 2. Create env file
cp .env.example .env

# 3. Start PostgreSQL in Docker
docker compose up -d postgres

# 4. Install dependencies
npm install

# 5. Push the database schema
npm run prisma:push

# 6. Start the dev server
npm run dev
```

Open `http://localhost:3000` — you'll be redirected to `/login`. The default admin password is whatever you set in `.env` (template default: `replace-with-a-strong-admin-password`).

### Quick Smoke Test

```bash
# Health check
curl http://localhost:3000/api/health

# Should return: {"ok":true,"database":"connected",...}
```

---

## 2. Host on a VPS with Docker (Recommended)

This is the intended production path — runs on any Linux VPS with Docker. The stack includes a reverse proxy with auto HTTPS.

### Requirements

- Linux VPS (Ubuntu/Debian) with **at least 2 GB RAM**
- Docker & Docker Compose installed
- Ports **80** and **443** open (for HTTPS)
- A domain name pointing to the server (optional but recommended)

### Setup

```bash
# 1. Copy project to server (git clone or rsync)

# 2. Create production env file
cp .env.production.example .env

# 3. Edit .env — set these:
#    - POSTGRES_PASSWORD    (strong, random)
#    - ADMIN_PASSWORD       (strong, random)
#    - SESSION_SECRET       (at least 32 random characters)
#    - PUBLIC_DOMAIN        (e.g., leaderboard.example.com)
#    - LETSENCRYPT_EMAIL    (your email for cert notifications)

# 4. Create photos directory
mkdir -p public/photos

# 5. Run the deploy script
chmod +x deploy.sh
./deploy.sh
```

### Without a Domain

Leave `PUBLIC_DOMAIN` and `LETSENCRYPT_EMAIL` empty in `.env`. The deploy script starts only the app + database stack. Access via `http://<server-ip>:3000`. No HTTPS — use only for testing or LAN events.

### Useful Commands

```bash
# Check container status
docker compose ps

# View app logs
docker compose logs app --tail 100

# View database logs
docker compose logs postgres --tail 100

# Restart app only (quick, doesn't rebuild)
docker compose restart app

# Full rebuild and restart
docker compose up --build -d

# Stop everything
docker compose down
```

### Update to a New Version

```bash
git pull                      # pull latest code
docker compose down           # stop current stack
./deploy.sh                   # rebuild and deploy
```

---

## 3. Host on Vercel

Vercel hosting is possible with changes — see the table below.

### Vercel Compatibility

| Feature | Works? | Notes |
|---|---|---|
| Pages (admin, vote, display) | Yes | All Next.js App Router pages deploy as-is |
| API routes | Yes | `/api/*`, `/auth/*`, `/admin/*/route.ts` all work |
| Form POST handlers | Yes | Server Actions in route handlers |
| Prisma + PostgreSQL | Yes | Use Vercel Postgres, Neon, or Supabase |
| Authentication (cookies + bcrypt) | Yes | Works in serverless functions |
| QR code generation | Yes | Pure JS, no native deps |
| **Photo upload** | **No** | Writes to local filesystem — **not available on serverless** |
| **Photo API** (`/api/photos`) | **No** | Uses `readdir` on local filesystem — **not available on serverless** |

### Changes Needed for Vercel

#### 1. Database

Provision a hosted PostgreSQL:

| Provider | Free tier | Notes |
|---|---|---|
| Vercel Postgres | 256 MB | Simplest — same dashboard as hosting |
| Neon | 500 MB | Serverless, auto-pause |
| Supabase | 500 MB | Includes dashboard, auth, storage |

Set `DATABASE_URL` in Vercel project env vars to the connection string.

#### 2. Photo Storage — Replace Filesystem with Vercel Blob

Three files need modification:

**`src/app/admin/sessions/[id]/participants/[participantId]/photo/route.ts`**

Replace filesystem `writeFile` / `readdir` / `rm` with blob upload. Using Vercel Blob:

```ts
import { put, list, del } from "@vercel/blob";
// ... validate file ...
const blob = await put(`photos/${fileName}`, file, {
  access: "public",
});
```

**`src/app/api/photos/route.ts`**

Replace `readdir` with `list()` from `@vercel/blob`:

```ts
import { list } from "@vercel/blob";
const { blobs } = await list({ prefix: "photos/" });
// map blob.url to normalized names
```

**`src/components/Scoreboard.tsx`**

No code change needed — it already fetches `/api/photos` and uses the returned URL map. The URLs will point to Vercel Blob instead of local paths.

Install the blob package:

```bash
npm install @vercel/blob
```

Set `BLOB_READ_WRITE_TOKEN` in Vercel env vars (auto-added when you enable Vercel Blob in the dashboard).

#### 3. Vercel Configuration

No special `vercel.json` needed — the Next.js config is compatible. Just:

1. Connect your Git repo in Vercel dashboard
2. Set all environment variables (see table below)
3. Deploy

### Environment Variables on Vercel

Set these in the Vercel project dashboard (Settings → Environment Variables):

| Variable | Source |
|---|---|
| `DATABASE_URL` | Your hosted PostgreSQL connection string |
| `ADMIN_USERNAME` | Your chosen admin username |
| `ADMIN_PASSWORD` | Your chosen admin password |
| `SESSION_SECRET` | Random 32+ char string |
| `BLOB_READ_WRITE_TOKEN` | Auto-added when Vercel Blob is enabled |

**Do not set** `NODE_ENV` — Vercel sets it automatically. `POSTGRES_*` vars are only for Docker and can be omitted.

### Vercel Limitations

- **No persistent filesystem** — photos must use blob/object storage
- **Serverless timeout** — 60s max on Hobby, 300s on Pro (not an issue for this app)
- **Edge runtime** — Not suitable (uses Prisma, bcrypt, Node.js APIs)
- **Cold starts** — First request after inactivity may be slow

---

## Comparison Summary

| Factor | Docker VPS | Vercel |
|---|---|---|
| Setup complexity | Medium | Low (after code changes) |
| Cost | ~$6–12/mo (2GB VPS) | Free tier sufficient |
| Maintenance | You manage server, updates, backups | Zero maintenance |
| HTTPS | Included (auto Let's Encrypt) | Included (automatic) |
| Photo storage | Local disk (Docker volume) | Vercel Blob (S3) |
| Scalability | Single node, 100+ concurrent voters | Auto-scaling |
| Cold starts | None (always running) | Yes (first request slow) |
| Custom domain | Yes | Yes |

### Recommendation

- **For live events with photos**: Use the Docker VPS path — it's the intended setup, zero code changes, and photos work out of the box.
- **For a quick test or no-photo deployment**: Vercel works well after the blob storage changes.
- **For a LAN / local event**: Just run locally with `npm run dev` — no server needed.
