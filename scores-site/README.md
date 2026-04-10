# PPT Leaderboard

This is a Next.js presentation voting and leaderboard app for PPT events.

It now supports:
- private admin session management
- public QR-based voting pages for each presentation
- a private podium screen
- a private full ranking screen
- automatic participant photo matching from `public/photos`
- one submission per device per session using a cookie token plus a lightweight hashed IP/device fingerprint

## Main Flow

1. Sign in to the admin area at `/login`.
2. Create a presentation session in `/admin`.
3. Add participants to that session.
4. Open voting for that session.
5. Show the generated QR code to the audience.
6. Audience votes on the public session page.
7. Private podium and ranking pages update from the stored votes.

## Routes

Private:
- `/admin`
- `/admin/sessions/[id]`
- `/`
- `/scoreboard`
- `/ranking`

Public:
- `/vote/[slug]`
- `/vote/[slug]/done`

Auth:
- `/login`
- `/logout`

## Data Storage

App data is stored locally in:

`data/app-data.json`

This file stores:
- sessions
- people
- session participants
- votes

## Vote Fairness

Each session allows one submission per device.

The app checks two things:
- a per-session cookie token
- a lightweight hashed device fingerprint built from IP address + browser headers

This is intentionally simple and practical, not bank-grade anti-fraud, but it helps prevent easy repeat submissions from the same device.

## Photo Matching

Participant photos are resolved automatically from `public/photos`.

Matching rules:
- lowercase names
- remove spaces
- remove `.`, `_`, `-`, `(`, `)`

Examples:
- `Rahul` matches `Rahul.JPG`
- `Abin Sheen` matches `abinsheen.jpg`
- `Midhun K` matches `midhun-k.png`

If no photo matches, the UI shows initials.

## Important Environment Variables

Set these before real use:

- `ADMIN_PASSWORD`
- `SESSION_SECRET`

If not set, local fallbacks are used for development.

## Local Development

Run commands from this folder:

```bash
cd scores-site
npm install
npm run dev
```

Open `http://localhost:3000`.

## Useful Commands

```bash
npm run dev
npm run lint
npm run build
npm run start
```

## Notes

- This app is built for a large-screen presentation environment.
- The audience should only access the public `/vote/[slug]` pages.
- Admin, podium, and overall ranking pages are private.
