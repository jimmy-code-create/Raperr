import { useState } from "react";
import { Loader2, Zap, Image, MessageCircle, Server, Award, Sparkles, Music, Users, Eye, EyeOff, UserPlus, LogIn } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

const FEATURES = [
  { icon: Image, label: "Posts & Stories", desc: "Share moments" },
  { icon: MessageCircle, label: "Instant DMs", desc: "Chat in real-time" },
  { icon: Server, label: "Servers", desc: "Build communities" },
  { icon: Award, label: "Badges", desc: "Flex your status" },
  { icon: Music, label: "Music Player", desc: "Built-in vibes" },
  { icon: Users, label: "Voice Channels", desc: "Hang together" },
];

type Mode = "login" | "register";

export default function LoginPage() {
  const qc = useQueryClient();
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body = mode === "login"
        ? { username: username.trim(), password }
        : { username: username.trim(), email: email.trim(), password, displayName: displayName.trim() || undefined };
      const res = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) {
        setError(data.error ?? (mode === "login" ? "Invalid credentials" : "Registration failed"));
        return;
      }
      qc.invalidateQueries({ queryKey: ["/api/users/me"] });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = async () => {
    setError(null);
    setGuestLoading(true);
    try {
      const stored = localStorage.getItem("rizz_guest_id");
      const res = await fetch("/api/auth/guest", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(stored ? { guestId: stored } : {}),
      });
      if (!res.ok) throw new Error("Guest login failed");
      const data = await res.json() as { guestId?: string };
      if (data.guestId) localStorage.setItem("rizz_guest_id", data.guestId);
      qc.invalidateQueries({ queryKey: ["/api/users/me"] });
    } catch {
      setError("Could not start a guest session. Please try again.");
    } finally {
      setGuestLoading(false);
    }
  };

  const anyLoading = loading || guestLoading;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 relative overflow-hidden">
      <div className="rizz-bg" aria-hidden>
        <div className="rizz-orb rizz-orb-1" />
        <div className="rizz-orb rizz-orb-2" />
        <div className="rizz-orb rizz-orb-3" />
      </div>

      <div className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{ backgroundImage: "linear-gradient(hsl(var(--foreground)) 1px,transparent 1px),linear-gradient(90deg,hsl(var(--foreground)) 1px,transparent 1px)", backgroundSize: "60px 60px" }} />

      <div className="w-full max-w-sm relative z-10 py-8">
        <div className="text-center mb-6">
          <div className="relative inline-block mb-4">
            <div className="w-20 h-20 rounded-3xl btn-primary flex items-center justify-center shadow-2xl glow-primary float mx-auto">
              <Zap className="w-10 h-10 text-white drop-shadow-md" strokeWidth={2.5} />
            </div>
            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-lg">
              <Sparkles className="w-2.5 h-2.5 text-white" />
            </div>
          </div>
          <h1 className="text-5xl font-black rizz-gradient mb-1 tracking-tight">Rizz</h1>
          <p className="text-muted-foreground text-sm font-medium">Your vibe, amplified ✨</p>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-5">
          {FEATURES.map(({ icon: Icon, label, desc }) => (
            <div key={label}
              className="glass-card rounded-2xl px-2 py-2.5 flex flex-col items-center gap-1 hover:scale-[1.04] transition-all cursor-default group"
            >
              <div className="w-8 h-8 rounded-xl bg-primary/12 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Icon className="w-4 h-4 text-primary" />
              </div>
              <p className="text-[9px] font-black text-foreground leading-tight text-center">{label}</p>
              <p className="text-[8px] text-muted-foreground text-center">{desc}</p>
            </div>
          ))}
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 bg-muted rounded-2xl p-1 mb-4">
          {(["login", "register"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(null); }}
              className={cn(
                "flex-1 py-2 rounded-xl text-sm font-bold capitalize transition-all flex items-center justify-center gap-1.5",
                mode === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {m === "login" ? <LogIn className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
              {m === "login" ? "Sign In" : "Sign Up"}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-3 px-4 py-3 bg-destructive/10 border border-destructive/25 text-destructive text-xs rounded-2xl font-medium text-center">
            {error}
            <button onClick={() => setError(null)} className="block w-full mt-1 opacity-60 hover:opacity-100 text-[10px]">Dismiss</button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-2.5">
          {mode === "register" && (
            <input
              type="text"
              placeholder="Display name (optional)"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              className="w-full bg-card border border-card-border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground"
              disabled={anyLoading}
            />
          )}
          <input
            type="text"
            placeholder={mode === "login" ? "Username or email" : "Username"}
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
            autoComplete="username"
            className="w-full bg-card border border-card-border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground"
            disabled={anyLoading}
          />
          {mode === "register" && (
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full bg-card border border-card-border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground"
              disabled={anyLoading}
            />
          )}
          <div className="relative">
            <input
              type={showPass ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              className="w-full bg-card border border-card-border rounded-2xl px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground"
              disabled={anyLoading}
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <button
            type="submit"
            disabled={anyLoading}
            className={cn(
              "w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 font-bold text-sm transition-all btn-primary shadow-md",
              "hover:shadow-lg hover:opacity-90 active:scale-[0.97]",
              "disabled:opacity-55"
            )}
          >
            {loading
              ? <Loader2 className="w-5 h-5 animate-spin" />
              : mode === "login" ? <><LogIn className="w-4 h-4" /> Sign In</> : <><UserPlus className="w-4 h-4" /> Create Account</>}
          </button>
        </form>

        <div className="flex items-center gap-3 my-3">
          <div className="flex-1 divider-gradient" />
          <span className="text-[10px] text-muted-foreground font-bold tracking-wider uppercase">or</span>
          <div className="flex-1 divider-gradient" />
        </div>

        <button
          onClick={handleGuest}
          disabled={anyLoading}
          className={cn(
            "w-full flex items-center justify-center gap-2.5 rounded-2xl py-3 font-bold text-sm transition-all",
            "border-2 border-dashed border-border/70 text-muted-foreground",
            "hover:border-primary/45 hover:text-primary hover:bg-primary/5 active:scale-[0.97]",
            "disabled:opacity-55"
          )}
        >
          {guestLoading
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <>Try as Guest <span className="text-[10px] font-normal opacity-55 ml-1">(no account needed)</span></>}
        </button>

        <p className="text-center text-[10px] text-muted-foreground/45 mt-4">
          By signing in, you agree to our Terms of Service.
        </p>
      </div>
    </div>
  );
}
