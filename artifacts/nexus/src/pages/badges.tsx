import { Layout } from "@/components/Layout";
import { useGetBadges } from "@workspace/api-client-react";
import { Award, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import type { Badge } from "@workspace/api-client-react";

const rarityOrder = ["exclusive", "legendary", "epic", "rare", "uncommon", "common"];

const rarityLabel: Record<string, string> = {
  exclusive: "Exclusive",
  legendary: "Legendary",
  epic: "Epic",
  rare: "Rare",
  uncommon: "Uncommon",
  common: "Common",
};

const rarityGradient: Record<string, string> = {
  exclusive: "from-amber-400 via-yellow-300 to-amber-500",
  legendary: "from-yellow-500 via-red-500 to-purple-600",
  epic: "from-purple-600 to-blue-500",
  rare: "from-blue-500 to-cyan-400",
  uncommon: "from-emerald-500 to-green-400",
  common: "from-slate-400 to-slate-500",
};

const rarityCardBg: Record<string, string> = {
  exclusive: "bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700/60",
  legendary: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/50",
  epic: "bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800/50",
  rare: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/50",
  uncommon: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50",
  common: "bg-slate-50 dark:bg-slate-950/30 border-slate-200 dark:border-slate-700/50",
};

type Filter = "all" | "exclusive" | "legendary" | "epic" | "rare" | "uncommon" | "common";

function isImageUrl(icon: string) {
  return icon.startsWith("/") || icon.startsWith("http");
}

function BadgeIcon({ icon, name, size = "md", animate = false }: { icon: string; name: string; size?: "sm" | "md" | "lg"; animate?: boolean }) {
  const dim = size === "lg" ? "w-20 h-20" : size === "md" ? "w-16 h-16" : "w-10 h-10";
  const textSize = size === "lg" ? "text-4xl" : size === "md" ? "text-3xl" : "text-xl";

  if (isImageUrl(icon)) {
    return (
      <img
        src={icon}
        alt={name}
        className={cn(dim, "object-cover rounded-2xl shadow-lg group-hover:scale-110 transition-transform duration-200", animate && "badge-icon-float badge-icon-glow")}
        style={{ imageRendering: "auto" }}
      />
    );
  }
  return (
    <div className={cn(dim, "flex items-center justify-center rounded-2xl shadow-md bg-gradient-to-br group-hover:scale-110 transition-transform duration-200", animate && "badge-icon-float")}>
      <span className={cn(textSize, animate && "badge-icon-glow")}>{icon}</span>
    </div>
  );
}

export default function BadgesPage() {
  const { data: badges, isLoading } = useGetBadges();
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<Badge | null>(null);

  const filtered = badges?.badges?.filter((b) => filter === "all" || b.rarity === filter) ?? [];

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-6 pb-24 md:pb-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shadow-md">
            <Award className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-foreground">Badge Collection</h1>
            <p className="text-sm text-muted-foreground">{badges?.badges?.length ?? 0} badges · All Exclusive</p>
          </div>
        </div>

        {/* Filter pills */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6 no-scrollbar">
          <button
            onClick={() => setFilter("all")}
            className={cn(
              "flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-colors border",
              filter === "all"
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-card border-card-border text-foreground hover:bg-muted"
            )}
          >
            All Badges
          </button>
          {rarityOrder.map((r) => (
            <button
              key={r}
              onClick={() => setFilter(r as Filter)}
              className={cn(
                "flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-colors border",
                filter === r
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-card border-card-border text-foreground hover:bg-muted"
              )}
            >
              {rarityLabel[r]}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🏅</p>
            <p className="font-semibold text-foreground">No badges found</p>
            <p className="text-sm text-muted-foreground mt-1">Be the first to unlock one</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {filtered.map((badge) => (
              <button
                key={badge.id}
                onClick={() => setSelected(selected?.id === badge.id ? null : badge)}
                className={cn(
                  "group relative flex flex-col items-center gap-3 p-5 rounded-2xl border-2 text-center transition-all duration-200 hover:scale-[1.05] hover:shadow-xl cursor-pointer",
                  rarityCardBg[badge.rarity ?? "common"],
                  selected?.id === badge.id ? "ring-2 ring-primary ring-offset-2 ring-offset-background scale-[1.05] shadow-xl" : "",
                  badge.rarity === "exclusive" ? "badge-exclusive-shimmer" : ""
                )}
              >
                {/* Exclusive animated border sweep */}
                {badge.rarity === "exclusive" && (
                  <>
                    <div className="absolute inset-x-0 top-0 h-[3px] badge-border-anim rounded-t-2xl opacity-90" />
                    {/* Sparkles in corners */}
                    <span className="absolute top-2 left-2 text-[10px] badge-sparkle" style={{ animationDelay: "0s" }}>✨</span>
                    <span className="absolute bottom-2 left-2 text-[10px] badge-sparkle" style={{ animationDelay: "0.8s" }}>⭐</span>
                    <span className="absolute bottom-2 right-8 text-[10px] badge-sparkle" style={{ animationDelay: "1.6s" }}>✨</span>
                  </>
                )}

                {/* Rarity badge */}
                <span
                  className={cn(
                    "absolute top-2 right-2 text-[9px] font-black px-2 py-0.5 rounded-full text-white bg-gradient-to-r shadow-sm tracking-wide",
                    rarityGradient[badge.rarity ?? "common"]
                  )}
                >
                  {rarityLabel[badge.rarity ?? "common"].toUpperCase()}
                </span>

                {/* Badge icon — image or emoji, floating for exclusive */}
                <BadgeIcon icon={badge.icon ?? "🏅"} name={badge.name ?? ""} size="md" animate={badge.rarity === "exclusive"} />

                <div className="w-full">
                  <p className="font-black text-sm text-foreground leading-tight">{badge.name}</p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{badge.description}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Badge detail panel */}
        {selected && (
          <div className="fixed bottom-6 inset-x-4 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[420px] bg-card border border-card-border rounded-3xl shadow-2xl p-5 z-50 animate-in slide-in-from-bottom-4">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 group">
                <BadgeIcon icon={selected.icon ?? "🏅"} name={selected.name ?? ""} size="sm" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <h3 className="font-black text-foreground">{selected.name}</h3>
                  <span className={cn("text-[9px] font-black px-2 py-0.5 rounded-full text-white bg-gradient-to-r tracking-wide", rarityGradient[selected.rarity ?? "common"])}>
                    {rarityLabel[selected.rarity ?? "common"].toUpperCase()}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{selected.description}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground flex-shrink-0 text-lg leading-none">
                ✕
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
