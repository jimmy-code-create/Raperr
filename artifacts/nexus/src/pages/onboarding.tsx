import { useState, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { Zap, ArrowRight, Check, Camera, Loader2, Sparkles, Flame, Star, Heart, Music, Gamepad2, Globe, Code2, Palette } from "lucide-react";
import { cn } from "@/lib/utils";

const INTERESTS = [
  { emoji: "🎮", label: "Gaming", icon: Gamepad2 },
  { emoji: "🎵", label: "Music", icon: Music },
  { emoji: "🎨", label: "Art", icon: Palette },
  { emoji: "💻", label: "Tech", icon: Code2 },
  { emoji: "🌍", label: "Travel", icon: Globe },
  { emoji: "🔥", label: "Trending", icon: Flame },
  { emoji: "✨", label: "Vibes", icon: Sparkles },
  { emoji: "⭐", label: "Pop Culture", icon: Star },
  { emoji: "❤️", label: "Relationships", icon: Heart },
];

const AVATAR_PRESETS = ["🦊", "🐱", "🐶", "🐸", "🦋", "🌸", "💎", "👑", "🔥", "✨", "🎭", "🦄"];

function compressImage(dataUrl: string, maxSize = 200): Promise<string> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.8));
    };
    img.src = dataUrl;
  });
}

