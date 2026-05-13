import app, { pgPool } from "./app.js";
import { logger } from "./lib/logger.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function ensureSessionTable() {
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS "user_sessions" (
      "sid" varchar NOT NULL,
      "sess" json NOT NULL,
      "expire" timestamp(6) NOT NULL
    )
  `);

  await pgPool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "user_sessions_sid_idx"
    ON "user_sessions" ("sid")
  `);

  await pgPool.query(`
    CREATE INDEX IF NOT EXISTS "IDX_session_expire"
    ON "user_sessions" ("expire")
  `);
}

async function start() {
  await ensureSessionTable();
  logger.info("Session table ready");

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
  });
}

start().catch((err) => {
  logger.error({ err }, "Failed to start server");
  process.exit(1);
});