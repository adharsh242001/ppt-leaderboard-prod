# PPT Leaderboard — System Design & Scalability Analysis

## 1. Current Architecture (Baseline)

```
[Voters] ──HTTPS──> Vercel Edge ──> Next.js Serverless Functions
                                          │
                                     ┌────┴────┐
                                     │ Prisma  │
                                     │  ORM    │
                                     └────┬────┘
                                          │
                              Supabase pgBouncer :6543
                                          │
                              ┌───────────┴───────────┐
                              │  Postgres (DB)        │
                              │  Storage (photos)     │
                              └───────────────────────┘
```

**Components:** All-in-one Next.js 15.5 monolith (App Router), Prisma 6 ORM, Supabase Postgres + Storage, Vercel serverless.

---

## 2. Issues Found

### Issue 1: No caching layer — every page load hits the database

Every vote page load, results page load, and scoreboard poll runs a full DB query. Under 100 concurrent voters + scoreboard polling, the DB gets unnecessary load.

**Affected queries:**
- `getSessionBySlug()` — every vote page load
- `getSessionLeaderboard()` — every results page + scoreboard poll
- `getGlobalLeaderboard()` — global scoreboard
- `getParticipantPhotoUrl()` — Supabase Storage `list()` on every session/results page
- `requireAdmin()` / `isValidAdminSession()` — every admin page load

**Without caching:** 100 voters × 2 queries each (session + submit) + 10 scoreboard polls/s = ~210 DB calls/sec minimum. With Supabase Free's 10 connection pool, queries queue and slow down.

### Issue 2: Scoreboard polls the DB every 10 seconds

The Scoreboard component (`src/components/Scoreboard.tsx:251-287`) calls `/api/leaderboard` every 10s, which runs a `groupBy` aggregation on the entire `Vote` table. As vote counts grow (1000s), this aggregation gets slower and more expensive.

### Issue 3: Vote aggregation queries scan the full table

`getGlobalLeaderboard()` and `getSessionLeaderboard()` (`src/lib/store.ts:568-619`) use Prisma `groupBy` which does a full table scan on `Vote`. No materialized view, summary table, or index-only scan.

### Issue 4: No rate limiting on vote submission

The vote submit route (`src/app/vote/[slug]/submit/route.ts`) has no rate limiting. A malicious voter could spam the submit endpoint and exhaust the connection pool.

### Issue 5: Admin session check on every request

`requireAdmin()` queries the `AdminSession` table on every page load (`src/lib/auth.ts:107-113`). For pages like the admin dashboard that show session lists, this adds an extra query per load.

### Issue 6: Photos served without CDN caching

Supabase Storage URLs from `getPublicUrl()` have no CDN cache headers by default. Each photo load hits Supabase's origin, not an edge cache.

### Issue 7: No vote idempotency key

The vote submit uses `voterToken` (cookie) + `voterFingerprint` (device fingerprint) for dedup. If the cookie is missing on first request (new voter), a new token is generated and the vote goes through — but if the redirect after vote fails, the voter might resubmit and get "already voted".

### Issue 8: Leaderboard data mixed with admin logic in a single store

`src/lib/store.ts` (620 lines) bundles session management, vote processing, participant management, and leaderboard queries. No separation of read models vs write models (CQRS).

---

## 3. Scalable Architecture (Target)

```
                           ┌──────────┐
                           │  Voters   │
                           └─────┬────┘
                                 │ HTTPS
                    ┌────────────┴────────────┐
                    │   Vercel Edge Network    │
                    │   - CDN (static assets)  │
                    │   - Rate limiting (edge) │
                    └────────────┬────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
     ┌────────┴────────┐  ┌─────┴──────┐  ┌────────┴────────┐
     │ Vote Submit API │  │  Read API  │  │   Admin API     │
     │ (write-optimized)│  │(cache-first)│  │ (session mgmt) │
     └────────┬────────┘  └─────┬──────┘  └────────┬────────┘
              │                 │                   │
              │           ┌─────┴──────┐            │
              │           │   Redis    │            │
              │           │  (cache)   │            │
              │           └─────┬──────┘            │
              │                 │                   │
              ├─────────────────┼───────────────────┘
              │                 │
     ┌────────┴────────┐       │
     │  Vote Queue     │       │
     │  (pg notify /   │       │
     │   BullMQ/Redis) │       │
     └────────┬────────┘       │
              │                 │
     ┌────────┴────────┐       │
     │ Vote Worker     │       │
     └────────┬────────┘       │
              │                 │
              └──────┬──────────┘
                     │
          ┌──────────┴──────────┐
          │   Supabase          │
          │   - Postgres (DB)   │
          │   - Storage (CDN)   │
          └─────────────────────┘
```

### 3a. Components

| Component | Responsibility | Technology |
|-----------|---------------|------------|
| **Vote Page** | Renders the voting form (RSC) | Next.js server component |
| **Vote Submit API** | Accepts votes, validates, enqueues | Next.js route handler + BullMQ |
| **Vote Worker** | Processes votes from queue, writes to DB | Node.js worker (separate process or cron) |
| **Read API** | Serves leaderboard, session data (cache-first) | Next.js route handler + Redis |
| **Scoreboard SSE** | Pushes live scoreboard updates via Server-Sent Events | Next.js route handler |
| **Admin Console** | Session CRUD, QR generation, photo upload | Next.js server components |
| **Redis** | Cache leaderboard aggregation, session data, rate limit counters | Upstash Redis (serverless) |
| **Photo CDN** | Cache photo responses at edge | Supabase Storage + Vercel Edge |

