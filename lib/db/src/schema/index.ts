import { pgTable, text, integer, boolean, timestamp, serial, json } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  displayName: text("display_name").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  bannerUrl: text("banner_url"),
  isVerified: boolean("is_verified").notNull().default(false),
  isAdmin: boolean("is_admin").notNull().default(false),
  isBanned: boolean("is_banned").notNull().default(false),
  rizzScore: integer("rizz_score").notNull().default(0),
  followerCount: integer("follower_count").notNull().default(0),
  followingCount: integer("following_count").notNull().default(0),
  postCount: integer("post_count").notNull().default(0),
  onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
  customStatus: text("custom_status"),
  dnd: boolean("dnd").notNull().default(false),
  interests: json("interests").$type<string[]>().default([]),
  lastSeenAt: timestamp("last_seen_at"),
  pushSubscription: json("push_subscription"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const postsTable = pgTable("posts", {
  id: serial("id").primaryKey(),
  authorId: text("author_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  imageUrl: text("image_url"),
  videoUrl: text("video_url"),
  tags: json("tags").$type<string[]>().default([]),
  likeCount: integer("like_count").notNull().default(0),
  commentCount: integer("comment_count").notNull().default(0),
  repostCount: integer("repost_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const commentsTable = pgTable("comments", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => postsTable.id, { onDelete: "cascade" }),
  authorId: text("author_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const likesTable = pgTable("likes", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  postId: integer("post_id").notNull().references(() => postsTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const savesTable = pgTable("saves", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  postId: integer("post_id").notNull().references(() => postsTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const followsTable = pgTable("follows", {
  id: serial("id").primaryKey(),
  followerId: text("follower_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  followingId: text("following_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const blocksTable = pgTable("blocks", {
  id: serial("id").primaryKey(),
  blockerId: text("blocker_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  blockedId: text("blocked_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  actorId: text("actor_id").references(() => usersTable.id, { onDelete: "set null" }),
  type: text("type").notNull(),
  entityId: text("entity_id"),
  message: text("message").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const conversationsTable = pgTable("conversations", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const conversationParticipantsTable = pgTable("conversation_participants", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversationsTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
});

export const messagesTable = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversationsTable.id, { onDelete: "cascade" }),
  senderId: text("sender_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  isDeleted: boolean("is_deleted").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const messageReactionsTable = pgTable("message_reactions", {
  id: serial("id").primaryKey(),
  messageId: integer("message_id").notNull().references(() => messagesTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  emoji: text("emoji").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const groupsTable = pgTable("groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  ownerId: text("owner_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  iconUrl: text("icon_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const groupMembersTable = pgTable("group_members", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull().references(() => groupsTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
});

export const groupMessagesTable = pgTable("group_messages", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull().references(() => groupsTable.id, { onDelete: "cascade" }),
  senderId: text("sender_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const storiesTable = pgTable("stories", {
  id: serial("id").primaryKey(),
  authorId: text("author_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  imageUrl: text("image_url").notNull(),
  caption: text("caption"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const storyViewsTable = pgTable("story_views", {
  id: serial("id").primaryKey(),
  storyId: integer("story_id").notNull().references(() => storiesTable.id, { onDelete: "cascade" }),
  viewerId: text("viewer_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const badgesTable = pgTable("badges", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  iconUrl: text("icon_url").notNull(),
  rarity: text("rarity").notNull().default("common"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const userBadgesTable = pgTable("user_badges", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  badgeId: integer("badge_id").notNull().references(() => badgesTable.id, { onDelete: "cascade" }),
  isTop: boolean("is_top").notNull().default(false),
  earnedAt: timestamp("earned_at").notNull().defaultNow(),
});

export const serversTable = pgTable("servers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  iconUrl: text("icon_url"),
  ownerId: text("owner_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  memberCount: integer("member_count").notNull().default(0),
  tags: json("tags").$type<string[]>().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const serverMembersTable = pgTable("server_members", {
  id: serial("id").primaryKey(),
  serverId: integer("server_id").notNull().references(() => serversTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
});

export const channelsTable = pgTable("channels", {
  id: serial("id").primaryKey(),
  serverId: integer("server_id").notNull().references(() => serversTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull().default("text"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const channelMessagesTable = pgTable("channel_messages", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").notNull().references(() => channelsTable.id, { onDelete: "cascade" }),
  senderId: text("sender_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const serverRolesTable = pgTable("server_roles", {
  id: serial("id").primaryKey(),
  serverId: integer("server_id").notNull().references(() => serversTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const voicePresenceTable = pgTable("voice_presence", {
  id: serial("id").primaryKey(),
  serverId: integer("server_id").notNull().references(() => serversTable.id, { onDelete: "cascade" }),
  channelId: integer("channel_id").notNull().references(() => channelsTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
});

export const reelsTable = pgTable("reels", {
  id: serial("id").primaryKey(),
  authorId: text("author_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  videoUrl: text("video_url").notNull(),
  caption: text("caption"),
  likeCount: integer("like_count").notNull().default(0),
  viewCount: integer("view_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const reelLikesTable = pgTable("reel_likes", {
  id: serial("id").primaryKey(),
  reelId: integer("reel_id").notNull().references(() => reelsTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const callSignalingTable = pgTable("call_signaling", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversationsTable.id, { onDelete: "cascade" }),
  fromUserId: text("from_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  toUserId: text("to_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  sdp: text("sdp").notNull(),
  type: text("type").notNull(),
  callType: text("call_type").notNull().default("video"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const iceCandidatesTable = pgTable("ice_candidates", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversationsTable.id, { onDelete: "cascade" }),
  fromUserId: text("from_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  candidate: text("candidate").notNull(),
  sdpMid: text("sdp_mid"),
  sdpMLineIndex: integer("sdp_m_line_index"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
