import { useState, useEffect, useRef, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  Heart, MessageCircle, Bookmark, Share2,
  Volume2, VolumeX, Play, Pause, Music,
  ChevronUp, ChevronDown, Plus, Upload,
  Loader2, X, Film,
} from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

interface ReelPost {
  id: number;
  content: string;
  mediaUrl?: string | null;
  imageUrl?: string | null;
  likeCount: number;
  commentCount: number;
  isLiked?: boolean;
  isSaved?: boolean;
  author: {
    id: string;
    username: string;
    displayName?: string;
    avatarUrl?: string | null;
    isVerified?: boolean;
  } | null;
  createdAt: string;
  musicTrack?: string | null;
}

function isVideoUrl(url?: string | null) {
  if (!url) return false;
  return (
    url.startsWith("data:video/") ||
    url.startsWith("[video]") ||
    /\.(mp4|webm|mov|avi|mkv|m4v|ogg)(\?|$)/i.test(url) ||
    url.includes("video")
  );
}

function Reel({ post, isActive }: { post: ReelPost; isActive: boolean }) {
  const qc = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [liked, setLiked] = useState(post.isLiked ?? false);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [saved, setSaved] = useState(post.isSaved ?? false);
  const [showHeart, setShowHeart] = useState(false);
  const doubleTapRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapsRef = useRef(0);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isActive) {
      v.currentTime = 0;
      v.play().then(() => setPlaying(true)).catch(() => {});
    } else {
      v.pause();
      setPlaying(false);
    }
  }, [isActive]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); }
    else { v.pause(); setPlaying(false); }
  };

  const handleTap = () => {
    tapsRef.current++;
    if (doubleTapRef.current) clearTimeout(doubleTapRef.current);
    doubleTapRef.current = setTimeout(() => {
      if (tapsRef.current === 1) togglePlay();
      else if (tapsRef.current >= 2) handleLike();
      tapsRef.current = 0;
    }, 250);
  };

  const handleLike = async () => {
    if (!liked) { setShowHeart(true); setTimeout(() => setShowHeart(false), 900); }
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => next ? c + 1 : Math.max(0, c - 1));
    await fetch(`/api/posts/${post.id}/${next ? "like" : "unlike"}`, { method: "POST", credentials: "include" });
    qc.invalidateQueries({ queryKey: ["/api/feed"] });
  };

  const handleSave = async () => {
    const next = !saved;
    setSaved(next);
    await fetch(`/api/posts/${post.id}/${next ? "save" : "unsave"}`, { method: "POST", credentials: "include" });
  };

  const rawUrl = post.mediaUrl ?? post.imageUrl;
  const src = rawUrl?.startsWith("[video]") ? rawUrl.replace("[video]", "") : rawUrl;
  const isVid = isVideoUrl(rawUrl);

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden">
      {/* Video or image */}
      {src ? (
        isVid ? (
          <video
            ref={videoRef}
            src={src}
            className="absolute inset-0 w-full h-full object-cover"
            loop muted={muted} playsInline onClick={handleTap}
          />
        ) : (
          <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover" onClick={handleTap} />
        )
      ) : (
        <div
          className="absolute inset-0 w-full h-full flex items-center justify-center p-8 text-center"
          style={{ background: `linear-gradient(135deg, hsl(${(post.id * 47) % 360} 70% 20%), hsl(${(post.id * 73) % 360} 60% 10%))` }}
          onClick={handleTap}
        >
          <p className="text-white text-2xl font-black leading-tight">{post.content}</p>
        </div>
      )}

      {/* Gradient overlay */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute bottom-0 inset-x-0 h-2/3 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      </div>

      {/* Double-tap heart */}
      {showHeart && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <Heart className="w-24 h-24 text-red-500 fill-current opacity-90" style={{ animation: "ping 0.7s ease-out 1" }} />
        </div>
      )}

      {/* Pause indicator */}
      {!playing && isVid && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm">
            <Play className="w-8 h-8 text-white fill-white ml-1" />
          </div>
        </div>
      )}

      {/* Right side actions */}
      <div className="absolute right-3 bottom-24 flex flex-col items-center gap-5 z-10">
        <button onClick={handleLike} className="flex flex-col items-center gap-1 active:scale-90 transition-transform">
          <div className={cn("w-12 h-12 rounded-full flex items-center justify-center", liked ? "bg-red-500/20" : "bg-black/30 backdrop-blur-sm")}>
            <Heart className={cn("w-6 h-6", liked ? "text-red-500 fill-current" : "text-white")} />
          </div>
          <span className="text-white text-xs font-bold drop-shadow">{likeCount}</span>
        </button>

        <button className="flex flex-col items-center gap-1">
          <div className="w-12 h-12 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center">
            <MessageCircle className="w-6 h-6 text-white" />
          </div>
          <span className="text-white text-xs font-bold drop-shadow">{post.commentCount}</span>
        </button>

        <button onClick={handleSave} className="flex flex-col items-center gap-1 active:scale-90 transition-transform">
          <div className={cn("w-12 h-12 rounded-full flex items-center justify-center", saved ? "bg-primary/20" : "bg-black/30 backdrop-blur-sm")}>
            <Bookmark className={cn("w-6 h-6", saved ? "text-primary fill-current" : "text-white")} />
          </div>
          <span className="text-white text-xs font-bold drop-shadow">Save</span>
        </button>

        <button
          onClick={() => navigator.share?.({ url: window.location.href, title: post.content }).catch(() => {})}
          className="flex flex-col items-center gap-1"
        >
          <div className="w-12 h-12 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center">
            <Share2 className="w-6 h-6 text-white" />
          </div>
          <span className="text-white text-xs font-bold drop-shadow">Share</span>
        </button>

        {isVid && (
          <button onClick={() => setMuted(!muted)} className="flex flex-col items-center gap-1 active:scale-90 transition-transform">
            <div className="w-12 h-12 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center">
              {muted ? <VolumeX className="w-6 h-6 text-white" /> : <Volume2 className="w-6 h-6 text-white" />}
            </div>
          </button>
        )}

        <div className="relative">
          <Link href={`/profile/${post.author?.id}`}>
            <a>
              <Avatar src={post.author?.avatarUrl} name={post.author?.displayName || "User"} size="md" className="ring-2 ring-white" />
            </a>
          </Link>
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
            <Plus className="w-3 h-3 text-white" strokeWidth={3} />
          </div>
        </div>
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-6 left-4 right-20 z-10">
        <Link href={`/profile/${post.author?.id}`}>
          <a className="flex items-center gap-2 mb-2">
            <span className="text-white font-black text-sm drop-shadow">@{post.author?.username}</span>
            {post.author?.isVerified && <span className="text-blue-400 text-xs">✓</span>}
          </a>
        </Link>
        {post.content && (
          <p className="text-white text-sm leading-relaxed drop-shadow line-clamp-2">{post.content}</p>
        )}
        {post.musicTrack && (
          <div className="flex items-center gap-1.5 mt-2">
            <Music className="w-3 h-3 text-white animate-spin" style={{ animationDuration: "3s" }} />
            <span className="text-white text-xs">{post.musicTrack}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function UploadModal({ onClose, onUploaded }: { onClose: () => void; onUploaded: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreview(url);
  };

  const handleSubmit = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const dataUrl = ev.target?.result as string;
        const videoUrl = `[video]${dataUrl}`;
        const res = await fetch("/api/posts", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: caption || "🎬", imageUrl: videoUrl, tags: ["reels"] }),
        });
        if (res.ok) {
          toast({ title: "Reel posted! 🎬" });
          onUploaded();
          onClose();
        } else {
          toast({ title: "Upload failed", variant: "destructive" });
        }
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-t-3xl sm:rounded-3xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Film className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-black text-white">Upload Reel</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-zinc-800 text-zinc-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!preview ? (
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full h-48 rounded-2xl border-2 border-dashed border-zinc-600 flex flex-col items-center justify-center gap-3 hover:border-primary/60 hover:bg-primary/5 transition-all group"
          >
            <div className="w-14 h-14 rounded-2xl bg-zinc-800 group-hover:bg-primary/10 flex items-center justify-center transition-colors">
              <Upload className="w-7 h-7 text-zinc-400 group-hover:text-primary transition-colors" />
            </div>
            <div className="text-center">
              <p className="text-white font-bold text-sm">Tap to choose a video</p>
              <p className="text-zinc-500 text-xs mt-0.5">MP4, MOV, WebM supported</p>
            </div>
          </button>
        ) : (
          <div className="relative rounded-2xl overflow-hidden mb-4 bg-zinc-800" style={{ aspectRatio: "9/16", maxHeight: "280px" }}>
            <video src={preview} className="w-full h-full object-cover" muted autoPlay loop playsInline />
            <button
              onClick={() => { setFile(null); setPreview(""); }}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 flex items-center justify-center text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={handleFile} />

        {preview && (
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Add a caption… 🎬"
            maxLength={200}
            className="w-full mt-3 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-primary/50 transition-colors"
          />
        )}

        <button
          onClick={handleSubmit}
          disabled={!file || uploading}
          className="w-full mt-4 py-3 rounded-2xl bg-primary text-primary-foreground font-black text-sm disabled:opacity-40 transition-all hover:opacity-90 flex items-center justify-center gap-2"
        >
          {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</> : "Post Reel ✨"}
        </button>
      </div>
    </div>
  );
}

