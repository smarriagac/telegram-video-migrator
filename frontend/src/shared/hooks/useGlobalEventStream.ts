import { useEffect, useRef } from "react";

export type GlobalEventType = "CONNECTED" | "JOB_PROGRESS" | "JOB_STATUS_CHANGE" | "NOTIFICATION_UPDATE";

export interface GlobalEvent<T = any> {
  type: GlobalEventType;
  data: T;
}

export type GlobalEventHandler = (event: GlobalEvent) => void;

/**
 * Custom hook providing a unified, reactive SSE subscription to the backend global event stream.
 * Replaces periodic HTTP polling across UI modules with push-based real-time updates.
 */
export function useGlobalEventStream(onEvent?: GlobalEventHandler) {
  const handlerRef = useRef<GlobalEventHandler | undefined>(onEvent);

  useEffect(() => {
    handlerRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimer: any = null;

    const connect = () => {
      eventSource = new EventSource("/api/events/stream");

      eventSource.onmessage = (e) => {
        try {
          const parsed = JSON.parse(e.data) as GlobalEvent;
          if (parsed && parsed.type && handlerRef.current) {
            handlerRef.current(parsed);
          }
        } catch {
          // Ignore unparseable or ping frames
        }
      };

      eventSource.onerror = () => {
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        // Auto-reconnect with 5s backoff
        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(connect, 5000);
      };
    };

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []);
}
