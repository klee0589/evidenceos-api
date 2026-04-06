require("./setup");
const request = require("supertest");
const app = require("../server");

let createdKey;

describe("POST /api/auth/register", () => {
  it("creates a new free API key", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "test@example.com" });

    expect(res.status).toBe(201);
    expect(res.body.apiKey).toMatch(/^eos_live_/);
    expect(res.body.plan).toBe("free");
    expect(res.body.keyPrefix).toBeDefined();
    createdKey = res.body.apiKey;
  });

  it("rejects missing email", async () => {
    const res = await request(app).post("/api/auth/register").send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it("rejects invalid email", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "not-an-email" });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/auth/keys", () => {
  it("lists keys for a registered email", async () => {
    const res = await request(app)
      .get("/api/auth/keys?email=test@example.com");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.keys)).toBe(true);
    expect(res.body.keys.length).toBeGreaterThan(0);
    // Never expose raw key
    res.body.keys.forEach((k) => {
      expect(k.key_prefix).toBeDefined();
      expect(k.key_hash).toBeUndefined();
    });
  });

  it("returns empty array for unknown email", async () => {
    const res = await request(app)
      .get("/api/auth/keys?email=nobody@example.com");
    expect(res.status).toBe(200);
    expect(res.body.keys).toHaveLength(0);
  });
});

describe("Authentication enforcement", () => {
  it("rejects requests to /api/usage without key", async () => {
    const res = await request(app).get("/api/usage");
    expect(res.status).toBe(401);
  });

  it("rejects malformed API key", async () => {
    const res = await request(app)
      .get("/api/usage")
      .set("X-API-Key", "bad-key");
    expect(res.status).toBe(401);
  });

  it("accepts valid API key via X-API-Key header", async () => {
    const res = await request(app)
      .get("/api/usage")
      .set("X-API-Key", createdKey);
    expect(res.status).toBe(200);
    expect(res.body.plan).toBe("free");
  });

  it("accepts valid API key via Authorization: Bearer header", async () => {
    const res = await request(app)
      .get("/api/usage")
      .set("Authorization", `Bearer ${createdKey}`);
    expect(res.status).toBe(200);
  });
});

describe("POST /api/auth/admin-token", () => {
  it("rejects wrong secret", async () => {
    const res = await request(app)
      .post("/api/auth/admin-token")
      .send({ secret: "wrong" });
    expect(res.status).toBe(403);
  });

  it("issues JWT with correct secret", async () => {
    const res = await request(app)
      .post("/api/auth/admin-token")
      .send({ secret: "test-admin-secret" });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.expiresIn).toBe("8h");
  });
});