### 3b. Data Flow

**Vote Submission (write path):**
```
Voter → Vote Submit API → Validate session → Enqueue to BullMQ
    → Vote Worker dequeues → Prisma transaction → Invalidate leaderboard cache → Acknowledge
```

**Leaderboard Read (read path):**
```
Scoreboard → Read API → Check Redis cache
    ─ Cache hit → Return cached data
    ─ Cache miss → Query Postgres groupBy → Store in Redis (TTL: 5s) → Return data
```

**Photo Serving:**
```
Scoreboard → Img tag → Supabase Storage Public URL
    → Vercel Edge Cache (Cache-Control: public, max-age=31536000, immutable)
```

### 3c. Trade-offs

| Approach | Pro | Con |
|----------|-----|-----|
| Redis cache for leaderboard | 10-50x faster reads, reduces DB load | Stale data up to TTL; extra infra cost |
| BullMQ vote queue | Smooths write spikes, never lose votes | Adds latency (queue → worker → DB); more moving parts |
| SSE instead of polling | Real-time updates, fewer requests | Requires persistent connection; harder to scale horizontally |
| Materialized view for leaderboard | Aggregation pre-computed, instant reads | Needs refresh after each vote; extra storage |
| CQRS (separate read/write models) | Read queries never block writes | Code complexity; eventual consistency |
| Rate limiting (Upstash) | Protects against abuse | Extra API call per request; cost at scale |
| Photo CDN caching | Fast photo loads globally | Cache invalidation on photo change |

---

## 4. Priority Recommendations

### P0 — Must fix for 100 concurrent voters

1. **Add database indexes** to prevent full table scans:
   ```sql
   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vote_session_person
     ON "Vote" (session_id, person_id);
   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vote_submission_session
     ON "VoteSubmission" (session_id, voter_token);
   ```

2. **Rate limit the vote submit endpoint** using Supabase's built-in `pg_net` or Vercel Edge middleware with Upstash.

3. **Add Redis caching for leaderboard queries** — cache `getSessionLeaderboard` results with 5s TTL. This drops 90% of DB reads.

### P1 — Important for production reliability

4. **Use materialized view for live leaderboard** — refresh on every vote insert via Supabase pg_cron.

5. **Replace scoreboard polling with SSE** — server pushes updates when votes arrive instead of clients polling.

6. **Set Supabase Storage CDN cache headers** — make photos cacheable at edge.

### P2 — Nice to have

7. **Separate vote processing into a queue** (BullMQ + Upstash Redis) — adds ~100ms latency per vote but guarantees no data loss under extreme load.

8. **Implement CQRS** — separate read-optimized schema (leaderboard summaries) from write-optimized schema (vote records).

---

## 5. Current Code Issues (Specific)

| File | Line(s) | Issue | Fix |
|------|---------|-------|-----|
| `src/lib/store.ts` | 568-619 | Full `groupBy` scan every call | Add index `(session_id, person_id)` + Redis cache |
| `src/lib/store.ts` | 274-511 | Transactions in `$transaction` with serializable checks | Already correct, but add `pool_timeout` config |
| `src/components/Scoreboard.tsx` | 251-287 | Polls every 10s regardless of data changes | Replace with SSE or increase to 30s with cache |
| `src/app/admin/sessions/[id]/page.tsx` | 52-58 | Calls `getParticipantPhotoUrl` per participant (list API) | Cache photo index or use direct URL |
| `src/app/api/leaderboard/route.ts` | 10-12 | Session check queries DB on every poll | Cache admin token validity (check once per minute) |
| `src/app/vote/[slug]/submit/route.ts` | 12-68 | No rate limiting | Add Upstash rate limiter in middleware |
| `prisma/schema.prisma` | 93-110 | No composite indexes on Vote table | Add `@@index([sessionId, personId])` and `@@index([sessionId, score])` |

---

## 6. Database Indexing Plan

```prisma
model Vote {
  // ... existing fields

  @@index([sessionId, personId])       // leaderboard aggregation
  @@index([sessionId, score])          // score-based queries
  @@index([personId])                  // per-person queries
  @@index([submissionId])              // submission lookup
}

model VoteSubmission {
  // ... existing fields

  @@index([sessionId, createdAt])      // submission history
}

model Session {
  // ... existing fields

  @@index([status, createdAt])         // session listing
}
```

Current schema has basic indexes. Adding composite indexes for the `groupBy` queries reduces query time from full-scan to index-only scan — ~100x faster on a table with 10,000+ votes.

---

## 7. Monitoring & Observability

| Metric | Tool | Alert threshold |
|--------|------|-----------------|
| Vote submission latency | Vercel Functions logs | > 2s p95 |
| Leaderboard query time | Prisma query logging | > 500ms |
| Connection pool utilization | Supabase dashboard | > 80% |
| Vote queue depth | BullMQ dashboard (if implemented) | > 100 |
| Photo upload failures | Vercel Functions logs | Any failure |
