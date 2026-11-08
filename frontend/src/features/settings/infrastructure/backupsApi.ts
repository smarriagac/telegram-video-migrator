const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

const getAuthHeaders = (): Record<string, string> => {
  const token =
    localStorage.getItem("telegram_hub_token") ||
    localStorage.getItem("auth_token") ||
    localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export interface BackupMetadata {
  snapshot_id: string;
  filename: string;
  created_at: string;
  trigger: "MANUAL" | "SCHEDULED" | "SYSTEM";
  size_bytes: number;
  table_counts?: Record<string, number>;
  total_records?: number;
  sha256?: string;
}

export interface BackupListResponse {
  snapshots: BackupMetadata[];
  total_count: number;
  total_size_bytes: number;
  retention_limit: number;
}

export interface VerifyBackupResponse {
  valid: boolean;
  snapshot_id: string;
  manifest?: {
    snapshot_id: string;
    version: string;
    trigger: string;
    created_at: string;
    table_counts: Record<string, number>;
    total_records: number;
  };
  has_tables_dump?: boolean;
  has_sqlite_db?: boolean;
  sha256?: string;
  size_bytes?: number;
  verified_at?: string;
  error?: string;
}

export const backupsApi = {
  async listBackups(): Promise<BackupListResponse> {
    const res = await fetch(`${API_BASE_URL}/backups`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Error al obtener lista de copias de seguridad");
    }
    return res.json();
  },

  async createBackup(params?: { trigger?: string; retention_limit?: number }): Promise<BackupMetadata> {
    const res = await fetch(`${API_BASE_URL}/backups`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        trigger: params?.trigger || "MANUAL",
        retention_limit: params?.retention_limit || 7,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Error al crear la copia de seguridad");
    }
    return res.json();
  },

  async verifyBackup(snapshotId: string): Promise<VerifyBackupResponse> {
    const res = await fetch(`${API_BASE_URL}/backups/${snapshotId}/verify`, {
      method: "POST",
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Error en la verificación de integridad");
    }
    return res.json();
  },

  async deleteBackup(snapshotId: string): Promise<{ success: boolean; deleted_snapshot_id: string }> {
    const res = await fetch(`${API_BASE_URL}/backups/${snapshotId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Error al eliminar la copia de seguridad");
    }
    return res.json();
  },

  getDownloadUrl(snapshotId: string): string {
    return `${API_BASE_URL}/backups/${snapshotId}/download`;
  },
};
