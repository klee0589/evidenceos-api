// Use an in-memory test DB so tests never touch the production data file
process.env.DB_PATH = ":memory:";
process.env.ADMIN_JWT_SECRET = "test-admin-secret";
process.env.NODE_ENV = "test";
