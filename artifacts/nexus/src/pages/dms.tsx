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
  const [callState, setCallState] = useState<null | { mode: "caller" | "callee"; callType: "voice" | "video"; incomingOffer?: { sdp: string; type: RTCSdpType; callerName: string; callType: "voice" | "video" } }>(null);
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
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-muted text-sm font-semibold