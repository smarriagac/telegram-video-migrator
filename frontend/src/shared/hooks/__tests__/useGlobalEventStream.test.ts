import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useGlobalEventStream } from "../useGlobalEventStream";

class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  onmessage: ((e: any) => void) | null = null;
  onerror: ((e: any) => void) | null = null;
  closed = false;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  close() {
    this.closed = true;
  }

  emitMessage(data: any) {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(data) });
    }
  }
}

describe("useGlobalEventStream", () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    (globalThis as any).EventSource = MockEventSource;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("subscribes to /api/events/stream and receives dispatched events", () => {
    const onEvent = vi.fn();
    renderHook(() => useGlobalEventStream(onEvent));

    expect(MockEventSource.instances.length).toBe(1);
    const instance = MockEventSource.instances[0];
    expect(instance.url).toBe("/api/events/stream");

    // Simulate server push event
    const payload = {
      type: "NOTIFICATION_UPDATE" as const,
      data: { action: "NEW", notification_id: "notif-999" },
    };
    instance.emitMessage(payload);

    expect(onEvent).toHaveBeenCalledWith(payload);
  });

  it("closes EventSource when unmounted", () => {
    const { unmount } = renderHook(() => useGlobalEventStream());
    const instance = MockEventSource.instances[0];
    expect(instance.closed).toBe(false);

    unmount();
    expect(instance.closed).toBe(true);
  });
});
