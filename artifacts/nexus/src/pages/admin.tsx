import { Layout } from "@/components/Layout";
import { useState, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, Shield, Plus, Trash2, Award, Users, BarChart3, Server, Edit2, Check, X, Upload, Crown, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface AdminStats { users: number; posts: number; servers: number; badges: number; }
interface AdminUser { id: string; email: string | null; firstName: string | null; lastName: string | null; profileImageUrl: string | null; username?: string; displayName?: string; avatarUrl?: string; isVerified?: boolean; createdAt: string; }
interface Badge { id: number; name: string; description: string; icon: string; rarity: string; color: string; }

const RARITIES = ["common", "uncommon", "rare", "epic", "legendary", "exclusive"] as const;
const RARITY_COLORS: Record<string, string> = {
  exclusive: "from-amber-400 via-yellow-300 to-amber-500",
  legendary: "from-yellow-500 via-red-500 to-purple-600",
  epic: "from-purple-600 to-blue-500",
  rare: "from-blue-500 to-cyan-400",
  uncommon: "from-emerald-500 to-green-400",
  common: "from-slate-500 to-slate-400",
};

function StatCard({ icon: Icon, label, value, color }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; color: string }) {
  return (
    <div className="glass-card rounded-2xl p-4 flex items-center gap-3">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", color)}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-2xl font-black text-foreground">{value.toLocaleString()}</p>
        <p className="text-xs text-muted-foreground font-semibold">{label}</p>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"overview" | "badges" | "users">("overview");
  const [editingBadge, setEditingBadge] = useState<Badge | null>(null);
  const [newBadge, setNewBadge] = useState({ name: "", description: "", icon: "🏅", rarity: "common", color: "#7c3aed" });
  const [showCreate, setShowCreate] = useState(false);
  const [assignTo, setAssignTo] = useState<{ badgeId: number; userId: string }>({ badgeId: 0, userId: "" });
  const [showAssign, setShowAssign] = useState(false);

  const { data: isAdmin, isLoading: checkingAdmin } = useQuery({
    queryKey: ["/api/admin/check"],
    queryFn: () => fetch("/api/admin/check", { credentials: "include" }).then(r => r.json()) as Promise<{ isAdmin: boolean }>,
  });

  const { data: stats } = useQuery({
    queryKey: ["/api/admin/stats"],
    queryFn: () => fetch("/api/admin/stats", { credentials: "include" }).then(r => r.json()) as Promise<AdminStats>,
    enabled: isAdmin?.isAdmin,
  });

  const { data: badgesData } = useQuery({
    queryKey: ["/api/admin/badges"],
    queryFn: () => fetch("/api/admin/badges", { credentials: "include" }).then(r => r.json()) as Promise<{ badges: Badge[] }>,
    enabled: isAdmin?.isAdmin,
  });
  const badges = badgesData?.badges;

  const { data: usersData } = useQuery({
    queryKey: ["/api/admin/users"],
    queryFn: () => fetch("/api/admin/users", { credentials: "include" }).then(r => r.json()) as Promise<{ users: AdminUser[] }>,
    enabled: isAdmin?.isAdmin && tab === "users",
  });
  const users = usersData?.users;

  const createBadge = useMutation({
    mutationFn: (data: typeof newBadge) => fetch("/api/admin/badges", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/badges"] }); setShowCreate(false); setNewBadge({ name: "", description: "", icon: "🏅", rarity: "common", color: "#7c3aed" }); },
  });

  const deleteBadge = useMutation({
    mutationFn: (id: number) => fetch(`/api/admin/badges/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/admin/badges"] }),
  });

  const assignBadge = useMutation({
    mutationFn: ({ badgeId, userId }: { badgeId: number; userId: string }) =>
      fetch(`/api/admin/badges/${badgeId}/award`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) }).then(r => r.json()),
    onSuccess: () => { setShowAssign(false); setAssignTo({ badgeId: 0, userId: "" }); },
  });

  if (checkingAdmin) {
    return (
      <Layout>
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      </Layout>
    );
  }

  if (!isAdmin?.isAdmin) {
    return (
      <Layout>
        <div className="max-w-md mx-auto px-4 py-20 text-center">
          <Shield className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-black text-foreground mb-2">Access Denied</h1>
          <p className="text-muted-foreground text-sm">You need admin permissions to view this panel.</p>
          <p className="text-muted-foreground text-xs mt-3">Set <code className="bg-muted px-1 py-0.5 rounded">RIZZ_ADMIN_IDS={user?.id}</code> in your environment secrets to grant access.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-6 pb-24 md:pb-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg flex-shrink-0">
            <Crown className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-black text-foreground">Owner Panel</h1>
            <p className="text-sm text-muted-foreground">Manage Rizz like a boss 👑</p>
          </div>
          <a
            href="/api/auth/logout"
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-destructive/10 text-destructive hover:bg-destructive/20 transition-all font-bold text-sm flex-shrink-0 active:scale-95"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </a>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted/50 rounded-2xl p-1 mb-6">
          {([
            { id: "overview", label: "Overview", icon: BarChart3 },
            { id: "badges", label: "Badges", icon: Award },
            { id: "users", label: "Users", icon: Users },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all",
                tab === id ? "btn-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        {/* Overview */}
        {tab === "overview" && stats && (
          <div className="grid grid-cols-2 gap-3">
            <StatCard icon={Users} label="Total Users" value={stats.users} color="bg-blue-500" />
            <StatCard icon={BarChart3} label="Total Posts" value={stats.posts} color="bg-green-500" />
            <StatCard icon={Server} label="Servers" value={stats.servers} color="bg-purple-500" />
            <StatCard icon={Award} label="Badges" value={stats.badges} color="bg-amber-500" />
          </div>
        )}

        {/* Badges management */}
        {tab === "badges" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-foreground">Badge Library</h2>
              <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-2 px-4 py-2 btn-primary text-primary-foreground rounded-2xl text-sm font-bold">
                <Plus className="w-4 h-4" /> Create Badge
              </button>
            </div>

            {/* Create form */}
            {showCreate && (
              <div className="glass-card rounded-2xl p-5 fade-in">
                <h3 className="font-black text-foreground mb-4">New Badge</h3>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="text-xs font-bold text-muted-foreground mb-1 block">Icon (emoji)</label>
                    <input value={newBadge.icon} onChange={e => setNewBadge(b => ({ ...b, icon: e.target.value }))}
                      className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-2xl focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground mb-1 block">Rarity</label>
                    <select value={newBadge.rarity} onChange={e => setNewBadge(b => ({ ...b, rarity: e.target.value }))}
                      className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-sm focus:outline-none capitalize">
                      {RARITIES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>
                <div className="mb-3">
                  <label className="text-xs font-bold text-muted-foreground mb-1 block">Name</label>
                  <input value={newBadge.name} onChange={e => setNewBadge(b => ({ ...b, name: e.target.value }))}
                    placeholder="Badge name..." className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div className="mb-4">
                  <label className="text-xs font-bold text-muted-foreground mb-1 block">Description</label>
                  <input value={newBadge.description} onChange={e => setNewBadge(b => ({ ...b, description: e.target.value }))}
                    placeholder="What does this badge mean?" className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => createBadge.mutate(newBadge)} disabled={!newBadge.name || createBadge.isPending}
                    className="flex-1 py-2.5 btn-primary text-primary-foreground rounded-xl font-bold text-sm disabled:opacity-50">
                    {createBadge.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Create Badge"}
                  </button>
                  <button onClick={() => setShowCreate(false)} className="px-4 py-2.5 bg-muted text-foreground rounded-xl font-bold text-sm">Cancel</button>
                </div>
              </div>
            )}

            {/* Badge grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {(badges ?? []).map((badge) => (
                <div key={badge.id} className="glass-card rounded-2xl p-4 relative group">
                  {/* Badge icon — image or emoji */}
                  {badge.icon.startsWith("/") || badge.icon.startsWith("http") ? (
                    <img
                      src={badge.icon}
                      alt={badge.name}
                      className="w-12 h-12 rounded-xl object-cover shadow-md mb-3 ring-2 ring-amber-400/40"
                    />
                  ) : (
                    <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-md bg-gradient-to-br mb-3", RARITY_COLORS[badge.rarity] ?? RARITY_COLORS.common)}>
                      {badge.icon}
                    </div>
                  )}
                  <p className="font-black text-sm text-foreground truncate">{badge.name}</p>
                  <p className="text-[10px] text-muted-foreground capitalize mb-1">{badge.rarity}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{badge.description}</p>
                  <div className="flex gap-1">
                    <button
                      onClick={() => { setAssignTo({ badgeId: badge.id, userId: "" }); setShowAssign(true); }}
                      className="flex-1 py-1.5 bg-primary/10 text-primary rounded-xl text-xs font-bold hover:bg-primary/20 transition-colors"
                    >
                      Assign
                    </button>
                    <button
                      onClick={() => { if (confirm("Delete this badge?")) deleteBadge.mutate(badge.id); }}
                      className="p-1.5 bg-destructive/10 text-destructive rounded-xl hover:bg-destructive/20 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Assign modal */}
            {showAssign && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowAssign(false)}>
                <div className="bg-card border border-card-border rounded-3xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
                  <h3 className="font-black text-foreground mb-4">Assign Badge</h3>
                  <input
                    value={assignTo.userId}
                    onChange={e => setAssignTo(a => ({ ...a, userId: e.target.value }))}
                    placeholder="Enter user ID..."
                    className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-primary/30"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button onClick={() => assignBadge.mutate(assignTo)} disabled={!assignTo.userId || assignBadge.isPending}
                      className="flex-1 py-2.5 btn-primary text-primary-foreground rounded-xl font-bold text-sm disabled:opacity-50">
                      {assignBadge.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Assign"}
                    </button>
                    <button onClick={() => setShowAssign(false)} className="px-4 bg-muted text-foreground rounded-xl font-bold text-sm">Cancel</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Users */}
        {tab === "users" && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground mb-3">{users?.length ?? 0} registered users</p>
            {(users ?? []).map((u) => (
              <div key={u.id} className="glass-card rounded-2xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center font-black text-foreground flex-shrink-0 overflow-hidden">
                  {u.avatarUrl ? <img src={u.avatarUrl} alt="" className="w-full h-full object-cover" /> : (u.firstName?.[0] ?? u.id[0]?.toUpperCase())}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-foreground truncate">{u.displayName ?? ([u.firstName, u.lastName].filter(Boolean).join(" ") || "User")}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email ?? u.id}</p>
                </div>
                <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {u.id.startsWith("discord_") ? "Discord" : u.id.startsWith("github_") ? "GitHub" : u.id.startsWith("guest_") ? "Guest" : "Google"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
