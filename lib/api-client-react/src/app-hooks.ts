import { useQuery, useMutation } from "@tanstack/react-query";
import type {
  UseQueryOptions,
  UseMutationOptions,
  UseQueryResult,
  UseMutationResult,
} from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";
import type { ErrorType } from "./custom-fetch";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface UserBase {
  id: string;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  isVerified?: boolean | null;
  topBadge?: { icon: string; name: string; rarity: string } | null;
}

export interface Post {
  id: string;
  content?: string | null;
  mediaUrl?: string | null;
  tags?: string[];
  mood?: string | null;
  song?: string | null;
  author?: UserBase | null;
  likeCount?: number;
  commentCount?: number;
  isLiked?: boolean;
  isSaved?: boolean;
  createdAt: string;
}

export interface Comment {
  id: string;
  content?: string | null;
  author?: UserBase | null;
  createdAt: string;
}

export interface Conversation {
  id: string;
  participants?: UserBase[];
  lastMessage?: { content: string; createdAt: string } | null;
  unreadCount?: number;
}

export interface Message {
  id: string;
  content: string;
  senderId?: string | null;
  createdAt: string;
  seenAt?: string | null;
}

export interface Group {
  id: string;
  name: string;
  memberCount?: number;
  avatarUrl?: string | null;
}

export interface GroupMessage {
  id: string;
  content: string;
  senderId?: string | null;
  sender?: UserBase | null;
  createdAt: string;
}

export interface Badge {
  id: number;
  name: string;
  icon: string;
  description?: string | null;
  rarity?: string;
}

export interface Server {
  id: string;
  name: string;
  description?: string | null;
  iconUrl?: string | null;
  bannerUrl?: string | null;
  memberCount?: number;
  tags?: string[];
  isJoined?: boolean;
}

export interface Channel {
  id: string;
  name: string;
  serverId: string;
  type?: string;
}

export interface ChannelMessage {
  id: string;
  content: string;
  senderId?: string | null;
  sender?: UserBase | null;
  createdAt: string;
}

export interface Story {
  id: number;
  mediaUrl: string;
  duration?: number;
  author?: UserBase | null;
  createdAt: string;
  viewCount?: number;
  isViewed?: boolean;
}

export interface StoryGroup {
  user: UserBase;
  stories: Story[];
  hasUnviewed?: boolean;
}

export interface Notification {
  id: number;
  type: string;
  content?: string | null;
  isRead?: boolean;
  actor?: UserBase | null;
  postId?: string | null;
  createdAt: string;
}

export interface UserProfile {
  id: string;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  bannerColor?: string | null;
  bio?: string | null;
  isVerified?: boolean | null;
  followerCount?: number;
  followingCount?: number;
  postCount?: number;
  isFollowing?: boolean;
  isFollowedBy?: boolean;
  rizzScore?: number;
}

// ---------------------------------------------------------------------------
// Helper types for hook options
// ---------------------------------------------------------------------------

type QueryOpts<TData> = {
  query?: Partial<UseQueryOptions<TData, ErrorType>>;
};

type MutationOpts<TData, TVars> = {
  mutation?: UseMutationOptions<TData, ErrorType, TVars>;
};

// ---------------------------------------------------------------------------
// Feed
// ---------------------------------------------------------------------------

export function useGetHomeFeed(
  options?: QueryOpts<{ posts: Post[] }>,
): UseQueryResult<{ posts: Post[] }, ErrorType> {
  return useQuery({
    queryKey: ["/api/feed"],
    queryFn: () => customFetch<{ posts: Post[] }>("/api/feed", { credentials: "include" }),
    ...options?.query,
  });
}

export function useGetSavedPosts(
  options?: QueryOpts<{ posts: Post[] }>,
): UseQueryResult<{ posts: Post[] }, ErrorType> {
  return useQuery({
    queryKey: ["/api/posts/saved"],
    queryFn: () => customFetch<{ posts: Post[] }>("/api/posts/saved", { credentials: "include" }),
    ...options?.query,
  });
}

// ---------------------------------------------------------------------------
// Posts – mutations
// ---------------------------------------------------------------------------

