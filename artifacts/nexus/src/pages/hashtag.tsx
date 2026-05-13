import { useParams, useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { PostCard } from "@/components/PostCard";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Hash, Loader2, Flame, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Post } from "@workspace/api-client-react";

interface HashtagResponse {
  tag: string;
  posts: Post[];
  count: number;
}

export default function HashtagPage() {
  const { tag } = useParams<{ tag: string }>();
  const [, navigate] = useLocation();

  const { data, isLoading } = useQuery<HashtagResponse>({
    queryKey: [`/api/hashtag/${tag}`],
    queryFn: () => fetch(`/api/hashtag/${tag}`, { credentials: "include" }).then((r) => r.json()),
    enabled: !!tag,
  });

  const posts = data?.posts ?? [];
  const totalLikes = posts.reduce((sum, p) => sum + (p.likeCount ?? 0), 0);
  const totalComments = posts.reduce((sum, p) => sum + (p.commentCount ?? 0), 0);

  return (
    <Layout>
      <div className="max-w-xl mx-auto pb-24 md:pb-8">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border/30">
          <div className="flex items-center gap-3 px-4 pt-5 pb-4">
            <button
              onClick={() => navigate(-1 as never)}
              className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-sm">
                <Hash className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-black text-foreground text-lg leading-tight">#{tag}</h1>
                {!isLoading && (
                  <p className="text-xs text-muted-foreground">{data?.count ?? 0} posts</p>
                )}
              </div>
            </div>
          </div>

          {/* Stats bar */}
          {!isLoading && posts.length > 0 && (
            <div className="flex gap-4 px-4 pb-4">
              <div className={cn(
                "flex-1 flex items-center gap-2 px-3 py-2 rounded-xl",
                "bg-card border border-card-border"
              )}>
                <Flame className="w-4 h-4 text-rose-500" />
                <div>
                  <p className="text-xs font-black text-foreground">{totalLikes.toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground">Total likes</p>
                </div>
              </div>
              <div className={cn(
                "flex-1 flex items-center gap-2 px-3 py-2 rounded-xl",
                "bg-card border border-card-border"
              )}>
                <TrendingUp className="w-4 h-4 text-blue-500" />
                <div>
                  <p className="text-xs font-black text-foreground">{totalComments.toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground">Comments</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="px-4 pt-4 space-y-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-32 gap-4">
              <div className="w-14 h-14 rounded-3xl btn-primary flex items-center justify-center">
                <Hash className="w-7 h-7 text-white animate-pulse" />
              </div>
              <p className="text-sm text-muted-foreground font-semibold">Loading #{tag}…</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-24">
              <div className="text-6xl mb-4">#️⃣</div>
              <p className="font-black text-xl text-foreground mb-2">No posts yet</p>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                Be the first to post with <span className="text-primary font-bold">#{tag}</span>
              </p>
            </div>
          ) : (
            posts.map((post, i) => (
              <div key={post.id} className="slide-up" style={{ animationDelay: `${i * 40}ms` }}>
                <PostCard
                  post={post}
                  onTagClick={(t) => navigate(`/hashtag/${encodeURIComponent(t)}`)}
                />
              </div>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}
