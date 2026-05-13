import { useParams, useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/hooks/use-auth";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Users, UserCheck, ArrowLeft, Loader2, UserPlus, UserMinus, MessageCircle } from "lucide-react";
import { Link } from "wouter";
import { useStartConversation } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

interface UserSummary {
  id: string;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  isVerified?: boolean;
  isFollowedByMe?: boolean;
}

type Tab = "following" | "followers" | "friends";

async function fetchList(userId: string, kind: Tab): Promise<UserSummary[]> {
  const url = kind === "friends" ? `/api/users/${userId}/friends` : `/api/users/${userId}/${kind}`;
  const r = await fetch(url, { credentials: "include" });
  if (!r.ok) return [];
  const data = await r.json() as { users?: UserSummary[] };
  return data.users ?? [];
}

export default function FollowingPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user: authUser } = useAuth();
  const profileId = id ?? authUser?.id ?? "";

  const [activeTab, setActiveTab] = useState<Tab>("following");
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [followPending, setFollowPending] = useState<string | null>(null);

  const qc = useQueryClient();
  const { mutate: startConvo } = useStartConversation({
    mutation: {
      onSuccess: (conv) => {
        qc.invalidateQueries({ queryKey: ["/api/dm/conversations"] });
        navigate("/dms");
        qc.setQueryData(["/api/dm/active"], conv);
      },
    },
  });

  useEffect(() => {
    if (!profileId) return;
    setLoading(true);
    fetchList(profileId, activeTab).then((u) => {
      setUsers(u);
      setLoading(false);
    });
  }, [profileId, activeTab]);

  const handleFollowToggle = async (u: UserSummary) => {
    setFollowPending(u.id);
    const endpoint = u.isFollowedByMe ? "unfollow" : "follow";
    await fetch(`/api/users/${u.id}/${endpoint}`, { method: "POST", credentials: "include" });
    setUsers((prev) => prev.map((p) => p.id === u.id ? { ...p, isFollowedByMe: !u.isFollowedByMe } : p));
    setFollowPending(null);
  };

  const isOwnProfile = !id || id === authUser?.id;

  const TABS: { id: Tab; label: string; icon: typeof Users }[] = [
    { id: "following", label: "Following", icon: UserPlus },
    { id: "followers", label: "Followers", icon: Users },
    { id: "friends", label: "Friends", icon: UserCheck },
  ];

  return (
    <Layout>
      <div className="max-w-xl mx-auto px-4 pt-4 pb-24 md:pb-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => navigate(isOwnProfile ? "/profile/me" : `/profile/${profileId}`)}
            className="p-2 rounded-xl hover:bg-muted text-muted-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-black text-foreground">Connections</h1>
            <p className="text-xs text-muted-foreground">{isOwnProfile ? "Your network" : "Their network"}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted/50 rounded-2xl p-1 mb-5 border border-border/30 shadow-sm">
          {TABS.map(({ id: tabId, label, icon: Icon }) => (
            <button
              key={tabId}
              onClick={() => setActiveTab(tabId)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-black transition-all duration-200",
                activeTab === tabId
                  ? "btn-primary text-primary-foreground shadow-md"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
            >
              <Icon className="w-3.5 h-3.5" strokeWidth={activeTab === tabId ? 2.5 : 2} />
              {label}
            </button>
          ))}
        </div>

        {/* Friends note */}
        {activeTab === "friends" && (
          <div className="mb-4 px-4 py-3 bg-primary/5 border border-primary/20 rounded-2xl">
            <p className="text-xs text-primary font-semibold flex items-center gap-2">
              <UserCheck className="w-4 h-4 flex-shrink-0" />
              Friends are people who follow each other mutually.
            </p>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-primary" />
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-5xl mb-4">
              {activeTab === "friends" ? "🤝" : activeTab === "following" ? "👤" : "👥"}
            </div>
            <p className="font-black text-foreground text-lg mb-1">
              {activeTab === "friends" ? "No friends yet" : activeTab === "following" ? "Not following anyone" : "No followers yet"}
            </p>
            <p className="text-sm text-muted-foreground">
              {activeTab === "friends"
                ? "Follow someone and they follow you back to become friends"
                : activeTab === "following"
                ? "Go explore and follow some people!"
                : "Share your profile to get followers"}
            </p>
            {activeTab !== "friends" && (
              <Link href="/search">
                <a className="mt-5 px-5 py-2.5 btn-primary text-primary-foreground rounded-2xl text-sm font-bold">
                  Find people
                </a>
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {users.map((u) => (
              <div key={u.id} className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-card-border shadow-sm hover:shadow-md transition-shadow">
                <Link href={`/profile/${u.id}`}>
                  <a className="flex items-center gap-3 flex-1 min-w-0">
                    <Avatar src={u.avatarUrl} name={u.displayName || u.username} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-bold text-sm text-foreground truncate">
                          {u.displayName || u.username}
                        </p>
                        {u.isVerified && (
                          <span className="text-blue-500 text-xs flex-shrink-0">✓</span>
                        )}
                        {activeTab === "friends" && (
                          <span className="text-[10px] bg-green-500/10 text-green-600 border border-green-500/20 px-1.5 py-0.5 rounded-full font-bold flex-shrink-0">
                            Friends
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">@{u.username}</p>
                    </div>
                  </a>
                </Link>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* DM button */}
                  {u.id !== authUser?.id && (
                    <button
                      onClick={() => startConvo({ data: { userId: u.id } })}
                      className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                      title="Send message"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </button>
                  )}
                  {/* Follow / Unfollow */}
                  {u.id !== authUser?.id && (
                    <button
                      onClick={() => handleFollowToggle(u)}
                      disabled={followPending === u.id}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50",
                        u.isFollowedByMe
                          ? "bg-muted text-foreground hover:bg-destructive/10 hover:text-destructive"
                          : "btn-primary text-primary-foreground"
                      )}
                    >
                      {followPending === u.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : u.isFollowedByMe ? (
                        <><UserMinus className="w-3.5 h-3.5" /> Unfollow</>
                      ) : (
                        <><UserPlus className="w-3.5 h-3.5" /> Follow</>
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
