# Filteral API Documentation

## Admin APIs

These endpoints require the `ADMIN_SECRET` environment variable to be set and passed as a Bearer token.

### Upgrade User to PRO

Upgrades a user to PRO tier and sends a welcome email automatically.

**Endpoint:** `POST /api/admin/upgrade-to-pro`

**Headers:**
```
Authorization: Bearer <ADMIN_SECRET>
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "user": {
    "email": "user@example.com",
    "name": "John",
    "tier": "PRO"
  },
  "welcomeEmailSent": true
}
```

**Error Responses:**
- `401 Unauthorized` - Missing or invalid ADMIN_SECRET
- `400 Bad Request` - Email not provided or user already PRO
- `404 Not Found` - User not found
- `500 Internal Server Error` - Server error

**Example:**
```bash
curl -X POST https://filteral.app/api/admin/upgrade-to-pro \
  -H "Authorization: Bearer your-admin-secret" \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'
```

---

## Cron APIs

### Daily Email Scheduler

Sends scheduled recommendation emails to users based on their preferred time.

**Endpoint:** `GET /api/cron/daily`

**Headers:**
```
Authorization: Bearer <CRON_SECRET>
```

**Response:**
```json
{
  "processed": 10,
  "successful": 8,
  "failed": 2,
  "results": [...]
}
```

### Manual Email Trigger

Manually triggers the email scheduler (for testing).

**Endpoint:** `POST /api/cron/trigger`

**Auth:** Requires user session in production.

---

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `ADMIN_SECRET` | Secret key for admin API endpoints | Yes (for admin APIs) |
| `CRON_SECRET` | Secret key for cron job endpoints | Yes (for cron APIs) |
| `WORKER_URL` | URL of the Python worker service | Yes |
| `OPENAI_API_KEY` | OpenAI API key for AI recommendations | Yes |
| `DATABASE_URL` | PostgreSQL connection string (Neon) | Yes |
| `SMTP_HOST` | SMTP server host | Yes (for emails) |
| `SMTP_PORT` | SMTP server port | Yes (for emails) |
| `SMTP_USER` | SMTP username | Yes (for emails) |
| `SMTP_PASS` | SMTP password | Yes (for emails) |
| `SMTP_FROM` | From email address | Yes (for emails) |
