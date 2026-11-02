import { JobListResponse, JobQueueStatus, JobItem } from "../domain/types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

const getAuthHeaders = (): Record<string, string> => {
  const token =
    localStorage.getItem("telegram_hub_token") ||
    localStorage.getItem("auth_token") ||
    localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const jobsApi = {
  async fetchJobs(params?: {
    page?: number;
    pageSize?: number;
    status?: string;
  }): Promise<JobListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.page) {
      searchParams.append("page", params.page.toString());
    }
    if (params?.pageSize) {
      searchParams.append("page_size", params.pageSize.toString());
    }
    if (params?.status && params.status !== "ALL") {
      searchParams.append("status_filter", params.status);
    }

    const res = await fetch(`${API_BASE_URL}/jobs?${searchParams.toString()}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Error al obtener la lista de trabajos");
    }
    return res.json();
  },

  async fetchJobQueue(jobId: string): Promise<JobQueueStatus> {
    const res = await fetch(`${API_BASE_URL}/jobs/${jobId}/queue`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || `Error al obtener la cola del trabajo ${jobId}`);
    }
    return res.json();
  },

  async pauseJob(jobId: string): Promise<{ job_id: string; status: string }> {
    const res = await fetch(`${API_BASE_URL}/jobs/${jobId}/pause`, {
      method: "POST",
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Error al pausar el trabajo");
    }
    return res.json();
  },

  async resumeJob(jobId: string): Promise<JobItem> {
    const res = await fetch(`${API_BASE_URL}/jobs/${jobId}/resume`, {
      method: "POST",
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Error al reanudar el trabajo");
    }
    return res.json();
  },

  async cancelJob(jobId: string): Promise<{ job_id: string; status: string }> {
    const res = await fetch(`${API_BASE_URL}/jobs/${jobId}/cancel`, {
      method: "POST",
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Error al cancelar el trabajo");
    }
    return res.json();
  },

  async retryFailedItems(jobId: string): Promise<{ job_id: string; requeued_items: number; status: string }> {
    const res = await fetch(`${API_BASE_URL}/jobs/${jobId}/retry`, {
      method: "POST",
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Error al reintentar ítems fallidos");
    }
    return res.json();
  },

  async deleteJob(jobId: string): Promise<{ job_id: string; deleted: string }> {
    const res = await fetch(`${API_BASE_URL}/jobs/${jobId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Error al eliminar el trabajo");
    }
    return res.json();
  },
};
