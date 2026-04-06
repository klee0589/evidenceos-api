# EvidenceOS API

Production-ready Node.js / Express backend for EvidenceOS — a SOC 2 access-review evidence tool.

Live at: **https://evidenceos-api.onrender.com**

---

## Overview

The API has two tiers of endpoints:

| Tier | Who uses it | Auth |
|---|---|---|
| **Demo** | Landing page, unauthenticated visitors | None |
| **Live** | Authenticated customers | API key (`eos_live_*`) |

Billing is handled by Base44. When a user upgrades or downgrades, Base44 fires a webhook that updates the plan on the API key instantly.

---

## Quick start

```bash
git clone https://github.com/klee0589/evidenceos-api
cd evidenceos-api
cp .env.example .env   # fill in required values
npm install
npm run dev            # hot-reload on port 3001
```

---

## Environment variables

Copy `.env.example` to `.env` and fill in:

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Server port (default `3001`) |
| `NODE_ENV` | No | `development` or `production` |
| `ALLOWED_ORIGIN` | Yes (prod) | CORS origin, e.g. `https://evidence-os-c6429f1e.base44.app` |
| `ADMIN_JWT_SECRET` | Yes | Secret for signing admin JWTs — use `openssl rand -hex 32` |
| `BASE44_WEBHOOK_SECRET` | Yes | Shared secret set in Base44 automation webhook headers |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Pro only | Full service account JSON for Google Workspace integration |
| `GOOGLE_ADMIN_EMAIL` | Pro only | Admin email for domain-wide delegation |
| `GITHUB_TOKEN` | Pro only | PAT with `read:org` scope |
| `GITHUB_ORG` | Pro only | GitHub organisation slug |
| `AWS_ACCESS_KEY_ID` | Pro only | IAM credentials with `iam:ListUsers`, `iam:ListMFADevices` |
| `AWS_SECRET_ACCESS_KEY` | Pro only | — |
| `AWS_REGION` | Pro only | Default `us-east-1` |
| `OKTA_DOMAIN` | Pro only | e.g. `dev-123456.okta.com` |
| `OKTA_API_TOKEN` | Pro only | Okta API token |

---

## API reference

### Public (no auth)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Liveness check |
| `GET` | `/api/demo/access-review` | Mock access-review data (Google Workspace default) |
| `GET` | `/api/demo/access-review?system=github` | Mock data for GitHub |
| `GET` | `/api/demo/access-review?system=aws` | Mock data for AWS IAM |
| `GET` | `/api/demo/access-review?system=okta` | Mock data for Okta |
| `GET` | `/api/demo/systems` | List available mock systems |

### Auth

| Method | Path | Body | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | `{ email }` | Create a free API key |
| `GET` | `/api/auth/keys?email=` | — | List keys for an email (prefix only, never raw) |
| `POST` | `/api/auth/admin-token` | `{ secret }` | Issue an 8-hour admin JWT |

### Authenticated (API key required)

Pass key as `X-API-Key: eos_live_...` or `Authorization: Bearer eos_live_...`

| Method | Path | Plan | Description |
|---|---|---|---|
| `GET` | `/api/usage` | Any | Quota usage and daily breakdown |
| `GET` | `/api/billing/subscription` | Any | Current plan and billing history |
| `GET` | `/api/systems/access-review?system=` | **Pro** | Live access-review from real system |
| `GET` | `/api/systems` | **Pro** | List supported live systems |

### Billing webhook (Base44)

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/billing/webhook` | `X-Webhook-Secret` header | Receives plan-change events from Base44 |

Expected payload from Base44 automation:
```json
{
  "event":    { "type": "update", "entity_name": "User", "entity_id": "abc123" },
  "data":     { "email": "user@example.com", "plan": "pro" },
  "old_data": { "email": "user@example.com", "plan": "free" }
}
```

### Admin (JWT required)

Obtain a token first: `POST /api/auth/admin-token` → use as `Authorization: Bearer <token>`

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/admin/keys` | List all API keys (`?plan=free\|pro`, `?active=true\|false`) |
| `DELETE` | `/api/admin/keys/:id` | Revoke a key |
| `POST` | `/api/admin/keys/:id/renew` | Reactivate a revoked key |
| `PATCH` | `/api/admin/keys/:id/plan` | Change plan: `{ plan: "free"\|"pro" }` |
| `GET` | `/api/admin/usage` | Global usage stats (`?days=7`) |
| `GET` | `/api/admin/billing-events` | Last 100 billing events |

---

## Plans

| | Free | Pro |
|---|---|---|
| Daily limit | 100 calls | 10,000 calls |
| Demo endpoints | ✓ | ✓ |
| Live system integrations | ✗ | ✓ |
| Rate-limit headers | ✓ | ✓ |

Plan upgrades are applied automatically when Base44 fires the `/api/billing/webhook` endpoint.

---

## File structure

```
evidenceos-api/
├── server.js                        # Express entry point
├── db/
│   └── index.js                     # SQLite connection + schema
├── middleware/
│   ├── auth.js                      # API key + admin JWT validation
│   ├── rateLimit.js                 # Per-key daily counter
│   └── planGate.js                  # Plan-based access control
├── services/
│   ├── apiKey.js                    # Key generation, revoke, renew
│   ├── usage.js                     # Request logging + analytics queries
│   └── billing.js                   # Base44 plan-change handler
├── integrations/
│   ├── googleWorkspace.js           # Google Admin SDK
│   ├── github.js                    # Octokit — org members + 2FA
│   ├── aws.js                       # AWS IAM users + MFA devices
│   └── okta.js                      # Okta REST API
├── controllers/                     # Route handlers
├── routes/                          # Express routers
└── tests/                           # jest + supertest (46 tests)
```

---

## Database

SQLite (`./data/evidenceos.db`). Three tables:

- **`api_keys`** — keys, plans, daily counters
- **`usage_logs`** — per-request logs (no PII, no response bodies)
- **`billing_events`** — plan-change audit trail from Base44 webhooks

On Render, attach a persistent disk and set `DB_PATH=/opt/render/project/src/data/evidenceos.db` to survive deploys (requires Starter plan+).

---

## Deploy (Render)

1. Push to GitHub — Render auto-deploys from `main`
2. In the Render dashboard, set all required environment variables
3. Set `BASE44_WEBHOOK_SECRET` to match the value in your Base44 automation webhook header
4. Optionally attach a disk for persistent SQLite storage

---

## Tests

```bash
npm test          # run all 46 tests
npm run test:watch
```

Tests use an in-memory SQLite database and never touch the production data file.
