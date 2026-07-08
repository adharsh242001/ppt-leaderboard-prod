# Setup Guide: Run Locally + Deploy to Vercel & Supabase

This guide walks you through two paths:

- **Local test run** — get the app running on your machine in 5 minutes
- **Vercel + Supabase deploy** — production hosting (free tier)

---

## Prerequisites

| Tool | Why | Install |
|---|---|---|
| Node.js 22+ | Runtime | [nodejs.org](https://nodejs.org) |
| Docker | Local Postgres | [docker.com](https://docker.com) |
| Git | Version control | [git-scm.com](https://git-scm.com) |

---

## 1. Quick Local Test Run

### 1.1 Clone and enter the project

```bash
git clone <your-repo-url>
cd ppt-leaderboard-prod
```

### 1.2 Create environment file

```bash
cp .env.example .env
```

Open `.env` and set at minimum:

```
ADMIN_PASSWORD=test123
SESSION_SECRET=my-local-dev-secret-key-change-me
```

For local dev you can leave `DATABASE_URL` as-is (it points to `localhost`).

### 1.3 Start the database

```bash
docker compose up -d postgres
```

This starts PostgreSQL in a container. It takes about 10 seconds to be ready.

### 1.4 Install dependencies

```bash
npm install
```

This also runs `prisma generate` automatically (via `postinstall` script).

### 1.5 Push the database schema

```bash
npm run prisma:push
```

Creates all 7 tables in your local Postgres.

### 1.6 Start the dev server

```bash
npm run dev
```

### 1.7 Open and test

| URL | What you see |
|---|---|
| `http://localhost:3000` | Redirected to `/login` |
| `http://localhost:3000/login` | Admin login form |
| `http://localhost:3000/api/health` | `{"ok":true,"database":"connected",...}` |

**Login**: Enter the password you set in `.env` (`ADMIN_PASSWORD`). Default: `test123`.

### 1.8 Quick functional test

Once logged in:

1. Create a session — type a title, click **Create**
2. Add participants — type names, click **Add** (try "Alice", "Bob", "Charlie")
3. Open voting — click **Go live**
4. Open the voting page in a private/incognito window: `http://localhost:3000/vote/{slug}` (slug is shown on the session page)
5. Submit votes for each participant
6. Check the scoreboard at `http://localhost:3000/scoreboard`
7. Close voting — click **Close**

---

## 2. Deploy to Vercel + Supabase (Free Tier)

### Architecture

```
Users ──► Vercel (Next.js app)
               │
       ┌───────┼───────┐
       ▼               ▼
  Supabase          Supabase
  PostgreSQL        Storage
  (data)            (photos)
```

---

### 2.1 Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click **New project**
3. Fill in:
   - **Name**: `ppt-leaderboard` (or anything)
   - **Database password**: generate a strong one, **save it**
   - **Region**: pick one close to your audience
4. Wait ~2 minutes for the project to provision

### 2.2 Get Supabase credentials

Once the project is ready:

**Database URL:**
- Go to **Project Settings → Database → Connection string**
- Select **URI**
- Copy the full URI. It looks like:
  ```
  postgresql://postgres:xxxxx@db.xxxxx.supabase.co:5432/postgres
  ```
- If you will deploy to Vercel, append `?pgbouncer=true` to use connection pooling:
  ```
  postgresql://postgres:xxxxx@db.xxxxx.supabase.co:5432/postgres?pgbouncer=true
  ```

**API credentials:**
- Go to **Project Settings → API**
- Copy these two values:
  - **Project URL** → this is your `NEXT_PUBLIC_SUPABASE_URL`
  - **service_role key** → this is your `SUPABASE_SERVICE_ROLE_KEY` (click **Copy**)

> **IMPORTANT**: The `service_role` key is a secret. Never expose it in frontend code. It's only used server-side (in API routes), so Vercel is safe.

### 2.3 Create the Storage bucket

1. Go to **Storage** in the Supabase dashboard
2. Click **New bucket**
3. Name: `photos` (must match exactly)
4. Check **Public bucket** (so photo URLs are accessible without auth)
5. Click **Create bucket**

### 2.4 Push the database schema to Supabase

You need to run this locally with your Supabase connection string:

```bash
# Set the Supabase DATABASE_URL temporarily
DATABASE_URL="postgresql://postgres:your-password@db.xxxxx.supabase.co:5432/postgres" npx prisma db push
```

This creates all 7 tables in your Supabase Postgres instance.

> **Troubleshooting**: If Prisma times out, add `?pgbouncer=true` and `&connection_limit=1` to the URL.

---

### 2.5 Push your code to GitHub

```bash
git add .
git commit -m "add Supabase Storage support for Vercel deployment"
git push
```

> The repo already has the Supabase Storage code changes (photo upload and photo API routes).

---

### 2.6 Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **Add New → Project**
3. Import your GitHub repo
4. Vercel auto-detects Next.js — leave the default settings

### 2.7 Set environment variables on Vercel

In the Vercel project dashboard, go to **Settings → Environment Variables** and add these:

| Variable | Value | Where to get it |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:...@db.xxxxx.supabase.co:5432/postgres?pgbouncer=true` | Supabase → Project Settings → Database → URI |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxxx.supabase.co` | Supabase → Project Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJIUzI1NiIs...` | Supabase → Project Settings → API → service_role key |
| `ADMIN_USERNAME` | `admin` | Your choice |
| `ADMIN_PASSWORD` | `your-strong-password` | Your choice (use a strong one) |
| `SESSION_SECRET` | `a-random-string-at-least-32-chars-long` | Generate: `openssl rand -hex 32` |

Set all of them for **Production** (and optionally Preview/Development).

> **Do NOT set** `NODE_ENV` — Vercel handles this automatically.
> **Do NOT set** `POSTGRES_*` vars — those are only for the Docker setup.

### 2.8 Deploy

Click **Deploy**. Wait ~2 minutes for the build.

---

### 2.9 Verify the deployment

Once deployed, Vercel gives you a URL like `https://ppt-leaderboard.vercel.app`.

Run through these checks:

**1. Health check**
```bash
curl https://your-app.vercel.app/api/health
```
Expected:
```json
{"ok":true,"service":"ppt-leaderboard","database":"connected","timestamp":"..."}
```

**2. Login page loads**
Open `https://your-app.vercel.app/login` — you should see the login form.

**3. Login works**
Enter your admin password — you should be redirected to `/admin`.

**4. Create a session**
Type a title and click **Create**.

**5. Add participants**
Type names and click **Add**.

**6. Upload a photo**
- Click **Choose file** next to a participant
- Select a `.jpg` or `.png` image
- Click **Upload photo**
- The photo is stored in Supabase Storage (check your Storage bucket in the Supabase dashboard)

**7. Open voting**
Click **Go live**.

**8. Vote**
Open `https://your-app.vercel.app/vote/{slug}` in a private/incognito window. Rate participants and submit.

**9. Scoreboard**
Open `https://your-app.vercel.app/scoreboard` — you should see the champion and rankings updating.

---

## 3. Alternative: Deploy on a VPS with Docker

If you prefer not to use Vercel, the project still supports Docker-based deployment on any Linux VPS.

```bash
# Copy the production env template
cp .env.production.example .env

# Edit .env with your values
#   POSTGRES_PASSWORD, ADMIN_PASSWORD, SESSION_SECRET
#   PUBLIC_DOMAIN (if using a domain)
#   LETSENCRYPT_EMAIL (if using HTTPS)

# Deploy
mkdir -p public/photos
chmod +x deploy.sh
./deploy.sh
```

See the [README.md](./README.md) for full Docker deployment details.

---

## Troubleshooting

### Build fails on Vercel

**"Cannot find module '@supabase/supabase-js'"**
→ Make sure `npm install` ran. Check that `@supabase/supabase-js` is in `package.json` under `dependencies` (not `devDependencies`).

**"PrismaClientInitializationError"**
→ Your `DATABASE_URL` is wrong. Go to Supabase → Project Settings → Database → URI and copy the full string. Make sure the password is correct.

### Login redirects back to /login

Either:
- Wrong `ADMIN_PASSWORD` — check the env var on Vercel
- `SESSION_SECRET` is missing — the session token can't be hashed properly
- The database isn't connected — check `/api/health`

### Photo upload redirects but nothing appears

- Check if the Storage bucket exists (name: `photos`, must be **public**)
- Check `SUPABASE_SERVICE_ROLE_KEY` is set correctly
- Check Vercel function logs for Supabase errors

### Viewing logs on Vercel

In the Vercel dashboard:
- Go to your project → **Deployments**
- Click the latest deployment
- Click **Functions** → select a function → **Logs**

---

## Reference: Key Files Changed for Supabase Storage

| File | Purpose |
|---|---|
| `src/lib/supabase.ts` | Supabase admin client (singleton) |
| `src/app/.../photo/route.ts` | Upload handler — uses `supabase.storage.upload()` |
| `src/app/api/photos/route.ts` | Photo index — uses `supabase.storage.list()`, returns public URLs |
| `next.config.ts` | Added `images.remotePatterns` for `*.supabase.co` |

Everything else (scoreboard, voting, auth, admin pages) is unchanged.
