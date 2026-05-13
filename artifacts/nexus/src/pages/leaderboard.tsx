import { useLocation, Link } from "wouter";
import { Layout } from "@/components/Layout";
import { Avatar } from "@/components/Avatar";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Crown, Zap, Users, Trophy, Loader2, Medal } from "lucide-react";
import { cn, getRizzRank } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

interface LeaderUser {
  rank: number;
  id: string;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  isVerified?: boolean;
  followerCount: number;
  followingCount: number;
  rizzScore: number;
  postCount: number;
  topBadge?: { id: number; name?: string | null; icon?: string | null; rarity?: string | null } | null;
  isOnline?: boolean;
}

const RANK_STYLES = [
  "from-amber-400 via-yellow-300 to-amber-500 text-amber-900",
  "from-slate-300 via-slate-200 to-slate-400 text-slate-800",
  "from-amber-700 via-orange-600 to-amber-800 text-amber-100",
];

const RANK_ICONS = [
  <Crown key="1" className="w-4 h-4" />,
  <Medal key="2" className="w-4 h-4" />,
  <Trophy key="3" className="w-4 h-4" />,
];

export default function LeaderboardPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const { data, isLoading } = useQuery<{ users: LeaderUser[] }>({
    queryKey: ["/api/leaderboard"],
    queryFn: () => fetch("/api/leaderboard", { credentials: "include" }).then((r) => r.json()),
  });

  const users = data?.users ?? [];
  const myRank = users.findIndex((u) => u.id === user?.id) + 1;

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
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm">
                <Crown className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-black text-foreground text-lg leading-tight">Leaderboard</h1>
                <p className="text-xs text-muted-foreground">Top Rizz creators</p>
              </div>
            </div>
            {myRank > 0 && (
              <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 rounded-full border border-primary/20">
                <Zap className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-black text-primary">You #{myRank}</span>
              </div>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="w-14 h-14 rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
              <Crown className="w-7 h-7 text-white animate-pulse" />
            </div>
            <p className="text-sm text-muted-foreground font-semibold">Loading leaderboard…</p>
          </div>
        ) : (
          <div className="px-4 pt-4">
            {/* Top 3 podium */}
            {users.length >= 3 && (
              <div className="flex items-end justify-center gap-3 mb-8 pt-4">
                {/* 2nd */}
                <div className="flex flex-col items-center gap-2">
                  <Link href={`/profile/${users[1]?.id}`}>
                    <a>
                      <Avatar src={users[1]?.avatarUrl} name={users[1]?.displayName || users[1]?.username || "?"} size="lg" online={users[1]?.isOnline} />
                    </a>
                  </Link>
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-300 to-slate-400 flex items-center justify-center text-slate-800 font-black text-sm shadow-md">2</div>
                  <div className="text-center">
                    <p className="text-xs font-black text-foreground truncate max-w-[72px]">{users[1]?.displayName || users[1]?.username}</p>
                    <p className="text-[10px] text-muted-foreground">{users[1]?.followerCount.toLocaleString()} followers</p>
                  </div>
                  <div className="w-20 h-20 bg-gradient-to-t from-slate-200/30 to-transparent rounded-t-xl border-t border-x border-slate-300/40" />
                </div>

                {/* 1st */}
                <div className="flex flex-col items-center gap-2 -mb-4">
                  <div className="relative">
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                      <Crown className="w-6 h-6 text-amber-400 drop-shadow-lg" />
                    </div>
                    <Link href={`/profile/${users[0]?.id}`}>
                      <a>
                        <Avatar src={users[0]?.avatarUrl} name={users[0]?.displayName || users[0]?.username || "?"} size="xl" online={users[0]?.isOnline} />
                      </a>
                    </Link>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-yellow-300 flex items-center justify-center text-amber-900 font-black text-sm shadow-md">1</div>
                  <div className="text-center">
                    <p className="text-xs font-black text-foreground truncate max-w-[80px]">{users[0]?.displayName || users[0]?.username}</p>
                    <p className="text-[10px] text-muted-foreground">{users[0]?.followerCount.toLocaleString()} followers</p>
                  </div>
                  <div className="w-20 h-28 bg-gradient-to-t from-amber-400/20 to-transparent rounded-t-xl border-t border-x border-amber-400/40" />
                </div>

                {/* 3rd */}
                <div className="flex flex-col items-center gap-2">
                  <Link href={`/profile/${users[2]?.id}`}>
                    <a>
                      <Avatar src={users[2]?.avatarUrl} name={users[2]?.displayName || users[2]?.username || "?"} size="lg" online={users[2]?.isOnline} />
                    </a>
                  </Link>
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-700 to-orange-600 flex items-center justify-center text-amber-100 font-black text-sm shadow-md">3</div>
                  <div className="text-center">
                    <p className="text-xs font-black text-foreground truncate max-w-[72px]">{users[2]?.displayName || users[2]?.username}</p>
                    <p className="text-[10px] text-muted-foreground">{users[2]?.followerCount.toLocaleString()} followers</p>
                  </div>
                  <div className="w-20 h-14 bg-gradient-to-t from-amber-700/20 to-transparent rounded-t-xl border-t border-x border-amber-700/40" />
                </div>
              </div>
            )}

            {/* Rest of the list */}
            <div className="space-y-2">
              {users.slice(3).map((u, i) => {
                const rank = i + 4;
                const isMe = u.id === user?.id;
                const rizzRank = getRizzRank(u.rizzScore);
                return (
                  <Link key={u.id} href={`/profile/${u.id}`}>
                    <a className={cn(
                      "flex items-center gap-3 p-3.5 rounded-2xl border transition-all hover:border-primary/30 hover:bg-primary/3 slide-up",
                      isMe ? "bg-primary/8 border-primary/30" : "bg-card border-card-border",
                    )} style={{ animationDelay: `${i * 30}ms` }}>
                      <div className="w-8 text-center">
                        <span className="text-sm font-black text-muted-foreground">#{rank}</span>
                      </div>
                      <Avatar src={u.avatarUrl} name={u.displayName || u.username || "?"} size="md" online={u.isOnline} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-sm text-foreground truncate">
                            {u.displayName || u.username}
                          </span>
                          {u.isVerified && <VerifiedBadge size="sm" />}
                          {isMe && <span className="text-[10px] px-1.5 py-0.5 bg-primary/15 text-primary rounded-full font-bold">You</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-muted-foreground">@{u.username}</span>
                          <span className="text-[10px] font-bold" style={{ color: rizzRank.color }}>{rizzRank.rank}</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="flex items-center gap-1 text-xs font-black text-foreground justify-end">
                          <Users className="w-3 h-3 text-muted-foreground" />
                          {u.followerCount.toLocaleString()}
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground justify-end mt-0.5">
                          <Zap className="w-2.5 h-2.5" />
                          {u.rizzScore.toLocaleString()} pts
                        </div>
                      </div>
                      {u.topBadge && (
                        <div className="text-lg ml-1" title={u.topBadge.name ?? ""}>
                          {u.topBadge.icon?.startsWith("/") || u.topBadge.icon?.startsWith("http")
                            ? <img src={u.topBadge.icon} className="w-6 h-6 rounded-md object-cover" />
                            : u.topBadge.icon}
                        </div>
                      )}
                    </a>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