export default function OnboardingPage({ onComplete }: { onComplete: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [username, setUsername] = useState((user?.firstName ?? "").toLowerCase().replace(/[^a-z0-9]/g, "") + Math.floor(Math.random() * 999));
  const [displayName, setDisplayName] = useState([user?.firstName, user?.lastName].filter(Boolean).join(" ") || "");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(user?.profileImageUrl ?? "");
  const [selectedEmoji, setSelectedEmoji] = useState("");
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const compressed = await compressImage(ev.target?.result as string);
      setAvatarUrl(compressed);
      setSelectedEmoji("");
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleFinish = async () => {
    const bioWithInterests = selectedInterests.length > 0
      ? `${bio}${bio ? "\n" : ""}Interests: ${selectedInterests.join(", ")}`
      : bio;

    setIsPending(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/users/me/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          displayName: displayName || username,
          username: username || undefined,
          bio: bioWithInterests || undefined,
          interests: selectedInterests.length > 0 ? selectedInterests : undefined,
          avatarUrl: (selectedEmoji ? undefined : avatarUrl) || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? "Failed to save profile");
      }

      await qc.invalidateQueries({ queryKey: ["/api/users/me"] });
      onComplete();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Couldn't save your profile. Please try again.");
    } finally {
      setIsPending(false);
    }
  };

  const steps = [
    {
      title: "Welcome to Rizz! 🔥",
      subtitle: "Set up your identity in seconds",
      content: (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-muted-foreground mb-1.5 uppercase tracking-wider">Display Name</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name..."
              className="w-full bg-muted border border-border rounded-2xl px-4 py-3 text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all text-base"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-muted-foreground mb-1.5 uppercase tracking-wider">Username</label>
            <div className="flex items-center gap-1 bg-muted border border-border rounded-2xl px-4 py-3 focus-within:ring-2 focus-within:ring-primary/40 transition-all">
              <span className="text-muted-foreground font-bold">@</span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ""))}
                placeholder="your_username"
                className="flex-1 bg-transparent text-foreground font-semibold focus:outline-none text-base"
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 ml-1">Only letters, numbers, underscores, dots</p>
          </div>
        </div>
      ),
    },
    {
      title: "Pick your look 🎨",
      subtitle: "Choose an avatar — you can always change it later",
      content: (
        <div className="space-y-4">
          {/* Current avatar */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div
                className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary/40 to-primary/10 flex items-center justify-center text-5xl shadow-xl ring-4 ring-background cursor-pointer hover:ring-primary/40 transition-all overflow-hidden"
                onClick={() => avatarRef.current?.click()}
              >
                {uploading ? (
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                ) : avatarUrl && !selectedEmoji ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : selectedEmoji ? (
                  <span>{selectedEmoji}</span>
                ) : (
                  <Camera className="w-8 h-8 text-primary/60" />
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary flex items-center justify-center shadow-md cursor-pointer" onClick={() => avatarRef.current?.click()}>
                <Camera className="w-3.5 h-3.5 text-white" />
              </div>
            </div>
            <button onClick={() => avatarRef.current?.click()} className="text-xs font-bold text-primary hover:underline">
              Upload photo
            </button>
            <input ref={avatarRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
          </div>

          {/* Emoji avatars */}
          <div>
            <p className="text-xs font-bold text-muted-foreground mb-2 text-center uppercase tracking-wider">Or pick an emoji</p>
            <div className="grid grid-cols-6 gap-2">
              {AVATAR_PRESETS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => { setSelectedEmoji(emoji); setAvatarUrl(""); }}
                  className={cn(
                    "w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all hover:scale-110",
                    selectedEmoji === emoji ? "bg-primary/20 ring-2 ring-primary scale-110" : "bg-muted hover:bg-muted/80"
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Tell your story ✍️",
      subtitle: "Let the world know what you're about",
      content: (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-muted-foreground mb-1.5 uppercase tracking-wider">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="What's your vibe? Share a little about yourself... ✨"
              rows={4}
              className="w-full bg-muted border border-border rounded-2xl px-4 py-3 text-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
              autoFocus
            />
            <p className="text-[10px] text-muted-foreground text-right mt-1">{bio.length}/160</p>
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wider">Interests (optional)</p>
            <div className="flex flex-wrap gap-2">
              {INTERESTS.map(({ emoji, label }) => (
                <button
                  key={label}
                  onClick={() => setSelectedInterests(prev =>
                    prev.includes(label) ? prev.filter(i => i !== label) : [...prev, label]
                  )}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all hover:scale-105",
                    selectedInterests.includes(label)
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {emoji} {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "You're all set! 🎉",
      subtitle: "Welcome to the Rizz universe",
      content: (
        <div className="text-center space-y-5">
          <div className="flex justify-center">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-5xl shadow-xl ring-4 ring-primary/20">
              {selectedEmoji || (avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover rounded-3xl" />
              ) : "🔥")}
            </div>
          </div>
          <div>
            <p className="text-2xl font-black text-foreground">{displayName || username}</p>
            <p className="text-muted-foreground text-sm">@{username}</p>
            {bio && <p className="text-foreground text-sm mt-2 italic">"{bio.slice(0, 100)}{bio.length > 100 ? "..." : ""}"</p>}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: "✨", label: "Feed ready" },
              { icon: "🏅", label: "Badges waiting" },
              { icon: "💬", label: "DMs open" },
            ].map(({ icon, label }) => (
              <div key={label} className="bg-muted/60 rounded-2xl py-3 text-center">
                <p className="text-2xl mb-1">{icon}</p>
                <p className="text-[11px] font-bold text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </div>
      ),
    },
  ];

  const currentStep = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 relative overflow-hidden">
      <div className="rizz-bg" aria-hidden>
        <div className="rizz-orb rizz-orb-1" />
        <div className="rizz-orb rizz-orb-2" />
        <div className="rizz-orb rizz-orb-3" />
      </div>

      <div className="w-full max-w-sm relative z-10">
        {/* Progress bar */}
        <div className="flex gap-1.5 mb-8">
          {steps.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 rounded-full flex-1 transition-all duration-500",
                i <= step ? "bg-primary" : "bg-muted"
              )}
            />
          ))}
        </div>

        {/* Logo */}
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-xl btn-primary flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-black rizz-gradient text-lg">Rizz</span>
          <span className="text-muted-foreground text-sm ml-auto">Step {step + 1}/{steps.length}</span>
        </div>

        {/* Content card */}
        <div className="glass-card rounded-3xl p-6 mb-4 fade-in">
          <h2 className="text-xl font-black text-foreground mb-1">{currentStep.title}</h2>
          <p className="text-sm text-muted-foreground mb-5">{currentStep.subtitle}</p>
          {currentStep.content}
        </div>

        {/* Navigation */}
        <div className="flex gap-3">
          {step > 0 && (
            <button
              onClick={() => setStep(s => s - 1)}
              className="flex-1 py-3.5 rounded-2xl bg-muted text-foreground font-bold transition-all hover:bg-muted/80"
            >
              Back
            </button>
          )}
          <button
            onClick={isLast ? handleFinish : () => setStep(s => s + 1)}
            disabled={isPending || (step === 0 && !username.trim())}
            className="flex-1 py-3.5 rounded-2xl btn-primary text-primary-foreground font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-all glow-primary-sm"
          >
            {isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : isLast ? (
              <><Check className="w-5 h-5" /> Let's go!</>
            ) : (
              <>Next <ArrowRight className="w-4 h-4" /></>
            )}
          </button>
        </div>

        {submitError && (
          <div className="mt-3 px-4 py-3 bg-destructive/10 border border-destructive/25 text-destructive text-xs rounded-2xl font-medium text-center fade-in">
            {submitError}
            <button onClick={() => setSubmitError(null)} className="block w-full mt-1 opacity-60 hover:opacity-100 text-[10px]">Dismiss</button>
          </div>
        )}

        {!isLast && (
          <button onClick={handleFinish} className="w-full text-center text-xs text-muted-foreground/60 hover:text-muted-foreground mt-3 py-1 transition-colors">
            Skip setup
          </button>
        )}
      </div>
    </div>
  );
}
