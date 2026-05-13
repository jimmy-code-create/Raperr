import { Layout } from "@/components/Layout";
import { useTheme, THEME_COLORS } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import {
  Sun, Moon, Monitor, Check, Palette, Zap, Volume2, VolumeX,
  Sparkles, Type, Eye, Shield, Info,
  Smartphone, Star, User, LogOut, ChevronRight, Edit3, Bell, Database, Globe
} from "lucide-react";
import { useSound, setSoundEnabled } from "@/hooks/use-sound";
import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";

function useSetting(key: string, defaultValue: boolean): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState<boolean>(() => {
    try { return JSON.parse(localStorage.getItem(key) ?? String(defaultValue)); } catch { return defaultValue; }
  });
  const set = (v: boolean) => {
    setValue(v);
    localStorage.setItem(key, String(v));
    if (key === "rizz_reduce_motion") {
      document.documentElement.classList.toggle("reduce-motion", v);
    }
    if (key === "rizz_high_contrast") {
      document.documentElement.classList.toggle("high-contrast", v);
    }
  };
  useEffect(() => {
    if (key === "rizz_reduce_motion" && value) document.documentElement.classList.add("reduce-motion");
    if (key === "rizz_high_contrast" && value) document.documentElement.classList.add("high-contrast");
  }, []);
  return [value, set];
}

function SettingsSection({ icon: Icon, title, desc, children }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rizz-card p-5">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 text-primary" />
        <h2 className="font-black text-foreground">{title}</h2>
      </div>
      {desc && <p className="text-xs text-muted-foreground mb-4">{desc}</p>}
      <div className="mt-3">
        {children}
      </div>
    </div>
  );
}

