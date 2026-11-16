import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { doctorApi } from "../doctorApi";

describe("doctorApi authentication headers", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    localStorage.clear();
  });

  it("includes Authorization header when telegram_hub_token is in localStorage", async () => {
    localStorage.setItem("telegram_hub_token", "jwt-hub-token-123");

    const mockResponse = {
      overall_status: "HEALTHY",
      timestamp: "2026-11-16T12:00:00Z",
      checks: {},
      recommendations: [],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const report = await doctorApi.getDoctorReport();
    expect(report.overall_status).toBe("HEALTHY");

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/health/doctor",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer jwt-hub-token-123",
          "Content-Type": "application/json",
        }),
      })
    );
  });

  it("includes Authorization header in remediation request with telegram_hub_token", async () => {
    localStorage.setItem("telegram_hub_token", "jwt-hub-token-456");

    const mockResponse = {
      remediated: true,
      action: "clean_temp_storage",
      message: "Cleaned temporary files",
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const res = await doctorApi.remediate("clean_temp_storage");
    expect(res.remediated).toBe(true);

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/health/doctor/remediate",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer jwt-hub-token-456",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ action: "clean_temp_storage" }),
      })
    );
  });
});
