import { Router } from "express";
import { db } from "../lib/db.js";
import { pgPool } from "../app.js";
import { usersTable, badgesTable, userBadgesTable, groupsTable, serversTable, postsTable } from "@workspace/db";
import { eq, or, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { requireAuth } from "../lib/auth.js";

const router = Router();

async function checkAdmin(userId: string): Promise<boolean> {
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, userId) });
  return user?.isAdmin ?? false;
}

router.get("/check", requireAuth, async (req, res) => {
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, req.session!.userId!) });
  res.json({ isAdmin: user?.isAdmin ?? false });
});

router.post("/claim", requireAuth, async (req, res) => {
  const { password } = req.body as { password: string };
  const adminPass = process.env["ADMIN_PASSWORD"];
  if (!adminPass) { res.status(403).json({ error: "ADMIN_PASSWORD env var not set on server" }); return; }
  if (!password || password !== adminPass) { res.status(403).json({ error: "Wrong password" }); return; }
  await db.update(usersTable).set({ isAdmin: true }).where(eq(usersTable.id, req.session!.userId!));
  res.json({ ok: true });
});

router.post("/owner-login", async (req, res) => {
  const { username, password } = req.body as { username: string; password: string };
  if (!username || !password) { res.status(400).json({ error: "username and password required" }); return; }
  const user = await db.query.usersTable.findFirst({ where: or(eq(usersTable.username, username), eq(usersTable.email, username)) });
  if (!user || !user.passwordHash) { res.status(401).json({ error: "Invalid credentials" }); return; }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) { res.status(401).json({ error: "Invalid credentials" }); return; }
  if (!user.isAdmin) { res.status(403).json({ error: "Not an admin account" }); return; }
  req.session!.userId = user.id;
  res.json({ ok: true, username: user.username });
});

router.get("/stats", requireAuth, async (req, res) => {
  if (!await checkAdmin(req.session!.userId!)) { res.status(403).json({ error: "Forbidden" }); return; }
  const [usersRow] = await db.select({ c: sql<number>`count(*)::int` }).from(usersTable);
  const [postsRow] = await db.select({ c: sql<number>`count(*)::int` }).from(postsTable);
  const [serversRow] = await db.select({ c: sql<number>`count(*)::int` }).from(serversTable);
  const [badgesRow] = await db.select({ c: sql<number>`count(*)::int` }).from(badgesTable);
  res.json({ users: usersRow?.c ?? 0, posts: postsRow?.c ?? 0, servers: serversRow?.c ?? 0, badges: badgesRow?.c ?? 0 });
});

router.get("/users", requireAuth, async (req, res) => {
  if (!await checkAdmin(req.session!.userId!)) { res.status(403).json({ error: "Forbidden" }); return; }
  const users = await db.query.usersTable.findMany({ limit: 200 });
  res.json({ users: users.map(u => ({ id: u.id, username: u.username, email: u.email, displayName: u.displayName, avatarUrl: u.avatarUrl, isAdmin: u.isAdmin, isBanned: u.isBanned, isVerified: u.isVerified, createdAt: u.createdAt })) });
});

router.post("/users/:id/ban", requireAuth, async (req, res) => {
  if (!await checkAdmin(req.session!.userId!)) { res.status(403).json({ error: "Forbidden" }); return; }
  await db.update(usersTable).set({ isBanned: true }).where(eq(usersTable.id, String(req.params["id"])));
  res.json({ ok: true });
});

router.post("/users/:id/unban", requireAuth, async (req, res) => {
  if (!await checkAdmin(req.session!.userId!)) { res.status(403).json({ error: "Forbidden" }); return; }
  await db.update(usersTable).set({ isBanned: false }).where(eq(usersTable.id, String(req.params["id"])));
  res.json({ ok: true });
});

router.post("/users/:id/verify", requireAuth, async (req, res) => {
  if (!await checkAdmin(req.session!.userId!)) { res.status(403).json({ error: "Forbidden" }); return; }
  await db.update(usersTable).set({ isVerified: true }).where(eq(usersTable.id, String(req.params["id"])));
  res.json({ ok: true });
});

