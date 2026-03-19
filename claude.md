# Filteral.app - Context for Claude

## Project Overview
Filteral.app is a daily recommendation platform that aggregates personalized content from multiple video/social platforms (Bilibili, YouTube, Reddit, X/Twitter) using AI-powered recommendation algorithms and user persona analysis.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              GOOGLE CLOUD                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────┐         ┌─────────────────────┐                   │
│  │   Cloud Run (Web)   │         │  Cloud Run (Worker) │                   │
│  │   Next.js 16        │ ──────► │  Python FastAPI     │                   │
│  │   Port 3000         │   HTTP  │  Port 3001          │                   │
│  │                     │         │  + Playwright       │                   │
│  └──────────┬──────────┘         └─────────────────────┘                   │
│             │                                                               │
│             │ Prisma                                                        │
│             ▼                                                               │
│  ┌─────────────────────┐                                                   │
│  │   Neon PostgreSQL   │                                                   │
│  │   (Serverless)      │                                                   │
│  └─────────────────────┘                                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

External Services:
├── OpenAI API (GPT-4o-mini) - AI recommendation selection
├── YouTube Data API v3 - YouTube subscriptions & videos
├── Bilibili (via Playwright) - Browser automation for login & data
├── Reddit JSON API - Public post fetching
├── Nitter instances - X/Twitter scraping
└── Zoho SMTP - Email delivery
```

---

## Tech Stack

### Web Service (Next.js)
- **Framework**: Next.js 16 (App Router), React 19
- **Language**: TypeScript
- **Styling**: Tailwind CSS, Shadcn/ui components
- **Auth**: NextAuth.js v5 (credentials + OAuth)
- **ORM**: Prisma
- **Deployment**: Google Cloud Run

### Worker Service (Python)
- **Framework**: FastAPI
- **Browser Automation**: Playwright (Chromium)
- **Language**: Python 3.12
- **Deployment**: Google Cloud Run (with Playwright dependencies)

### Database
- **Provider**: Neon (Serverless PostgreSQL)
- **Connection**: Pooled connections via Prisma

### AI
- **Provider**: OpenAI
- **Model**: GPT-4o-mini
- **Usage**: Persona analysis, recommendation ranking, search query generation

---

## Deployment Configuration

### Google Cloud Run Settings

**Web Service:**
- Container port: 3000
- Memory: 512MB - 1GB
- CPU: 1
- Request timeout: 300s (for long generation requests)
- Min instances: 0 (scale to zero)
- Max instances: 10

**Worker Service:**
- Container port: 3001
- Memory: 2GB (Playwright needs memory)
- CPU: 2 (Playwright is CPU-intensive)
- Request timeout: 600s (Playwright operations are slow)
- Min instances: 1 (keep warm for faster response)
- Max instances: 5

### Environment Variables

**Web (.env):**
```
DATABASE_URL=postgresql://...@neon.tech/neondb
NEXTAUTH_SECRET=...
NEXTAUTH_URL=https://filteral.app
OPENAI_API_KEY=sk-...
WORKER_URL=https://worker-xxx.run.app
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
SMTP_HOST=smtp.zoho.com
SMTP_USER=hello@filteral.app
SMTP_PASS=...
```

**Worker (.env):**
```
OPENAI_API_KEY=sk-...
```

### Timeout Configuration

The worker-client has specific timeouts for different operations:
- Default: 120 seconds (2 minutes)
- Bilibili: 300 seconds (5 minutes) - Playwright is slow
- Reddit/X: 120 seconds

---

## Project Structure

```
daily-recommend/
├── web/                          # Next.js frontend + API
│   ├── src/
│   │   ├── app/                  # App Router pages
│   │   │   ├── (auth)/          # Auth pages (login, register, etc.)
│   │   │   ├── (dashboard)/     # Dashboard pages (protected)
│   │   │   └── api/             # API routes
│   │   ├── components/          # React components
│   │   │   ├── ui/              # Shadcn/ui components
│   │   │   └── dashboard/       # Dashboard-specific components
│   │   └── lib/                 # Utilities
│   │       ├── auth.ts          # NextAuth configuration
│   │       ├── db.ts            # Prisma client
│   │       ├── worker-client.ts # HTTP client for worker
│   │       ├── email.ts         # Email templates & sending
│   │       ├── email-scheduler.ts # Cron job for daily emails
│   │       └── generate-recommendations.ts # Shared generation logic
│   └── prisma/
│       └── schema.prisma        # Database schema
│
├── worker/                       # Python FastAPI worker
│   ├── app.py                   # FastAPI server & endpoints
│   ├── services/
│   │   ├── base.py              # Base service class
│   │   ├── bilibili.py          # Bilibili Playwright automation
│   │   ├── youtube.py           # YouTube API integration
│   │   └── reddit.py            # Reddit + X/Twitter scraping
│   └── requirements.txt
│
└── CLAUDE.md                    # This file
```

---

## Core Features

### 1. Platform Connections
- **Bilibili**: QR code login via Playwright browser automation
- **YouTube**: OAuth 2.0 via Google
- **Reddit/X**: No auth needed (keyword + persona based search)

### 2. Recommendation Generation

**Two-Step Process:**
1. **Raw Candidate Collection (70/30 split)**
   - 70% from subscribed channels/followings
   - 30% from trending/popular content
   - Filter: only last 24 hours

2. **AI Selection (persona-driven)**
   - 100% weight: User persona
   - Watch history / subscription interests used only for candidate pool context
   - Constraint: Max 2 items per author/channel

### 3. User Persona System
- Explicit input via profile form
- Implicit signals from viewing behavior
- AI-compiled comprehensive persona
- Used for Reddit/X search query generation

### 4. Email Notifications
- Daily scheduled emails at user's preferred time
- Generates fresh recommendations before sending
- Uses Zoho SMTP

---

## API Endpoints

### Web API Routes

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/recommendations/generate` | Generate recommendations |
| POST | `/api/sites/[site]/connect` | Start platform connection |
| GET | `/api/sites/[site]/status` | Check connection status |
| POST | `/api/persona/update` | Update user persona |
| GET | `/api/oauth/youtube` | YouTube OAuth flow |

