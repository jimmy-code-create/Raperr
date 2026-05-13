import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import React from "react";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelativeTime(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "";
  const date = new Date(dateStr as string);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString();
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function extractHashtags(text: string): string[] {
  const matches = text.match(/#([a-zA-Z0-9_]+)/g) ?? [];
  return matches.map((m) => m.slice(1));
}

// Render message text, converting <:slug:id> custom emoji tags to <img> elements
export function renderWithEmojis(text: string): React.ReactNode {
  if (!text) return null;
  const parts = text.split(/(<:[a-z0-9_-]+:\d+>)/gi);
  if (parts.length === 1) return text;
  return React.createElement(
    React.Fragment,
    null,
    ...parts.map((part, i) => {
      const match = part.match(/^<:([a-z0-9_-]+):(\d+)>$/i);
      if (match) {
        const [, slug, id] = match;
        return React.createElement("img", {
          key: i,
          src: `https://cdn3.emoji.gg/emojis/${id}_${slug}.png`,
          alt: slug,
          title: slug,
          className: "inline w-6 h-6 object-contain align-middle mx-0.5",
          loading: "lazy",
        });
      }
      return React.createElement("span", { key: i }, part);
    })
  );
}

// Parse a plain text segment and render markdown inline formatting
function renderMarkdown(text: string, key: number): React.ReactNode {
  // Split on bold (**), italic (*), strikethrough (~~)
  const tokens = text.split(/(\*\*[\s\S]+?\*\*|\*[\s\S]+?\*|~~[\s\S]+?~~)/g);
  if (tokens.length === 1) return React.createElement("span", { key }, text);
  return React.createElement(
    React.Fragment,
    { key },
    ...tokens.map((tok, j) => {
      if (tok.startsWith("**") && tok.endsWith("**") && tok.length > 4)
        return React.createElement("strong", { key: j, className: "font-bold" }, tok.slice(2, -2));
      if (tok.startsWith("*") && tok.endsWith("*") && tok.length > 2)
        return React.createElement("em", { key: j, className: "italic" }, tok.slice(1, -1));
      if (tok.startsWith("~~") && tok.endsWith("~~") && tok.length > 4)
        return React.createElement("del", { key: j, className: "line-through opacity-70" }, tok.slice(2, -2));
      return React.createElement("span", { key: j }, tok);
    })
  );
}

// Render text with clickable #hashtags, custom emojis, and markdown formatting
export function renderWithEmojisAndTags(
  text: string,
  onTagClick?: (tag: string) => void
): React.ReactNode {
  if (!text) return null;

  // Split by custom emojis and hashtags first
  const parts = text.split(/(<:[a-z0-9_-]+:\d+>|#[a-zA-Z0-9_]+)/gi);

  return React.createElement(
    React.Fragment,
    null,
    ...parts.map((part, i) => {
      const emojiMatch = part.match(/^<:([a-z0-9_-]+):(\d+)>$/i);
      if (emojiMatch) {
        const [, slug, id] = emojiMatch;
        return React.createElement("img", {
          key: i,
          src: `https://cdn3.emoji.gg/emojis/${id}_${slug}.png`,
          alt: slug,
          title: slug,
          className: "inline w-6 h-6 object-contain align-middle mx-0.5",
          loading: "lazy",
        });
      }
      const hashMatch = part.match(/^#([a-zA-Z0-9_]+)$/);
      if (hashMatch) {
        const tag = hashMatch[1];
        return React.createElement(
          "span",
          {
            key: i,
            onClick: onTagClick ? (e: React.MouseEvent) => { e.stopPropagation(); onTagClick(tag); } : undefined,
            className: "text-primary font-semibold cursor-pointer hover:underline hover:opacity-80 transition-opacity",
          },
          part
        );
      }
      // Plain text segment — render with markdown formatting
      return renderMarkdown(part, i);
    })
  );
}

export function getRizzRank(score: number): { rank: string; emoji: string; color: string } {
  if (score >= 1000) return { rank: "Elite Rizz", emoji: "👑", color: "from-amber-400 via-yellow-300 to-amber-500" };
  if (score >= 500) return { rank: "Diamond", emoji: "💎", color: "from-cyan-400 to-blue-500" };
  if (score >= 200) return { rank: "Gold", emoji: "🥇", color: "from-yellow-400 to-amber-500" };
  if (score >= 100) return { rank: "Silver", emoji: "🥈", color: "from-slate-300 to-slate-500" };
  if (score >= 50) return { rank: "Bronze", emoji: "🥉", color: "from-amber-600 to-amber-800" };
  return { rank: "Rookie", emoji: "⚡", color: "from-primary/60 to-primary" };
}
