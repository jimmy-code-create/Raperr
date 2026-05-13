import { useState, useEffect, useRef, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { Avatar } from "@/components/Avatar";
import { EmojiPicker } from "@/components/EmojiPicker";
import { GifPicker } from "@/components/GifPicker";
import { CallModal } from "@/components/CallModal";
import { MessageReactions } from "@/components/MessageReactions";
import { useListConversations, useGetDmMessages, useSendDmMessage, useStartConversation, useListGroups, useGetGroupMessages, useSendGroupMessage, useCreateGroup, useSendTypingIndicator } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useRealtime } from "@/hooks/use-realtime";
import { formatRelativeTime, cn, renderWithEmojis } from "@/lib/utils";
import { Send, ArrowLeft, MessageCircle, Loader2, Plus, Smile, X, Search, Zap, Paperclip, Users, Hash, Copy, Trash2, ShieldOff, ShieldCheck, Phone, PhoneOff, Video, Reply, Forward, Bold, Italic, Strikethrough } from "lucide-react";
import { UserProfilePopup } from "@/components/UserProfilePopup";
import type { Conversation, Group } from "@workspace/api-client-react";

type CallState = {
  mode: "caller" | "callee";
  callType: "voice" | "video";
  incomingOffer?: { sdp: string; type: RTCSdpType; callerName: string; callType: "voice" | "video" };
};

