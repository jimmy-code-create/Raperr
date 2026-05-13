import { Layout } from "@/components/Layout";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, Shield, Plus, Trash2, Award, Users, BarChart3, Server, Crown, LogOut, KeyRound, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface AdminStats { users: number; posts: number; servers: number; badges: number; }
interface AdminUser { id: string; email: string | null; username?: string; displayName?: string; avatarUrl?: string | null; isAdmin?: boolean; isBanned?: boolean; isVerified?: boolean; createdAt: string; }
interface Badge { id: number; name: string; description: string; icon: string; rarity: string; color: string; }
interface AdminGroup { id: number; name: string; }
interface AdminServer { id: number; name: string; memberCount: number; ownerId: string; }

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

function AccessDenied() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");

  const claim = useMutation({
    mutationFn: (pw: string) =>
      fetch("/api/admin/claim", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) }).then(r => r.json()),
    onSuccess: (data) => {
      if (data.ok) {
        qc.invalidateQueries({ queryKey: ["/api/admin/check"] });
      } else {
        setError(data.error ?? "Wrong password");
      }
    },
    onError: () => setError("Failed to connect"),
  });

  return (
    <Layout>
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mx-auto mb-6 shadow-xl">
          <Crown className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-2xl font-black text-foreground mb-2">Admin Access</h1>
        <p className="text-muted-foreground text-sm mb-8">Enter the admin password set in your server environment.</p>

        <div className="glass-card rounded-2xl p-5 text-left">
          <label className="text-xs font-bold text-muted-foreground mb-2 block">Admin Password</label>
          <div className="relative mb-3">
            <input
              type={showPass ? "text" : "password"}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter" && password) claim.mutate(password); }}
              placeholder="Enter ADMIN_PASSWORD…"
              className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-primary/30"
              autoFocus
            />
            <button type="button" onClick={() => setShowPass(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {error && <p className="text-destructive text-xs mb-3">{error}</p>}
          <button
            onClick={() => { if (password) claim.mutate(password); }}
            disabled={!password || claim.isPending}
            className="w-full py-2.5 btn-primary text-primary-foreground rounded-xl font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {claim.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
            {claim.isPending ? "Checking…" : "Claim Admin Access"}
          </button>
          <p className="text-[10px] text-muted-foreground mt-3 text-center">
            Set <code className="bg-muted px-1 py-0.5 rounded">ADMIN_PASSWORD=yourpass</code> in Render environment variables.
          </p>
        </div>

        <p className="text-[10px] text-muted-foreground mt-4">Your user ID: <code className="bg-muted px-1 py-0.5 rounded text-[10px]">{user?.id}</code></p>
      </div>
    </Layout>
  );
}

export default function AdminPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"overview" | "badges" | "users" | "content">("overview");
  const [newBadge, setNewBadge] = useState({ name: "", description: "", icon: "🏅", rarity: "common", color: "#7c3aed" });
  const [showCreate, setShowCreate] = useState(false);
  const [assignTo, setAssignTo] = useState<{ badgeId: number; userId: string }>({ badgeId: 0, userId: "" });
  const [showAssign, setShowAssign] = useState(false);

  const { data: adminCheck, isLoading: checkingAdmin } = useQuery({
    queryKey: ["/api/admin/check"],
    queryFn: () => fetch("/api/admin/check", { credentials: "include" }).then(r => r.json()) as Promise<{ isAdmin: boolean }>,
  });

  const { data: stats } = useQuery({
    queryKey: ["/api/admin/stats"],
    queryFn: () => fetch("/api/admin/stats", { credentials: "include" }).then(r => r.json()) as Promise<AdminStats>,
    enabled: adminCheck?.isAdmin,
  });

  const { data: badgesData } = useQuery({
    queryKey: ["/api/admin/badges"],
    queryFn: () => fetch("/api/admin/badges", { credentials: "include" }).then(r => r.json()) as Promise<{ badges: Badge[] }>,
    enabled: adminCheck?.isAdmin,
  });

  const { data: usersData } = useQuery({
    queryKey: ["/api/admin/users"],
    queryFn: () => fetch("/api/admin/users", { credentials: "include" }).then(r => r.json()) as Promise<{ users: AdminUser[] }>,
    enabled: adminCheck?.isAdmin && tab === "users",
  });

  const { data: groupsData } = useQuery({
    queryKey: ["/api/admin/groups"],
    queryFn: () => fetch("/api/admin/groups", { credentials: "include" }).then(r => r.json()) as Promise<{ groups: AdminGroup[] }>,
    enabled: adminCheck?.isAdmin && tab === "content",
  });

  const { data: serversData } = useQuery({
    queryKey: ["/api/admin/servers"],
    queryFn: () => fetch("/api/admin/servers", { credentials: "include" }).then(r => r.json()) as Promise<{ servers: AdminServer[] }>,
    enabled: adminCheck?.isAdmin && tab === "content",
  });

  const badges = badgesData?.badges ?? [];
  const users = usersData?.users ?? [];
  const groups = groupsData?.groups ?? [];
  const servers = serversData?.servers ?? [];

  const createBadge = useMutation({
    mutationFn: (data: typeof newBadge) => fetch("/api/admin/badges", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/badges"] }); qc.invalidateQueries({ queryKey: ["/api/admin/stats"] }); setShowCreate(false); setNewBadge({ name: "", description: "", icon: "🏅", rarity: "common", color: "#7c3aed" }); },
  });

  const deleteBadge = useMutation({
    mutationFn: (id: number) => fetch(`/api/admin/badges/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/badges"] }); qc.invalidateQueries({ queryKey: ["/api/admin/stats"] }); },
  });

  const assignBadge = useMutation({
    mutationFn: ({ badgeId, userId }: { badgeId: number; userId: string }) =>
      fetch(`/api/admin/badges/${badgeId}/award`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) }).then(r => r.json()),
    onSuccess: () => { setShowAssign(false); setAssignTo({ badgeId: 0, userId: "" }); },
  });

  const banUser = useMutation({
    mutationFn: ({ id, ban }: { id: string; ban: boolean }) => fetch(`/api/admin/users/${id}/${ban ? "ban" : "unban"}`, { method: "POST", credentials: "include" }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/admin/users"] }),
  });

  const verifyUser = useMutation({
    mutationFn: (id: string) => fetch(`/api/admin/users/${id}/verify`, { method: "POST", credentials: "include" }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/admin/users"] }),
  });

  const makeAdmin = useMutation({
    mutationFn: (id: string) => fetch(`/api/admin/users/${id}/make-admin`, { method: "POST", credentials: "include" }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/admin/users"] }),
  });

  const deleteGroup = useMutation({
    mutationFn: (id: number) => fetch(`/api/admin/groups/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/admin/groups"] }),
  });

  const deleteServer = useMutation({
    mutationFn: (id: number) => fetch(`/api/admin/servers/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/servers"] }); qc.invalidateQueries({ queryKey: ["/api/admin/stats"] }); },
  });

  if (checkingAdmin) {
    return (
      <Layout>
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      </Layout>
    );
  }

  if (!adminCheck?.isAdmin) return <AccessDenied />;

  const TABS = [
    { id: "overview" as const, label: "Overview", icon: BarChart3 },
    { id: "badges" as const, label: "Badges", icon: Award },
    { id: "users" as const, label: "Users", icon: Users },
    { id: "content" as const, label: "Content", icon: Server },
  ];

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
            <p className="text-sm text-muted-foreground">Manage Raperr like a boss 👑</p>
          </div>
          <a href="/api/auth/logout" className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-destructive/10 text-destructive hover:bg-destructive/20 transition-all font-bold text-sm flex-shrink-0 active:scale-95">
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </a>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted/50 rounded-2xl p-1 mb-6 overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={cn("flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap px-2",
                tab === id ? "btn-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted")}>
              <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" /> {label}
            </button>
          ))}
        </div>

        {/* Overview */}
        {tab === "overview" && (
          <div className="grid grid-cols-2 gap-3">
            <StatCard icon={Users} label="Total Users" value={stats?.users ?? 0} color="bg-blue-500" />
            <StatCard icon={BarChart3} label="Total Posts" value={stats?.posts ?? 0} color="bg-green-500" />
            <StatCard icon={Server} label="Servers" value={stats?.servers ?? 0} color="bg-purple-500" />
            <StatCard icon={Award} label="Badges" value={stats?.badges ?? 0} color="bg-amber-500" />
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

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {badges.map((badge) => (
                <div key={badge.id} className="glass-card rounded-2xl p-4 relative group">
                  {badge.icon.startsWith("/") || badge.icon.startsWith("http") ? (
                    <img src={badge.icon} alt={badge.name} className="w-12 h-12 rounded-xl object-cover shadow-md mb-3 ring-2 ring-amber-400/40" />
                  ) : (
                    <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-md bg-gradient-to-br mb-3", RARITY_COLORS[badge.rarity] ?? RARITY_COLORS.common)}>
                      {badge.icon}
                    </div>
                  )}
                  <p className="font-black text-sm text-foreground truncate">{badge.name}</p>
                  <p className="text-[10px] text-muted-foreground capitalize mb-1">{badge.rarity}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{badge.description}</p>
                  <div className="flex gap-1">
                    <button onClick={() => { setAssignTo({ badgeId: badge.id, userId: "" }); setShowAssign(true); }}
                      className="flex-1 py-1.5 bg-primary/10 text-primary rounded-xl text-xs font-bold hover:bg-primary/20 transition-colors">
                      Assign
                    </button>
                    <button onClick={() => { if (confirm("Delete this badge?")) deleteBadge.mutate(badge.id); }}
                      className="p-1.5 bg-destructive/10 text-destructive rounded-xl hover:bg-destructive/20 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {badges.length === 0 && (
                <div className="col-span-full text-center py-10 text-muted-foreground text-sm">No badges yet. Create one!</div>
              )}
            </div>

            {showAssign && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowAssign(false)}>
                <div className="bg-card border border-card-border rounded-3xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
                  <h3 className="font-black text-foreground mb-1">Assign Badge</h3>
                  <p className="text-xs text-muted-foreground mb-4">Enter the username or user ID to award this badge to.</p>
                  <input value={assignTo.userId} onChange={e => setAssignTo(a => ({ ...a, userId: e.target.value }))}
                    placeholder="User ID or username…"
                    className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-primary/30" autoFocus />
                  {assignBadge.isError && <p className="text-destructive text-xs mb-2">Failed to assign badge</p>}
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
            <p className="text-sm text-muted-foreground mb-3">{users.length} registered users</p>
            {users.map((u) => (
              <div key={u.id} className="glass-card rounded-2xl p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center font-black text-foreground flex-shrink-0 overflow-hidden">
                  {u.avatarUrl ? <img src={u.avatarUrl} alt="" className="w-full h-full object-cover" /> : (u.displayName?.[0] ?? u.username?.[0] ?? u.id[0]?.toUpperCase())}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-bold text-sm text-foreground truncate">{u.displayName ?? u.username ?? "User"}</p>
                    {u.isAdmin && <span className="text-[9px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded-full">Admin</span>}
                    {u.isBanned && <span className="text-[9px] font-bold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded-full">Banned</span>}
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate">{u.email ?? u.id}</p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {!u.isVerified && (
                    <button onClick={() => verifyUser.mutate(u.id)} title="Verify"
                      className="text-[10px] font-bold px-2 py-1 bg-blue-500/10 text-blue-500 rounded-lg hover:bg-blue-500/20 transition-colors">
                      Verify
                    </button>
                  )}
                  {!u.isAdmin && (
                    <button onClick={() => { if (confirm(`Make ${u.displayName ?? u.username} an admin?`)) makeAdmin.mutate(u.id); }} title="Make Admin"
                      className="text-[10px] font-bold px-2 py-1 bg-amber-500/10 text-amber-500 rounded-lg hover:bg-amber-500/20 transition-colors">
                      Admin
                    </button>
                  )}
                  <button onClick={() => banUser.mutate({ id: u.id, ban: !u.isBanned })}
                    className={cn("text-[10px] font-bold px-2 py-1 rounded-lg transition-colors", u.isBanned ? "bg-green-500/10 text-green-500 hover:bg-green-500/20" : "bg-destructive/10 text-destructive hover:bg-destructive/20")}>
                    {u.isBanned ? "Unban" : "Ban"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Content — delete groups and servers */}
        {tab === "content" && (
          <div className="space-y-6">
            {/* Groups */}
            <div>
              <h2 className="text-base font-black text-foreground mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" /> Group Chats ({groups.length})
              </h2>
              {groups.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No groups found</p>
              ) : (
                <div className="space-y-2">
                  {groups.map((g) => (
                    <div key={g.id} className="glass-card rounded-2xl p-3 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center text-white font-black text-sm flex-shrink-0">
                        {g.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-foreground truncate">{g.name}</p>
                        <p className="text-[10px] text-muted-foreground">ID: {g.id}</p>
                      </div>
                      <button onClick={() => { if (confirm(`Delete group "${g.name}"? This cannot be undone.`)) deleteGroup.mutate(g.id); }}
                        className="p-2 bg-destructive/10 text-destructive rounded-xl hover:bg-destructive/20 transition-colors flex-shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Servers */}
            <div>
              <h2 className="text-base font-black text-foreground mb-3 flex items-center gap-2">
                <Server className="w-4 h-4 text-purple-500" /> Servers ({servers.length})
              </h2>
              {servers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No servers found</p>
              ) : (
                <div className="space-y-2">
                  {servers.map((s) => (
                    <div key={s.id} className="glass-card rounded-2xl p-3 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-black text-sm flex-shrink-0">
                        {s.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-foreground truncate">{s.name}</p>
                        <p className="text-[10px] text-muted-foreground">{s.memberCount} members · ID: {s.id}</p>
                      </div>
                      <button onClick={() => { if (confirm(`Delete server "${s.name}"? All channels and messages will be lost.`)) deleteServer.mutate(s.id); }}
                        className="p-2 bg-destructive/10 text-destructive rounded-xl hover:bg-destructive/20 transition-colors flex-shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