export function useCreatePost(
  options?: MutationOpts<Post, { data: { content: string; mediaUrl?: string; tags?: string[]; mood?: string; song?: string } }>,
): UseMutationResult<Post, ErrorType, { data: { content: string; mediaUrl?: string; tags?: string[]; mood?: string; song?: string } }> {
  return useMutation({
    mutationFn: ({ data }) =>
      customFetch<Post>("/api/posts", {
        method: "POST",
        body: JSON.stringify(data),
        credentials: "include",
      }),
    ...options?.mutation,
  });
}

export function useDeletePost(
  options?: MutationOpts<void, { postId: string }>,
): UseMutationResult<void, ErrorType, { postId: string }> {
  return useMutation({
    mutationFn: ({ postId }) =>
      customFetch<void>(`/api/posts/${postId}`, { method: "DELETE", credentials: "include" }),
    ...options?.mutation,
  });
}

export function useLikePost(
  options?: MutationOpts<void, { postId: string }>,
): UseMutationResult<void, ErrorType, { postId: string }> {
  return useMutation({
    mutationFn: ({ postId }) =>
      customFetch<void>(`/api/posts/${postId}/like`, { method: "POST", credentials: "include" }),
    ...options?.mutation,
  });
}

export function useUnlikePost(
  options?: MutationOpts<void, { postId: string }>,
): UseMutationResult<void, ErrorType, { postId: string }> {
  return useMutation({
    mutationFn: ({ postId }) =>
      customFetch<void>(`/api/posts/${postId}/like`, { method: "DELETE", credentials: "include" }),
    ...options?.mutation,
  });
}

export function useSavePost(
  options?: MutationOpts<void, { postId: string }>,
): UseMutationResult<void, ErrorType, { postId: string }> {
  return useMutation({
    mutationFn: ({ postId }) =>
      customFetch<void>(`/api/posts/${postId}/save`, { method: "POST", credentials: "include" }),
    ...options?.mutation,
  });
}

