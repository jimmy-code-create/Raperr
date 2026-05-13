import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

const HEARTBEAT_INTERVAL = 60_000;

export function usePresenceHeartbeat() {
  const { isAuthenticated } = useAuth();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    const beat = () => {
      fetch("/api/presence/heartbeat", { method: "POST", credentials: "include" }).catch(() => {});
    };

    beat();
    timerRef.current = setInterval(beat, HEARTBEAT_INTERVAL);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isAuthenticated]);
}

export function useOnlineUsers(): Set<string> {
  const { isAuthenticated } = useAuth();
  const { data } = useQuery<{ online: string[] }>({
    queryKey: ["/api/presence/online"],
    queryFn: () => fetch("/api/presence/online", { credentials: "include" }).then((r) => r.json()),
    enabled: isAuthenticated,
    refetchInterval: 30_000,
    staleTime: 20_000,
  });
  return new Set(data?.online ?? []);
}
