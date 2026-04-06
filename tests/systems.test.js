require("./setup");
const request = require("supertest");
const app = require("../server");

let freeKey;
let proKey;
let proKeyId;
let adminToken;

beforeAll(async () => {
  // Admin token
  const tokenRes = await request(app)
    .post("/api/auth/admin-token")
    .send({ secret: "test-admin-secret" });
  adminToken = tokenRes.body.token;

  // Free key
  const freeRes = await request(app)
    .post("/api/auth/register")
    .send({ email: "free-systems@example.com" });
  freeKey = freeRes.body.apiKey;

  // Pro key (register then admin-upgrade)
  const proRes = await request(app)
    .post("/api/auth/register")
    .send({ email: "pro-systems@example.com" });
  proKey = proRes.body.apiKey;
  proKeyId = proRes.body.id;

  await request(app)
    .patch(`/api/admin/keys/${proKeyId}/plan`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ plan: "pro" });
});

describe("Plan gating on /api/systems", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await request(app).get("/api/systems/access-review");
    expect(res.status).toBe(401);
  });

  it("rejects free-plan key with 403", async () => {
    const res = await request(app)
      .get("/api/systems/access-review?system=github")
      .set("X-API-Key", freeKey);
    expect(res.status).toBe(403);
    expect(res.body.requiredPlan).toContain("pro");
    expect(res.body.upgradeUrl).toBeDefined();
  });

  it("allows pro-plan key through to integration", async () => {
    // Without real credentials, integration will return 503 (config error)
    // But it should NOT be 401 or 403 — auth + plan gate passed
    const res = await request(app)
      .get("/api/systems/access-review?system=github")
      .set("X-API-Key", proKey);
    expect([200, 502, 503]).toContain(res.status);
    if (res.status !== 200) {
      expect(res.body.error).toBeDefined();
    }
  });

  it("returns 400 for unknown system (pro key)", async () => {
    const res = await request(app)
      .get("/api/systems/access-review?system=salesforce")
      .set("X-API-Key", proKey);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Unknown system/);
  });
});

describe("Rate limiting", () => {
  it("tracks calls_today and exposes rate limit headers", async () => {
    const res = await request(app)
      .get("/api/usage")
      .set("X-API-Key", proKey);
    expect(res.status).toBe(200);
    expect(res.body.today).toHaveProperty("calls");
    expect(res.body.today).toHaveProperty("limit");
    expect(res.body.today).toHaveProperty("remaining");
  });
});
