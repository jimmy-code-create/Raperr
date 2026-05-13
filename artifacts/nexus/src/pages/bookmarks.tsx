import { Layout } from "@/components/Layout";
import { PostCard } from "@/components/PostCard";
import { useGetSavedPosts } from "@workspace/api-client-react";
import { Bookmark, Loader2 } from "lucide-react";
import { useLocation } from "wouter";

export default function BookmarksPage() {
  const { data, isLoading } = useGetSavedPosts();
  const [, navigate] = useLocation();
  const posts = data?.posts ?? [];

  return (
    <Layout>
      <div className="max-w-xl mx-auto px-4 py-6 pb-24 md:pb-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-2xl btn-primary flex items-center justify-center shadow-md">
            <Bookmark className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-foreground">Saved Posts</h1>
            <p className="text-xs text-muted-foreground">
              {posts.length} {posts.length === 1 ? "post" : "posts"} saved
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-12 h-12 rounded-2xl btn-primary flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            </div>
            <p className="text-sm text-muted-foreground font-semibold">Loading saved posts…</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20 rizz-card">
            <div className="text-6xl mb-4 float inline-block">🔖</div>
            <p className="font-black text-foreground text-xl mb-2">No saved posts yet</p>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              Tap the bookmark icon on any post to save it here for later
            </p>
            <button
              onClick={() => navigate("/")}
              className="mt-5 btn-primary px-6 py-2.5 rounded-2xl text-sm font-bold text-white"
            >
              Explore Feed
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onTagClick={(tag) => navigate(`/search?q=${encodeURIComponent(tag)}&type=tag`)}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
