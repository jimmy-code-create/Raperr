import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

export type RealtimeEvent =
  | { type: "new_message"; conversationId: number }
  | { type: "new_group_msg"; groupId: number }
  | { type: "new_channel_msg"; channelId: number }
  | { type: "new_notification"; notifType: string; message: string; actorName?: string }
  | { type: "new_like"; postId: number; actorName: string }
  | { type: "new_comment"; postId: number; actorName: string }
  | { type: "new_follow"; actorName: string }
  | { type: "typing"; conversationId: number; userId: string; name: string }
  | { type: "incoming_call"; conversationId: number; callType: "voice" | "video"; callerId: string; callerName: string; callerAvatar: string | null }
  | { type: "call_declined"; conversationId: number };

type EventHandler = (event: RealtimeEvent) => void;

export function useRealtime(onEvent?: EventHandler) {
  const qc = useQueryClient();
  const esRef = useRef<EventSource | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let active = true;

    function connect() {
      if (!active) return;
      const es = new EventSource("/api/events", { withCredentials: true });
      esRef.current = es;

      es.addEventListener("new_message", (e: MessageEvent) => {
        const data = JSON.parse(e.data) as { conversationId: number };
        qc.invalidateQueries({ queryKey: ["/api/dm/conversations"] });
        qc.invalidateQueries({ queryKey: [`/api/dm/conversations/${data.conversationId}/messages`] });
        onEventRef.current?.({ type: "new_message", conversationId: data.conversationId });
      });

      es.addEventListener("new_group_msg", (e: MessageEvent) => {
        const data = JSON.parse(e.data) as { groupId: number };
        qc.invalidateQueries({ queryKey: [`/api/groups/${data.groupId}/messages`] });
        onEventRef.current?.({ type: "new_group_msg", groupId: data.groupId });
      });

      es.addEventListener("new_channel_msg", (e: MessageEvent) => {
        const data = JSON.parse(e.data) as { channelId: number };
        qc.invalidateQueries({ queryKey: [`/api/channels/${data.channelId}/messages`] });
        onEventRef.current?.({ type: "new_channel_msg", channelId: data.channelId });
      });

      es.addEventListener("new_notification", (e: MessageEvent) => {
        const data = JSON.parse(e.data) as { notifType: string; message: string; actorName?: string };
        qc.invalidateQueries({ queryKey: ["/api/notifications"] });
        onEventRef.current?.({ type: "new_notification", ...data });
      });

      es.addEventListener("new_like", (e: MessageEvent) => {
        const data = JSON.parse(e.data) as { postId: number; actorName: string };
        qc.invalidateQueries({ queryKey: ["/api/notifications"] });
        onEventRef.current?.({ type: "new_like", ...data });
      });

      es.addEventListener("new_comment", (e: MessageEvent) => {
        const data = JSON.parse(e.data) as { postId: number; actorName: string };
        qc.invalidateQueries({ queryKey: ["/api/notifications"] });
        onEventRef.current?.({ type: "new_comment", ...data });
      });

      es.addEventListener("new_follow", (e: MessageEvent) => {
        const data = JSON.parse(e.data) as { actorName: string };
        qc.invalidateQueries({ queryKey: ["/api/notifications"] });
        onEventRef.current?.({ type: "new_follow", ...data });
      });

      es.addEventListener("typing", (e: MessageEvent) => {
        const data = JSON.parse(e.data) as { conversationId: number; userId: string; name: string };
        onEventRef.current?.({ type: "typing", ...data });
      });

      es.addEventListener("incoming_call", (e: MessageEvent) => {
        const data = JSON.parse(e.data) as { conversationId: number; callType: "voice" | "video"; callerId: string; callerName: string; callerAvatar: string | null };
        onEventRef.current?.({ type: "incoming_call", ...data });
      });

      es.addEventListener("call_declined", (e: MessageEvent) => {
        const data = JSON.parse(e.data) as { conversationId: number };
        onEventRef.current?.({ type: "call_declined", ...data });
      });

      es.addEventListener("messages_seen", (e: MessageEvent) => {
        const data = JSON.parse(e.data) as { conversationId: number; seenBy: string };
        qc.invalidateQueries({ queryKey: [`/api/dm/conversations/${data.conversationId}/messages`] });
      });

      es.addEventListener("reaction_update", (e: MessageEvent) => {
        const data = JSON.parse(e.data) as { conversationId: number; messageId: number };
        qc.invalidateQueries({ queryKey: [`/api/dm/conversations/${data.conversationId}/messages`] });
      });

      es.onerror = () => {
        es.close();
        if (active) {
          retryTimeout = setTimeout(connect, 3000);
        }
      };
    }

    connect();

    return () => {
      active = false;
      if (retryTimeout) clearTimeout(retryTimeout);
      esRef.current?.close();
    };
  }, [qc]);
}
