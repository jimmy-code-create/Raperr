import { useParams, useLocation, Link } from "wouter";
import { Layout } from "@/components/Layout";
import { Avatar } from "@/components/Avatar";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { PostCard } from "@/components/PostCard";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { ArrowLeft, MessageCircle, Loader2, Send, Smile } from "lucide-react";
import { useState, useRef } from "react";
import { formatRelativeTime, cn } from "@/lib/utils";
import { useSound } from "@/hooks/use-sound";
import type { Post } from "@workspace/api-client-react";
import { EmojiPicker } from "@/components/EmojiPicker";

export default function PostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [commentText, setCommentText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const commentRef = useRef<HTMLInputElement>(null);
  const { playComment, playClick } = useSound();

  const { data: post, isLoading: postLoading } = useQuery<Post>({
    queryKey: [`/api/posts/${id}`],
    queryFn: () => fetch(`/api/posts/${id}`, { credentials: "include" }).then((r) => r.json()),
    enabled: !!id,
  });

  const { data: commentsData, isLoading: commentsLoading } = useQuery<{ comments: Array<{ id: number; content: string; createdAt: string; author: { id: string; username: string; displayName?: string | null; avatarUrl?: string | null } | null }> }>({
    queryKey: [`/api/posts/${id}/comments`],
    queryFn: () => fetch(`/api/posts/${id}/comments`, { credentials: "include" }).then((r) => r.json()),
    enabled: !!id,
  });

  const addComment = useMutation({
    mutationFn: (content: string) =>
      fetch(`/api/posts/${id}/comments`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/posts/${id}/comments`] });
      qc.invalidateQueries({ queryKey: [`/api/posts/${id}`] });
      setCommentText("");
      playComment();
    },
  });

  const comments = commentsData?.comments ?? [];

  const insertEmoji = (emoji: string) => {
    const el = commentRef.current;
    if (!el) { setCommentText((c) => c + emoji); setShowEmoji(false); return; }
    const start = el.selectionStart ?? commentText.length;
    const end = el.selectionEnd ?? commentText.length;
    setCommentText(commentText.slice(0, start) + emoji + commentText.slice(end));
    setShowEmoji(false);
    setTimeout(() => { el.focus(); el.setSelectionRange(start + emoji.length, start + emoji.length); }, 0);
  };

  if (postLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!post) {
    return (
      <Layout>
        <div className="max-w-xl mx-auto px-4 py-20 text-center">
          <div className="text-6xl mb-4">🚫</div>
          <p className="font-black text-xl">Post not found</p>
          <button onClick={() => navigate(-1 as never)} className="mt-4 text-sm text-primary hover:underline">
            Go back
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-xl mx-auto pb-32 md:pb-8">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 pt-5 pb-3 sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border/30">
          <button
            onClick={() => navigate(-1 as never)}
            className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-black text-foreground text-lg">Post</h1>
        </div>

        {/* Post card */}
        <div className="px-4 pt-4">
          <PostCard
            post={post}
            onTagClick={(tag) => navigate(`/hashtag/${encodeURIComponent(tag)}`)}
          />
        </div>

        {/* Comments section */}
        <div className="px-4 mt-4">
          <div className="flex items-center gap-2 mb-4">
            <MessageCircle className="w-4.5 h-4.5 text-primary" />
            <h2 className="font-black text-foreground">
              {post.commentCount} {post.commentCount === 1 ? "Comment" : "Comments"}
            </h2>
          </div>

          {/* Add comment */}
          <div className="flex gap-3 mb-6">
            <Avatar
              src={user?.avatarUrl ?? user?.profileImageUrl}
              name={user?.displayName || user?.username || "Me"}
              size="sm"
              className="flex-shrink-0 mt-0.5"
            />
            <div className="flex-1 relative">
              <div className="flex items-center gap-2 bg-muted/60 rounded-2xl px-3 py-2 border border-border/40 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
                <input
                  ref={commentRef}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && commentText.trim()) { e.preventDefault(); addComment.mutate(commentText.trim()); } }}
                  placeholder="Add a comment…"
                  className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground"
                />
                <button
                  onClick={() => { setShowEmoji(!showEmoji); playClick(); }}
                  className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                >
                  <Smile className="w-4 h-4" />
                </button>
                <button
                  onClick={() => commentText.trim() && addComment.mutate(commentText.trim())}
                  disabled={!commentText.trim() || addComment.isPending}
                  className="p-1.5 rounded-xl bg-primary text-primary-foreground disabled:opacity-40 transition-all hover:scale-110 active:scale-95"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
              {showEmoji && (
                <div className="absolute bottom-full mb-2 z-30">
                  <EmojiPicker onSelect={insertEmoji} onClose={() => setShowEmoji(false)} />
                </div>
              )}
            </div>
          </div>

          {/* Comments list */}
          {commentsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">💬</div>
              <p className="font-bold text-foreground">No comments yet</p>
              <p className="text-sm text-muted-foreground mt-1">Be the first to comment</p>
            </div>
          ) : (
            <div className="space-y-4">
              {comments.map((comment, i) => (
                <div key={comment.id} className="flex gap-3 slide-up" style={{ animationDelay: `${i * 30}ms` }}>
                  <Link href={`/profile/${comment.author?.id}`}>
                    <a>
                      <Avatar
                        src={comment.author?.avatarUrl}
                        name={comment.author?.displayName || comment.author?.username || "User"}
                        size="sm"
                        className="flex-shrink-0"
                      />
                    </a>
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="bg-card border border-card-border rounded-2xl rounded-tl-sm px-3.5 py-2.5">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Link href={`/profile/${comment.author?.id}`}>
                          <a className="text-xs font-black text-foreground hover:text-primary transition-colors">
                            {comment.author?.displayName || comment.author?.username}
                          </a>
                        </Link>
                        <span className="text-[10px] text-muted-foreground">
                          {formatRelativeTime(comment.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-foreground leading-relaxed">{comment.content}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
