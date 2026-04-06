# EvidenceOS Demo API

Lightweight Node.js / Express API powering the EvidenceOS landing page demo.
Returns realistic-looking SOC 2 access-review evidence — no database, no auth required.

---

## Quick start

```bash
cd evidenceos-api
npm install
npm run dev          # hot-reload via nodemon
# or
npm start            # plain node
```

API runs at **http://localhost:3001**

---

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Liveness check |
| GET | `/api/demo/access-review` | Access-review evidence (default: Google Workspace) |
| GET | `/api/demo/access-review?system=github` | Same for GitHub |
| GET | `/api/demo/access-review?system=aws` | Same for AWS IAM |
| GET | `/api/demo/access-review?system=okta` | Same for Okta |
| GET | `/api/demo/systems` | List all available mock systems |

### Example response — `/api/demo/access-review?system=github`

```json
{
  "control": "Access Review",
  "system": "GitHub",
  "timestamp": "2026-04-05T12:00:00Z",
  "status": "Warning",
  "users": [
    { "email": "dev-alice@example.com", "role": "Owner",          "mfa": true,  "lastLogin": "2026-04-05T07:30:00Z" },
    { "email": "dev-bob@example.com",   "role": "Member",         "mfa": false, "lastLogin": "2026-04-02T11:22:00Z" },
    { "email": "dev-carol@example.com", "role": "Member",         "mfa": true,  "lastLogin": "2026-04-04T16:55:00Z" },
    { "email": "dev-dan@example.com",   "role": "Billing Manager","mfa": true,  "lastLogin": "2026-04-01T09:00:00Z" }
  ],
  "summary": "4/4 users reviewed, 1 warning"
}
```

---

## File structure

```
evidenceos-api/
├── server.js                  # Express app entry point
├── routes/
│   └── demo.js                # Route definitions
├── controllers/
│   └── demoController.js      # Business logic + seed data
├── render.yaml                # One-click Render.com deploy
├── .env.example               # Environment variable template
├── .gitignore
└── package.json
```

---

## Landing page integration

```js
// Fetch default (Google Workspace) evidence
const res = await fetch("https://your-api-url/api/demo/access-review");
const data = await res.json();

// Fetch for a specific system
const ghRes = await fetch("https://your-api-url/api/demo/access-review?system=github");
```

---

## Deploy

### Render.com (recommended — free tier)
1. Push this folder to a GitHub repo.
2. In Render, click **New → Web Service** and connect the repo.
3. Set `ALLOWED_ORIGIN` to your landing page domain in the Render environment variables panel.
4. Deploy — Render uses `render.yaml` automatically.

### Vercel (serverless)
```bash
npm i -g vercel
vercel --prod
```
Add a `vercel.json` if you need custom routes.

### Fly.io
```bash
fly launch
fly deploy
```

---

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port |
| `ALLOWED_ORIGIN` | `*` | CORS allow-list (lock down in production) |