### Worker API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/bilibili/connect` | Start QR login |
| GET | `/bilibili/status/{id}` | Check login status |
| POST | `/bilibili/recommendations` | Get recommendations |
| POST | `/youtube/recommendations` | Get recommendations |
| POST | `/reddit/recommendations/keywords` | Keyword search |
| POST | `/x/recommendations/keywords` | X/Twitter search |

---

## Database Schema (Key Models)

```prisma
model User {
  id                String    @id @default(cuid())
  email             String    @unique
  passwordHash      String?
  name              String?
  subscriptionTier  Tier      @default(FREE)
  connections       SiteConnection[]
  preferences       UserPreferences?
  persona           UserPersona?
  recommendations   Recommendation[]
}

model SiteConnection {
  id              String   @id @default(cuid())
  userId          String
  site            Site     // BILIBILI, YOUTUBE, REDDIT, X
  connected       Boolean  @default(false)
  authState       String?  // Encrypted cookies/tokens
  username        String?
  cachedHistory   String?  // JSON - for offline recommendations
  cachedChannels  String?  // JSON - for offline recommendations
  needsReauth     Boolean  @default(false)
}

model UserPersona {
  id              String   @id @default(cuid())
  userId          String   @unique
  compiledPersona String?  // AI-generated summary
  viewingSignals  String?  // JSON of behavior patterns
  interests       String?
  profession      String?
}

model Recommendation {
  id        String   @id @default(cuid())
  userId    String
  site      Site
  videoId   String
  title     String
  author    String
  coverUrl  String?
  reason    String   // AI-generated explanation
  url       String
}
```

---

## Key Design Decisions

1. **Separate Worker Service**: Playwright can't run in serverless easily, so we use a dedicated Cloud Run service with persistent browser instances.

2. **Caching Strategy**: Bilibili auth expires frequently. We cache watch history and channels so recommendations can still work with stale auth.

3. **AI for Selection, Not Generation**: We fetch real content from platforms, then use AI to rank/select. No hallucinated content.

4. **Persona-Driven Search**: For Reddit/X (no auth), we use AI to generate search queries from the user's persona.

5. **Rate Limiting**: Tiered limits (FREE: 2/day, PRO: 20/day) to manage costs.

6. **Background Generation**: UI shows friendly message and dismisses quickly while generation continues in background.

---

## Common Issues & Solutions

### Bilibili Timeout
**Problem**: Bilibili requests timeout (AbortError)
**Solution**: Worker-client has 5-minute timeout for Bilibili. Ensure Cloud Run request timeout is also set to 300s+.

### Image Loading Failures
**Problem**: Thumbnails from Bilibili/Reddit fail to load
**Solution**: RecommendationImage component handles errors with platform-specific fallback icons.

### QR Login Race Condition
**Problem**: Error popup shows briefly after successful Bilibili login
**Solution**: connectionSucceededRef prevents error display after success.

### Database Schema Out of Sync
**Problem**: Prisma errors about missing columns
**Solution**: Check which database (local vs Neon) and run `prisma db push` with correct DATABASE_URL.

### Neon Connection Closed Error
**Problem**: `prisma:error Error in PostgreSQL connection: Error { kind: Closed, cause: None }`
**Cause**: Neon serverless closes idle connections, Prisma tries to use stale connection.
**Solution**: Add connection parameters to DATABASE_URL:
```
DATABASE_URL="postgresql://...@...-pooler.neon.tech/neondb?pgbouncer=true&connect_timeout=10&pool_timeout=10"
```
Make sure you're using the `-pooler` hostname from Neon (not the direct connection).

---

## File Locations Quick Reference

| Purpose | File |
|---------|------|
| Main generation logic | `web/src/app/api/recommendations/generate/route.ts` |
| Shared generation function | `web/src/lib/generate-recommendations.ts` |
| Worker HTTP client | `web/src/lib/worker-client.ts` |
| Bilibili automation | `worker/services/bilibili.py` |
| YouTube API | `worker/services/youtube.py` |
| Reddit/X scraping | `worker/services/reddit.py` |
| Worker endpoints | `worker/app.py` |
| Database schema | `web/prisma/schema.prisma` |
| Email scheduler | `web/src/lib/email-scheduler.ts` |
| Dashboard page | `web/src/app/(dashboard)/dashboard/page.tsx` |
| Generate button | `web/src/components/dashboard/generate-button.tsx` |

---

## Development Setup

### Local Development

```bash
# Terminal 1: Web
cd web
npm install
npx prisma generate
npm run dev

# Terminal 2: Worker
cd worker
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
playwright install chromium
uvicorn app:app --host 0.0.0.0 --port 3001
```

### Environment for Local Dev
- Web uses `web/.env.local` (local Postgres at localhost:5433)
- Worker needs OPENAI_API_KEY from `web/.env`

### Database
- Local: `postgresql://postgres:postgres@localhost:5433/dailyrec`
- Production: Neon serverless PostgreSQL
