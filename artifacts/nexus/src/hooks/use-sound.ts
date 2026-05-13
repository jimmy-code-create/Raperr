import { useCallback, useRef } from "react";

let globalSoundEnabled = localStorage.getItem("rizz-sound") !== "false";

export function getSoundEnabled() {
  return globalSoundEnabled;
}

export function setSoundEnabled(val: boolean) {
  globalSoundEnabled = val;
  localStorage.setItem("rizz-sound", val ? "true" : "false");
}

function createCtx() {
  try {
    return new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  } catch {
    return null;
  }
}

function playTone(
  frequency: number,
  endFrequency: number,
  duration: number,
  type: OscillatorType = "sine",
  volume = 0.25,
  delay = 0
) {
  if (!globalSoundEnabled) return;
  const ctx = createCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, ctx.currentTime + delay);
  osc.frequency.exponentialRampToValueAtTime(endFrequency, ctx.currentTime + delay + duration * 0.6);
  gain.gain.setValueAtTime(0, ctx.currentTime + delay);
  gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + delay + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
  osc.start(ctx.currentTime + delay);
  osc.stop(ctx.currentTime + delay + duration + 0.05);
}

export function useSound() {
  const lastPlayRef = useRef<Record<string, number>>({});

  const throttle = useCallback((key: string, ms: number) => {
    const now = Date.now();
    if ((lastPlayRef.current[key] ?? 0) + ms > now) return false;
    lastPlayRef.current[key] = now;
    return true;
  }, []);

  const playLike = useCallback(() => {
    if (!throttle("like", 200)) return;
    playTone(440, 880, 0.18, "sine", 0.3);
    playTone(660, 1320, 0.15, "sine", 0.15, 0.06);
  }, [throttle]);

  const playUnlike = useCallback(() => {
    if (!throttle("unlike", 200)) return;
    playTone(440, 220, 0.2, "sine", 0.2);
  }, [throttle]);

  const playComment = useCallback(() => {
    if (!throttle("comment", 300)) return;
    playTone(600, 600, 0.08, "sine", 0.2);
    playTone(800, 800, 0.08, "sine", 0.15, 0.09);
  }, [throttle]);

  const playSave = useCallback(() => {
    if (!throttle("save", 300)) return;
    playTone(330, 495, 0.12, "triangle", 0.25);
    playTone(495, 660, 0.12, "triangle", 0.2, 0.1);
    playTone(660, 990, 0.15, "triangle", 0.15, 0.2);
  }, [throttle]);

  const playPost = useCallback(() => {
    if (!throttle("post", 500)) return;
    playTone(200, 600, 0.1, "sawtooth", 0.15);
    playTone(440, 880, 0.2, "sine", 0.3, 0.1);
    playTone(660, 1320, 0.25, "sine", 0.2, 0.25);
  }, [throttle]);

  const playNotification = useCallback(() => {
    if (!throttle("notif", 1000)) return;
    playTone(523, 784, 0.15, "sine", 0.2);
    playTone(784, 1046, 0.15, "sine", 0.15, 0.18);
  }, [throttle]);

  const playClick = useCallback(() => {
    if (!throttle("click", 80)) return;
    playTone(800, 600, 0.06, "sine", 0.08);
  }, [throttle]);

  const playSuccess = useCallback(() => {
    if (!throttle("success", 500)) return;
    playTone(523, 659, 0.12, "sine", 0.2);
    playTone(659, 784, 0.12, "sine", 0.18, 0.12);
    playTone(784, 1046, 0.2, "sine", 0.22, 0.24);
  }, [throttle]);

  const playFollow = useCallback(() => {
    if (!throttle("follow", 400)) return;
    playTone(440, 880, 0.1, "sine", 0.2);
    playTone(550, 1100, 0.1, "sine", 0.15, 0.08);
    playTone(660, 1320, 0.15, "sine", 0.12, 0.16);
  }, [throttle]);

  const playStory = useCallback(() => {
    if (!throttle("story", 300)) return;
    playTone(300, 600, 0.15, "sine", 0.15);
  }, [throttle]);

  return { playLike, playUnlike, playComment, playSave, playPost, playNotification, playClick, playSuccess, playFollow, playStory };
}
