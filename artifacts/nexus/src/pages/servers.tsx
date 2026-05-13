import { useState, useEffect, useRef, useCallback } from "react";
import { UserProfilePopup } from "@/components/UserProfilePopup";
import { Layout } from "@/components/Layout";
import { Avatar } from "@/components/Avatar";
import { EmojiPicker } from "@/components/EmojiPicker";
import { GifPicker } from "@/components/GifPicker";
import { MessageReactions } from "@/components/MessageReactions";
import {
  useGetMyServers,
  useListServers,
  useCreateServer,
  useJoinServer,
  useLeaveServer,
  useGetServer,
  useGetServerChannels as useListChannels,
  useGetChannelMessages,
  useSendChannelMessage,
  useCreateChannel,
} from "@workspace/api-client-react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { formatRelativeTime, cn, renderWithEmojis } from "@/lib/utils";
import {
  Plus, Hash, Send, Server, ArrowLeft, Smile, Loader2,
  Volume2, Users, Settings, Crown, Tag, Image, Mic, MicOff,
  Headphones, Phone, PhoneOff, Copy, Trash2, MoreHorizontal, Reply,
  ShieldOff, UserMinus, MessageCircle, Eye, Forward
} from "lucide-react";
import type { Server as ServerType, Channel } from "@workspace/api-client-react";

interface VoiceUser { id: string; username?: string; displayName?: string; avatarUrl?: string | null; }
interface ServerRole { id: number; name: string; color: string; hoist: boolean; isAdmin: boolean; }

const SERVER_TAGS = ["Gaming", "Music", "Art", "Tech", "Anime", "Movies", "Fitness", "Study", "Memes", "IRL"];

