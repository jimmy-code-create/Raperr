import { Layout } from "@/components/Layout";
import { Avatar } from "@/components/Avatar";
import { useListNotifications } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { formatRelativeTime, cn } from "@/lib/utils";
import { useState } from "react";
import { useLocation } from "wouter";

type FilterTab = "all" | "likes" | "follows" | "comments" | "dms";

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "likes", label: "Likes" },
  { id: "follows", label: "Follows" },
  { id: "comments", label: "Comments" },
  { id: "dms", label: "DMs" },
];

const TYPE_TO_FILTER: Record<string, FilterTab> = {
  like: "likes",
  comment: "comments",
  follow: "follows",
  mention: "comments",
  message: "dms",
  badge: "all",
  server_invite: "all",
};

const MILESTONE_TYPES = ["milestone_followers", "milestone_trending"];

export default function NotificationsPage() {
  const { data: notifications, isLoading } = useListNotifications();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<FilterTab>("all");
  const [, navigate] = useLocation();

  const markAllRead = () => {
    fetch("/api/notifications/read-all", { method: "POST", credentials: "include" }).then(() =>
      qc.invalidateQueries({ queryKey: ["/api/notifications"] })
    );
  };

  const confirmFollow = async (notifId: number, actorId: string) => {
    await fetch(`/api/users/${actorId}/follow`, { method: "POST", credentials: "include" });
    await fetch(`/api/notifications/${notifId}/read`, { method: "POST", credentials: "include" });
    qc.invalidateQueries({ queryKey: ["/api/notifications"] });
  };

  const deleteNotif = async (notifId: number) => {
    await fetch(`/api/notifications/${notifId}`, { method: "DELETE", credentials: "include" });
    qc.invalidateQueries({ queryKey: ["/api/notifications"] });
  };

  const allNotifs = notifications?.notifications ?? [];
  const unreadCount = allNotifs.filter((n) => !n.isRead).length;

  const filtered = filter === "all"
    ? allNotifs
    : allNotifs.filter((n) => (TYPE_TO_FILTER[n.type ?? ""] ?? "all") === filter);

  return (
    <Layout>
      <div className="max-w-xl mx-auto pb-24 md:pb-8">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-5 pb-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/")} className="md:hidden p-1.5 rounded-xl text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-black text-foreground">Activity</h1>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-sm font-bold text-primary hover:opacity-70 transition-opacity"
            >
              Mark all read
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 px-4 mb-2 no-scrollbar">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={cn(
                "flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-all border",
                filter === tab.id
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-card border-card-border text-foreground hover:bg-muted"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-10 h-10 rounded-2xl btn-primary flex items-center justify-center animate-pulse">
              <span className="text-xl">🔔</span>
            </div>
            <p className="text-sm text-muted-foreground font-semibold">Loading activity…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 px-4">
            <div className="text-6xl mb-4">🔔</div>
            <p className="font-black text-foreground text-xl mb-2">All caught up!</p>
            <p className="text-sm text-muted-foreground">Nothing new here yet</p>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {filtered.map((notif, i) => {
              const isMilestone = MILESTONE_TYPES.includes(notif.type ?? "") || notif.type === "milestone";
              const isFollowReq = notif.type === "follow" && !notif.isRead;

              if (isMilestone) {
                const isFollowers = notif.message?.toLowerCase().includes("follower");
                const isTrending = notif.message?.toLowerCase().includes("trending");
                return (
                  <div
                    key={notif.id}
                    className={cn(
                      "mx-4 my-2 rounded-2xl px-4 py-3.5 flex items-center gap-3 slide-up",
                      isFollowers
                        ? "bg-gradient-to-r from-emerald-600 to-green-500 text-white"
                        : isTrending
                        ? "bg-gradient-to-r from-amber-600 to-orange-500 text-white"
                        : "bg-gradient-to-r from-primary to-primary/70 text-primary-foreground"
                    )}
                    style={{ animationDelay: `${i * 25}ms` }}
                  >
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-xl">{isFollowers ? "🏅" : isTrending ? "📈" : "🏆"}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-sm">{notif.message ?? "Milestone reached!"}</p>
                      <p className="text-xs opacity-75 mt-0.5">{formatRelativeTime(notif.createdAt)}</p>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={notif.id}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 slide-up hover:bg-muted/30 transition-colors cursor-pointer",
                    !notif.isRead && "bg-primary/3"
                  )}
                  style={{ animationDelay: `${i * 25}ms` }}
                  onClick={() => notif.actorId && navigate(`/profile/${notif.actorId}`)}
                >
                  {/* Avatar with type icon badge */}
                  <div className="relative flex-shrink-0">
                    <Avatar
                      src={notif.actor?.avatarUrl ?? undefined}
                      name={notif.actor?.displayName ?? notif.actor?.username ?? "User"}
                      size="md"
                    />
                    <div className={cn(
                      "absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[11px] border-2 border-background",
                      notif.type === "like" ? "bg-red-500" :
                      notif.type === "comment" ? "bg-blue-500" :
                      notif.type === "follow" ? "bg-purple-500" :
                      notif.type === "message" ? "bg-primary" : "bg-amber-500"
                    )}>
                      {notif.type === "like" ? "❤️" :
                       notif.type === "comment" ? "💬" :
                       notif.type === "follow" ? "👤" :
                       notif.type === "message" ? "✉️" : "🔔"}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground leading-snug">
                      {(notif.actor?.displayName ?? notif.actor?.username) && (
                        <span className="font-black">{notif.actor?.displayName ?? notif.actor?.username} </span>
                      )}
                      <span className={!notif.isRead ? "text-foreground" : "text-muted-foreground"}>
                        {notif.message ?? notif.type}
                      </span>
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{formatRelativeTime(notif.createdAt)}</p>

                    {/* Follow request actions */}
                    {isFollowReq && notif.actorId && (
                      <div className="flex gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => confirmFollow(notif.id, notif.actorId!)}
                          className="px-4 py-1.5 bg-primary text-primary-foreground rounded-xl text-xs font-black hover:bg-primary/90 transition-colors"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => deleteNotif(notif.id)}
                          className="px-4 py-1.5 bg-muted text-foreground rounded-xl text-xs font-bold hover:bg-muted/70 transition-colors border border-border"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Post thumbnail or unread dot */}
                  <div className="flex-shrink-0 flex flex-col items-end gap-1">
                    {(notif as typeof notif & { postImage?: string }).postImage ? (
                      <img
                        src={(notif as typeof notif & { postImage?: string }).postImage}
                        alt=""
                        className="w-12 h-12 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10" />
                    )}
                    {!notif.isRead && (
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
