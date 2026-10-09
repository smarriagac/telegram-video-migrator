import { useEffect, useRef } from "react";
import { ProgressEventPayload } from "../domain/types";
import { migrationApi } from "../infrastructure/migrationApi";
import { useMigrationStore } from "./useMigrationStore";

export function useMigrationStream(jobId: string | null) {
  const updateProgress = useMigrationStore((state) => state.updateProgress);
  const addLog = useMigrationStore((state) => state.addLog);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!jobId) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return;
    }

    const url = migrationApi.getStreamUrl(jobId);
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      addLog(`Connected to live stream for job: ${jobId}`, "info");
    };

    eventSource.addEventListener("progress", (event) => {
      try {
        const payload: ProgressEventPayload = JSON.parse(event.data);
        updateProgress(payload);

        if (
          payload.status === "COMPLETED" ||
          payload.status === "FAILED" ||
          payload.status === "CANCELLED"
        ) {
          eventSource.close();
          eventSourceRef.current = null;
        }
      } catch (err) {
        console.error("Failed to parse SSE event:", err);
      }
    });

    eventSource.onerror = (err) => {
      console.warn("EventSource encountered an error or closed:", err);
      // Close on fatal disconnect
      if (eventSource.readyState === EventSource.CLOSED) {
        eventSourceRef.current = null;
      }
    };

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [jobId, updateProgress, addLog]);
}