export default function ServersPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [activeServer, setActiveServer] = useState<ServerType | null>(null);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [activeVoiceChannel, setActiveVoiceChannel] = useState<Channel | null>(null);
  const [joinedVoice, setJoinedVoice] = useState<number | null>(null);
  const [micMuted, setMicMuted] = useState(false);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [showCreateServer, setShowCreateServer] = useState(false);
  const [newServerName, setNewServerName] = useState("");
  const [newServerTags, setNewServerTags] = useState<string[]>([]);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelType, setNewChannelType] = useState<"text" | "voice">("text");
  const [tab, setTab] = useState<"mine" | "discover">("mine");
  const [showEmoji, setShowEmoji] = useState(false);
  const [showGif, setShowGif] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleColor, setNewRoleColor] = useState("#7c3aed");
  const [showCreateRole, setShowCreateRole] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ id: number; x: number; y: number; isMe: boolean; content: string } | null>(null);
  const [profilePopup, setProfilePopup] = useState<{ userId: string } | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [memberMenu, setMemberMenu] = useState<{ userId: string; x: number; y: number } | null>(null);

  const { data: myServers } = useGetMyServers();
  const { data: allServers } = useListServers();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: serverDetail } = useGetServer(activeServer?.id ?? 0);
  const { data: channels } = useListChannels(activeServer?.id ?? 0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: messages, refetch: refetchMessages } = useGetChannelMessages(String(activeChannel?.id ?? ""), { query: { enabled: !!activeChannel } } as any);

  const { data: roles } = useQuery({
    queryKey: [`/api/servers/${activeServer?.id}/roles`],
    queryFn: () => fetch(`/api/servers/${activeServer?.id}/roles`, { credentials: "include" }).then(r => r.json()) as Promise<ServerRole[]>,
    enabled: !!activeServer,
  });

  interface ServerMember { id: string; username?: string | null; displayName?: string | null; avatarUrl?: string | null; customStatus?: string | null; isVerified?: boolean; }
  const { data: membersData, refetch: refetchMembers } = useQuery({
    queryKey: [`/api/servers/${activeServer?.id}/members`],
    queryFn: () => fetch(`/api/servers/${activeServer?.id}/members`, { credentials: "include" }).then(r => r.json()) as Promise<{ members: ServerMember[] }>,
    enabled: !!activeServer && showMembers,
  });
  const serverMembers: ServerMember[] = membersData?.members ?? [];

  const kickMember = useMutation({
    mutationFn: (targetId: string) => fetch(`/api/servers/${activeServer?.id}/members/${targetId}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => { refetchMembers(); qc.invalidateQueries({ queryKey: [`/api/servers/${activeServer?.id}`] }); setMemberMenu(null); },
  });

  const { data: voiceUsers } = useQuery({
    queryKey: [`/api/channels/${activeVoiceChannel?.id}/voice`],
    queryFn: () => fetch(`/api/channels/${activeVoiceChannel?.id}/voice`, { credentials: "include" }).then(r => r.json()) as Promise<VoiceUser[]>,
    enabled: !!activeVoiceChannel,
    refetchInterval: 5000,
  });

  const joinVoice = useMutation({
    mutationFn: async (channelId: number) => {
      setMicError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        setMicStream(stream);
        setMicMuted(false);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Mic access denied";
        setMicError(msg);
      }
      return fetch(`/api/channels/${channelId}/voice/join`, { method: "POST", credentials: "include" }).then(r => r.json());
    },
    onSuccess: (_, channelId) => { setJoinedVoice(channelId); qc.invalidateQueries({ queryKey: [`/api/channels/${channelId}/voice`] }); },
  });

  const leaveVoice = useMutation({
    mutationFn: (channelId: number) => fetch(`/api/channels/${channelId}/voice/leave`, { method: "POST", credentials: "include" }).then(r => r.json()),
    onSuccess: () => {
      setJoinedVoice(null);
      setMicError(null);
      if (micStream) { micStream.getTracks().forEach(t => t.stop()); setMicStream(null); }
      if (activeVoiceChannel) qc.invalidateQueries({ queryKey: [`/api/channels/${activeVoiceChannel.id}/voice`] });
    },
  });

  const createRole = useMutation({
    mutationFn: ({ serverId, name, color }: { serverId: number; name: string; color: string }) =>
      fetch(`/api/servers/${serverId}/roles`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, color }) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [`/api/servers/${activeServer?.id}/roles`] }); setShowCreateRole(false); setNewRoleName(""); },
  });

  // Heartbeat to keep voice presence alive
  useEffect(() => {
    if (!joinedVoice) return;
    const interval = setInterval(() => {
      fetch("/api/voice/heartbeat", { method: "POST", credentials: "include" });
    }, 30000);
    return () => clearInterval(interval);
  }, [joinedVoice]);

  // Leave voice on unmount
  useEffect(() => {
    return () => {
      if (joinedVoice) fetch(`/api/channels/${joinedVoice}/voice/leave`, { method: "POST", credentials: "include" });
    };
  }, [joinedVoice]);

  // Real-time polling for channel messages
  useEffect(() => {
    if (!activeChannel) return;
    const interval = setInterval(() => { refetchMessages(); }, 2500);
    return () => clearInterval(interval);
  }, [activeChannel, refetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Real-time SSE for channel messages
  useEffect(() => {
    const es = new EventSource("/api/events", { withCredentials: true });
    es.addEventListener("new_channel_msg", (e: MessageEvent) => {
      const { channelId } = JSON.parse(e.data) as { channelId: number };
      qc.invalidateQueries({ queryKey: [`/api/channels/${channelId}/messages`] });
    });
    es.onerror = () => { /* reconnect silently */ };
    return () => es.close();
  }, [qc]);

  const { mutate: sendMessage, isPending: sending } = useSendChannelMessage({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: [`/api/channels/${activeChannel?.id}/messages`] });
        setMessageText("");
        refetchMessages();
      },
    },
  });
  const { mutate: createServer } = useCreateServer({
    mutation: {
      onSuccess: (s) => {
        qc.invalidateQueries({ queryKey: ["/api/servers/me"] });
        setActiveServer(s);
        setShowCreateServer(false);
        setNewServerName("");
        setNewServerTags([]);
      },
    },
  });
  const { mutate: joinServer } = useJoinServer({
    mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/servers/me"] }) },
  });
  const { mutate: leaveServer } = useLeaveServer({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["/api/servers/me"] });
        setActiveServer(null);
        setActiveChannel(null);
        setActiveVoiceChannel(null);
      },
    },
  });
  const { mutate: createChannel } = useCreateChannel({
    mutation: {
      onSuccess: (ch) => {
        qc.invalidateQueries({ queryKey: [`/api/servers/${activeServer?.id}/channels`] });
        if (ch.type === "voice") setActiveVoiceChannel(ch);
        else setActiveChannel(ch);
        setShowCreateChannel(false);
        setNewChannelName("");
      },
    },
  });

  const myServerIds = new Set((myServers?.servers ?? []).map((s) => s.id));
  const textChannels = channels?.channels?.filter(c => c.type !== "voice") ?? [];
  const voiceChannels = channels?.channels?.filter(c => c.type === "voice") ?? [];
  const isOwner = activeServer?.ownerId === user?.id;

  const handleSend = () => {
    if (!messageText.trim() || !activeChannel || !activeServer) return;
    sendMessage({ serverId: activeServer.id, channelId: activeChannel.id, data: { content: messageText.trim() } });
  };

  const handleGifSelect = (url: string) => {
    if (!activeChannel || !activeServer) return;
    sendMessage({ serverId: activeServer.id, channelId: activeChannel.id, data: { content: url } });
    setShowGif(false);
  };

  const insertEmoji = (emoji: string) => {
    const el = inputRef.current;
    if (!el) { setMessageText((t) => t + emoji); setShowEmoji(false); return; }
    const start = el.selectionStart ?? messageText.length;
    const end = el.selectionEnd ?? messageText.length;
    setMessageText(messageText.slice(0, start) + emoji + messageText.slice(end));
    setShowEmoji(false);
    setTimeout(() => { el.focus(); el.setSelectionRange(start + emoji.length, start + emoji.length); }, 0);
  };

  const isGifUrl = (content: string) => /^https?:\/\/.*\.(gif|gifv)/.test(content) || content.includes("tenor.com") || content.includes("giphy.com");

  const openCtxMenu = useCallback((e: React.MouseEvent | React.TouchEvent, id: number, isMe: boolean, content: string) => {
    e.preventDefault();
    const x = "touches" in e ? e.changedTouches[0].clientX : (e as React.MouseEvent).clientX;
    const y = "touches" in e ? e.changedTouches[0].clientY : (e as React.MouseEvent).clientY;
    setCtxMenu({ id, x, y, isMe, content });
  }, []);

  const startLongPress = useCallback((id: number, isMe: boolean, content: string) => {
    longPressTimer.current = setTimeout(() => {
      setCtxMenu({ id, x: window.innerWidth / 2, y: window.innerHeight * 0.55, isMe, content });
    }, 500);
  }, []);

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  }, []);

  const copyMsg = (content: string) => {
    navigator.clipboard.writeText(content).catch(() => {});
    setCtxMenu(null);
  };

  const deleteChannelMsg = async (msgId: number) => {
    await fetch(`/api/messages/${msgId}`, { method: "DELETE", credentials: "include" });
    qc.invalidateQueries({ queryKey: [`/api/channels/${activeChannel?.id}/messages`] });
    refetchMessages();
    setCtxMenu(null);
  };

  return (
    <Layout>
      {ctxMenu && (
        <div className="fixed inset-0 z-[60]" onClick={() => setCtxMenu(null)}>
          <div
            className="absolute bg-card border border-card-border rounded-2xl shadow-2xl min-w-[200px] overflow-hidden animate-in zoom-in-95 fade-in duration-150"
            style={{ left: Math.min(ctxMenu.x, window.innerWidth - 220), top: Math.min(ctxMenu.y - 10, window.innerHeight - 220) }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Quick emoji reactions */}
            <div className="flex items-center px-1.5 py-2 border-b border-border/40 gap-0.5">
              {["❤️", "👍", "😂", "😮", "😢", "😡"].map(emoji => (
                <button key={emoji}
                  onClick={() => {
                    const txt = replyTo ? `↩ ${replyTo.slice(0, 40)}…\n${emoji}` : emoji;
                    sendMessage({ serverId: activeServer!.id, channelId: activeChannel!.id, data: { content: txt } });
                    setCtxMenu(null);
                  }}
                  className="w-9 h-9 rounded-xl hover:bg-muted text-xl flex items-center justify-center transition-all hover:scale-125 active:scale-90"
                >{emoji}</button>
              ))}
            </div>
            {/* Actions */}
            <div className="p-1.5 space-y-0.5">
              <button onClick={() => { setReplyTo(ctxMenu.content); setCtxMenu(null); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-muted text-sm font-semibold text-foreground transition-colors text-left">
                <Reply className="w-4 h-4 text-muted-foreground flex-shrink-0" /> Reply
              </button>
              <button onClick={() => {
                const content = ctxMenu.content;
                setCtxMenu(null);
                if (activeChannel && activeServer) {
                  sendMessage({ serverId: activeServer.id, channelId: activeChannel.id, data: { content: `↪ ${content}` } });
                }
              }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-muted text-sm font-semibold text-foreground transition-colors text-left">
                <Forward className="w-4 h-4 text-muted-foreground flex-shrink-0" /> Forward to channel
              </button>
              <button onClick={() => copyMsg(ctxMenu.content)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-muted text-sm font-semibold text-foreground transition-colors text-left">
                <Copy className="w-4 h-4 text-muted-foreground flex-shrink-0" /> Copy text
              </button>
              {ctxMenu.isMe && (
                <button onClick={() => deleteChannelMsg(ctxMenu.id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-destructive/10 text-sm font-semibold text-destructive transition-colors text-left">
                  <Trash2 className="w-4 h-4 flex-shrink-0" /> Delete message
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {profilePopup && (
        <UserProfilePopup
          userId={profilePopup.userId}
          onClose={() => setProfilePopup(null)}
        />
      )}

      {/* Member action menu */}
      {memberMenu && (
        <div className="fixed inset-0 z-[70]" onClick={() => setMemberMenu(null)}>
          <div
            className="absolute bg-card border border-card-border rounded-2xl shadow-2xl min-w-[180px] overflow-hidden animate-in zoom-in-95 fade-in duration-150"
            style={{ left: Math.min(memberMenu.x, window.innerWidth - 200), top: Math.min(memberMenu.y, window.innerHeight - 220) }}
            onClick={e => e.stopPropagation()}
          >
            <div className="p-1.5 space-y-0.5">
              <button onClick={() => { setProfilePopup({ userId: memberMenu.userId }); setMemberMenu(null); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-muted text-sm font-semibold text-foreground transition-colors text-left">
                <Eye className="w-4 h-4 text-muted-foreground flex-shrink-0" /> View Profile
              </button>
              <button onClick={() => { setMemberMenu(null); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-muted text-sm font-semibold text-foreground transition-colors text-left">
                <MessageCircle className="w-4 h-4 text-muted-foreground flex-shrink-0" /> Message
              </button>
              <div className="border-t border-border/40 my-1" />
              <button onClick={async () => {
                await fetch(`/api/users/${memberMenu.userId}/block`, { method: "POST", credentials: "include" });
                setMemberMenu(null);
              }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-destructive/10 text-sm font-semibold text-destructive transition-colors text-left">
                <ShieldOff className="w-4 h-4 flex-shrink-0" /> Block
              </button>
              {isOwner && memberMenu.userId !== user?.id && (
                <button onClick={() => kickMember.mutate(memberMenu.userId)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-destructive/10 text-sm font-semibold text-destructive transition-colors text-left">
                  <UserMinus className="w-4 h-4 flex-shrink-0" />
                  {kickMember.isPending ? "Kicking…" : "Kick from server"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      <div className="flex h-[calc(100dvh-121px)] md:h-screen overflow-hidden">
        {/* Server list */}
        <div className={cn(
          "flex flex-col border-r border-border bg-sidebar",
          activeServer ? "hidden md:flex w-64 flex-shrink-0" : "flex flex-1 md:w-72 md:flex-none"
        )}>
          <div className="p-4 border-b border-sidebar-border">
            <div className="flex items-center justify-between mb-3">
              <h1 className="font-black text-foreground flex items-center gap-2">
                <Server className="w-4 h-4 text-primary" /> Servers
              </h1>
              <button onClick={() => setShowCreateServer(true)} className="p-1.5 hover:bg-primary/10 rounded-xl text-primary transition-colors">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-1 bg-muted rounded-xl p-1">
              {(["mine", "discover"] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)} className={cn(
                  "flex-1 py-1.5 rounded-lg text-xs font-bold capitalize transition-all",
                  tab === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}>
                  {t === "mine" ? "My Servers" : "Discover"}
                </button>
              ))}
            </div>
          </div>

          {showCreateServer && (
            <div className="p-3 border-b border-sidebar-border bg-primary/5">
              <p className="text-xs font-bold text-primary mb-2">Create a server</p>
              <input
                value