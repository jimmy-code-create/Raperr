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
  const { data: messages, refetch: refetchMessages } = useGetChannelMessages(activeServer?.id ?? 0, activeChannel?.id ?? 0);

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
                value={newServerName}
                onChange={(e) => setNewServerName(e.target.value)}
                placeholder="Server name…"
                autoFocus
                className="w-full bg-card border border-border rounded-xl px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 mb-2"
              />
              <div className="flex flex-wrap gap-1 mb-2">
                {SERVER_TAGS.slice(0, 8).map(tag => (
                  <button
                    key={tag}
                    onClick={() => setNewServerTags(t => t.includes(tag) ? t.filter(x => x !== tag) : [...t, tag])}
                    className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold transition-all", newServerTags.includes(tag) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}
                  >
                    {tag}
                  </button>
                ))}
              </div>
              <button
                onClick={() => { if (newServerName.trim()) createServer({ data: { name: newServerName.trim(), tags: newServerTags } }); }}
                className="w-full px-3 py-1.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold"
              >
                Create
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {(tab === "mine" ? (myServers?.servers ?? []) : (allServers?.servers ?? []))?.map((server) => (
              <button
                key={server.id}
                onClick={() => { setActiveServer(server); setActiveChannel(null); setActiveVoiceChannel(null); }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left",
                  activeServer?.id === server.id ? "bg-primary/10 text-primary shadow-sm" : "hover:bg-muted text-sidebar-foreground"
                )}
              >
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center flex-shrink-0 text-base font-black">
                  {(server.name ?? "?")[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{server.name}</p>
                  <p className="text-xs text-muted-foreground">{server.memberCount ?? 0} members</p>
                </div>
                {tab === "discover" && !myServerIds.has(server.id) && (
                  <span onClick={(e) => { e.stopPropagation(); joinServer({ serverId: server.id }); }}
                    className="text-[10px] px-2 py-0.5 bg-primary text-primary-foreground rounded-full cursor-pointer font-bold">
                    Join
                  </span>
                )}
              </button>
            ))}
            {tab === "mine" && (!myServers || !myServers.servers || myServers.servers.length === 0) && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Server className="w-8 h-8 text-muted-foreground mb-2" />
                <p className="text-sm font-bold text-foreground">No servers yet</p>
                <p className="text-xs text-muted-foreground mt-1">Create or join one above</p>
              </div>
            )}
          </div>
        </div>

        {/* Channel sidebar */}
        {activeServer && (
          <div className={cn(
            "flex flex-col border-r border-border bg-sidebar/50 w-48 flex-shrink-0",
            (activeChannel || activeVoiceChannel) ? "hidden md:flex" : "flex"
          )}>
            <div className="p-3 border-b border-sidebar-border">
              <div className="flex items-center gap-1.5 mb-1">
                <button onClick={() => setActiveServer(null)} className="md:hidden p-1 text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <p className="font-black text-sm text-foreground truncate flex-1">{activeServer.name}</p>
                <button onClick={() => setShowMembers(!showMembers)} title="Members" className={cn("p-1 transition-colors rounded", showMembers ? "text-primary" : "text-muted-foreground hover:text-primary")}>
                  <Users className="w-3.5 h-3.5" />
                </button>
                {isOwner && (
                  <button onClick={() => setShowSettings(!showSettings)} title="Settings" className={cn("p-1 transition-colors rounded", showSettings ? "text-primary" : "text-muted-foreground hover:text-primary")}>
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{serverDetail?.memberCount ?? 0} members</p>
              {/* Server tags */}
              {(activeServer as ServerType & { tags?: string[] }).tags && (activeServer as ServerType & { tags?: string[] }).tags!.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {((activeServer as ServerType & { tags?: string[] }).tags ?? []).map(tag => (
                    <span key={tag} className="text-[9px] px-1.5 py-0.5 bg-primary/10 text-primary rounded-full font-bold">{tag}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Settings panel */}
            {showSettings && isOwner && (
              <div className="border-b border-sidebar-border p-3 space-y-2">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Crown className="w-3 h-3" /> Server Roles
                </p>
                {(roles ?? []).map(role => (
                  <div key={role.id} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: role.color }} />
                    <span className="text-xs text-foreground truncate flex-1">{role.name}</span>
                  </div>
                ))}
                {showCreateRole ? (
                  <div className="space-y-1.5">
                    <input value={newRoleName} onChange={e => setNewRoleName(e.target.value)} placeholder="Role name…" autoFocus
                      className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs focus:outline-none" />
                    <div className="flex items-center gap-1.5">
                      <input type="color" value={newRoleColor} onChange={e => setNewRoleColor(e.target.value)} className="w-6 h-6 rounded cursor-pointer border-0" />
                      <button onClick={() => { if (newRoleName && activeServer) createRole.mutate({ serverId: activeServer.id, name: newRoleName, color: newRoleColor }); }}
                        className="flex-1 py-1 bg-primary text-primary-foreground rounded-lg text-xs font-bold">
                        {createRole.isPending ? "…" : "Add Role"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowCreateRole(true)} className="w-full text-xs text-primary hover:bg-primary/10 rounded-lg px-2 py-1 text-left transition-colors font-semibold">
                    + New Role
                  </button>
                )}

                <div className="pt-1.5 border-t border-border/40">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Tag className="w-3 h-3" /> Add Channel
                  </p>
                  <div className="flex gap-1 mb-1.5">
                    {(["text", "voice"] as const).map(t => (
                      <button key={t} onClick={() => setNewChannelType(t)}
                        className={cn("flex-1 py-1 rounded-lg text-[10px] font-bold transition-all capitalize", newChannelType === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                        {t === "text" ? "# Text" : "🔊 Voice"}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-1">
                    <input value={newChannelName} onChange={e => setNewChannelName(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && newChannelName.trim() && activeServer) createChannel({ serverId: activeServer.id, data: { name: newChannelName.trim(), type: newChannelType } }); }}
                      placeholder="channel-name" autoFocus={showCreateChannel}
                      className="flex-1 bg-card border border-border rounded-lg px-2 py-1 text-xs focus:outline-none" />
                    <button onClick={() => { if (newChannelName.trim() && activeServer) createChannel({ serverId: activeServer.id, data: { name: newChannelName.trim(), type: newChannelType } }); }}
                      className="px-2 bg-primary text-primary-foreground rounded-lg text-xs font-bold">+</button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {/* Text channels */}
              {textChannels.length > 0 && (
                <>
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider px-2 py-1">Text Channels</p>
                  {textChannels.map((ch) => (
                    <button key={ch.id} onClick={() => { setActiveChannel(ch); setActiveVoiceChannel(null); }}
                      className={cn(
                        "w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm transition-all text-left",
                        activeChannel?.id === ch.id ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      )}>
                      <Hash className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{ch.name}</span>
                    </button>
                  ))}
                </>
              )}

              {/* Voice channels */}
              {voiceChannels.length > 0 && (
                <>
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider px-2 py-1 mt-2">Voice Channels</p>
                  {voiceChannels.map((ch) => (
                    <button key={ch.id} onClick={() => { setActiveVoiceChannel(ch); setActiveChannel(null); }}
                      className={cn(
                        "w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm transition-all text-left",
                        activeVoiceChannel?.id === ch.id ? "bg-green-500/10 text-green-500 font-semibold" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      )}>
                      <Volume2 className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate flex-1">{ch.name}</span>
                      {joinedVoice === ch.id && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse flex-shrink-0" />}
                    </button>
                  ))}
                </>
              )}

              {!isOwner && (
                <button onClick={() => setShowCreateChannel(true)} className="w-full text-xs text-muted-foreground hover:text-primary px-2 py-1.5 rounded-lg hover:bg-primary/5 transition-colors text-left mt-2">
                  + Add channel
                </button>
              )}

              {showCreateChannel && !showSettings && (
                <div className="px-2 py-2 space-y-1.5">
                  <div className="flex gap-1">
                    {(["text", "voice"] as const).map(t => (
                      <button key={t} onClick={() => setNewChannelType(t)}
                        className={cn("flex-1 py-0.5 rounded-lg text-[10px] font-bold capitalize", newChannelType === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                        {t === "text" ? "#" : "🔊"} {t}
                      </button>
                    ))}
                  </div>
                  <input value={newChannelName} onChange={e => setNewChannelName(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && newChannelName.trim() && activeServer) createChannel({ serverId: activeServer.id, data: { name: newChannelName.trim(), type: newChannelType } }); }}
                    placeholder="channel-name" autoFocus
                    className="w-full bg-card border border-border rounded-xl px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
              )}
            </div>

            <div className="p-2 border-t border-sidebar-border">
              <button onClick={() => leaveServer({ serverId: activeServer.id })}
                className="w-full text-xs text-muted-foreground hover:text-destructive px-2 py-1.5 rounded-lg hover:bg-destructive/10 transition-colors text-left">
                Leave server
              </button>
            </div>
          </div>
        )}

        {/* Voice channel view */}
        {activeServer && activeVoiceChannel && !activeChannel && (
          <div className="flex flex-col flex-1 min-w-0">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/80 backdrop-blur-sm">
              <button onClick={() => setActiveVoiceChannel(null)} className="md:hidden p-1 text-muted-foreground">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <Volume2 className="w-4 h-4 text-green-500" />
              <p className="font-bold text-foreground">{activeVoiceChannel.name}</p>
              <span className="text-xs text-muted-foreground ml-1">{voiceUsers?.length ?? 0} connected</span>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6">
              <div className="text-center mb-4">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-green-500/20 to-green-500/5 flex items-center justify-center mb-4 mx-auto">
                  <Headphones className="w-10 h-10 text-green-500" />
                </div>
                <h2 className="text-xl font-black text-foreground">{activeVoiceChannel.name}</h2>
                <p className="text-muted-foreground text-sm mt-1">Voice Channel • {activeServer.name}</p>
              </div>

              {/* Connected users */}
              {voiceUsers && voiceUsers.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full max-w-lg">
                  {voiceUsers.map((u) => (
                    <div key={u.id} className="flex flex-col items-center gap-2 p-4 bg-muted/60 rounded-2xl border border-border/40">
                      <div className="relative">
                        <Avatar src={u.avatarUrl} name={u.displayName || "User"} size="lg" />
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-green-500 border-2 border-background flex items-center justify-center">
                          <Mic className="w-2.5 h-2.5 text-white" />
                        </div>
                      </div>
                      <p className="text-xs font-bold text-foreground text-center truncate w-full">{u.displayName ?? u.username ?? "User"}</p>
                    </div>
                  ))}
                  {joinedVoice === activeVoiceChannel.id && !voiceUsers.find(u => u.id === user?.id) && (
                    <div className="flex flex-col items-center gap-2 p-4 bg-primary/10 rounded-2xl border border-primary/20">
                      <Avatar src={user?.profileImageUrl} name={user?.firstName || "Me"} size="lg" />
                      <p className="text-xs font-bold text-primary text-center">You</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center text-muted-foreground">
                  <p className="text-4xl mb-3">👻</p>
                  <p className="text-sm font-semibold">Nobody here yet</p>
                  <p className="text-xs mt-1">Join the channel and invite others</p>
                </div>
              )}

              {/* Join/leave button + mic controls */}
              <div className="flex flex-col items-center gap-3">
                {micError && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-destructive/10 border border-destructive/20 rounded-2xl text-destructive text-xs font-semibold max-w-xs text-center">
                    <MicOff className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Mic: {micError}. Presence still joined.</span>
                  </div>
                )}
                <div className="flex gap-3">
                  {joinedVoice === activeVoiceChannel.id ? (
                    <>
                      <button
                        onClick={() => {
                          if (micStream) {
                            micStream.getAudioTracks().forEach(t => { t.enabled = micMuted; });
                            setMicMuted(!micMuted);
                          }
                        }}
                        className={cn(
                          "flex items-center gap-2 px-4 py-3 rounded-2xl font-bold text-sm border transition-colors",
                          micMuted
                            ? "bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20"
                            : "bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20"
                        )}
                        title={micMuted ? "Unmute" : "Mute"}
                      >
                        {micMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                        {micMuted ? "Unmute" : "Mute"}
                      </button>
                      <button
                        onClick={() => leaveVoice.mutate(activeVoiceChannel.id)}
                        className="flex items-center gap-2 px-5 py-3 bg-red-500/10 text-red-500 border border-red-500/20 rounded-2xl font-bold text-sm hover:bg-red-500/20 transition-colors"
                      >
                        <PhoneOff className="w-4 h-4" /> Leave
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => joinVoice.mutate(activeVoiceChannel.id)}
                      disabled={joinVoice.isPending}
                      className="flex items-center gap-2 px-6 py-3 bg-green-500 text-white rounded-2xl font-bold text-sm hover:bg-green-600 transition-colors shadow-lg disabled:opacity-60"
                    >
                      {joinVoice.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
                      {joinVoice.isPending ? "Joining…" : "Join Voice"}
                    </button>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground/60 text-center max-w-xs">
                {joinedVoice === activeVoiceChannel.id
                  ? micStream ? "🎙️ Mic active — others can hear you" : "👻 Presence only — no mic"
                  : "Join to share your presence in this channel"}
              </p>
            </div>
          </div>
        )}

        {/* Text message area */}
        {activeServer && activeChannel ? (
          <div className="flex flex-col flex-1 min-w-0">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card/80 backdrop-blur-sm">
              <button onClick={() => setActiveChannel(null)} className="md:hidden p-1 text-muted-foreground">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <Hash className="w-4 h-4 text-muted-foreground" />
              <p className="font-bold text-foreground">{activeChannel.name}</p>
              {(activeChannel as unknown as { description?: string }).description && <p className="text-xs text-muted-foreground ml-2 border-l border-border pl-2 hidden md:block">{(activeChannel as unknown as { description?: string }).description}</p>}
              <div className="flex-1" />
              <button onClick={() => setShowMembers(!showMembers)} className={cn("p-1.5 rounded-xl transition-colors", showMembers ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-primary")}>
                <Users className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-1 min-h-0">
              <div className="flex flex-col flex-1 min-w-0">
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                  {(messages?.messages ?? []).map((msg, idx) => {
                    const isMe = msg.sender?.id === user?.id;
                    const prevMsg = idx > 0 ? (messages?.messages ?? [])[idx - 1] : null;
                    const showHeader = !prevMsg || prevMsg.sender?.id !== msg.sender?.id;
                    const content = msg.content ?? "";
                    const isGif = isGifUrl(content);
                    return (
                      <div key={msg.id}
                        className="flex items-start gap-3 group hover:bg-muted/30 -mx-2 px-2 py-1 rounded-xl transition-colors cursor-default select-none"
                        onContextMenu={(e) => openCtxMenu(e, msg.id, isMe, content)}
                        onTouchStart={() => startLongPress(msg.id, isMe, content)}
                        onTouchEnd={cancelLongPress}
                        onTouchMove={cancelLongPress}
                      >
                        <div className="w-8 flex-shrink-0 mt-0.5">
                          {showHeader && (
                            <button
                              onClick={() => msg.sender?.id && setProfilePopup({ userId: msg.sender.id })}
                              className="focus:outline-none"
                            >
                              <Avatar src={msg.sender?.avatarUrl} name={msg.sender?.displayName || "User"} size="sm" className="hover:opacity-80 transition-opacity cursor-pointer" />
                            </button>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          {showHeader && (
                            <div className="flex items-baseline gap-2 mb-0.5">
                              <span className={cn("text-sm font-bold", isMe ? "text-primary" : "text-foreground")}>
                                {msg.sender?.displayName || msg.sender?.username}
                              </span>
                              <span className="text-xs text-muted-foreground">{formatRelativeTime(msg.createdAt)}</span>
                            </div>
                          )}
                          {isGif ? (
                            <img src={content} alt="GIF" className="rounded-xl max-w-xs max-h-48 object-cover" loading="lazy" />
                          ) : (
                            <p className="text-sm text-foreground leading-relaxed">{renderWithEmojis(content)}</p>
                          )}
                          <MessageReactions messageId={msg.id} showPicker />
                        </div>
                      </div>
                    );
                  })}
                  {(!messages?.messages || messages.messages.length === 0) && (
                    <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-16">
                      <Hash className="w-10 h-10 mb-3 opacity-40" />
                      <p className="font-bold">Start of #{activeChannel.name}</p>
                      <p className="text-xs mt-1">Be the first to send a message!</p>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div className="px-4 py-3 border-t border-border">
                  {replyTo && (
                    <div className="flex items-center gap-2 mb-2 px-3 py-1.5 bg-primary/10 rounded-xl border-l-2 border-primary">
                      <Reply className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                      <p className="text-xs text-primary font-semibold flex-1 truncate">↩ {replyTo.slice(0, 50)}</p>
                      <button onClick={() => setReplyTo(null)} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
                    </div>
                  )}
                  <div className="flex items-center gap-2 bg-muted rounded-2xl px-3 py-2.5">
                    <div className="relative">
                      <button onClick={() => { setShowEmoji(!showEmoji); setShowGif(false); }}
                        className={cn("p-1 rounded-xl transition-colors", showEmoji ? "text-primary" : "text-muted-foreground hover:text-primary")}>
                        <Smile className="w-5 h-5" />
                      </button>
                      {showEmoji && <EmojiPicker onSelect={insertEmoji} onClose={() => setShowEmoji(false)} position="top" />}
                    </div>
                    <div className="relative">
                      <button onClick={() => { setShowGif(!showGif); setShowEmoji(false); }}
                        className={cn("p-1 rounded-xl transition-colors text-xs font-black leading-none", showGif ? "text-primary" : "text-muted-foreground hover:text-primary")}>
                        GIF
                      </button>
                      {showGif && <GifPicker onSelect={handleGifSelect} onClose={() => setShowGif(false)} position="top" />}
                    </div>
                    <input
                      ref={inputRef}
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && messageText.trim()) { e.preventDefault(); handleSend(); } }}
                      placeholder={`Message #${activeChannel.name}`}
                      className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                    />
                    <button onClick={handleSend} disabled={!messageText.trim() || sending}
                      className="p-1.5 text-primary disabled:text-muted-foreground transition-all active:scale-90">
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : activeServer && !activeVoiceChannel ? (
          <div className="hidden md:flex flex-1 items-center justify-center text-center text-muted-foreground">
            <div>
              <Hash className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="font-bold">Select a channel to chat</p>
            </div>
          </div>
        ) : !activeServer ? (
          <div className="hidden md:flex flex-1 items-center justify-center text-center text-muted-foreground">
            <div>
              <Server className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="font-bold">Select a server</p>
              <p className="text-sm mt-1">Choose from the left or create your own</p>
            </div>
          </div>
        ) : null}

        {/* Members panel */}
        {activeServer && showMembers && (
          <div className="flex flex-col border-l border-border bg-sidebar/60 w-52 flex-shrink-0">
            <div className="p-3 border-b border-sidebar-border flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-xs font-black text-muted-foreground uppercase tracking-wider flex-1">
                Members — {serverMembers.length}
              </p>
              <button onClick={() => setShowMembers(false)} className="text-muted-foreground hover:text-foreground transition-colors text-xs">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {serverMembers.length === 0 ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              ) : serverMembers.map((m) => (
                <div key={m.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-muted/60 transition-colors group cursor-pointer"
                  onClick={(e) => {
                    if (m.id === user?.id) return;
                    setMemberMenu({ userId: m.id, x: e.clientX, y: e.clientY });
                  }}
                >
                  <div className="relative flex-shrink-0">
                    <Avatar src={m.avatarUrl} name={m.displayName || "User"} size="xs" />
                    {m.id === activeServer.ownerId && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-amber-400 rounded-full flex items-center justify-center">
                        <Crown className="w-1.5 h-1.5 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-xs font-bold truncate", m.id === user?.id ? "text-primary" : "text-foreground")}>
                      {m.displayName || m.username || "User"}
                      {m.id === user?.id && " (you)"}
                    </p>
                    {m.customStatus && <p className="text-[10px] text-muted-foreground truncate">{m.customStatus}</p>}
                  </div>
                  {m.id !== user?.id && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setMemberMenu({ userId: m.id, x: e.clientX, y: e.clientY }); }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-muted transition-all"
                    >
                      <MoreHorizontal className="w-3 h-3 text-muted-foreground" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
