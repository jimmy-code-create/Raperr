import { useParams, useLocation, Link } from "wouter";
import { Layout } from "@/components/Layout";
import { PostCard } from "@/components/PostCard";
import { Avatar } from "@/components/Avatar";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import {
  useGetUserProfile,
  useGetUserPosts,
  useGetUserBadges,
  useFollowUser,
  useUnfollowUser,
  useGetMyProfile,
  useUpdateMyProfile,
  useStartConversation,
} from "@workspace/api-client-react";
import type { Post } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Edit3, Check, X, Grid3X3, List, Zap, Image, Camera, MessageCircle, Phone, Video, ShieldOff, ShieldCheck, Users } from "lucide-react";
import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn, getRizzRank } from "@/lib/utils";
import { useSound } from "@/hooks/use-sound";
import { useToast } from "@/hooks/use-toast";
import { CallModal } from "@/components/CallModal";

type ProfileTab = "posts" | "badges";

const RARITY_GRADIENT: Record<string, string> = {
  exclusive: "from-amber-400 via-yellow-300 to-amber-500",
  legendary: "from-yellow-500 via-red-500 to-purple-600",
  epic: "from-purple-600 to-blue-500",
  rare: "from-blue-500 to-cyan-400",
  uncommon: "from-emerald-500 to-green-400",
  common: "from-slate-500 to-slate-400",
};

const BANNER_PRESETS = [
  "linear-gradient(135deg, hsl(var(--primary) / 0.6), hsl(280 80% 60% / 0.4))",
  "linear-gradient(135deg, #667eea, #764ba2)",
  "linear-gradient(135deg, #f093fb, #f5576c)",
  "linear-gradient(135deg, #4facfe, #00f2fe)",
  "linear-gradient(135deg, #43e97b, #38f9d7)",
  "linear-gradient(135deg, #fa709a, #fee140)",
  "linear-gradient(135deg, #a18cd1, #fbc2eb)",
  "linear-gradient(135deg, #ffecd2, #fcb69f)",
];

const AVATAR_EMOJIS = ["🦊", "🐱", "🐶", "🐸", "🦋", "🌸", "💎", "👑", "🔥", "✨", "🎭", "🦄", "🐲", "🦁", "🐯"];

function compressImage(dataUrl: string, maxSize = 300): Promise<string> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.src = dataUrl;
  });
}

