require("./setup");
const request = require("supertest");
const app = require("../server");

let adminToken;
let testKeyId;

beforeAll(async () => {
  // Get admin JWT
  const tokenRes = await request(app)
    .post("/api/auth/admin-token")
    .send({ secret: "test-admin-secret" });
  adminToken = tokenRes.body.token;

  // Create a test key to operate on
  const keyRes = await request(app)
    .post("/api/auth/register")
    .send({ email: "admin-test@example.com" });
  testKeyId = keyRes.body.id;
});

describe("Admin authorization", () => {
  it("rejects admin routes without JWT", async () => {
    const res = await request(app).get("/api/admin/keys");
    expect(res.status).toBe(401);
  });

  it("rejects invalid JWT", async () => {
    const res = await request(app)
      .get("/api/admin/keys")
      .set("Authorization", "Bearer bad.token.here");
    expect(res.status).toBe(403);
  });
});

describe("GET /api/admin/keys", () => {
  it("lists all keys with valid admin JWT", async () => {
    const res = await request(app)
      .get("/api/admin/keys")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.keys)).toBe(true);
    expect(res.body.total).toBeGreaterThan(0);
  });

  it("filters by plan", async () => {
    const res = await request(app)
      .get("/api/admin/keys?plan=free")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    res.body.keys.forEach((k) => expect(k.plan).toBe("free"));
  });
});

describe("DELETE /api/admin/keys/:id", () => {
  it("revokes a key", async () => {
    const res = await request(app)
      .delete(`/api/admin/keys/${testKeyId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toContain("revoked");
  });

  it("returns 409 when revoking already-revoked key", async () => {
    const res = await request(app)
      .delete(`/api/admin/keys/${testKeyId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(409);
  });
});

describe("POST /api/admin/keys/:id/renew", () => {
  it("reactivates a revoked key", async () => {
    const res = await request(app)
      .post(`/api/admin/keys/${testKeyId}/renew`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toContain("reactivated");
  });
});

describe("PATCH /api/admin/keys/:id/plan", () => {
  it("upgrades a key to pro", async () => {
    const res = await request(app)
      .patch(`/api/admin/keys/${testKeyId}/plan`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ plan: "pro" });
    expect(res.status).toBe(200);
  });

  it("rejects invalid plan", async () => {
    const res = await request(app)
      .patch(`/api/admin/keys/${testKeyId}/plan`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ plan: "enterprise" });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/admin/usage", () => {
  it("returns usage stats", async () => {
    const res = await request(app)
      .get("/api/admin/usage")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("byEndpoint");
    expect(res.body).toHaveProperty("bySystem");
    expect(res.body).toHaveProperty("total");
  });
});
