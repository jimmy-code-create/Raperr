import { createContext, useContext, useState, useEffect, useCallback } from "react";

export type ThemeColor = "rose" | "purple" | "ocean" | "sunset" | "forest" | "gold" | "neon" | "cyber" | "aurora";
export type ThemeMode = "light" | "dark" | "system";

interface ThemeContextValue {
  mode: ThemeMode;
  color: ThemeColor;
  setMode: (m: ThemeMode) => void;
  setColor: (c: ThemeColor) => void;
  resolvedMode: "light" | "dark";
  soundEnabled: boolean;
  setSoundEnabled: (v: boolean) => void;
  animationsEnabled: boolean;
  setAnimationsEnabled: (v: boolean) => void;
  compactMode: boolean;
  setCompactMode: (v: boolean) => void;
  fontSize: "sm" | "md" | "lg";
  setFontSize: (v: "sm" | "md" | "lg") => void;
  vibeMode: boolean;
  setVibeMode: (v: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    return (localStorage.getItem("rizz-theme-mode") as ThemeMode) ?? "light";
  });
  const [color, setColorState] = useState<ThemeColor>(() => {
    return (localStorage.getItem("rizz-theme-color") as ThemeColor) ?? "rose";
  });
  const [soundEnabled, setSoundEnabledState] = useState(() => {
    return localStorage.getItem("rizz-sound") !== "false";
  });
  const [animationsEnabled, setAnimationsEnabledState] = useState(() => {
    return localStorage.getItem("rizz-animations") !== "false";
  });
  const [compactMode, setCompactModeState] = useState(() => {
    return localStorage.getItem("rizz-compact") === "true";
  });
  const [fontSize, setFontSizeState] = useState<"sm" | "md" | "lg">(() => {
    return (localStorage.getItem("rizz-fontsize") as "sm" | "md" | "lg") ?? "md";
  });
  const [vibeMode, setVibeModeState] = useState(() => {
    return localStorage.getItem("rizz-vibe") !== "false";
  });
  const [systemDark, setSystemDark] = useState(getSystemDark);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const resolvedMode: "light" | "dark" = mode === "system" ? (systemDark ? "dark" : "light") : mode;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", resolvedMode === "dark");
    root.setAttribute("data-theme", color);
    root.setAttribute("data-compact", compactMode ? "true" : "false");
    root.setAttribute("data-fontsize", fontSize);
    root.setAttribute("data-vibe", vibeMode ? "true" : "false");
    localStorage.setItem("rizz-theme-mode", mode);
    localStorage.setItem("rizz-theme-color", color);
    localStorage.setItem("rizz-sound", soundEnabled ? "true" : "false");
    localStorage.setItem("rizz-animations", animationsEnabled ? "true" : "false");
    localStorage.setItem("rizz-compact", compactMode ? "true" : "false");
    localStorage.setItem("rizz-fontsize", fontSize);
    localStorage.setItem("rizz-vibe", vibeMode ? "true" : "false");
  }, [mode, color, resolvedMode, soundEnabled, animationsEnabled, compactMode, fontSize, vibeMode]);

  const setMode = useCallback((m: ThemeMode) => setModeState(m), []);
  const setColor = useCallback((c: ThemeColor) => setColorState(c), []);
  const setSoundEnabled = useCallback((v: boolean) => setSoundEnabledState(v), []);
  const setAnimationsEnabled = useCallback((v: boolean) => setAnimationsEnabledState(v), []);
  const setCompactMode = useCallback((v: boolean) => setCompactModeState(v), []);
  const setFontSize = useCallback((v: "sm" | "md" | "lg") => setFontSizeState(v), []);
  const setVibeMode = useCallback((v: boolean) => setVibeModeState(v), []);

  return (
    <ThemeContext.Provider value={{
      mode, color, setMode, setColor, resolvedMode,
      soundEnabled, setSoundEnabled,
      animationsEnabled, setAnimationsEnabled,
      compactMode, setCompactMode,
      fontSize, setFontSize,
      vibeMode, setVibeMode,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

export const THEME_COLORS: { id: ThemeColor; label: string; hue: string; gradient?: string }[] = [
  { id: "rose",   label: "Rose",    hue: "#f43f5e" },
  { id: "purple", label: "Purple",  hue: "#a855f7" },
  { id: "ocean",  label: "Ocean",   hue: "#0ea5e9" },
  { id: "sunset", label: "Sunset",  hue: "#f97316" },
  { id: "forest", label: "Forest",  hue: "#22c55e" },
  { id: "gold",   label: "Gold",    hue: "#eab308" },
  { id: "neon",   label: "Neon",    hue: "#00d4ff",  gradient: "linear-gradient(135deg, #00d4ff, #ff006e)" },
  { id: "cyber",  label: "Cyber",   hue: "#ccff00",  gradient: "linear-gradient(135deg, #ccff00, #7c3aed)" },
  { id: "aurora", label: "Aurora",  hue: "#00c9a7",  gradient: "linear-gradient(135deg, #00c9a7, #f72585)" },
];
