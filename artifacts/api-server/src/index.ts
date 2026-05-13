import app, { pgPool } from "./app";
import { logger } from "./lib/logger";

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

async function ensureSchema() {
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS "user_sessions" (
      "sid" varchar NOT NULL,
      "sess" json NOT NULL,
      "expire" timestamp(6) NOT NULL
    )
  `);
  await pgPool.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS "user_sessions_sid_idx" ON "user_sessions" ("sid")`,
  );
  await pgPool.query(
    `CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "user_sessions" ("expire")`,
  );

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS "users" (
      "id" text PRIMARY KEY,
      "username" text NOT NULL UNIQUE,
      "email" text NOT NULL UNIQUE,
      "password_hash" text,
      "display_name" text NOT NULL,
      "first_name" text,
      "last_name" text,
      "bio" text,
      "avatar_url" text,
      "banner_url" text,
      "is_verified" boolean NOT NULL DEFAULT false,
      "is_admin" boolean NOT NULL DEFAULT false,
      "is_banned" boolean NOT NULL DEFAULT false,
      "rizz_score" integer NOT NULL DEFAULT 0,
      "follower_count" integer NOT NULL DEFAULT 0,
      "following_count" integer NOT NULL DEFAULT 0,
      "post_count" integer NOT NULL DEFAULT 0,
      "onboarding_completed" boolean NOT NULL DEFAULT false,
      "custom_status" text,
      "dnd" boolean NOT NULL DEFAULT false,
      "interests" json DEFAULT '[]',
      "last_seen_at" timestamp,
      "push_subscription" json,
      "created_at" timestamp NOT NULL DEFAULT now()
    )
  `);

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS "posts" (
      "id" serial PRIMARY KEY,
      "author_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "content" text NOT NULL,
      "image_url" text,
      "video_url" text,
      "tags" json DEFAULT '[]',
      "like_count" integer NOT NULL DEFAULT 0,
      "comment_count" integer NOT NULL DEFAULT 0,
      "repost_count" integer NOT NULL DEFAULT 0,
      "created_at" timestamp NOT NULL DEFAULT now()
    )
  `);

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS "comments" (
      "id" serial PRIMARY KEY,
      "post_id" integer NOT NULL REFERENCES "posts"("id") ON DELETE CASCADE,
      "author_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "content" text NOT NULL,
      "created_at" timestamp NOT NULL DEFAULT now()
    )
  `);

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS "likes" (
      "id" serial PRIMARY KEY,
      "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "post_id" integer NOT NULL REFERENCES "posts"("id") ON DELETE CASCADE,
      "created_at" timestamp NOT NULL DEFAULT now()
    )
  `);

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS "saves" (
      "id" serial PRIMARY KEY,
      "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "post_id" integer NOT NULL REFERENCES "posts"("id") ON DELETE CASCADE,
      "created_at" timestamp NOT NULL DEFAULT now()
    )
  `);

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS "follows" (
      "id" serial PRIMARY KEY,
      "follower_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "following_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "created_at" timestamp NOT NULL DEFAULT now()
    )
  `);

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS "blocks" (
      "id" serial PRIMARY KEY,
      "blocker_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "blocked_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "created_at" timestamp NOT NULL DEFAULT now()
    )
  `);

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS "notifications" (
      "id" serial PRIMARY KEY,
      "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "actor_id" text REFERENCES "users"("id") ON DELETE SET NULL,
      "type" text NOT NULL,
      "entity_id" text,
      "message" text NOT NULL,
      "is_read" boolean NOT NULL DEFAULT false,
      "created_at" timestamp NOT NULL DEFAULT now()
    )
  `);

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS "conversations" (
      "id" serial PRIMARY KEY,
      "created_at" timestamp NOT NULL DEFAULT now()
    )
  `);

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS "conversation_participants" (
      "id" serial PRIMARY KEY,
      "conversation_id" integer NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
      "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE
    )
  `);

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS "messages" (
      "id" serial PRIMARY KEY,
      "conversation_id" integer NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
      "sender_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "content" text NOT NULL,
      "is_deleted" boolean NOT NULL DEFAULT false,
      "created_at" timestamp NOT NULL DEFAULT now()
    )
  `);

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS "message_reactions" (
      "id" serial PRIMARY KEY,
      "message_id" integer NOT NULL REFERENCES "messages"("id") ON DELETE CASCADE,
      "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "emoji" text NOT NULL,
      "created_at" timestamp NOT NULL DEFAULT now()
    )
  `);

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS "groups" (
      "id" serial PRIMARY KEY,
      "name" text NOT NULL,
      "owner_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "icon_url" text,
      "created_at" timestamp NOT NULL DEFAULT now()
    )
  `);

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS "group_members" (
      "id" serial PRIMARY KEY,
      "group_id" integer NOT NULL REFERENCES "groups"("id") ON DELETE CASCADE,
      "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE
    )
  `);

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS "group_messages" (
      "id" serial PRIMARY KEY,
      "group_id" integer NOT NULL REFERENCES "groups"("id") ON DELETE CASCADE,
      "sender_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "content" text NOT NULL,
      "created_at" timestamp NOT NULL DEFAULT now()
    )
  `);

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS "stories" (
      "id" serial PRIMARY KEY,
      "author_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "image_url" text NOT NULL,
      "caption" text,
      "expires_at" timestamp NOT NULL,
      "created_at" timestamp NOT NULL DEFAULT now()
    )
  `);

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS "story_views" (
      "id" serial PRIMARY KEY,
      "story_id" integer NOT NULL REFERENCES "stories"("id") ON DELETE CASCADE,
      "viewer_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "created_at" timestamp NOT NULL DEFAULT now()
    )
  `);

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS "badges" (
      "id" serial PRIMARY KEY,
      "name" text NOT NULL,
      "description" text NOT NULL,
      "icon_url" text NOT NULL,
      "rarity" text NOT NULL DEFAULT 'common',
      "created_at" timestamp NOT NULL DEFAULT now()
    )
  `);

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS "user_badges" (
      "id" serial PRIMARY KEY,
      "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "badge_id" integer NOT NULL REFERENCES "badges"("id") ON DELETE CASCADE,
      "is_top" boolean NOT NULL DEFAULT false,
      "earned_at" timestamp NOT NULL DEFAULT now()
    )
  `);

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS "servers" (
      "id" serial PRIMARY KEY,
      "name" text NOT NULL,
      "description" text,
      "icon_url" text,
      "owner_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "member_count" integer NOT NULL DEFAULT 0,
      "tags" json DEFAULT '[]',
      "created_at" timestamp NOT NULL DEFAULT now()
    )
  `);

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS "server_members" (
      "id" serial PRIMARY KEY,
      "server_id" integer NOT NULL REFERENCES "servers"("id") ON DELETE CASCADE,
      "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE
    )
  `);

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS "channels" (
      "id" serial PRIMARY KEY,
      "server_id" integer NOT NULL REFERENCES "servers"("id") ON DELETE CASCADE,
      "name" text NOT NULL,
      "type" text NOT NULL DEFAULT 'text',
      "created_at" timestamp NOT NULL DEFAULT now()
    )
  `);

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS "channel_messages" (
      "id" serial PRIMARY KEY,
      "channel_id" integer NOT NULL REFERENCES "channels"("id") ON DELETE CASCADE,
      "sender_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "content" text NOT NULL,
      "created_at" timestamp NOT NULL DEFAULT now()
    )
  `);

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS "server_roles" (
      "id" serial PRIMARY KEY,
      "server_id" integer NOT NULL REFERENCES "servers"("id") ON DELETE CASCADE,
      "name" text NOT NULL,
      "color" text,
      "created_at" timestamp NOT NULL DEFAULT now()
    )
  `);

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS "voice_presence" (
      "id" serial PRIMARY KEY,
      "server_id" integer NOT NULL REFERENCES "servers"("id") ON DELETE CASCADE,
      "channel_id" integer NOT NULL REFERENCES "channels"("id") ON DELETE CASCADE,
      "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "joined_at" timestamp NOT NULL DEFAULT now()
    )
  `);

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS "reels" (
      "id" serial PRIMARY KEY,
      "author_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "video_url" text NOT NULL,
      "caption" text,
      "like_count" integer NOT NULL DEFAULT 0,
      "view_count" integer NOT NULL DEFAULT 0,
      "created_at" timestamp NOT NULL DEFAULT now()
    )
  `);

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS "reel_likes" (
      "id" serial PRIMARY KEY,
      "reel_id" integer NOT NULL REFERENCES "reels"("id") ON DELETE CASCADE,
      "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "created_at" timestamp NOT NULL DEFAULT now()
    )
  `);

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS "call_signaling" (
      "id" serial PRIMARY KEY,
      "conversation_id" integer NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
      "from_user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "to_user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "sdp" text NOT NULL,
      "type" text NOT NULL,
      "call_type" text NOT NULL DEFAULT 'video',
      "created_at" timestamp NOT NULL DEFAULT now()
    )
  `);

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS "ice_candidates" (
      "id" serial PRIMARY KEY,
      "conversation_id" integer NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
      "from_user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "candidate" text NOT NULL,
      "sdp_mid" text,
      "sdp_m_line_index" integer,
      "created_at" timestamp NOT NULL DEFAULT now()
    )
  `);

  // Migration safety: add new columns in case Drizzle push didn't run correctly
  await pgPool.query(`ALTER TABLE IF EXISTS posts ADD COLUMN IF NOT EXISTS media_url text`);
  await pgPool.query(`ALTER TABLE IF EXISTS stories ADD COLUMN IF NOT EXISTS media_url text`);
  await pgPool.query(`ALTER TABLE IF EXISTS stories ADD COLUMN IF NOT EXISTS type text DEFAULT 'image'`);
  await pgPool.query(`ALTER TABLE IF EXISTS stories ADD COLUMN IF NOT EXISTS text_overlay json`);
  await pgPool.query(`ALTER TABLE IF EXISTS stories ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0`);
  await pgPool.query(`ALTER TABLE IF EXISTS story_views ADD COLUMN IF NOT EXISTS viewed_at timestamp NOT NULL DEFAULT now()`);
  await pgPool.query(`ALTER TABLE IF EXISTS badges ADD COLUMN IF NOT EXISTS color text DEFAULT '#7c3aed'`);

  logger.info("All database tables verified");
}

async function ensureAdminUser() {
  const adminEmail = process.env["ADMIN_EMAIL"];
  const adminPassword = process.env["ADMIN_PASSWORD"];
  if (!adminEmail || !adminPassword) return;

  const bcrypt = await import("bcryptjs");
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const existing = await pgPool.query(`SELECT id FROM users WHERE email = $1`, [adminEmail]);
  if (existing.rows.length > 0) {
    await pgPool.query(
      `UPDATE users SET is_admin = true, password_hash = $1 WHERE email = $2`,
      [passwordHash, adminEmail]
    );
    logger.info({ email: adminEmail }, "Admin user updated");
  } else {
    const { nanoid } = await import("nanoid");
    const id = nanoid();
    const username = adminEmail.split("@")[0]!.replace(/[^a-z0-9_]/gi, "_").toLowerCase();
    await pgPool.query(
      `INSERT INTO users (id, username, email, password_hash, display_name, is_admin, onboarding_completed)
       VALUES ($1, $2, $3, $4, $5, true, true)
       ON CONFLICT (email) DO UPDATE SET is_admin = true, password_hash = $4`,
      [id, username, adminEmail, passwordHash, username]
    );
    logger.info({ email: adminEmail }, "Admin user created");
  }
}

async function startKeepAlive() {
  const selfUrl = process.env["RENDER_EXTERNAL_URL"];
  if (!selfUrl) return;
  setInterval(
    () => {
      fetch(`${selfUrl}/api/healthz`)
        .then(() => logger.info("Keep-alive ping OK"))
        .catch((err) => logger.warn({ err }, "Keep-alive ping failed"));
    },
    14 * 60 * 1000,
  );
  logger.info({ selfUrl }, "Keep-alive started");
}

async function start() {
  await ensureSchema();
  await ensureAdminUser();

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
    startKeepAlive();
  });
}

start().catch((err) => {
  logger.error({ err }, "Failed to start server");
  process.exit(1);
});