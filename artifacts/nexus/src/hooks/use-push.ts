import { useEffect, useRef } from "react";
import { useAuth } from "./use-auth";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function usePushNotifications() {
  const { user } = useAuth();
  const subscribed = useRef(false);

  useEffect(() => {
    if (!user || subscribed.current) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    (async () => {
      try {
        // Fetch VAPID public key from server
        const keyRes = await fetch("/api/push/vapid-key");
        if (!keyRes.ok) return;
        const { publicKey } = await keyRes.json() as { publicKey: string };
        if (!publicKey) return;

        const reg = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;

        const permission = await Notification.requestPermission();
        if (permission !== "granted") return;

        const existing = await reg.pushManager.getSubscription();
        const sub = existing ?? await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });

        const json = sub.toJSON();
        const keys = json.keys as { p256dh: string; auth: string } | undefined;
        if (!keys?.p256dh || !keys?.auth) return;

        await fetch("/api/push/subscribe", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint, p256dh: keys.p256dh, auth: keys.auth }),
        });

        subscribed.current = true;
      } catch {
        // Push not supported or permission denied — fail silently
      }
    })();
  }, [user]);
}