export default function ReelsPage() {
  const [allPosts, setAllPosts] = useState<ReelPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);
  const [showUpload, setShowUpload] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchReels = useCallback(() => {
    setLoading(true);
    fetch("/api/feed", { credentials: "include" })
      .then((r) => r.json())
      .then((data: { posts: ReelPost[] }) => {
        setAllPosts(data.posts ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { fetchReels(); }, [fetchReels]);

  // Show both video posts AND posts without media as reels (like TikTok text posts)
  // But prefer video posts first — show video if available
  const reels = allPosts;

  const goTo = (idx: number) => {
    if (idx < 0 || idx >= reels.length) return;
    setActiveIdx(idx);
    containerRef.current?.children[idx]?.scrollIntoView({ behavior: "smooth" });
  };

  const handleScroll = useCallback(() => {
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      const container = containerRef.current;
      if (!container) return;
      const h = container.clientHeight;
      const scrollTop = container.scrollTop;
      setActiveIdx(Math.round(scrollTop / h));
    }, 80);
  }, []);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
        <div className="text-center text-white">
          <div className="w-16 h-16 rounded-3xl bg-primary/20 border border-primary/40 flex items-center justify-center mx-auto mb-4">
            <Film className="w-8 h-8 text-primary animate-pulse" />
          </div>
          <p className="font-black text-xl">Loading Reels…</p>
        </div>
      </div>
    );
  }

  if (reels.length === 0) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-50 text-center px-6">
        <div className="w-20 h-20 rounded-3xl bg-zinc-800 flex items-center justify-center mb-5">
          <Film className="w-10 h-10 text-zinc-400" />
        </div>
        <h2 className="text-2xl font-black text-white mb-2">No Reels Yet</h2>
        <p className="text-zinc-400 text-sm mb-6">Be the first to post a reel!</p>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-2xl font-black text-sm"
        >
          <Plus className="w-4 h-4" /> Upload Reel
        </button>
        <Link href="/">
          <a className="mt-3 text-sm text-zinc-500 hover:text-white transition-colors">Back to Feed</a>
        </Link>
        {showUpload && <UploadModal onClose={() => setShowUpload(false)} onUploaded={() => { fetchReels(); }} />}
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black z-40 overflow-hidden">
        {/* Nav arrows */}
        <button
          onClick={() => goTo(activeIdx - 1)} disabled={activeIdx === 0}
          className="absolute top-1/2 right-4 z-20 -translate-y-8 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white disabled:opacity-30 transition-opacity"
        >
          <ChevronUp className="w-5 h-5" />
        </button>
        <button
          onClick={() => goTo(activeIdx + 1)} disabled={activeIdx === reels.length - 1}
          className="absolute top-1/2 right-4 z-20 translate-y-8 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white disabled:opacity-30 transition-opacity"
        >
          <ChevronDown className="w-5 h-5" />
        </button>

        {/* Back */}
        <Link href="/">
          <a className="absolute top-12 left-4 z-20 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white">
            <X className="w-5 h-5" />
          </a>
        </Link>

        {/* Title */}
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
          <Film className="w-4 h-4 text-white/70" />
          <p className="text-white font-black text-base drop-shadow">Reels</p>
        </div>

        {/* Upload button */}
        <button
          onClick={() => setShowUpload(true)}
          className="absolute top-12 right-16 z-20 w-10 h-10 rounded-full bg-primary flex items-center justify-center shadow-lg hover:opacity-90 active:scale-95 transition-all"
          title="Upload Reel"
        >
          <Plus className="w-5 h-5 text-white" />
        </button>

        {/* Progress dots */}
        <div className="absolute top-24 right-4 z-20 flex flex-col gap-1">
          {reels.slice(Math.max(0, activeIdx - 2), activeIdx + 3).map((_, i) => {
            const realIdx = Math.max(0, activeIdx - 2) + i;
            return (
              <div
                key={realIdx}
                className={cn("rounded-full transition-all duration-200", realIdx === activeIdx ? "w-1.5 h-4 bg-white" : "w-1.5 h-1.5 bg-white/40")}
              />
            );
          })}
        </div>

        {/* Scrollable reels */}
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="h-full overflow-y-scroll snap-y snap-mandatory"
          style={{ scrollbarWidth: "none" }}
        >
          {reels.map((reel, idx) => (
            <div key={reel.id} className="h-screen w-full snap-start snap-always flex-shrink-0">
              <Reel post={reel} isActive={idx === activeIdx} />
            </div>
          ))}
        </div>
      </div>

      {showUpload && (
        <UploadModal onClose={() => setShowUpload(false)} onUploaded={() => { fetchReels(); setActiveIdx(0); }} />
      )}
    </>
  );
}
