import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Avatar } from "@/components/Avatar";
import { PostCard } from "@/components/PostCard";
import { useGetHomeFeed } from "@workspace/api-client-react";
import { Search, Loader2, Users, FileText, Server, TrendingUp, X, Hash, Sparkles } from "lucide-react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import type { UserProfile, Post } from "@workspace/api-client-react";

const TRENDING_TOPICS = [
  { tag: "rizz", emoji: "⚡", color: "from-purple-500 to-pink-500" },
  { tag: "aesthetic", emoji: "🌸", color: "from-pink-400 to-rose-500" },
  { tag: "vibes", emoji: "✨", color: "from-blue-400 to-cyan-400" },
  { tag: "fyp", emoji: "🔥", color: "from-orange-400 to-red-500" },
  { tag: "drip", emoji: "💧", color: "from-cyan-400 to-blue-500" },
  { tag: "glow", emoji: "🌟", color: "from-yellow-400 to-amber-500" },
  { tag: "based", emoji: "😤", color: "from-green-400 to-emerald-500" },
  { tag: "mood", emoji: "🎭", color: "from-violet-400 to-purple-600" },
];

const TABS = [
  { id: "people",  label: "People",  icon: Users },
  { id: "posts",   label: "Posts",   icon: FileText },
  { id: "servers", label: "Servers", icon: Server },
] as const;

export default function SearchPage() {
  const [query, setQuery]     = useState("");
  const [tab, setTab]         = useState<"people" | "posts" | "servers">("people");
  const [results, setResults] = useState<{ users?: UserProfile[]; posts?: Post[]; servers?: unknown[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const { data: trending }    = useGetHomeFeed();
  const [, navigate]          = useLocation();

  const doSearch = async (q: string) => {
    if (!q.trim()) { setResults(null); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&type=all`, { credentials: "include" });
      const data = await res.json();
      setResults(data);
    } finally {
      setLoading(false);
    }
  };

  const clearSearch = () => { setQuery(""); setResults(null); };

  return (
    <Layout>
      <div className="max-w-xl mx-auto px-4 pt-6 pb-24 md:pb-8">
        {/* Search bar */}
        <div className="relative mb-6">
          <div className="flex items-center gap-3 bg-card border border-card-border rounded-2xl px-4 py-3 shadow-sm focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/12 transition-all">
            <Search className="w-4.5 h-4.5 text-muted-foreground flex-shrink-0" />
            <input
              type="search"
              value={query}
              onChange={(e) => { setQuery(e.target.value); doSearch(e.target.value); }}
              placeholder="Search people, posts, servers…"
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              autoComplete="off"
            />
            {query && (
              <button onClick={clearSearch} className="p-0.5 text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {results ? (
          <>
            {/* Tab bar */}
            <div className="flex gap-1 bg-muted/50 rounded-2xl p-1 mb-5">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all",
                    tab === id
                      ? "btn-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="w-7 h-7 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Searching…</p>
              </div>
            ) : tab === "people" ? (
              <div className="space-y-2">
                {results.users && results.users.length > 0 ? results.users.map((u, i) => (
                  <Link key={u.id} href={`/profile/${u.id}`}>
                    <a
                      className="flex items-center gap-3.5 p-4 rizz-card hover:border-primary/20 transition-all slide-up"
                      style={{ animationDelay: `${i * 40}ms` }}
                    >
                      <Avatar src={u.avatarUrl} name={u.displayName || u.username || "User"} size="md" />
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-sm text-foreground truncate">{u.displayName}</p>
                        <p className="text-xs text-muted-foreground truncate">@{u.username}</p>
                      </div>
                      <div className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full font-semibold flex-shrink-0">
                        View →
                      </div>
                    </a>
                  </Link>
                )) : (
                  <div className="text-center py-16 rizz-card">
                    <p className="text-4xl mb-3">👤</p>
                    <p className="font-bold text-foreground">No people found</p>
                    <p className="text-sm text-muted-foreground mt-1">Try a different search</p>
                  </div>
                )}
              </div>
            ) : tab === "posts" ? (
              <div className="space-y-4">
                {results.posts && results.posts.length > 0
                  ? results.posts.map((p) => <PostCard key={p.id} post={p} />)
                  : (
                    <div className="text-center py-16 rizz-card">
                      <p className="text-4xl mb-3">📝</p>
                      <p className="font-bold text-foreground">No posts found</p>
                      <p className="text-sm text-muted-foreground mt-1">Try a different search</p>
                    </div>
                  )}
              </div>
            ) : (
              <div className="text-center py-16 rizz-card">
                <p className="text-4xl mb-3">🌐</p>
                <p className="font-bold text-foreground">No servers found</p>
                <p className="text-sm text-muted-foreground mt-1">Try a different search</p>
              </div>
            )}
          </>
        ) : (
          /* Discover */
          <div className="space-y-6">
            {/* Trending Topics */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-black text-foreground">Trending Topics</h2>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {TRENDING_TOPICS.map(({ tag, emoji, color }) => (
                  <button
                    key={tag}
                    onClick={() => { setQuery(tag); doSearch(tag); }}
                    className="flex items-center gap-3 p-3.5 rizz-card hover:border-primary/20 hover:shadow-md transition-all group"
                  >
                    <div className={cn("w-9 h-9 rounded-xl bg-gradient-to-br flex items-center justify-center text-lg flex-shrink-0 shadow-sm group-hover:scale-110 transition-transform", color)}>
                      {emoji}
                    </div>
                    <div className="text-left min-w-0">
                      <p className="text-sm font-black text-foreground">#{tag}</p>
                      <p className="text-[10px] text-muted-foreground">Trending</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Trending Posts */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-black text-foreground">Hot Right Now</h2>
              </div>
              <div className="space-y-4">
                {!trending?.posts || trending.posts.length === 0 ? (
                  <div className="text-center py-12 rizz-card">
                    <p className="text-5xl mb-4">🔥</p>
                    <p className="font-black text-foreground text-lg">Nothing trending yet</p>
                    <p className="text-sm text-muted-foreground mt-2">Be the first to post something fire</p>
                  </div>
                ) : (
                  trending.posts.slice(0, 6).map((post) => (
                    <PostCard key={post.id} post={post} />
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
