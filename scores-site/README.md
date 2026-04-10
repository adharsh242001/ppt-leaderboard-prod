# PPT Leaderboard

This is a Next.js presentation leaderboard for PPT events.

It shows a live ranking screen that:
- reads participant scores from a Google Sheets CSV
- refreshes automatically every 10 seconds
- ranks people by total score
- highlights the top 3 like an awards board
- shows participant photos when matching images exist in `public/photos`
- falls back to initials when no matching photo is found

## How It Works

The app renders the same live board on:
- `/`
- `/scoreboard`

The main UI lives in `src/components/Scoreboard.tsx`.

Score data is fetched in the browser from the configured Google Sheets CSV URL.

Photos are indexed by the API route in `src/app/api/photos/route.ts`, which:
- scans `public/photos`
- accepts common image file types like `jpg`, `jpeg`, `png`, `webp`, `gif`, `avif`
- normalizes filenames
- returns a map the UI can use for avatar matching

Name matching logic lives in `src/lib/photoMatching.ts`.

## Photo Matching

Photos do not need a hardcoded map anymore.

The app matches a participant name from the sheet to a filename in `public/photos` by normalizing both values:
- lowercase
- remove spaces
- remove `.`, `_`, `-`, `(`, `)`

Examples:
- `Rahul` matches `Rahul.JPG`
- `Abin Sheen` matches `abinsheen.jpg`
- `Midhun K` matches `midhun-k.png`

If no photo matches, the app shows initials instead.

## Update Flow

To update the leaderboard for a new event:

1. Update names and scores in the Google Sheet.
2. Add or replace participant photos in `public/photos`.
3. Keep filenames close to participant names.
4. Reload the board if needed, or wait for the next auto-refresh.

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

## Current Configuration

The board is currently configured directly in:
- `src/app/page.tsx`
- `src/app/scoreboard/page.tsx`

Both currently pass:
- title: `PPT Leaderboard`
- logo: `/Logo.png`
- brand color: `#b85d32`
- a published Google Sheets CSV URL

## Notes

- This app is designed to be shown on a large screen during presentations.
- The visual design is optimized as a live awards-style scoreboard, not a typical content website.
- If multiple photo files normalize to the same name, the API keeps the first sorted file and ignores the rest.
