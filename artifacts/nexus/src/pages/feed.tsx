import { useState } from "react";
import { Layout } from "@/components/Layout";
import { PostCard } from "@/components/PostCard";
import { StoriesBar } from "@/components/StoriesBar";
import { WhoToFollow } from "@/components/WhoToFollow";
import { useGetHomeFeed } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { Loader2, Flame, Sparkles, Users, Hash } from "lucide-react";
import { useLocation } from "wouter";
import { useSound } from "@/hooks/use-sound";

const FEED_TABS = [
  { id: "foryou",    label: "For You",   icon: Sparkles },
  { id: "following", label: "Following", icon: Users },
  { id: "trending",  label: "Trending",  icon: Flame },
] as const;

type FeedTab = typeof FEED_TABS[number]["id"];

const TRENDING_TAGS = ["#rizz", "#vibes", "#aesthetic", "#fyp", "#trending", "#fire", "#glow", "#mood", "#drip", "#based"];

export default function FeedPage() {
  const [activeTab, setActiveTab] = useState<FeedTab>("foryou");
  const { data: feedData, isLoading } = useGetHomeFeed();
  const [, navigate] = useLocation();
  const { playClick } = useSound();
  const posts = feedData?.posts ?? [];

  const displayPosts = activeTab === "trending"
    ? [...posts].sort((a, b) => (b.likeCount ?? 0) - (a.likeCount ?? 0))
    : posts;

  return (
    <Layout>
      <div className="max-w-xl mx-auto px-4 pt-5 pb-24 md:pb-8">
        {/* Stories */}
        <section className="mb-5">
          <StoriesBar />
        </section>

        {/* Trending hashtags */}
        <div className="flex gap-2 overflow-x-auto pb-3 mb-4 no-scrollbar">
          {TRENDING_TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => { navigate(`/hashtag/${encodeURIComponent(tag.slice(1))}`); playClick(); }}
              className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-muted/70 text-xs font-bold text-muted-foreground border border-border/30 hover:bg-primary/10 hover:text-primary hover:border-primary/30 hover:scale-105 active:scale-95 transition-all duration-150"
            >
              <Hash className="w-3 h-3 opacity-70" />
              {tag.slice(1)}
            </button>
          ))}
        </div>

        {/* Feed Tabs */}
        <div className="flex gap-1 bg-muted/50 rounded-2xl p-1 mb-5 sticky top-2 z-10 backdrop-blur-xl border border-border/30 shadow-sm">
          {FEED_TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => { setActiveTab(id); playClick(); }}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all duration-200",
                activeTab === id
                  ? "btn-primary text-primary-foreground shadow-md"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
            >
              <Icon className="w-3.5 h-3.5" strokeWidth={activeTab === id ? 2.5 : 2} />
              {label}
            </button>
          ))}
        </div>

        {/* Feed Content */}
        <section className="space-y-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="relative">
                <div className="w-14 h-14 rounded-3xl btn-primary flex items-center justify-center">
                  <Sparkles className="w-7 h-7 text-white animate-pulse" />
                </div>
                <div className="absolute inset-0 rounded-3xl glow-primary animate-pulse" />
              </div>
              <p className="text-sm text-muted-foreground font-semibold">Loading your feed…</p>
            </div>
          ) : !displayPosts || displayPosts.length === 0 ? (
            <div className="text-center py-20 rizz-card">
              <div className="text-7xl mb-5 float inline-block">
                {activeTab === "foryou" ? "✨" : activeTab === "following" ? "👥" : "🔥"}
              </div>
              <p className="font-black text-foreground text-xl mb-2">
                {activeTab === "foryou" ? "Your feed is empty" : activeTab === "following" ? "Nothing from your circle" : "Nothing trending yet"}
              </p>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
                {activeTab === "foryou"
                  ? "Follow people or create a post to get started"
                  : activeTab === "following"
                  ? "Follow some accounts to see their posts here"
                  : "Check back later for trending posts"}
              </p>
            </div>
          ) : (
            displayPosts.map((post, i) => (
              <div key={post.id}>
                <PostCard
                  post={post}
                  onTagClick={(tag) => navigate(`/hashtag/${encodeURIComponent(tag)}`)}
                />
                {i === 2 && <WhoToFollow />}
              </div>
            ))
          )}
        </section>
      </div>
    </Layout>
  );
}
