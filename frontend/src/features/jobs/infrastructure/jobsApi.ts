import { JobListResponse, JobQueueStatus, JobItem, QueueItem } from "../domain/types";

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

  async runScheduledJobNow(jobId: string): Promise<JobItem> {
    const res = await fetch(`${API_BASE_URL}/jobs/${jobId}/run-now`, {
      method: "POST",
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Error al iniciar el trabajo programado");
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

  async fetchDLQ(params?: { limit?: number; offset?: number; jobId?: string }): Promise<{
    items: QueueItem[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.append("limit", params.limit.toString());
    if (params?.offset) searchParams.append("offset", params.offset.toString());
    if (params?.jobId) searchParams.append("job_id", params.jobId);

    const res = await fetch(`${API_BASE_URL}/jobs/dlq?${searchParams.toString()}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Error al obtener Dead-Letter Queue");
    }
    return res.json();
  },

  async retrySingleItem(jobId: string, sourceMsgId: number): Promise<{ success: boolean; status: string }> {
    const res = await fetch(`${API_BASE_URL}/jobs/${jobId}/queue/${sourceMsgId}/retry`, {
      method: "POST",
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || `Error al reintentar mensaje #${sourceMsgId}`);
    }
    return res.json();
  },

  async skipSingleItem(jobId: string, sourceMsgId: number): Promise<{ success: boolean; status: string }> {
    const res = await fetch(`${API_BASE_URL}/jobs/${jobId}/queue/${sourceMsgId}/skip`, {
      method: "POST",
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || `Error al omitir mensaje #${sourceMsgId}`);
    }
    return res.json();
  },

  async updateItemCaption(
    jobId: string,
    sourceMsgId: number,
    caption: string
  ): Promise<{ success: boolean; caption: string }> {
    const res = await fetch(`${API_BASE_URL}/jobs/${jobId}/queue/${sourceMsgId}`, {
      method: "PATCH",
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ caption }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || `Error al actualizar caption del mensaje #${sourceMsgId}`);
    }
    return res.json();
  },

  async bulkRetryDLQ(
    items: { job_id: string; source_message_id: number }[]
  ): Promise<{ success: boolean; retried_count: number; total_requested: number; resumed_jobs: string[] }> {
    const res = await fetch(`${API_BASE_URL}/jobs/dlq/bulk-retry`, {
      method: "POST",
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ items }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Error al reintentar lote de elementos de la DLQ");
    }
    return res.json();
  },

  async bulkSkipDLQ(
    items: { job_id: string; source_message_id: number }[]
  ): Promise<{ success: boolean; skipped_count: number; total_requested: number }> {
    const res = await fetch(`${API_BASE_URL}/jobs/dlq/bulk-skip`, {
      method: "POST",
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ items }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Error al omitir lote de elementos de la DLQ");
    }
    return res.json();
  },
};