function Toggle({ checked, onChange, label, desc }: { checked: boolean; onChange: (v: boolean) => void; label: string; desc?: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm font-semibold text-foreground">{label}</p>
        {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={cn(
          "relative w-12 h-6 rounded-full transition-all duration-200 flex-shrink-0",
          checked ? "bg-primary" : "bg-muted border border-border"
        )}
      >
        <span className={cn(
          "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-200",
          checked ? "left-6" : "left-0.5"
        )} />
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const {
    mode, color, setMode, setColor,
    soundEnabled, setSoundEnabled: setSound,
    animationsEnabled, setAnimationsEnabled,
    compactMode, setCompactMode,
    fontSize, setFontSize,
    vibeMode, setVibeMode,
  } = useTheme();
  const { playClick, playNotification } = useSound();
  const { user, logout } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const [privateAccount, setPrivateAccount] = useSetting("rizz_private_account", false);
  const [hideActivity, setHideActivity] = useSetting("rizz_hide_activity", false);
  const [reduceMotion, setReduceMotion] = useSetting("rizz_reduce_motion", false);
  const [highContrast, setHighContrast] = useSetting("rizz_high_contrast", false);
  const [notifLikes, setNotifLikes] = useSetting("rizz_notif_likes", true);
  const [notifComments, setNotifComments] = useSetting("rizz_notif_comments", true);
  const [notifFollows, setNotifFollows] = useSetting("rizz_notif_follows", true);
  const [notifMessages, setNotifMessages] = useSetting("rizz_notif_messages", true);
  const [notifMarketing, setNotifMarketing] = useSetting("rizz_notif_marketing", false);
  const [dataSaver, setDataSaver] = useSetting("rizz_data_saver", false);

  const handleSoundToggle = (v: boolean) => {
    setSound(v);
    setSoundEnabled(v);
    if (v) playNotification();
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-6 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl btn-primary flex items-center justify-center shadow-lg glow-primary-sm">
            <Palette className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-foreground">Settings</h1>
            <p className="text-sm text-muted-foreground">Craft your perfect Rizz experience</p>
          </div>
        </div>

        {/* Appearance Mode */}
        <SettingsSection icon={Sun} title="Appearance" desc="Choose how Rizz looks to you.">
          <div className="grid grid-cols-3 gap-3">
            {([
              { id: "light", label: "Light", icon: Sun, desc: "Bright vibes" },
              { id: "dark", label: "Dark", icon: Moon, desc: "Night mode" },
              { id: "system", label: "System", icon: Monitor, desc: "Auto" },
            ] as const).map(({ id, label, icon: Icon, desc }) => (
              <button
                key={id}
                onClick={() => { setMode(id); playClick(); }}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all",
                  mode === id
                    ? "border-primary bg-primary/5 shadow-sm glow-primary-sm"
                    : "border-border hover:border-primary/40 hover:bg-muted"
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-2xl flex items-center justify-center transition-all",
                  mode === id ? "btn-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-black text-foreground">{label}</p>
                  <p className="text-[10px] text-muted-foreground">{desc}</p>
                </div>
                {mode === id && (
                  <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-3 h-3 text-primary-foreground" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </SettingsSection>

        {/* Theme Color */}
        <SettingsSection icon={Palette} title="Accent Color" desc="Pick your vibe — affects buttons, icons, and highlights.">
          <div className="grid grid-cols-3 gap-2.5">
            {THEME_COLORS.map((tc) => (
              <button
                key={tc.id}
                onClick={() => { setColor(tc.id); playClick(); }}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-2xl border-2 transition-all hover:scale-[1.02]",
                  color === tc.id
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border hover:border-border-foreground/20 hover:bg-muted"
                )}
              >
                <div
                  className="w-8 h-8 rounded-xl flex-shrink-0 shadow-sm"
                  style={{ background: tc.gradient ?? tc.hue }}
                />
                <div className="text-left min-w-0 flex-1">
                  <p className="text-sm font-black text-foreground truncate">{tc.label}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">{tc.id}</p>
                </div>
                {color === tc.id && (
                  <Check className="w-4 h-4 text-primary flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        </SettingsSection>

        {/* Font Size */}
        <SettingsSection icon={Type} title="Font Size" desc="Adjust the text size to your preference.">
          <div className="grid grid-cols-3 gap-3">
            {([
              { id: "sm", label: "Small", preview: "Aa", size: "text-xs" },
              { id: "md", label: "Normal", preview: "Aa", size: "text-sm" },
              { id: "lg", label: "Large", preview: "Aa", size: "text-base" },
            ] as const).map(({ id, label, preview, size }) => (
              <button
                key={id}
                onClick={() => { setFontSize(id); playClick(); }}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all",
                  fontSize === id ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:bg-muted"
                )}
              >
                <span className={cn("font-black text-foreground", size)}>{preview}</span>
                <span className="text-xs font-bold text-muted-foreground">{label}</span>
                {fontSize === id && <Check className="w-4 h-4 text-primary" />}
              </button>
            ))}
          </div>
        </SettingsSection>

        {/* Experience Toggles */}
        <SettingsSection icon={Sparkles} title="Experience" desc="Fine-tune your Rizz experience.">
          <div className="space-y-1 divide-y divide-border/40">
            <Toggle
              checked={vibeMode}
              onChange={(v) => { setVibeMode(v); playClick(); }}
              label="Vibe Mode"
              desc="Animated background orbs and effects"
            />
            <Toggle
              checked={soundEnabled}
              onChange={handleSoundToggle}
              label="Sound Effects"
              desc="Satisfying sounds on likes, comments, and posts"
            />
            <Toggle
              checked={animationsEnabled}
              onChange={(v) => { setAnimationsEnabled(v); playClick(); }}
              label="Animations"
              desc="Smooth transitions and micro-animations"
            />
            <Toggle
              checked={compactMode}
              onChange={(v) => { setCompactMode(v); playClick(); }}
              label="Compact Mode"
              desc="Reduce spacing for more content on screen"
            />
          </div>
        </SettingsSection>

        {/* Preview */}
        <SettingsSection icon={Eye} title="Live Preview">
          <div className="bg-muted/60 rounded-2xl p-4 space-y-3 border border-border/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full btn-primary flex items-center justify-center text-primary-foreground font-black text-sm shadow-lg">
                R
              </div>
              <div>
                <p className="font-black text-sm text-foreground">rizz.user</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                  Just now
                </p>
              </div>
            </div>
            <p className="text-sm text-foreground">Loving the new Rizz aesthetic! 🔥✨ <span className="text-primary font-semibold cursor-pointer">#vibes</span></p>
            <div className="flex gap-2">
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-black btn-primary text-primary-foreground shadow-sm">❤️ Like</button>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-black bg-muted text-muted-foreground">💬 Comment</button>
            </div>
          </div>
        </SettingsSection>

        {/* Notifications */}
        <SettingsSection icon={Bell} title="Notifications" desc="Control what you get notified about.">
          <div className="space-y-1 divide-y divide-border/40">
            <Toggle checked={notifLikes} onChange={(v) => { setNotifLikes(v); playClick(); }} label="Likes & Reactions" desc="When someone likes or reacts to your post" />
            <Toggle checked={notifComments} onChange={(v) => { setNotifComments(v); playClick(); }} label="Comments" desc="When someone comments on your post" />
            <Toggle checked={notifFollows} onChange={(v) => { setNotifFollows(v); playClick(); }} label="Follows" desc="When someone follows you" />
            <Toggle checked={notifMessages} onChange={(v) => { setNotifMessages(v); playClick(); }} label="Messages" desc="New direct messages" />
            <Toggle checked={notifMarketing} onChange={(v) => { setNotifMarketing(v); playClick(); }} label="Marketing & Updates" desc="Product news and announcements" />
          </div>
        </SettingsSection>

        {/* Privacy & Safety */}
        <SettingsSection icon={Shield} title="Privacy & Safety">
          <div className="space-y-1 divide-y divide-border/40">
            <Toggle
              checked={privateAccount}
              onChange={(v) => { setPrivateAccount(v); playClick(); }}
              label="Private Account"
              desc="Only followers can see your posts"
            />
            <Toggle
              checked={hideActivity}
              onChange={(v) => { setHideActivity(v); playClick(); }}
              label="Hide Activity Status"
              desc="Prevent others from seeing when you're active"
            />
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-semibold text-foreground">Block & Mute</p>
                <p className="text-xs text-muted-foreground">Manage blocked and muted accounts</p>
              </div>
              <a href="/dms" className="text-xs font-bold text-primary hover:underline">Open DMs →</a>
            </div>
          </div>
        </SettingsSection>

        {/* Accessibility */}
        <SettingsSection icon={Smartphone} title="Accessibility">
          <div className="space-y-1 divide-y divide-border/40">
            <Toggle
              checked={reduceMotion}
              onChange={(v) => { setReduceMotion(v); playClick(); }}
              label="Reduce Motion"
              desc="Minimize animations for motion sensitivity"
            />
            <Toggle
              checked={highContrast}
              onChange={(v) => { setHighContrast(v); playClick(); }}
              label="High Contrast"
              desc="Increase contrast for better readability"
            />
          </div>
        </SettingsSection>

        {/* Data & Storage */}
        <SettingsSection icon={Database} title="Data & Storage" desc="Manage your data and storage preferences.">
          <div className="space-y-0 divide-y divide-border/40">
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Clear Cache</p>
                <p className="text-xs text-muted-foreground">Reset cached data and free up local storage</p>
              </div>
              <button
                onClick={() => { Object.keys(localStorage).filter(k => k.startsWith("rizz_cache")).forEach(k => localStorage.removeItem(k)); playClick(); }}
                className="text-xs font-bold text-primary hover:text-primary/80 transition-colors px-3 py-1.5 rounded-xl hover:bg-primary/10"
              >
                Clear
              </button>
            </div>
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Language</p>
                <p className="text-xs text-muted-foreground">App display language</p>
              </div>
              <div className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                <select
                  value={localStorage.getItem("rizz_language") ?? "en"}
                  onChange={(e) => { localStorage.setItem("rizz_language", e.target.value); playClick(); }}
                  className="text-xs font-semibold text-muted-foreground bg-muted border border-border/40 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary/30 cursor-pointer"
                >
                  <option value="en">English</option>
                  <option value="es">Español</option>
                  <option value="fr">Français</option>
                  <option value="de">Deutsch</option>
                  <option value="pt">Português</option>
                  <option value="ja">日本語</option>
                  <option value="ko">한국어</option>
                  <option value="zh">中文</option>
                  <option value="ar">العربية</option>
                  <option value="hi">हिन्दी</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Data Saver</p>
                <p className="text-xs text-muted-foreground">Reduce data usage by loading lower quality media</p>
              </div>
              <Toggle checked={dataSaver} onChange={(v) => { setDataSaver(v); playClick(); }} label="" />
            </div>
          </div>
        </SettingsSection>

        {/* Account */}
        <SettingsSection icon={User} title="Account" desc="Manage your profile and session.">
          <div className="space-y-2">
            {/* Profile info row */}
            <div className="flex items-center gap-3 p-3 bg-muted/60 rounded-2xl border border-border/30">
              <div className="w-10 h-10 rounded-full btn-primary flex items-center justify-center text-primary-foreground font-black text-sm shadow-md flex-shrink-0">
                {(user?.firstName?.[0] ?? "R").toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-sm text-foreground truncate">{user?.firstName} {user?.lastName}</p>
                <p className="text-xs text-muted-foreground truncate">@{user?.id?.slice(0, 10)}…</p>
              </div>
            </div>

            {/* Edit profile */}
            <Link href="/profile/me">
              <a className="flex items-center gap-3 w-full px-4 py-3 bg-card border border-card-border rounded-2xl hover:border-primary/30 hover:bg-muted/40 transition-all group">
                <Edit3 className="w-4 h-4 text-primary" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">Edit Profile</p>
                  <p className="text-xs text-muted-foreground">Change name, bio, avatar, banner</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </a>
            </Link>

            {/* Log out */}
            {!showLogoutConfirm ? (
              <button
                onClick={() => { setShowLogoutConfirm(true); playClick(); }}
                className="flex items-center gap-3 w-full px-4 py-3 bg-card border border-card-border rounded-2xl hover:border-destructive/30 hover:bg-destructive/5 transition-all group"
              >
                <LogOut className="w-4 h-4 text-destructive/70 group-hover:text-destructive transition-colors" />
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold text-foreground">Log Out</p>
                  <p className="text-xs text-muted-foreground">Sign out of your Rizz account</p>
                </div>
              </button>
            ) : (
              <div className="flex items-center gap-2 px-4 py-3 bg-destructive/8 border border-destructive/30 rounded-2xl">
                <p className="text-sm font-semibold text-destructive flex-1">Log out of Rizz?</p>
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="px-3 py-1.5 text-xs font-bold bg-muted rounded-xl hover:bg-muted/80 transition-colors text-muted-foreground"
                >
                  Cancel
                </button>
                <button
                  onClick={() => logout()}
                  className="px-3 py-1.5 text-xs font-black bg-destructive text-white rounded-xl hover:opacity-90 transition-all"
                >
                  Log Out
                </button>
              </div>
            )}
          </div>
        </SettingsSection>

        {/* About */}
        <SettingsSection icon={Info} title="About">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-3xl btn-primary flex items-center justify-center shadow-xl glow-primary-sm">
              <Zap className="w-7 h-7 text-primary-foreground" />
            </div>
            <div>
              <p className="text-xl font-black rizz-gradient">Rizz</p>
              <p className="text-xs text-muted-foreground">Social Platform · v2.0 ✨</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Rizz is your social universe — combining the best of Instagram and Discord into one crazy aesthetic app. Packed with 100+ features, custom themes, sound effects, story sharing, and more.
          </p>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-primary font-semibold">
            <Star className="w-3.5 h-3.5 fill-current" />
            Built different. Stay different. 🔥
          </div>
        </SettingsSection>
      </div>
    </Layout>
  );
}
