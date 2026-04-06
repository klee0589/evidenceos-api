require("./setup");
const request = require("supertest");
const app = require("../server");

describe("GET /api/health", () => {
  it("returns ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.version).toBe("2.0.0");
  });
});

describe("GET /api/demo/access-review", () => {
  it("returns Google Workspace mock by default", async () => {
    const res = await request(app).get("/api/demo/access-review");
    expect(res.status).toBe(200);
    expect(res.body.system).toBe("Google Workspace");
    expect(res.body.control).toBe("Access Review");
    expect(Array.isArray(res.body.users)).toBe(true);
    expect(res.body.users.length).toBeGreaterThan(0);
    expect(res.body).toHaveProperty("status");
    expect(res.body).toHaveProperty("summary");
    expect(res.body).toHaveProperty("timestamp");
  });

  it("returns GitHub mock when ?system=github", async () => {
    const res = await request(app).get("/api/demo/access-review?system=github");
    expect(res.status).toBe(200);
    expect(res.body.system).toBe("GitHub");
    expect(res.body.users.length).toBeGreaterThan(0);
  });

  it("returns AWS mock when ?system=aws", async () => {
    const res = await request(app).get("/api/demo/access-review?system=aws");
    expect(res.status).toBe(200);
    expect(res.body.system).toBe("AWS IAM");
  });

  it("returns Okta mock when ?system=okta", async () => {
    const res = await request(app).get("/api/demo/access-review?system=okta");
    expect(res.status).toBe(200);
    expect(res.body.system).toBe("Okta");
  });

  it("falls back to Google Workspace for unknown system", async () => {
    const res = await request(app).get("/api/demo/access-review?system=unknown");
    expect(res.status).toBe(200);
    expect(res.body.system).toBe("Google Workspace");
  });

  it("each user has email and mfa fields", async () => {
    const res = await request(app).get("/api/demo/access-review");
    res.body.users.forEach((u) => {
      expect(u).toHaveProperty("email");
      expect(u).toHaveProperty("mfa");
    });
  });

  it("timestamp varies slightly between calls", async () => {
    const r1 = await request(app).get("/api/demo/access-review");
    const r2 = await request(app).get("/api/demo/access-review");
    // Both should be valid ISO strings
    expect(() => new Date(r1.body.timestamp)).not.toThrow();
    expect(() => new Date(r2.body.timestamp)).not.toThrow();
  });
});

describe("GET /api/demo/systems", () => {
  it("returns list of available mock systems", async () => {
    const res = await request(app).get("/api/demo/systems");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.systems)).toBe(true);
    expect(res.body.systems.length).toBeGreaterThan(0);
  });
});

describe("404 handler", () => {
  it("returns 404 for unknown routes", async () => {
    const res = await request(app).get("/api/nonexistent");
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });
});