export default function DMsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: conversations, isLoading } = useListConversations();
  const [active, setActive] = useState<Conversation | null>(null);
  const [messageText, setMessageText] = useState("");
  const [newDmTo, setNewDmTo] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showGif, setShowGif] = useState(false);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  // Tab: "dms" | "groups"
  const [activeTab, setActiveTab] = useState<"dms" | "groups">("dms");
  const [activeGroup, setActiveGroup] = useState<Group | null>(null);
  const [groupMessageText, setGroupMessageText] = useState("");
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const groupMsgEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const groupInputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ id: number; x: number; y: number; isMe: boolean; content: string } | null>(null);
  const [profilePopup, setProfilePopup] = useState<{ userId: string } | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [blockPending, setBlockPending] = useState(false);
  const [callState, setCallState] = useState<CallState | null>(null);
  const [callDeclined, setCallDeclined] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingSentRef = useRef(0);
  const [forwardContent, setForwardContent] = useState<string | null>(null);
  const [blockedUsers, setBlockedUsers] = useState<Set<string>>(new Set());
  const [unblockPending, setUnblockPending] = useState(false);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const isOnline = (userId?: string | null) => !!userId && onlineIds.has(userId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: messages, refetch: refetchMessages } = useGetDmMessages(active?.id ?? 0, { query: { enabled: !!active } as any });
  const { data: groups, refetch: refetchGroups } = useListGroups();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: groupMessages, refetch: refetchGroupMessages } = useGetGroupMessages(activeGroup?.id ?? 0, { query: { enabled: !!activeGroup } as any });

  // Heartbeat — mark current user online every 30s
  useEffect(() => {
    if (!user) return;
    const ping = () => fetch("/api/users/me/heartbeat", { method: "POST", credentials: "include" }).catch(() => {});
    ping();
    const hb = setInterval(ping, 30_000);
    return () => clearInterval(hb);
  }, [user]);

  // Poll online IDs every 30s
  useEffect(() => {
    if (!user) return;
    const fetchOnline = () =>
      fetch("/api/users/online", { credentials: "include" })
        .then(r => r.ok ? r.json() : { onlineIds: [] })
        .then((d: { onlineIds: string[] }) => setOnlineIds(new Set(d.onlineIds)))
        .catch(() => {});
    fetchOnline();
    const iv = setInterval(fetchOnline, 30_000);
    return () => clearInterval(iv);
  }, [user]);

  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => {
      refetchMessages();
      qc.invalidateQueries({ queryKey: ["/api/dm/conversations"] });
    }, 2500);
    return () => clearInterval(interval);
  }, [active, refetchMessages, qc]);

  useEffect(() => {
    if (!activeGroup) return;
    const interval = setInterval(() => refetchGroupMessages(), 2500);
    return () => clearInterval(interval);
  }, [activeGroup, refetchGroupMessages]);

  // Mark conversation as seen when opened → read receipts
  useEffect(() => {
    if (!active) return;
    fetch(`/api/dm/conversations/${active.id}/seen`, { method: "POST", credentials: "include" }).catch(() => {});
  }, [active?.id]);

  // Load blocked users for the other party in active conversation
  useEffect(() => {
    if (!active) return;
    const other = active.participants?.find(p => p.id !== user?.id);
    if (!other) return;
    fetch(`/api/users/${other.id}/block-status`, { credentials: "include" })
      .then(r => r.ok ? r.json() : { isBlocked: false })
      .then((data: { isBlocked: boolean }) => {
        setBlockedUsers(prev => {
          const next = new Set(prev);
          if (data.isBlocked) next.add(other.id!);
          else next.delete(other.id!);
          return next;
        });
      })
      .catch(() => {});
  }, [active?.id]);

  useEffect(() => {
    if (!active || callState) return;
    const poll = setInterval(async () => {
      try {
        const r = await fetch(`/api/calls/offer/${active.id}`, { credentials: "include" });
        const { offer } = await r.json();
        if (offer) {
          setCallState({ mode: "callee", callType: offer.callType ?? "video", incomingOffer: offer });
        }
      } catch {}
    }, 3000);
    return () => clearInterval(poll);
  }, [active, callState]);

  // Real-time SSE via shared hook
  useRealtime((event) => {
    if (event.type === "new_message") {
      qc.invalidateQueries({ queryKey: [`/api/dm/conversations/${event.conversationId}/messages`] });
      qc.invalidateQueries({ queryKey: ["/api/dm/conversations"] });
    } else if (event.type === "new_group_msg") {
      qc.invalidateQueries({ queryKey: [`/api/groups/${event.groupId}/messages`] });
    } else if (event.type === "typing" && event.conversationId === active?.id) {
      setOtherTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => setOtherTyping(false), 3000);
    } else if (event.type === "incoming_call" && event.conversationId === active?.id && !callState) {
      setCallState({
        mode: "callee",
        callType: event.callType,
        incomingOffer: undefined,
      });
      fetch(`/api/calls/offer/${event.conversationId}`, { credentials: "include" })
        .then(r => r.json())
        .then(({ offer }) => {
          if (offer) setCallState({ mode: "callee", callType: offer.callType ?? "video", incomingOffer: offer });
        })
        .catch(() => {});
    } else if (event.type === "call_declined" && active?.id === event.conversationId) {
      setCallDeclined(true);
      setTimeout(() => setCallDeclined(false), 3000);
    }
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    groupMsgEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [groupMessages]);

  const { mutate: createGroup, isPending: creatingGroup } = useCreateGroup({
    mutation: {
      onSuccess: (g) => {
        qc.invalidateQueries({ queryKey: ["/api/groups"] });
        setActiveGroup(g);
        setShowNewGroup(false);
        setNewGroupName("");
      },
    },
  });

  const { mutate: sendGroupMsg, isPending: sendingGroupMsg } = useSendGroupMessage({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: [`/api/groups/${activeGroup?.id}/messages`] });
        setGroupMessageText("");
        refetchGroupMessages();
      },
    },
  });

  const { mutate: sendMsg, isPending: sending } = useSendDmMessage({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: [`/api/dm/conversations/${active?.id}/messages`] });
        qc.invalidateQueries({ queryKey: ["/api/dm/conversations"] });
        setMessageText("");
        refetchMessages();
      },
    },
  });

  const { mutate: sendTyping } = useSendTypingIndicator({ mutation: { onError: () => {} } });

  const handleTyping = (text: string) => {
    setMessageText(text);
    if (!active) return;
    const now = Date.now();
    if (now - typingSentRef.current > 2000) {
      typingSentRef.current = now;
      sendTyping({ conversationId: active.id });
    }
  };

  const { mutate: startConvo, isPending: starting } = useStartConversation({
    mutation: {
      onSuccess: (convo) => {
        qc.invalidateQueries({ queryKey: ["/api/dm/conversations"] });
        setActive(convo);
        setShowNew(false);
        setNewDmTo("");
      },
    },
  });

  const handleSend = (content?: string) => {
    const text = content ?? messageText;
    if (!text.trim() || !active) return;
    const finalText = replyTo ? `↩ ${replyTo.slice(0, 40)}…\n${text.trim()}` : text.trim();
    sendMsg({ conversationId: active.id, data: { content: finalText } });
    if (!content) { setMessageText(""); setReplyTo(null); }
  };

  const handleGroupSend = (content?: string) => {
    const text = content ?? groupMessageText;
    if (!text.trim() || !activeGroup) return;
    const finalText = replyTo ? `↩ ${replyTo.slice(0, 40)}…\n${text.trim()}` : text.trim();
    sendGroupMsg({ groupId: activeGroup.id, data: { content: finalText } });
    if (!content) { setGroupMessageText(""); setReplyTo(null); }
  };

  const insertEmoji = (emoji: string) => {
    const el = inputRef.current;
    if (!el) { setMessageText((t) => t + emoji); setShowEmoji(false); return; }
    const start = el.selectionStart ?? messageText.length;
    const end = el.selectionEnd ?? messageText.length;
    const next = messageText.slice(0, start) + emoji + messageText.slice(end);
    setMessageText(next);
    setShowEmoji(false);
    setTimeout(() => { el.focus(); el.setSelectionRange(start + emoji.length, start + emoji.length); }, 0);
  };

  const handleGifSelect = (url: string) => {
    setShowGif(false);
    handleSend(url);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !active) return;
    setUploading(true);
    try {
      const isVideo = file.type.startsWith("video/");
      const isAudio = file.type.startsWith("audio/");
      const isImage = file.type.startsWith("image/");

      if (file.size > 500 * 1024 * 1024) {
        alert("File too large. Maximum size is 500MB.");
        return;
      }

      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload/media", { method: "POST", credentials: "include", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const { url } = await res.json() as { url: string };

      let content = url;
      if (isVideo) content = `[video]${url}`;
      else if (isAudio) content = `[audio]${url}`;
      else if (isImage) content = `[image]${url}`;

      sendMsg({ conversationId: active.id, data: { content } });
    } catch {
      alert("Upload failed. Please try again.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const isGifUrl = (content: string) => /^https?:\/\/.*\.gif/.test(content) || content.includes("tenor.com") || content.includes("giphy.com");
  const isVideoUrl = (content: string) => content.startsWith("[video]");

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

  const deleteDmMsg = async (msgId: number) => {
    await fetch(`/api/dm/messages/${msgId}`, { method: "DELETE", credentials: "include" });
    refetchMessages();
    setCtxMenu(null);
  };

  const blockCurrentUser = async () => {
    const other = active ? getOtherUser(active) : null;
    if (!other) return;
    setBlockPending(true);
    try {
      await fetch(`/api/users/${other.id}/block`, { method: "POST", credentials: "include" });
      setShowBlockConfirm(false);
      setActive(null);
    } finally {
      setBlockPending(false);
    }
  };
  const isAudioUrl = (content: string) => content.startsWith("[audio]");
  const isImageUrl = (content: string) => content.startsWith("[image]");

  const renderMessageContent = (content: string, senderId?: string) => {
    if (content.startsWith("[call:")) {
      const match = content.match(/\[call:(\w+):(\w+)\]/);
      const callResultType = match?.[1];
      const callTypeLabel = match?.[2];
      const isSender = senderId === user?.id;
      if (callResultType === "ended") {
        return (
          <div className="flex items-center gap-2 text-sm">
            <Phone className="w-4 h-4 text-green-500 flex-shrink-0" />
            <span className="text-muted-foreground font-medium">
              Call ended {callTypeLabel === "video" ? "· Video" : "· Voice"}
            </span>
          </div>
        );
      }
      if (callResultType === "missed") {
        return (
          <div className="flex items-center gap-2 text-sm">
            <PhoneOff className="w-4 h-4 text-red-500 flex-shrink-0" />
            <span className={isSender ? "text-muted-foreground font-medium" : "text-red-400 font-medium"}>
              {isSender ? "No answer" : "Missed call"}
              {callTypeLabel === "video" ? " · Video" : " · Voice"}
            </span>
          </div>
        );
      }
    }
    if (isVideoUrl(content)) {
      const url = content.replace("[video]", "");
      return <video src={url} controls className="rounded-xl max-w-xs max-h-48 mt-1" preload="metadata" />;
    }
    if (isAudioUrl(content)) {
      const url = content.replace("[audio]", "");
      return <audio src={url} controls className="rounded-xl max-w-xs mt-1" preload="metadata" />;
    }
    if (isImageUrl(content)) {
      const url = content.replace("[image]", "");
      return <img src={url} alt="Image" className="rounded-xl max-w-xs max-h-48 object-cover mt-1" loading="lazy" />;
    }
    if (isGifUrl(content)) {
      return <img src={content} alt="GIF" className="rounded-xl max-w-xs max-h-48 object-cover" loading="lazy" />;
    }
    return <span>{renderWithEmojis(content)}</span>;
  };

  const allConvos = conversations?.conversations ?? [];
  const getOtherUser = (conv: import("@workspace/api-client-react").Conversation) =>
    conv.participants?.find(p => p.id !== user?.id) ?? conv.participants?.[0] ?? null;
  const filteredConvos = allConvos.filter((c) => {
    const other = getOtherUser(c);
    return !search || other?.displayName?.toLowerCase().includes(search.toLowerCase()) ||
      other?.username?.toLowerCase().includes(search.toLowerCase());
  });

  const otherUser = active ? getOtherUser(active) : null;

  return (
    <Layout>
      {/* WebRTC Call Modal */}
      {callState && active && (
        <CallModal
          conversationId={active.id}
          otherUser={(getOtherUser(active) ?? { id: "", displayName: "User" }) as any}
          callType={callState.callType}
          mode={callState.mode}
          incomingOffer={callState.incomingOffer}
          onClose={() => { setCallState(null); setCallDeclined(false); }}
          callDeclined={callDeclined}
        />
      )}

      {/* Context menu – Discord-style */}
      {ctxMenu && (
        <div className="fixed inset-0 z-[60]" onClick={() => setCtxMenu(null)}>
          <div
            className="absolute bg-card border border-card-border rounded-2xl shadow-2xl min-w-[200px] overflow-hidden animate-in zoom-in-95 fade-in duration-150"
            style={{ left: Math.min(ctxMenu.x, window.innerWidth - 220), top: Math.min(ctxMenu.y - 10, window.innerHeight - 220) }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Quick emoji reactions — saved to message reactions */}
            <div className="flex flex-wrap items-center px-1.5 py-2 border-b border-border/40 gap-0.5">
              {["❤️", "🔥", "😂", "😮", "💀", "👏", "🙌", "💯", "👑", "✨", "😢", "😡"].map(emoji => (
                <button key={emoji}
                  onClick={async () => {
                    setCtxMenu(null);
                    await fetch(`/api/dm/messages/${ctxMenu.id}/react`, {
                      method: "POST", credentials: "include",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ emoji }),
                    });
                    if (active) qc.invalidateQueries({ queryKey: [`/api/dm/conversations/${active.id}/messages`] });
                    if (activeGroup) qc.invalidateQueries({ queryKey: [`/api/groups/${activeGroup.id}/messages`] });
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
              <button onClick={() => { setForwardContent(ctxMenu.content); setCtxMenu(null); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-muted text-sm font-semibold text-foreground transition-colors text-left">
                <Forward className="w-4 h-4 text-muted-foreground flex-shrink-0" /> Forward
              </button>
              <button onClick={() => copyMsg(ctxMenu.content)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-muted text-sm font-semibold text-foreground transition-colors text-left">
                <Copy className="w-4 h-4 text-muted-foreground flex-shrink-0" /> Copy text
              </button>
              {ctxMenu.isMe && (
                <button onClick={() => deleteDmMsg(ctxMenu.id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-destructive/10 text-sm font-semibold text-destructive transition-colors text-left">
                  <Trash2 className="w-4 h-4 flex-shrink-0" /> Delete
                </button>
              )}
              {!ctxMenu.isMe && (
                <button onClick={() => { setCtxMenu(null); setShowBlockConfirm(true); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-destructive/10 text-sm font-semibold text-destructive/80 transition-colors text-left">
                  <ShieldOff className="w-4 h-4 flex-shrink-0" /> Block user
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Forward message modal */}
      {forwardContent !== null && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4" onClick={() => setForwardContent(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative z-10 bg-card border border-card-border rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h3 className="font-black text-foreground">Forward Message</h3>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 italic">"{forwardContent.slice(0, 60)}{forwardContent.length > 60 ? "…" : ""}"</p>
              </div>
              <button onClick={() => setForwardContent(null)} className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground"><X className="w-4 h-4" /></button>
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider px-3 py-2">Direct Messages</p>
              {(conversations?.conversations ?? []).map((conv) => {
                const other = getOtherUser(conv);
                return (
                  <button key={conv.id}
                    onClick={async () => {
                      const fc = forwardContent;
                      setForwardContent(null);
                      await fetch(`/api/dm/conversations/${conv.id}/messages`, {
                        method: "POST", credentials: "include",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ content: `↪ ${fc}` }),
                      });
                      qc.invalidateQueries({ queryKey: [`/api/dm/conversations/${conv.id}/messages`] });
                      setActive(conv);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted transition-colors text-left">
                    <Avatar src={other?.avatarUrl} name={other?.displayName || "User"} size="sm" />
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-foreground truncate">{other?.displayName || other?.username}</p>
                      <p className="text-xs text-muted-foreground truncate">@{other?.username}</p>
                    </div>
                  </button>
                );
              })}
              {(groups?.groups ?? []).length > 0 && (
                <>
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider px-3 py-2 mt-1">Groups</p>
                  {(groups?.groups ?? []).map((grp) => (
                    <button key={grp.id}
                      onClick={async () => {
                        const fc = forwardContent;
                        setForwardContent(null);
                        await fetch(`/api/groups/${grp.id}/messages`, {
                          method: "POST", credentials: "include",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ content: `↪ ${fc}` }),
                        });
                        qc.invalidateQueries({ queryKey: [`/api/groups/${grp.id}/messages`] });
                        setActiveGroup(grp);
                        setActiveTab("groups");
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted transition-colors text-left">
                      <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center flex-shrink-0">
                        <Hash className="w-4 h-4 text-white" />
                      </div>
                      <p className="font-bold text-sm text-foreground truncate">{grp.name}</p>
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Profile popup */}
      {profilePopup && (
        <UserProfilePopup
          userId={profilePopup.userId}
          onClose={() => setProfilePopup(null)}
        />
      )}

      {/* Block confirm dialog */}
      {showBlockConfirm && otherUser && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowBlockConfirm(false)} />
          <div className="relative bg-card border border-card-border rounded-3xl p-6 max-w-sm w-full shadow-2xl">
            <div className="text-center mb-4">
              <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-3">
                <ShieldOff className="w-6 h-6 text-destructive" />
              </div>
              <h3 className="text-lg font-black text-foreground">Block {otherUser.displayName}?</h3>
              <p className="text-sm text-muted-foreground mt-1">They won't be able to message you and you won't see their content.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowBlockConfirm(false)}
                className="flex-1 py-2.5 rounded-2xl border border-border text-sm font-bold text-foreground hover:bg-muted transition-colors">
                Cancel
              </button>
              <button onClick={blockCurrentUser} disabled={blockPending}
                className="flex-1 py-2.5 rounded-2xl bg-destructive text-white text-sm font-bold hover:bg-destructive/90 transition-colors disabled:opacity-50">
                {blockPending ? "Blocking…" : "Block"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex h-[calc(100dvh-121px)] md:h-screen overflow-hidden">
        {/* Conversation list */}
        <div className={cn(
          "flex flex-col border-r border-border",
          (active || activeGroup) ? "hidden md:flex w-80 flex-shrink-0" : "flex flex-1 md:w-80 md:flex-none"
        )}>
          {/* Header with iOS segmented control */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-lg font-black text-foreground flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary" /> Messages
              </h1>
              <button onClick={() => activeTab === "dms" ? setShowNew(!showNew) : setShowNewGroup(!showNewGroup)}
                className="p-1.5 hover:bg-primary/10 rounded-xl text-primary transition-colors">
                <Plus className="w-5 h-5" />
              </button>
            </div>
            {/* iOS Segmented Control */}
            <div className="seg-ctrl mb-3">
              <button className={cn("seg-ctrl-item", activeTab === "dms" && "active")}
                onClick={() => { setActiveTab("dms"); setActiveGroup(null); }}>
                <span className="flex items-center justify-center gap-1"><MessageCircle className="w-3 h-3" /> DMs</span>
              </button>
              <button className={cn("seg-ctrl-item", activeTab === "groups" && "active")}
                onClick={() => { setActiveTab("groups"); setActive(null); }}>
                <span className="flex items-center justify-center gap-1"><Users className="w-3 h-3" /> Groups</span>
              </button>
            </div>
            {activeTab === "dms" && (
              <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2">
                <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search conversations…"
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none" />
                {search && <button onClick={() => setSearch("")}><X className="w-3.5 h-3.5 text-muted-foreground" /></button>}
              </div>
            )}
          </div>

          {/* New DM */}
          {activeTab === "dms" && showNew && (
            <NewDmPanel
              onStart={(id) => startConvo({ data: { userId: id } })}
              starting={starting}
              onClose={() => setShowNew(false)}
            />
          )}

          {/* New Group */}
          {activeTab === "groups" && showNewGroup && (
            <div className="p-4 border-b border-border bg-gradient-to-br from-primary/5 to-purple-500/5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center flex-shrink-0">
                  <Users className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-black text-foreground">New Group Chat</p>
                  <p className="text-[10px] text-muted-foreground">Create a group to chat with multiple people</p>
                </div>
                <button onClick={() => setShowNewGroup(false)} className="ml-auto p-1 rounded-lg hover:bg-muted text-muted-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex gap-2">
                <input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && newGroupName.trim()) createGroup({ data: { name: newGroupName.trim() } }); }}
                  placeholder="Group name (e.g. The Squad 🔥)" autoFocus
                  className="flex-1 bg-card border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
                <button onClick={() => { if (newGroupName.trim()) createGroup({ data: { name: newGroupName.trim() } }); }}
                  disabled={creatingGroup || !newGroupName.trim()}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-bold disabled:opacity-40 hover:opacity-90 transition-opacity">
                  {creatingGroup ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Create"}
                </button>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {activeTab === "dms" ? (
              isLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : filteredConvos.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-4 py-12">
                  <MessageCircle className="w-10 h-10 text-muted-foreground mb-3" />
                  <p className="font-bold text-foreground">No messages yet</p>
                  <p className="text-sm text-muted-foreground mt-1">Press + to start a conversation</p>
                </div>
              ) : (
                filteredConvos.map((conv) => {
                  const other = getOtherUser(conv);
                  return (
                  <button key={conv.id} onClick={() => setActive(conv)}
                    className={cn("w-full flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors text-left",
                      active?.id === conv.id ? "bg-primary/5 border-l-2 border-primary" : "")}>
                    <Avatar src={other?.avatarUrl} name={other?.displayName || "User"} size="md" online={isOnline(other?.id)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="font-bold text-sm text-foreground truncate">{other?.displayName || other?.username}</p>
                        {conv.lastMessage?.createdAt && <span className="text-[10px] text-muted-foreground flex-shrink-0 ml-1">{formatRelativeTime(conv.lastMessage.createdAt)}</span>}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{conv.lastMessage?.content ?? "No messages yet"}</p>
                    </div>
                  </button>
                  );
                })
              )
            ) : (
              /* Groups list */
              !groups?.groups || groups.groups.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
                  <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center mb-4">
                    <Users className="w-8 h-8 text-primary" />
                  </div>
                  <p className="font-black text-foreground mb-1">No groups yet</p>
                  <p className="text-sm text-muted-foreground mb-4">Create a group to chat with multiple people at once</p>
                  <button
                    onClick={() => setShowNewGroup(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-xl text-sm font-bold hover:bg-primary/20 transition-colors"
                  >
                    <Plus className="w-4 h-4" /> Create a Group
                  </button>
                </div>
              ) : (
                groups.groups.map((grp, i) => {
                  const gradients = [
                    "from-primary to-purple-500",
                    "from-pink-500 to-rose-500",
                    "from-blue-500 to-cyan-500",
                    "from-amber-500 to-orange-500",
                    "from-emerald-500 to-teal-500",
                  ];
                  const grad = gradients[i % gradients.length];
                  return (
                    <button key={grp.id} onClick={() => setActiveGroup(grp)}
                      className={cn("w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/60 transition-all text-left group",
                        activeGroup?.id === grp.id ? "bg-primary/8 border-l-[3px] border-primary" : "border-l-[3px] border-transparent")}>
                      <div className={cn("w-11 h-11 rounded-2xl bg-gradient-to-br flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-105 transition-transform", grad)}>
                        <span className="text-white font-black text-base">{grp.name.charAt(0).toUpperCase()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-foreground truncate">{grp.name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Users className="w-3 h-3" />
                          Group chat
                          {(grp as any).memberCount && <span className="ml-1">· {(grp as any).memberCount} members</span>}
                        </p>
                      </div>
                      <Hash className="w-4 h-4 text-muted-foreground/40 flex-shrink-0 group-hover:text-primary/50 transition-colors" />
                    </button>
                  );
                })
              )
            )}
          </div>
        </div>

        {/* Group chat panel */}
        {activeTab === "groups" && activeGroup ? (
          <div className="flex flex-col flex-1 min-w-0">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/80 backdrop-blur-sm">
              <button onClick={() => setActiveGroup(null)} className="md:hidden p-1.5 hover:bg-muted rounded-xl text-muted-foreground">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                <span className="text-white font-black text-base">{activeGroup.name.charAt(0).toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-sm text-foreground">{activeGroup.name}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Users className="w-3 h-3" /> Group chat
                </p>
              </div>
              {(activeGroup as any).inviteCode && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/invite/${(activeGroup as any).inviteCode}`);
                  }}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors px-2.5 py-1.5 rounded-xl hover:bg-primary/10 font-semibold border border-border/60 hover:border-primary/30"
                  title="Copy invite link"
                >
                  <Copy className="w-3 h-3" /> Invite
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
              {(groupMessages?.messages ?? []).map((msg, idx) => {
                const isMe = (msg as any).senderId === user?.id;
                const prev = idx > 0 ? (groupMessages?.messages ?? [])[idx - 1] : null;
                const showAvatar = !isMe && (!prev || (prev as any).senderId !== (msg as any).senderId);
                const msgId = (msg as any).id as number;
                const msgContent = (msg as any).content as string;
                const isDeleted = (msg as any).isDeleted;
                return (
                  <div key={msgId} className={cn("flex items-end gap-2 group", isMe ? "justify-end" : "justify-start")}
                    onContextMenu={(e) => { if (!isDeleted) openCtxMenu(e, msgId, isMe, msgContent); }}
                    onTouchStart={() => { if (!isDeleted) startLongPress(msgId, isMe, msgContent); }}
                    onTouchEnd={cancelLongPress}
                    onTouchMove={cancelLongPress}
                  >
                    {!isMe && (
                      <div className="w-7 flex-shrink-0">
                        {showAvatar && <Avatar src={(msg as any).sender?.avatarUrl} name={(msg as any).sender?.displayName || "User"} size="xs" />}
                      </div>
                    )}
                    <div className={cn("flex flex-col gap-0.5", isMe ? "items-end" : "items-start")}>
                      {showAvatar && !isMe && (
                        <p className="text-[10px] text-muted-foreground px-1 font-semibold">{(msg as any).sender?.displayName ?? "User"}</p>
                      )}
                      <div className={cn("max-w-[300px] text-sm leading-relaxed px-4 py-2.5 rounded-2xl shadow-sm",
                        isDeleted ? "bg-muted text-muted-foreground italic" : isMe ? "bubble-sent" : "bubble-recv")}>
                        {isDeleted
                          ? <span className="text-xs">🗑 Message deleted</span>
                          : <span>{renderWithEmojis(msgContent)}</span>}
                      </div>
                      <p className="text-[10px] px-1 text-muted-foreground">{formatRelativeTime((msg as any).createdAt)}</p>
                    </div>
                  </div>
                );
              })}
              {(!groupMessages?.messages || groupMessages.messages.length === 0) && (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-16">
                  <div className="text-4xl mb-3">👋</div>
                  <p className="text-sm font-semibold">Say hello to {activeGroup.name}!</p>
                </div>
              )}
              <div ref={groupMsgEndRef} />
            </div>
            <div className="px-4 py-3 border-t border-border bg-card/50">
              {replyTo && (
                <div className="flex items-center gap-2 mb-2 px-3 py-1.5 bg-primary/10 rounded-xl border-l-2 border-primary">
                  <Reply className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  <p className="text-xs text-primary font-semibold flex-1 truncate">↩ {replyTo.slice(0, 50)}</p>
                  <button onClick={() => setReplyTo(null)} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
                </div>
              )}
              <div className="flex items-center gap-2 bg-muted rounded-2xl px-3 py-2">
                <input
                  ref={groupInputRef}
                  value={groupMessageText}
                  onChange={(e) => setGroupMessageText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && groupMessageText.trim()) { e.preventDefault(); handleGroupSend(); } }}
                  placeholder={`Message ${activeGroup.name}…`}
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
                <button onClick={() => handleGroupSend()} disabled={!groupMessageText.trim() || sendingGroupMsg}
                  className="p-1.5 text-primary disabled:text-muted-foreground transition-all active:scale-90">
                  {sendingGroupMsg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>
        ) : activeTab === "groups" ? (
          <div className="hidden md:flex flex-1 items-center justify-center text-center">
            <div>
              <div className="text-5xl mb-4">👥</div>
              <p className="font-bold text-foreground text-lg">Group Chats</p>
              <p className="text-sm text-muted-foreground mt-1">Select a group or create a new one</p>
            </div>
          </div>
        ) : null}

        {/* DM Chat panel */}
        {activeTab === "dms" && active ? (
          <div className="flex flex-col flex-1 min-w-0">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/80 backdrop-blur-sm">
              <button onClick={() => setActive(null)} className="md:hidden p-1.5 hover:bg-muted rounded-xl text-muted-foreground">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="relative">
                <Avatar src={getOtherUser(active)?.avatarUrl} name={getOtherUser(active)?.displayName || "User"} size="sm" online={isOnline(getOtherUser(active)?.id)} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-foreground">{getOtherUser(active)?.displayName || getOtherUser(active)?.username}</p>
                <div className="flex items-center gap-2">
                  {isOnline(getOtherUser(active)?.id) ? (
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      <p className="text-xs text-green-500 font-medium">Active now</p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Offline</p>
                  )}
                  {getOtherUser(active)?.id && (
                    <span className="text-[9px] text-muted-foreground/50 font-mono border border-border/30 rounded px-1 py-0.5 hidden sm:inline">
                      ID: {getOtherUser(active)?.id}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setCallState({ mode: "caller", callType: "voice" })}
                className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="Voice call"
              >
                <Phone className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCallState({ mode: "caller", callType: "video" })}
                className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="Video call"
              >
                <Video className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
              {(messages?.messages ?? []).map((msg, idx) => {
                const isMe = msg.sender?.id === user?.id || msg.senderId === user?.id;
                const prevMsg = idx > 0 ? (messages?.messages ?? [])[idx - 1] : null;
                const showAvatar = !isMe && (!prevMsg || prevMsg.sender?.id !== msg.sender?.id);
                const msgContent = msg.content ?? "";
                const isDeleted = (msg as unknown as { isDeleted?: boolean }).isDeleted;
                const isMedia = !isDeleted && (isVideoUrl(msgContent) || isAudioUrl(msgContent) || isImageUrl(msgContent) || isGifUrl(msgContent));
                const isForwarded = !isDeleted && msgContent.startsWith("↪ ");
                const reactions = (msg as unknown as { reactions?: { emoji: string; count: number; users: string[]; hasReacted: boolean }[] }).reactions ?? [];
                return (
                  <div key={msg.id} className={cn("flex items-end gap-2 group", isMe ? "justify-end" : "justify-start")}
                    onContextMenu={(e) => { if (!isDeleted) openCtxMenu(e, msg.id, isMe, msgContent); }}
                    onTouchStart={() => { if (!isDeleted) startLongPress(msg.id, isMe, msgContent); }}
                    onTouchEnd={cancelLongPress}
                    onTouchMove={cancelLongPress}
                  >
                    {!isMe && (
                      <div className="w-7 flex-shrink-0">
                        {showAvatar && (
                          <button onClick={() => msg.sender && setProfilePopup({ userId: msg.sender.id! })} className="focus:outline-none">
                            <Avatar src={msg.sender?.avatarUrl} name={msg.sender?.displayName || "User"} size="xs" className="hover:opacity-80 transition-opacity cursor-pointer" />
                          </button>
                        )}
                      </div>
                    )}
                    <div className={cn("flex flex-col gap-0.5", isMe ? "items-end" : "items-start")}>
                      {isForwarded && (
                        <div className={cn("flex items-center gap-1 text-[10px] text-muted-foreground mb-0.5 px-1", isMe ? "justify-end" : "justify-start")}>
                          <Forward className="w-2.5 h-2.5" /> Forwarded
                        </div>
                      )}
                      <div className={cn(
                        "max-w-[300px] text-sm leading-relaxed shadow-sm select-none",
                        isDeleted
                          ? "px-4 py-2.5 rounded-2xl bg-muted text-muted-foreground/60 italic"
                          : isMedia ? "bg-transparent" : cn(
                            "px-4 py-2.5 rounded-2xl",
                            isMe
                              ? "bg-primary text-primary-foreground rounded-br-sm"
                              : "bg-card border border-card-border text-foreground rounded-bl-sm",
                            isForwarded && "border-l-2 border-primary/50 !rounded-bl-2xl opacity-90"
                          )
                      )}>
                        {isDeleted
                          ? <span className="text-xs">🗑 Message deleted</span>
                          : renderMessageContent(isForwarded ? msgContent.slice(2) : msgContent, msg.senderId ?? undefined)}
                      </div>
                      <MessageReactions
                        messageId={msg.id}
                        reactions={reactions}
                        onReactionChange={() => refetchMessages()}
                        showPicker={false}
                      />
                      <div className={cn("flex items-center gap-1 px-1", isMe ? "justify-end" : "justify-start")}>
                        <p className="text-[10px] text-muted-foreground">
                          {formatRelativeTime(msg.createdAt)}
                        </p>
                        {isMe && (
                          <span className="text-[11px] leading-none select-none" title={(msg as unknown as { seenAt?: string }).seenAt ? "Seen" : "Sent"}>
                            {(msg as unknown as { seenAt?: string }).seenAt
                              ? <span className="text-primary font-bold">✓✓</span>
                              : <span className="text-muted-foreground/60">✓</span>}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {(!messages?.messages || messages.messages.length === 0) && (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-16">
                  <div className="text-4xl mb-3">👋</div>
                  <p className="text-sm font-semibold">Say hello to {getOtherUser(active)?.displayName || "them"}!</p>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="px-4 py-3 border-t border-border bg-card/50">
              {/* Block/Unblock UX — show when the conversation partner is blocked */}
              {otherUser && blockedUsers.has(otherUser.id!) && (
                <div className="mb-3 flex flex-col items-center gap-2 py-3 px-4 bg-destructive/5 border border-destructive/20 rounded-2xl text-center">
                  <p className="text-sm font-bold text-destructive/80">You have blocked this user</p>
                  <p className="text-xs text-muted-foreground">Unblock to send messages</p>
                  <button
                    onClick={async () => {
                      setUnblockPending(true);
                      await fetch(`/api/users/${otherUser.id}/block`, { method: "DELETE", credentials: "include" });
                      setBlockedUsers(prev => { const n = new Set(prev); n.delete(otherUser.id!); return n; });
                      setUnblockPending(false);
                    }}
                    disabled={unblockPending}
                    className="flex items-center gap-1.5 px-4 py-2 bg-card border border-border rounded-xl text-sm font-bold hover:bg-green-500/10 hover:text-green-600 hover:border-green-500/30 transition-colors disabled:opacity-50"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    {unblockPending ? "Unblocking…" : "Unblock User"}
                  </button>
                </div>
              )}
              {otherTyping && (
                <div className="flex items-center gap-2 mb-1.5 px-1">
                  <Avatar src={getOtherUser(active)?.avatarUrl} name={getOtherUser(active)?.displayName || "User"} size="xs" />
                  <div className="flex items-center gap-1 px-3 py-2 bg-card border border-card-border rounded-2xl rounded-bl-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              )}
              {replyTo && (
                <div className="flex items-center gap-2 mb-2 px-3 py-1.5 bg-primary/10 rounded-xl border-l-2 border-primary">
                  <Reply className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  <p className="text-xs text-primary font-semibold flex-1 truncate">↩ {replyTo.slice(0, 50)}</p>
                  <button onClick={() => setReplyTo(null)} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
                </div>
              )}
              <div className="flex items-center gap-2 bg-muted rounded-2xl px-3 py-2">
                {/* Emoji */}
                <div className="relative">
                  <button onClick={() => { setShowEmoji(!showEmoji); setShowGif(false); }}
                    className={cn("p-1.5 rounded-xl transition-colors", showEmoji ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-primary")}>
                    <Smile className="w-5 h-5" />
                  </button>
                  {showEmoji && <EmojiPicker onSelect={insertEmoji} onClose={() => setShowEmoji(false)} position="top" />}
                </div>
                {/* GIF */}
                <div className="relative">
                  <button onClick={() => { setShowGif(!showGif); setShowEmoji(false); }}
                    className={cn("p-1.5 rounded-xl transition-colors text-xs font-black leading-none", showGif ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-primary")}>
                    GIF
                  </button>
                  {showGif && <GifPicker onSelect={handleGifSelect} onClose={() => setShowGif(false)} position="top" />}
                </div>
                {/* File/media upload */}
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="p-1.5 rounded-xl text-muted-foreground hover:text-primary transition-colors"
                  title="Upload image, video, or audio (up to 500MB)"
                >
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                </button>
                <input ref={fileRef} type="file" accept="image/*,video/*,audio/*" onChange={handleFileUpload} className="hidden" />

                <input
                  ref={inputRef}
                  value={messageText}
                  onChange={(e) => handleTyping(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && messageText.trim()) { e.preventDefault(); handleSend(); } }}
                  placeholder={`Message ${getOtherUser(active)?.displayName ?? "…"}`}
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
                <button onClick={() => handleSend()} disabled={!messageText.trim() || sending}
                  className="p-1.5 text-primary disabled:text-muted-foreground transition-all active:scale-90">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground/50 text-center mt-1.5">Supports images, video, audio • Max 500MB per file</p>
            </div>
          </div>
        ) : activeTab === "dms" ? (
          <div className="hidden md:flex flex-1 items-center justify-center text-center">
            <div>
              <div className="text-5xl mb-4">💬</div>
              <p className="font-bold text-foreground text-lg">Your messages</p>
              <p className="text-sm text-muted-foreground mt-1">Select a conversation or start a new one</p>
            </div>
          </div>
        ) : null}
      </div>
    </Layout>
  );
}

function NewDmPanel({ onStart, starting, onClose }: { onStart: (id: string) => void; starting: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ id: string; username: string; displayName?: string; avatarUrl?: string }>>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(query.trim())}`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setResults(data.users ?? []);
        }
      } catch { /* ignore */ }
      finally { setSearching(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <div className="border-b border-border bg-card shadow-lg">
      <div className="flex items-center gap-2 px-3 pt-3 pb-1">
        <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by username…"
          className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground"
        />
        <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>
      {(results.length > 0 || searching) && (
        <div className="max-h-56 overflow-y-auto px-2 pb-2">
          {searching && results.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">Searching…</p>
          )}
          {results.map((u) => (
            <button
              key={u.id}
              onClick={() => { onStart(u.id); onClose(); }}
              disabled={starting}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted transition-colors text-left"
            >
              <Avatar src={u.avatarUrl} name={u.displayName || u.username} size="sm" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground truncate">{u.displayName || u.username}</p>
                <p className="text-xs text-muted-foreground">@{u.username}</p>
              </div>
            </button>
          ))}
        </div>
      )}
      {!searching && query.trim() && results.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4 px-3">No users found for "{query}"</p>
      )}
    </div>
  );
}
