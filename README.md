# EvidenceOS — Sandbox API for Identity & Compliance Testing

Simulate Okta, AWS, GitHub, and Google Workspace data for access reviews, audit logs, and compliance reports — without touching real systems.

No OAuth flows. No production credentials. Just an API key and realistic data.

---

## Quickstart

```bash
curl https://evidenceos-api.onrender.com/api/v1/demo/access-review?system=github
```

**Response:**

```json
{
  "request_id": "req_a0939df1dbeb42f6",
  "data": {
    "control": "Access Review",
    "system": "GitHub",
    "timestamp": "2026-04-06T23:47:31.003Z",
    "status": "Warning",
    "users": [
      { "email": "dev-alice@example.com", "role": "Owner",           "mfa": true,  "lastLogin": "2026-04-05T07:30:00Z" },
      { "email": "dev-bob@example.com",   "role": "Member",          "mfa": false, "lastLogin": "2026-04-02T11:22:00Z" },
      { "email": "dev-carol@example.com", "role": "Member",          "mfa": true,  "lastLogin": "2026-04-04T16:55:00Z" },
      { "email": "dev-dan@example.com",   "role": "Billing Manager", "mfa": true,  "lastLogin": "2026-04-01T09:00:00Z" }
    ],
    "pagination": { "next_cursor": null, "has_more": false },
    "summary": "4/4 users reviewed, 1 warning"
  },
  "meta": { "api_version": "v1", "plan": "free", "response_time_ms": 1 }
}
```

`dev-bob` has MFA disabled — exactly the kind of finding a real access review surfaces.

---

## Get an API Key

```bash
curl -X POST https://evidenceos-api.onrender.com/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "you@example.com"}'
```

```json
{
  "data": {
    "apiKey": "eos_live_...",
    "plan": "free",
    "docsUrl": "https://evidenceos.com/docs"
  }
}
```

Save the key — it won't be shown again.

---

## Features

| Endpoint | What it does |
|---|---|
| `GET /api/v1/demo/access-review` | User access review with MFA status per system |
| `GET /api/v1/demo/audit-log` | Timestamped security events with risk levels |
| `POST /api/v1/reports/access-review` | Generate a structured compliance report |
| `GET /api/v1/reports/:id` | Retrieve a report by ID (JSON or mocked PDF) |
| `POST /api/v1/webhooks` | Register a URL to receive real-time compliance events |
| `GET /api/v1/dashboard` | Per-key usage stats and first-call tracking |

**Supported systems:** `okta` · `aws` · `github` · `google-workspace`

---

## Access Reviews

Check which users have MFA disabled, stale logins, or elevated roles.

```bash
curl "https://evidenceos-api.onrender.com/api/v1/demo/access-review?system=okta" \
  -H "X-API-Key: eos_live_..."
```

**Query params:**

| Param | Description |
|---|---|
| `system` | `okta` · `aws` · `github` · `google-workspace` (default: `okta`) |
| `onlyWarnings=true` | Return only users with issues |
| `sort` | `timestamp_asc` or `timestamp_desc` |
| `limit` + `cursor` | Cursor-based pagination |
| `simulate=slow` | Adds 500–1200ms delay for latency testing |
| `simulate=error` | Returns a 500 with 10% probability |

---

## Audit Logs

Get timestamped security events — logins without MFA, privilege escalations, policy changes.

```bash
curl "https://evidenceos-api.onrender.com/api/v1/demo/audit-log?system=aws&risk=high" \
  -H "X-API-Key: eos_live_..."
```

**Response:**

```json
{
  "data": {
    "control": "Audit Log",
    "system": "AWS IAM",
    "status": "Warning",
    "events": [
      {
        "timestamp": "2026-04-02T13:20:00Z",
        "user": "ops-bob@example.com",
        "action": "iam_policy_attach",
        "policy": "AdministratorAccess",
        "target_user": "ops-eve@example.com",
        "approved": false,
        "risk": "high",
        "warning": "AdministratorAccess attached to non-admin user"
      },
      {
        "timestamp": "2026-04-04T17:45:00Z",
        "user": "ops-eve@example.com",
        "action": "s3_bucket_public",
        "bucket": "prod-data-exports",
        "risk": "high",
        "warning": "S3 bucket made publicly accessible"
      }
    ],
    "pagination": { "next_cursor": null, "has_more": false },
    "summary": "4 events reviewed, 3 warnings"
  }
}
```

**Filter params:** `?risk=high|medium|low` · `?user=alice` · `?sort=timestamp_desc`

---

## Compliance Reports

Generate a structured report from access review data. Free plan: 3 reports/day.

```bash
curl -X POST https://evidenceos-api.onrender.com/api/v1/reports/access-review \
  -H "X-API-Key: eos_live_..." \
  -H "Content-Type: application/json" \
  -d '{"system": "github", "includeWarningsOnly": false}'
```

**Response:**