export default function ProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { user: authUser } = useAuth();
  const isMe = !id || id === "me" || id === authUser?.id;
  const userId = isMe ? (authUser?.id ?? "") : (id ?? "");
  const qc = useQueryClient();
  const { playFollow, playSuccess, playClick } = useSound();
  const { toast } = useToast();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile, isLoading: profileLoading } = useGetUserProfile(userId, { query: { enabled: !isMe && !!userId } as any });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: myProfile, isLoading: myLoading } = useGetMyProfile({ query: { enabled: isMe } as any });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: posts } = useGetUserPosts(userId, { query: { enabled: !!userId } as any });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: badges } = useGetUserBadges(userId, { query: { enabled: !!userId } as any });

  const displayProfile = isMe ? myProfile : profile;
  const loading = isMe ? myLoading : profileLoading;
  const [, navigate] = useLocation();

  const [editing, setEditing] = useState(false);
  const [editBio, setEditBio] = useState("");
  const [editName, setEditName] = useState("");
  const [editAvatar, setEditAvatar] = useState("");
  const [editBanner, setEditBanner] = useState("");
  const [activeTab, setActiveTab] = useState<ProfileTab>("posts");
  const [gridView, setGridView] = useState(true);
  const [showBannerPicker, setShowBannerPicker] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [editBannerPreset, setEditBannerPreset] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [activeCall, setActiveCall] = useState<{ type: "voice" | "video"; convoId: number } | null>(null);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [blockPending, setBlockPending] = useState(false);
  const bannerFileRef = useRef<HTMLInputElement>(null);
  const avatarFileRef = useRef<HTMLInputElement>(null);

  const { data: mutualsData } = useQuery({
    queryKey: [`/api/users/${userId}/mutuals`],
    queryFn: () => fetch(`/api/users/${userId}/mutuals`, { credentials: "include" }).then(r => r.json()),
    enabled: !isMe && !!userId,
  });
  const mutuals: Array<{ id: string; displayName?: string | null; avatarUrl?: string | null; username?: string | null }> = mutualsData?.mutuals ?? [];

  const handleBlock = async () => {
    setBlockPending(true);
    try {
      if ((displayProfile as unknown as { isBlocked?: boolean })?.isBlocked) {
        await fetch(`/api/users/${userId}/block`, { method: "DELETE", credentials: "include" });
      } else {
        await fetch(`/api/users/${userId}/block`, { method: "POST", credentials: "include" });
      }
      qc.invalidateQueries({ queryKey: [`/api/users/${userId}`] });
      setShowBlockConfirm(false);
    } finally { setBlockPending(false); }
  };

  const { mutate: follow } = useFollowUser({
    mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: [`/api/users/${userId}`] }); playFollow(); } },
  });
  const { mutate: unfollow } = useUnfollowUser({
    mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: [`/api/users/${userId}`] }) },
  });
  const { mutate: startConvo } = useStartConversation({
    mutation: { onSuccess: () => navigate("/dms") },
  });
  const { mutate: updateProfile, isPending: saving } = useUpdateMyProfile({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["/api/users/me"] });
        qc.invalidateQueries({ queryKey: [`/api/users/${userId}`] });
        setEditing(false);
        playSuccess();
        toast({ title: "Profile saved ✨", description: "Your changes are live." });
      },
      onError: () => {
        toast({ title: "Save failed", description: "Could not save profile. Try again.", variant: "destructive" });
      },
    },
  });

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  const startEdit = () => {
    setEditBio(displayProfile?.bio ?? "");
    setEditName(displayProfile?.displayName ?? "");
    setEditAvatar(displayProfile?.avatarUrl ?? authUser?.profileImageUrl ?? "");
    setEditBanner("");
    setEditing(true);
    playClick();
  };

  const rizzScore = Math.min(9999, posts?.posts?.reduce((s: number, p) => s + ((p.likeCount ?? 0) as number), 0) ?? 0);
  const rizzRank = getRizzRank(rizzScore);

  const handleBannerFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      if (file.type === "image/gif") {
        setEditBanner(dataUrl);
      } else {
        const compressed = await compressImage(dataUrl, 800);
        setEditBanner(compressed);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const compressed = await compressImage(ev.target?.result as string, 300);
      setEditAvatar(compressed);
      setAvatarUploading(false);
      setShowAvatarPicker(false);
    };
    reader.readAsDataURL(file);
  };

  const bannerStyle = editBanner
    ? { backgroundImage: `url(${editBanner})`, backgroundSize: "cover", backgroundPosition: "center" }
    : editBannerPreset
    ? { background: editBannerPreset }
    : { background: BANNER_PRESETS[0] };

  const savedBanner = (displayProfile as unknown as { bannerUrl?: string })?.bannerUrl;
  const profileBannerStyle = savedBanner
    ? (savedBanner.startsWith("http") || savedBanner.startsWith("data:") || savedBanner.startsWith("/")
      ? { backgroundImage: `url(${savedBanner})`, backgroundSize: "cover", backgroundPosition: "center" }
      : { background: savedBanner })
    : { background: BANNER_PRESETS[Math.abs((userId.charCodeAt(0) || 65) - 65) % BANNER_PRESETS.length] };

  const currentAvatar = editing ? editAvatar : (displayProfile?.avatarUrl ?? authUser?.profileImageUrl ?? "");

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-6">
        {/* Profile header card */}
        <div className="rizz-card mb-5 overflow-hidden">
          {/* Banner */}
          <div className="h-36 relative overflow-hidden" style={editing ? bannerStyle : profileBannerStyle}>
            {!editing && !savedBanner && <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-primary/10 to-transparent" />}
            {editing && (
              <div className="absolute inset-0 flex items-center justify-center gap-3">
                <button onClick={() => bannerFileRef.current?.click()}
                  className="flex items-center gap-2 px-3 py-2 bg-black/50 backdrop-blur-sm text-white rounded-2xl text-xs font-bold hover:bg-black/70 transition-colors">
                  <Camera className="w-3.5 h-3.5" /> Upload Banner
                </button>
                <button onClick={() => setShowBannerPicker(!showBannerPicker)}
                  className="flex items-center gap-2 px-3 py-2 bg-black/50 backdrop-blur-sm text-white rounded-2xl text-xs font-bold hover:bg-black/70 transition-colors">
                  <Image className="w-3.5 h-3.5" /> Presets
                </button>
                <input ref={bannerFileRef} type="file" accept="image/*" onChange={handleBannerFile} className="hidden" />
              </div>
            )}
            <div className="absolute top-3 right-3">
              <div className={cn("px-2.5 py-1 rounded-full text-white text-[11px] font-black bg-gradient-to-r shadow-lg", rizzRank.color)}>
                {rizzRank.emoji} {rizzRank.rank}
              </div>
            </div>
          </div>

          {/* Banner preset picker */}
          {editing && showBannerPicker && (
            <div className="px-4 py-2 flex gap-2 overflow-x-auto bg-muted/50 border-b border-border/40">
              {BANNER_PRESETS.map((preset, i) => (
                <button key={i} onClick={() => { setEditBannerPreset(preset); setEditBanner(""); setShowBannerPicker(false); }}
                  className={cn("w-12 h-8 rounded-xl flex-shrink-0 ring-2 transition-all", editBannerPreset === preset ? "ring-primary scale-110" : "ring-transparent hover:ring-primary")}
                  style={{ background: preset }} />
              ))}
            </div>
          )}

          <div className="px-5 pb-5">
            {/* Avatar + actions */}
            <div className="flex items-end justify-between -mt-10 mb-4">
              <div className="relative">
                <div className="ring-4 ring-background rounded-full shadow-xl overflow-hidden">
                  {currentAvatar ? (
                    <img src={currentAvatar} alt="Avatar" className="w-20 h-20 rounded-full object-cover" />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/40 to-primary/10 flex items-center justify-center text-3xl font-black text-foreground">
                      {(displayProfile?.displayName || authUser?.firstName || "U")[0].toUpperCase()}
                    </div>
                  )}
                </div>
                {editing && (
                  <button onClick={() => setShowAvatarPicker(!showAvatarPicker)}
                    className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary border-2 border-background flex items-center justify-center shadow-md">
                    <Camera className="w-3.5 h-3.5 text-white" />
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                {isMe ? (
                  !editing ? (
                    <button onClick={startEdit}
                      className="flex items-center gap-1.5 px-4 py-2 bg-card border border-card-border rounded-2xl text-sm font-bold hover:bg-muted transition-colors shadow-sm">
                      <Edit3 className="w-4 h-4" /> Edit Profile
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={() => setEditing(false)} className="p-2 bg-card border border-card-border rounded-2xl hover:bg-muted transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => updateProfile({ data: { displayName: editName, bio: editBio, avatarUrl: editAvatar || undefined, bannerUrl: editBanner || editBannerPreset || undefined } })}
                        disabled={saving}
                        className="flex items-center gap-1.5 px-4 py-2 btn-primary text-primary-foreground rounded-2xl text-sm font-bold disabled:opacity-50">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Save
                      </button>
                    </div>
                  )
                ) : (
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => startConvo({ data: { userId } })}
                      className="p-2.5 rounded-2xl bg-muted border border-border hover:bg-primary/10 hover:border-primary/30 hover:text-primary text-muted-foreground transition-all"
                      title="Message"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setActiveCall({ type: "voice", convoId: 0 });
                        startConvo({ data: { userId } });
                      }}
                      className="p-2.5 rounded-2xl bg-muted border border-border hover:bg-green-500/10 hover:border-green-500/30 hover:text-green-500 text-muted-foreground transition-all"
                      title="Voice call"
                    >
                      <Phone className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setActiveCall({ type: "video", convoId: 0 });
                        startConvo({ data: { userId } });
                      }}
                      className="p-2.5 rounded-2xl bg-muted border border-border hover:bg-blue-500/10 hover:border-blue-500/30 hover:text-blue-500 text-muted-foreground transition-all"
                      title="Video call"
                    >
                      <Video className="w-4 h-4" />
                    </button>
                    <button onClick={() => displayProfile?.isFollowing ? unfollow({ userId }) : follow({ userId })}
                      className={cn("px-5 py-2 rounded-2xl text-sm font-black transition-all shadow-sm",
                        displayProfile?.isFollowing
                          ? "bg-muted text-foreground hover:bg-destructive/10 hover:text-destructive border border-border"
                          : "btn-primary text-primary-foreground glow-primary-sm")}>
                      {displayProfile?.isFollowing ? "Following" : "Follow"}
                    </button>
                    {showBlockConfirm ? (
                      <div className="flex gap-1.5">
                        <button onClick={() => setShowBlockConfirm(false)} className="px-3 py-2 rounded-2xl bg-muted text-sm font-bold text-muted-foreground">Cancel</button>
                        <button onClick={handleBlock} disabled={blockPending}
                          className="px-3 py-2 rounded-2xl bg-destructive/10 text-destructive text-sm font-bold hover:bg-destructive/20 transition-colors">
                          {blockPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (displayProfile as unknown as { isBlocked?: boolean })?.isBlocked ? "Unblock" : "Confirm Block"}
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setShowBlockConfirm(true)}
                        className={cn("p-2.5 rounded-2xl border transition-all",
                          (displayProfile as unknown as { isBlocked?: boolean })?.isBlocked
                            ? "bg-green-500/10 border-green-500/30 text-green-600 hover:bg-green-500/20"
                            : "bg-muted border-border text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30")}
                        title={(displayProfile as unknown as { isBlocked?: boolean })?.isBlocked ? "Unblock user" : "Block user"}>
                        {(displayProfile as unknown as { isBlocked?: boolean })?.isBlocked ? <ShieldCheck className="w-4 h-4" /> : <ShieldOff className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Avatar picker panel */}
            {editing && showAvatarPicker && (
              <div className="mb-4 p-3 bg-muted/60 rounded-2xl border border-border/40 fade-in">
                <p className="text-xs font-bold text-muted-foreground mb-2">Choose avatar</p>
                <div className="flex items-center gap-2 mb-2">
                  <button onClick={() => avatarFileRef.current?.click()} disabled={avatarUploading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-xl text-xs font-bold hover:bg-primary/20 transition-colors">
                    {avatarUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />} Upload Photo
                  </button>
                  <input ref={avatarFileRef} type="file" accept="image/*" onChange={handleAvatarFile} className="hidden" />
                </div>
                <div className="grid grid-cols-8 gap-1.5">
                  {AVATAR_EMOJIS.map(emoji => (
                    <button key={emoji} onClick={() => {
                      const canvas = document.createElement("canvas");
                      canvas.width = canvas.height = 100;
                      const ctx = canvas.getContext("2d")!;
                      ctx.font = "68px serif";
                      ctx.textAlign = "center";
                      ctx.textBaseline = "middle";
                      ctx.fillText(emoji, 50, 56);
                      setEditAvatar(canvas.toDataURL("image/png"));
                      setShowAvatarPicker(false);
                    }}
                      className="w-8 h-8 text-xl flex items-center justify-center rounded-lg hover:bg-muted transition-colors hover:scale-110">
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Name / bio */}
            {editing ? (
              <div className="space-y-2.5">
                <input value={editName} onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-muted border border-border rounded-2xl px-4 py-2.5 text-lg font-black focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                  placeholder="Display name" />
                <textarea value={editBio} onChange={(e) => setEditBio(e.target.value)}
                  className="w-full bg-muted border border-border rounded-2xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                  rows={3} placeholder="Write a bio… ✨" />
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-black text-foreground">{displayProfile?.displayName || authUser?.firstName || "User"}</h2>
                  {displayProfile?.isVerified && (
                    <VerifiedBadge size="md" />
                  )}
                  {displayProfile?.topBadge && (() => {
                    const tb = displayProfile.topBadge!;
                    const isImg = tb.icon?.startsWith("/") || tb.icon?.startsWith("http");
                    return isImg ? (
                      <img src={tb.icon!} alt={tb.name ?? ""} title={tb.name ?? ""} className="w-6 h-6 rounded-lg object-cover shadow-md ring-1 ring-amber-400/40" />
                    ) : (
                      <span className="text-xl leading-none drop-shadow" title={tb.name ?? ""}>{tb.icon}</span>
                    );
                  })()}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-sm text-muted-foreground">@{displayProfile?.username || authUser?.id?.slice(0, 8)}</p>
                  {!isMe && (displayProfile as unknown as { isFollowingBack?: boolean })?.isFollowingBack && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 bg-primary/10 text-primary rounded-full border border-primary/20">
                      Follows you
                    </span>
                  )}
                </div>
                {displayProfile?.id && (
                  <p className="text-[10px] text-muted-foreground/50 font-mono mt-0.5">ID: {displayProfile.id}</p>
                )}
                {displayProfile?.bio && <p className="text-sm text-foreground mt-2 leading-relaxed">{displayProfile.bio}</p>}
              </div>
            )}

            {/* Mutual friends */}
            {!isMe && mutuals.length > 0 && (
              <div className="mt-3 p-3 bg-muted/40 rounded-2xl border border-border/30">
                <div className="flex items-center gap-1.5 mb-2">
                  <Users className="w-3.5 h-3.5 text-muted-foreground" />
                  <p className="text-xs font-black text-muted-foreground uppercase tracking-wider">
                    {mutuals.length} Mutual Friend{mutuals.length > 1 ? "s" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {mutuals.slice(0, 5).map((m, i) => (
                    <div key={m.id} style={{ marginLeft: i > 0 ? -10 : 0 }} className="relative">
                      <img
                        src={m.avatarUrl ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${m.id}`}
                        alt={m.displayName ?? ""}
                        title={m.displayName ?? m.username ?? ""}
                        className="w-8 h-8 rounded-full object-cover ring-2 ring-card"
                        onError={e => { e.currentTarget.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${m.id}`; }}
                      />
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground ml-1 truncate">
                    {mutuals.slice(0, 2).map(m => m.displayName || m.username).join(", ")}
                    {mutuals.length > 2 ? ` +${mutuals.length - 2} more` : ""}
                  </p>
                </div>
              </div>
            )}

            {/* Stats */}
            <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4 pt-4 border-t border-border/40">
              <div className="text-center min-w-[44px]">
                <p className="font-black text-lg text-foreground leading-tight">{posts?.posts?.length ?? 0}</p>
                <p className="text-xs text-muted-foreground font-semibold">Posts</p>
              </div>
              <Link href={`/following/${userId}`}>
                <a className="text-center min-w-[60px] hover:text-primary transition-colors group cursor-pointer">
                  <p className="font-black text-lg text-foreground leading-tight group-hover:text-primary">{displayProfile?.followerCount ?? 0}</p>
                  <p className="text-xs text-muted-foreground font-semibold group-hover:text-primary">Followers</p>
                </a>
              </Link>
              <Link href={`/following/${userId}`}>
                <a className="text-center min-w-[64px] hover:text-primary transition-colors group cursor-pointer">
                  <p className="font-black text-lg text-foreground leading-tight group-hover:text-primary">{displayProfile?.followingCount ?? 0}</p>
                  <p className="text-xs text-muted-foreground font-semibold group-hover:text-primary">Following</p>
                </a>
              </Link>
              <div className="text-center min-w-[44px]">
                <p className={cn("font-black text-lg flex items-center gap-1 justify-center bg-gradient-to-r bg-clip-text text-transparent leading-tight", rizzRank.color)}>
                  <Zap className="w-4 h-4 text-primary flex-shrink-0" />{rizzScore}
                </p>
                <p className="text-xs text-muted-foreground font-semibold">Rizz</p>
              </div>
              <div className="text-center min-w-[52px]">
                <p className="font-black text-lg text-foreground leading-tight">{badges?.badges?.length ?? 0}</p>
                <p className="text-xs text-muted-foreground font-semibold">Badges</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted/40 rounded-2xl p-1 mb-4 border border-border/30">
          {(["posts", "badges"] as const).map((tab) => (
            <button key={tab} onClick={() => { setActiveTab(tab); playClick(); }}
              className={cn("flex-1 py-2.5 rounded-xl text-sm font-black capitalize transition-all",
                activeTab === tab ? "btn-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
              {tab === "posts" ? `Posts (${posts?.posts?.length ?? 0})` : `Badges (${badges?.badges?.length ?? 0})`}
            </button>
          ))}
          {activeTab === "posts" && (
            <div className="flex gap-0.5 ml-1">
              <button onClick={() => setGridView(true)} className={cn("p-2.5 rounded-xl transition-colors", gridView ? "bg-card text-primary shadow-sm" : "text-muted-foreground")}>
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button onClick={() => setGridView(false)} className={cn("p-2.5 rounded-xl transition-colors", !gridView ? "bg-card text-primary shadow-sm" : "text-muted-foreground")}>
                <List className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Tab content */}
        {activeTab === "posts" ? (
          posts?.posts && posts.posts.length > 0 ? (
            gridView ? (
              <div className="grid grid-cols-3 gap-0.5 rounded-2xl overflow-hidden">
                {posts.posts.map((post) => (
                  <div key={post.id} onClick={() => setSelectedPost(post)} className="relative aspect-square bg-muted group cursor-pointer overflow-hidden">
                    {post.mediaUrl ? (
                      post.mediaUrl.startsWith("data:video") || post.mediaUrl.includes("[video]") ? (
                        <div className="w-full h-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center">
                          <span className="text-3xl">🎬</span>
                        </div>
                      ) : (
                        <img src={post.mediaUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      )
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center p-2">
                        <p className="text-[10px] text-foreground text-center line-clamp-4 leading-tight">{post.content}</p>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 flex items-center justify-center">
                      <p className="text-white text-xs font-black opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">❤️ {post.likeCount}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {posts.posts.map((post) => <PostCard key={post.id} post={post} />)}
              </div>
            )
          ) : (
            <div className="text-center py-16 rizz-card">
              <p className="text-5xl mb-3">📷</p>
              <p className="font-black text-foreground text-lg">No posts yet</p>
              {isMe && <p className="text-sm text-muted-foreground mt-1">Share your first post with the world! ✨</p>}
            </div>
          )
        ) : (
          badges?.badges && badges.badges.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {badges.badges.map((badge, i) => (
                <div key={i} className={cn("flex flex-col items-center gap-1.5 p-3 rounded-2xl text-white shadow-md bg-gradient-to-br hover:scale-[1.04] transition-transform cursor-default", RARITY_GRADIENT[badge.rarity ?? "common"] ?? RARITY_GRADIENT.common)}>
                  {badge.icon?.startsWith("http") || badge.icon?.startsWith("/") ? (
                    <img src={badge.icon ?? undefined} alt={badge.name ?? undefined} className="w-7 h-7 rounded-full object-cover drop-shadow" />
                  ) : (
                    <span className="text-2xl drop-shadow">{badge.icon ?? "🏅"}</span>
                  )}
                  <p className="font-black text-[10px] truncate w-full text-center">{badge.name}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 rizz-card">
              <p className="text-5xl mb-3">🏅</p>
              <p className="font-black text-foreground text-lg">No badges yet</p>
              <p className="text-sm text-muted-foreground mt-1">Keep being awesome to earn badges! ✨</p>
            </div>
          )
        )}
      </div>

      {/* Post detail modal (grid view click) */}
      {selectedPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelectedPost(null)}>
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
          <div className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setSelectedPost(null)}
              className="absolute -top-11 right-0 text-white/90 hover:text-white flex items-center gap-1.5 text-sm font-bold bg-black/30 backdrop-blur-sm px-3 py-1.5 rounded-full z-10"
            >
              <X className="w-4 h-4" /> Close
            </button>
            <PostCard
              post={selectedPost}
              onDeleted={() => {
                setSelectedPost(null);
                qc.invalidateQueries({ queryKey: [`/api/users/${userId}/posts`] });
              }}
            />
          </div>
        </div>
      )}

      {/* Call modal */}
      {activeCall && displayProfile && (
        <CallModal
          conversationId={activeCall.convoId}
          otherUser={{ id: userId, displayName: displayProfile.displayName, username: displayProfile.username ?? undefined, avatarUrl: displayProfile.avatarUrl }}
          callType={activeCall.type}
          mode="caller"
          onClose={() => setActiveCall(null)}
        />
      )}
    </Layout>
  );
}