export function useUnsavePost(
  options?: MutationOpts<void, { postId: string }>,
): UseMutationResult<void, ErrorType, { postId: string }> {
  return useMutation({
    mutationFn: ({ postId }) =>
      customFetch<void>(`/api/posts/${postId}/save`, { method: "DELETE", credentials: "include" }),
    ...options?.mutation,
  });
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export function useGetPostComments(
  postId: string,
  options?: QueryOpts<{ comments: Comment[] }>,
): UseQueryResult<{ comments: Comment[] }, ErrorType> {
  return useQuery({
    queryKey: [`/api/posts/${postId}/comments`],
    queryFn: () => customFetch<{ comments: Comment[] }>(`/api/posts/${postId}/comments`, { credentials: "include" }),
    ...options?.query,
  });
}

export function useCreateComment(
  options?: MutationOpts<Comment, { postId: string; data: { content: string } }>,
): UseMutationResult<Comment, ErrorType, { postId: string; data: { content: string } }> {
  return useMutation({
    mutationFn: ({ postId, data }) =>
      customFetch<Comment>(`/api/posts/${postId}/comments`, {
        method: "POST",
        body: JSON.stringify(data),
        credentials: "include",
      }),
    ...options?.mutation,
  });
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

export function useGetBadges(
  options?: QueryOpts<{ badges: Badge[] }>,
): UseQueryResult<{ badges: Badge[] }, ErrorType> {
  return useQuery({
    queryKey: ["/api/badges"],
    queryFn: () => customFetch<{ badges: Badge[] }>("/api/badges", { credentials: "include" }),
    ...options?.query,
  });
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export function useListNotifications(
  options?: QueryOpts<{ notifications: Notification[] }>,
): UseQueryResult<{ notifications: Notification[] }, ErrorType> {
  return useQuery({
    queryKey: ["/api/notifications"],
    queryFn: () => customFetch<{ notifications: Notification[] }>("/api/notifications", { credentials: "include" }),
    ...options?.query,
  });
}

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

export function useListStories(
  options?: QueryOpts<StoryGroup[]>,
): UseQueryResult<StoryGroup[], ErrorType> {
  return useQuery({
    queryKey: ["/api/stories"],
    queryFn: async () => {
      const res = await customFetch<{ storyGroups: StoryGroup[] } | StoryGroup[]>("/api/stories", { credentials: "include" });
      return Array.isArray(res) ? res : (res as { storyGroups: StoryGroup[] }).storyGroups ?? [];
    },
    ...options?.query,
  });
}

export function useCreateStory(
  options?: MutationOpts<Story, { data: { mediaUrl: string; duration?: number } }>,
): UseMutationResult<Story, ErrorType, { data: { mediaUrl: string; duration?: number } }> {
  return useMutation({
    mutationFn: ({ data }) =>
      customFetch<Story>("/api/stories", {
        method: "POST",
        body: JSON.stringify(data),
        credentials: "include",
      }),
    ...options?.mutation,
  });
}

export function useViewStory(
  options?: MutationOpts<void, { storyId: number }>,
): UseMutationResult<void, ErrorType, { storyId: number }> {
  return useMutation({
    mutationFn: ({ storyId }) =>
      customFetch<void>(`/api/stories/${storyId}/view`, { method: "POST", credentials: "include" }),
    ...options?.mutation,
  });
}

// ---------------------------------------------------------------------------
// Direct messages & conversations
// ---------------------------------------------------------------------------

export function useListConversations(
  options?: QueryOpts<{ conversations: Conversation[] }>,
): UseQueryResult<{ conversations: Conversation[] }, ErrorType> {
  return useQuery({
    queryKey: ["/api/dm/conversations"],
    queryFn: () => customFetch<{ conversations: Conversation[] }>("/api/dm/conversations", { credentials: "include" }),
    ...options?.query,
  });
}

export function useStartConversation(
  options?: MutationOpts<Conversation, { data: { userId: string } }>,
): UseMutationResult<Conversation, ErrorType, { data: { userId: string } }> {
  return useMutation({
    mutationFn: ({ data }) =>
      customFetch<Conversation>("/api/dm/conversations", {
        method: "POST",
        body: JSON.stringify(data),
        credentials: "include",
      }),
    ...options?.mutation,
  });
}

export function useGetDmMessages(
  conversationId: string,
  options?: QueryOpts<{ messages: Message[] }>,
): UseQueryResult<{ messages: Message[] }, ErrorType> {
  return useQuery({
    queryKey: [`/api/dm/conversations/${conversationId}/messages`],
    queryFn: () =>
      customFetch<{ messages: Message[] }>(`/api/dm/conversations/${conversationId}/messages`, { credentials: "include" }),
    ...options?.query,
  });
}

export function useSendDmMessage(
  options?: MutationOpts<Message, { conversationId: string; data: { content: string } }>,
): UseMutationResult<Message, ErrorType, { conversationId: string; data: { content: string } }> {
  return useMutation({
    mutationFn: ({ conversationId, data }) =>
      customFetch<Message>(`/api/dm/conversations/${conversationId}/messages`, {
        method: "POST",
        body: JSON.stringify(data),
        credentials: "include",
      }),
    ...options?.mutation,
  });
}

export function useSendTypingIndicator(
  options?: MutationOpts<void, { conversationId?: string; groupId?: string }>,
): UseMutationResult<void, ErrorType, { conversationId?: string; groupId?: string }> {
  return useMutation({
    mutationFn: (data) =>
      customFetch<void>("/api/dm/typing", {
        method: "POST",
        body: JSON.stringify(data),
        credentials: "include",
      }),
    ...options?.mutation,
  });
}

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

export function useListGroups(
  options?: QueryOpts<{ groups: Group[] }>,
): UseQueryResult<{ groups: Group[] }, ErrorType> {
  return useQuery({
    queryKey: ["/api/groups"],
    queryFn: () => customFetch<{ groups: Group[] }>("/api/groups", { credentials: "include" }),
    ...options?.query,
  });
}

export function useCreateGroup(
  options?: MutationOpts<Group, { data: { name: string; memberIds?: string[] } }>,
): UseMutationResult<Group, ErrorType, { data: { name: string; memberIds?: string[] } }> {
  return useMutation({
    mutationFn: ({ data }) =>
      customFetch<Group>("/api/groups", {
        method: "POST",
        body: JSON.stringify(data),
        credentials: "include",
      }),
    ...options?.mutation,
  });
}

export function useGetGroupMessages(
  groupId: string,
  options?: QueryOpts<{ messages: GroupMessage[] }>,
): UseQueryResult<{ messages: GroupMessage[] }, ErrorType> {
  return useQuery({
    queryKey: [`/api/groups/${groupId}/messages`],
    queryFn: () =>
      customFetch<{ messages: GroupMessage[] }>(`/api/groups/${groupId}/messages`, { credentials: "include" }),
    ...options?.query,
  });
}

export function useSendGroupMessage(
  options?: MutationOpts<GroupMessage, { groupId: string; data: { content: string } }>,
): UseMutationResult<GroupMessage, ErrorType, { groupId: string; data: { content: string } }> {
  return useMutation({
    mutationFn: ({ groupId, data }) =>
      customFetch<GroupMessage>(`/api/groups/${groupId}/messages`, {
        method: "POST",
        body: JSON.stringify(data),
        credentials: "include",
      }),
    ...options?.mutation,
  });
}

// ---------------------------------------------------------------------------
// Servers
// ---------------------------------------------------------------------------

export function useGetMyServers(
  options?: QueryOpts<{ servers: Server[] }>,
): UseQueryResult<{ servers: Server[] }, ErrorType> {
  return useQuery({
    queryKey: ["/api/servers/me"],
    queryFn: () => customFetch<{ servers: Server[] }>("/api/servers/me", { credentials: "include" }),
    ...options?.query,
  });
}

export function useListServers(
  query?: { search?: string; tag?: string },
  options?: QueryOpts<{ servers: Server[] }>,
): UseQueryResult<{ servers: Server[] }, ErrorType> {
  const params = new URLSearchParams();
  if (query?.search) params.set("q", query.search);
  if (query?.tag) params.set("tag", query.tag);
  const qs = params.toString();
  return useQuery({
    queryKey: ["/api/servers", qs],
    queryFn: () =>
      customFetch<{ servers: Server[] }>(`/api/servers${qs ? `?${qs}` : ""}`, { credentials: "include" }),
    ...options?.query,
  });
}

export function useGetServer(
  serverId: string,
  options?: QueryOpts<Server>,
): UseQueryResult<Server, ErrorType> {
  return useQuery({
    queryKey: [`/api/servers/${serverId}`],
    queryFn: () => customFetch<Server>(`/api/servers/${serverId}`, { credentials: "include" }),
    ...options?.query,
  });
}

export function useCreateServer(
  options?: MutationOpts<Server, { data: { name: string; description?: string; tags?: string[] } }>,
): UseMutationResult<Server, ErrorType, { data: { name: string; description?: string; tags?: string[] } }> {
  return useMutation({
    mutationFn: ({ data }) =>
      customFetch<Server>("/api/servers", {
        method: "POST",
        body: JSON.stringify(data),
        credentials: "include",
      }),
    ...options?.mutation,
  });
}

export function useJoinServer(
  options?: MutationOpts<void, { serverId: string }>,
): UseMutationResult<void, ErrorType, { serverId: string }> {
  return useMutation({
    mutationFn: ({ serverId }) =>
      customFetch<void>(`/api/servers/${serverId}/join`, { method: "POST", credentials: "include" }),
    ...options?.mutation,
  });
}

export function useLeaveServer(
  options?: MutationOpts<void, { serverId: string }>,
): UseMutationResult<void, ErrorType, { serverId: string }> {
  return useMutation({
    mutationFn: ({ serverId }) =>
      customFetch<void>(`/api/servers/${serverId}/leave`, { method: "POST", credentials: "include" }),
    ...options?.mutation,
  });
}

export function useGetServerChannels(
  serverId: string,
  options?: QueryOpts<{ channels: Channel[] }>,
): UseQueryResult<{ channels: Channel[] }, ErrorType> {
  return useQuery({
    queryKey: [`/api/servers/${serverId}/channels`],
    queryFn: () =>
      customFetch<{ channels: Channel[] }>(`/api/servers/${serverId}/channels`, { credentials: "include" }),
    ...options?.query,
  });
}

export function useCreateChannel(
  options?: MutationOpts<Channel, { serverId: string; data: { name: string; type?: string } }>,
): UseMutationResult<Channel, ErrorType, { serverId: string; data: { name: string; type?: string } }> {
  return useMutation({
    mutationFn: ({ serverId, data }) =>
      customFetch<Channel>(`/api/servers/${serverId}/channels`, {
        method: "POST",
        body: JSON.stringify(data),
        credentials: "include",
      }),
    ...options?.mutation,
  });
}

export function useGetChannelMessages(
  channelId: string,
  options?: QueryOpts<{ messages: ChannelMessage[] }>,
): UseQueryResult<{ messages: ChannelMessage[] }, ErrorType> {
  return useQuery({
    queryKey: [`/api/channels/${channelId}/messages`],
    queryFn: () =>
      customFetch<{ messages: ChannelMessage[] }>(`/api/channels/${channelId}/messages`, { credentials: "include" }),
    ...options?.query,
  });
}

export function useSendChannelMessage(
  options?: MutationOpts<ChannelMessage, { channelId: string; data: { content: string } }>,
): UseMutationResult<ChannelMessage, ErrorType, { channelId: string; data: { content: string } }> {
  return useMutation({
    mutationFn: ({ channelId, data }) =>
      customFetch<ChannelMessage>(`/api/channels/${channelId}/messages`, {
        method: "POST",
        body: JSON.stringify(data),
        credentials: "include",
      }),
    ...options?.mutation,
  });
}

// ---------------------------------------------------------------------------
// Users / profiles
// ---------------------------------------------------------------------------

export function useGetUserProfile(
  userId: string,
  options?: QueryOpts<UserProfile>,
): UseQueryResult<UserProfile, ErrorType> {
  return useQuery({
    queryKey: [`/api/users/${userId}`],
    queryFn: () => customFetch<UserProfile>(`/api/users/${userId}`, { credentials: "include" }),
    ...options?.query,
  });
}

export function useGetMyProfile(
  options?: QueryOpts<UserProfile>,
): UseQueryResult<UserProfile, ErrorType> {
  return useQuery({
    queryKey: ["/api/users/me"],
    queryFn: () => customFetch<UserProfile>("/api/users/me", { credentials: "include" }),
    ...options?.query,
  });
}

export function useUpdateMyProfile(
  options?: MutationOpts<UserProfile, { data: Partial<UserProfile> }>,
): UseMutationResult<UserProfile, ErrorType, { data: Partial<UserProfile> }> {
  return useMutation({
    mutationFn: ({ data }) =>
      customFetch<UserProfile>("/api/users/me", {
        method: "PUT",
        body: JSON.stringify(data),
        credentials: "include",
      }),
    ...options?.mutation,
  });
}

export function useGetUserPosts(
  userId: string,
  options?: QueryOpts<{ posts: Post[] }>,
): UseQueryResult<{ posts: Post[] }, ErrorType> {
  return useQuery({
    queryKey: [`/api/users/${userId}/posts`],
    queryFn: () => customFetch<{ posts: Post[] }>(`/api/users/${userId}/posts`, { credentials: "include" }),
    ...options?.query,
  });
}

export function useGetUserBadges(
  userId: string,
  options?: QueryOpts<{ badges: Badge[] }>,
): UseQueryResult<{ badges: Badge[] }, ErrorType> {
  return useQuery({
    queryKey: [`/api/users/${userId}/badges`],
    queryFn: () => customFetch<{ badges: Badge[] }>(`/api/users/${userId}/badges`, { credentials: "include" }),
    ...options?.query,
  });
}

export function useFollowUser(
  options?: MutationOpts<void, { userId: string }>,
): UseMutationResult<void, ErrorType, { userId: string }> {
  return useMutation({
    mutationFn: ({ userId }) =>
      customFetch<void>(`/api/users/${userId}/follow`, { method: "POST", credentials: "include" }),
    ...options?.mutation,
  });
}

export function useUnfollowUser(
  options?: MutationOpts<void, { userId: string }>,
): UseMutationResult<void, ErrorType, { userId: string }> {
  return useMutation({
    mutationFn: ({ userId }) =>
      customFetch<void>(`/api/users/${userId}/follow`, { method: "DELETE", credentials: "include" }),
    ...options?.mutation,
  });
}
