import { Router } from "express";
import { db } from "../lib/db.js";
import { channelsTable, channelMessagesTable, serverMembersTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { sendSseEvent } from "../lib/sse.js";

const router = Router();

router.get("/channels/:channelId/messages", requireAuth, async (req, res) => {
  const channelId = Number(req.params["channelId"]);
  const msgs = await db.query.channelMessagesTable.findMany({
    where: eq(channelMessagesTable.channelId, channelId),
    orderBy: [desc(channelMessagesTable.createdAt)],
    limit: 100,
  });
  const enriched = await Promise.all(msgs.reverse().map(async (m) => {
    const sender = await db.query.usersTable.findFirst({ where: eq(usersTable.id, m.senderId) });
    return {
      id: m.id,
      content: m.content,
      senderId: m.senderId,
      conversationId: null,
      groupId: null,
      createdAt: m.createdAt.toISOString(),
      sender: sender ? { id: sender.id, username: sender.username, displayName: sender.displayName, avatarUrl: sender.avatarUrl } : null,
    };
  }));
  res.json({ messages: enriched });
});

router.post("/channels/:channelId/messages", requireAuth, async (req, res) => {
  const channelId = Number(req.params["channelId"]);
  const { content } = req.body as { content: string };
  const senderId = req.session!.userId!;
  const channel = await db.query.channelsTable.findFirst({ where: eq(channelsTable.id, channelId) });
  const [msg] = await db.insert(channelMessagesTable).values({ channelId, senderId, content }).returning();
  const sender = await db.query.usersTable.findFirst({ where: eq(usersTable.id, senderId) });
  if (channel) {
    const members = await db.query.serverMembersTable.findMany({ where: eq(serverMembersTable.serverId, channel.serverId) });
    for (const m of members) {
      if (m.userId !== senderId) sendSseEvent(m.userId, "new_channel_msg", { channelId });
    }
  }
  res.status(201).json({
    id: msg!.id,
    content: msg!.content,
    senderId: msg!.senderId,
    conversationId: null,
    groupId: null,
    createdAt: msg!.createdAt.toISOString(),
    sender: sender ? { id: sender.id, username: sender.username, displayName: sender.displayName, avatarUrl: sender.avatarUrl } : null,
  });
});

export default router;