```json
{
  "data": {
    "report_id": "rpt_62c77d2380d0",
    "system": "github",
    "generated_at": "2026-04-06T23:48:24.247Z",
    "summary": {
      "total_users": 4,
      "flagged_users": 1,
      "mfa_issues": 1,
      "admin_accounts": 1
    },
    "findings": [
      {
        "user": "dev-bob@example.com",
        "issue": "MFA not enabled",
        "severity": "high",
        "recommendation": "Enable MFA immediately"
      }
    ]
  }
}
```

**Retrieve or export:**

```bash
# JSON (default)
curl https://evidenceos-api.onrender.com/api/v1/reports/rpt_62c77d2380d0 \
  -H "X-API-Key: eos_live_..."

# Mocked PDF download URL
curl "https://evidenceos-api.onrender.com/api/v1/reports/rpt_62c77d2380d0?format=pdf" \
  -H "X-API-Key: eos_live_..."
```

---

## Webhooks

Register a URL to receive events when compliance conditions are met.

```bash
curl -X POST https://evidenceos-api.onrender.com/api/v1/webhooks \
  -H "X-API-Key: eos_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-app.com/webhook",
    "events": ["access_review.flagged", "audit_log.high_risk"]
  }'
```

**Response:**

```json
{
  "data": {
    "webhook_id": "wh_45f4cdbeea74",
    "url": "https://your-app.com/webhook",
    "events": ["access_review.flagged", "audit_log.high_risk"],
    "secret": "whsec_38c0784fc06ff10e...",
    "_notice": "Save your webhook secret. It will not be shown again."
  }
}
```

Every delivery is signed with HMAC-SHA256. Verify it on your server:

```js
const crypto = require("crypto");

function verifyWebhook(rawBody, signature, secret) {
  const expected = "sha256=" + crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

// Express handler
app.post("/webhook", express.raw({ type: "application/json" }), (req, res) => {
  const sig = req.headers["x-evidenceos-signature"];
  if (!verifyWebhook(req.body, sig, process.env.WEBHOOK_SECRET)) {
    return res.status(401).send("Invalid signature");
  }
  const event = JSON.parse(req.body);
  console.log(event.event, event.flagged_users);
  res.sendStatus(200);
});
```

**Supported events:**

| Event | Trigger |
|---|---|
| `access_review.flagged` | Any user has MFA disabled |
| `audit_log.high_risk` | Any audit event has `risk: "high"` |

Free plan: 1 webhook · Pro plan: unlimited

---

## Response Format

Every response follows the same structure:

**Success:**
```json
{
  "request_id": "req_a0939df1dbeb42f6",
  "data": { ... },
  "meta": {
    "api_version": "v1",
    "plan": "free",
    "response_time_ms": 1
  }
}
```

**Error:**
```json
{
  "request_id": "req_c4b10918a15f4881",
  "error": {
    "message": "Invalid system. Supported: google-workspace, github, aws, okta",
    "type": "validation_error",
    "code": 400
  },
  "meta": { "api_version": "v1", "plan": "public", "response_time_ms": 0 }
}
```

Every response includes `X-Request-Id` and `X-RateLimit-*` headers.

---

## Authentication

Pass your API key in either header:

```bash
-H "X-API-Key: eos_live_..."
# or
-H "Authorization: Bearer eos_live_..."
```

**Rate limits:**

| Plan | Requests/day |
|---|---|
| Free | 100 |
| Pro | 10,000 |

Limits are exposed on every response:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 97
X-RateLimit-Plan: free
```

---

## API Reference

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/demo/access-review` | — | Access review (sandbox) |
| `GET` | `/api/v1/demo/audit-log` | — | Audit log (sandbox) |
| `GET` | `/api/v1/demo/systems` | — | List supported systems |
| `GET` | `/api/v1/health` | — | Health check |
| `POST` | `/api/v1/auth/register` | — | Create API key |
| `GET` | `/api/v1/usage` | Key | Call stats + rate limit info |
| `GET` | `/api/v1/billing/subscription` | Key | Plan and billing history |
| `POST` | `/api/v1/reports/access-review` | Key | Generate compliance report |
| `GET` | `/api/v1/reports/:id` | — | Get report by ID |
| `POST` | `/api/v1/webhooks` | Key | Register webhook |
| `GET` | `/api/v1/webhooks` | Key | List webhooks |
| `POST` | `/api/v1/webhooks/test` | Key | Fire test event |
| `GET` | `/api/v1/dashboard` | Key | Usage + onboarding stats |

Legacy routes at `/api/*` are still functional but return `X-API-Deprecated: true`.

---

## Why This Exists

Building a GRC tool, access review workflow, or compliance integration means you need real-looking data before you have real integrations.

Connecting to production Okta or AWS during development is slow, risky, and often blocked — you need a service account, an org to test against, and someone to approve access.

EvidenceOS gives you an API that behaves like those systems — with MFA flags, privilege escalations, and audit trails — so you can build and test your UI, webhooks, and report logic against something realistic enough to matter.

---

[**Get your free API key →**](https://evidenceos.com)

Free plan includes 100 requests/day, 3 reports/day, and 1 webhook. No credit card required.
