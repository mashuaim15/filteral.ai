# Filteral - Your Personal AI Information Filter

AI-powered content recommendations from YouTube, Bilibili, Reddit, and X (Twitter).

## Quick Start (Local Development)

### Prerequisites

- Node.js 20+
- Python 3.11+
- PostgreSQL 15+
- Docker (optional, for containerized setup)

### Option 1: Docker Compose (Recommended)

```bash
# Clone the repository
git clone <repo-url>
cd daily-recommend

# Copy environment file and configure
cp .env.example .env
# Edit .env with your API keys

# Start all services
docker-compose -f docker-compose.dev.yml up -d

# Run database migrations
cd web && npx prisma migrate dev
```

### Option 2: Manual Setup

#### 1. Start PostgreSQL

```bash
# macOS with Homebrew
brew services start postgresql@15

# Create database
createdb dailyrec
```

#### 2. Setup Web (Next.js)

```bash
cd web

# Install dependencies
npm install

# Copy environment file
cp ../.env.example .env
# Edit .env with your settings

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Start development server
npm run dev
```

#### 3. Setup Worker (Python)

```bash
cd worker

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Install Playwright browsers
playwright install chromium

# Start worker
python -m uvicorn app:app --host 0.0.0.0 --port 3001 --reload
```

### Access the App

- Web: http://localhost:3000
- Worker API: http://localhost:3001

## Environment Variables

Create a `.env` file in the project root with:

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/dailyrec"
DB_PASSWORD="your-secure-password"

# Auth
NEXTAUTH_SECRET="generate-with: openssl rand -base64 32"
NEXTAUTH_URL="http://localhost:3000"

# OpenAI (required)
OPENAI_API_KEY="sk-..."

# Google OAuth (for YouTube)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Stripe (optional)
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# Email (optional)
SMTP_HOST="smtp.zoho.com"
SMTP_PORT="587"
SMTP_USER="hello@filteral.app"
SMTP_PASS="your-password"

# Worker
WORKER_URL="http://localhost:3001"
```

## Google Cloud Deployment

### Prerequisites

1. Google Cloud account with billing enabled
2. `gcloud` CLI installed and authenticated
3. Cloud Build API and Cloud Run API enabled

### Setup Cloud Build Trigger

1. Connect your GitHub repository to Cloud Build
2. Create a trigger for the `main` branch
3. Add substitution variables in Cloud Build:
   - `_OPENAI_API_KEY`: Your OpenAI API key
   - Other secrets as needed

### Manual Deployment

```bash
# Build and deploy using Cloud Build
gcloud builds submit --config=cloudbuild.yaml

# Or deploy manually:
# Build web
cd web && docker build -t gcr.io/YOUR_PROJECT/filteral-web .
docker push gcr.io/YOUR_PROJECT/filteral-web

# Build worker
cd worker && docker build -t gcr.io/YOUR_PROJECT/filteral-worker .
docker push gcr.io/YOUR_PROJECT/filteral-worker

# Deploy to Cloud Run
gcloud run deploy filteral-web --image gcr.io/YOUR_PROJECT/filteral-web --region us-central1
gcloud run deploy filteral-worker --image gcr.io/YOUR_PROJECT/filteral-worker --region us-central1
```

### Database Setup (Cloud SQL)

```bash
# Create Cloud SQL instance
gcloud sql instances create filteral-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1

# Create database
gcloud sql databases create dailyrec --instance=filteral-db

# Get connection string
# Use Cloud SQL Auth Proxy or direct connection
```

## Project Structure

```
daily-recommend/
├── web/                    # Next.js 14 frontend + API
│   ├── src/
│   │   ├── app/           # App Router pages
│   │   ├── components/    # React components
│   │   └── lib/           # Utilities
│   ├── prisma/            # Database schema
│   └── Dockerfile
├── worker/                 # Python Playwright worker
│   ├── services/          # Platform services
│   │   ├── bilibili.py
│   │   ├── youtube.py
│   │   └── reddit.py
│   ├── app.py             # FastAPI server
│   └── Dockerfile
├── nginx/                  # Nginx config
├── docker-compose.yml      # Production
├── docker-compose.dev.yml  # Development
├── cloudbuild.yaml         # Google Cloud Build
└── README.md
```

## Features

- **YouTube**: Recommendations from subscriptions + trending
- **Bilibili**: QR code login, subscription-based recommendations
- **Reddit**: Keyword-based post discovery (no login required)
- **X (Twitter)**: Keyword-based post discovery (no login required)
- **AI Persona**: Learn user preferences over time
- **Email Delivery**: Daily recommendations via email
- **Subscription Tiers**: Free/Pro/Enterprise

## Development

```bash
# Run database migrations
cd web && npx prisma migrate dev

# Open Prisma Studio (database viewer)
npx prisma studio

# Check types
npm run build

# Format code
npm run lint
```

## Troubleshooting

### Prisma Client Not Found

```bash
cd web && npx prisma generate
```

### Worker Connection Failed

Ensure the worker is running on port 3001:
```bash
curl http://localhost:3001/health
```

### Database Connection Failed

Check PostgreSQL is running:
```bash
pg_isready -h localhost -p 5432
```

## Legal Pages

The application includes the following legal pages required for API compliance and user transparency:

| Page | URL | Description |
|------|-----|-------------|
| Privacy Policy | `/privacy` | How we collect, use, and protect user data |
| Terms of Service | `/terms` | Terms and conditions for using the service |
| Disclaimer | `/disclaimer` | Liability limitations and third-party platform notices |

### Google API Compliance

These pages are required for Google API verification (YouTube Data API). Key compliance points:

- **Limited Use Disclosure**: We only access data necessary for recommendations
- **Data Handling**: User data is not sold or shared with third parties
- **Revocation**: Users can revoke access via Google Account settings
- **YouTube ToS Link**: Required link to YouTube Terms of Service

### Updating Legal Pages

Legal pages are located at:
```
web/src/app/
├── privacy/page.tsx      # Privacy Policy
├── terms/page.tsx        # Terms of Service
└── disclaimer/page.tsx   # Disclaimer
```

When updating these pages:
1. Update the "Last updated" date at the bottom
2. Ensure Google API compliance language remains intact
3. Test that all external links work correctly

## License

MIT