router.post("/users/:id/make-admin", requireAuth, async (req, res) => {
  if (!await checkAdmin(req.session!.userId!)) { res.status(403).json({ error: "Forbidden" }); return; }
  await db.update(usersTable).set({ isAdmin: true }).where(eq(usersTable.id, String(req.params["id"])));
  res.json({ ok: true });
});

router.get("/badges", requireAuth, async (req, res) => {
  if (!await checkAdmin(req.session!.userId!)) { res.status(403).json({ error: "Forbidden" }); return; }
  const result = await pgPool.query(`SELECT id, name, description, icon_url as icon, rarity, COALESCE(color, '#7c3aed') as color FROM badges ORDER BY created_at DESC`);
  res.json({ badges: result.rows });
});

router.post("/badges", requireAuth, async (req, res) => {
  if (!await checkAdmin(req.session!.userId!)) { res.status(403).json({ error: "Forbidden" }); return; }
  const { name, description, icon, rarity, color } = req.body as { name: string; description?: string; icon?: string; rarity?: string; color?: string };
  if (!name) { res.status(400).json({ error: "name required" }); return; }
  const result = await pgPool.query(
    `INSERT INTO badges (name, description, icon_url, rarity, color) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, description, icon_url as icon, rarity, color`,
    [name, description ?? "", icon ?? "🏅", rarity ?? "common", color ?? "#7c3aed"]
  );
  res.status(201).json(result.rows[0]);
});

router.delete("/badges/:id", requireAuth, async (req, res) => {
  if (!await checkAdmin(req.session!.userId!)) { res.status(403).json({ error: "Forbidden" }); return; }
  const badgeId = Number(req.params["id"]);
  await db.delete(userBadgesTable).where(eq(userBadgesTable.badgeId, badgeId));
  await db.delete(badgesTable).where(eq(badgesTable.id, badgeId));
  res.json({ ok: true });
});

router.post("/badges/:id/award", requireAuth, async (req, res) => {
  if (!await checkAdmin(req.session!.userId!)) { res.status(403).json({ error: "Forbidden" }); return; }
  const badgeId = Number(req.params["id"]);
  const { userId } = req.body as { userId: string };
  if (!userId) { res.status(400).json({ error: "userId required" }); return; }
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, userId) });
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  await db.insert(userBadgesTable).values({ userId, badgeId, isTop: false }).onConflictDoNothing();
  res.json({ ok: true });
});

router.get("/groups", requireAuth, async (req, res) => {
  if (!await checkAdmin(req.session!.userId!)) { res.status(403).json({ error: "Forbidden" }); return; }
  const groups = await db.query.groupsTable.findMany({ limit: 200 });
  res.json({ groups: groups.map(g => ({ id: g.id, name: g.name })) });
});

router.delete("/groups/:id", requireAuth, async (req, res) => {
  if (!await checkAdmin(req.session!.userId!)) { res.status(403).json({ error: "Forbidden" }); return; }
  await db.delete(groupsTable).where(eq(groupsTable.id, Number(req.params["id"])));
  res.json({ ok: true });
});

router.get("/servers", requireAuth, async (req, res) => {
  if (!await checkAdmin(req.session!.userId!)) { res.status(403).json({ error: "Forbidden" }); return; }
  const servers = await db.query.serversTable.findMany({ limit: 200 });
  res.json({ servers: servers.map(s => ({ id: s.id, name: s.name, memberCount: s.memberCount, ownerId: s.ownerId })) });
});

router.delete("/servers/:id", requireAuth, async (req, res) => {
  if (!await checkAdmin(req.session!.userId!)) { res.status(403).json({ error: "Forbidden" }); return; }
  await db.delete(serversTable).where(eq(serversTable.id, Number(req.params["id"])));
  res.json({ ok: true });
});

export default router;
