require("./setup");
const request = require("supertest");
const app = require("../server");

// Set a test webhook secret
process.env.BASE44_WEBHOOK_SECRET = "test-webhook-secret";

let apiKey;
let userEmail;

beforeAll(async () => {
  userEmail = "billing-test@example.com";
  const res = await request(app)
    .post("/api/auth/register")
    .send({ email: userEmail });
  apiKey = res.body.apiKey;
});

const validPayload = (plan, oldPlan = "free") => ({
  event: { type: "update", entity_name: "User", entity_id: "base44-user-abc123" },
  data: { email: "billing-test@example.com", plan },
  old_data: { email: "billing-test@example.com", plan: oldPlan },
});

describe("POST /api/billing/webhook", () => {
  it("rejects missing webhook secret", async () => {
    const res = await request(app)
      .post("/api/billing/webhook")
      .send(validPayload("pro"));
    expect(res.status).toBe(401);
  });

  it("rejects wrong webhook secret", async () => {
    const res = await request(app)
      .post("/api/billing/webhook")
      .set("x-webhook-secret", "wrong-secret")
      .send(validPayload("pro"));
    expect(res.status).toBe(401);
  });

  it("upgrades user to pro plan", async () => {
    const res = await request(app)
      .post("/api/billing/webhook")
      .set("x-webhook-secret", "test-webhook-secret")
      .send(validPayload("pro", "free"));

    expect(res.status).toBe(200);
    expect(res.body.plan).toBe("pro");
    expect(res.body.updatedKeys).toBeGreaterThan(0);
  });

  it("reflects plan change on usage endpoint", async () => {
    const res = await request(app)
      .get("/api/usage")
      .set("X-API-Key", apiKey);
    expect(res.status).toBe(200);
    expect(res.body.plan).toBe("pro");
  });

  it("skips when plan hasn't changed", async () => {
    const res = await request(app)
      .post("/api/billing/webhook")
      .set("x-webhook-secret", "test-webhook-secret")
      .send(validPayload("pro", "pro")); // same plan
    expect(res.status).toBe(200);
    expect(res.body.skipped).toBe(true);
  });

  it("downgrades user back to free", async () => {
    const res = await request(app)
      .post("/api/billing/webhook")
      .set("x-webhook-secret", "test-webhook-secret")
      .send(validPayload("free", "pro"));
    expect(res.status).toBe(200);
    expect(res.body.plan).toBe("free");
  });

  it("rejects missing email in payload", async () => {
    const res = await request(app)
      .post("/api/billing/webhook")
      .set("x-webhook-secret", "test-webhook-secret")
      .send({ event: {}, data: { plan: "pro" }, old_data: {} });
    expect(res.status).toBe(400);
  });

  it("rejects unknown plan value", async () => {
    const res = await request(app)
      .post("/api/billing/webhook")
      .set("x-webhook-secret", "test-webhook-secret")
      .send(validPayload("enterprise"));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Unknown plan/);
  });
});

describe("GET /api/billing/subscription", () => {
  it("returns current plan and billing history", async () => {
    const res = await request(app)
      .get("/api/billing/subscription")
      .set("X-API-Key", apiKey);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("plan");
    expect(Array.isArray(res.body.billingHistory)).toBe(true);
  });

  it("requires auth", async () => {
    const res = await request(app).get("/api/billing/subscription");
    expect(res.status).toBe(401);
  });
});
