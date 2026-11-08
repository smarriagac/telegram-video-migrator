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

export interface CaptionTemplate {
  id: string;
  tenant_id: string;
  name: string;
  category: "MIGRATION" | "BROADCAST" | "WATERMARK" | "GENERAL";
  header?: string | null;
  body_template: string;
  signature?: string | null;
  caption_rules?: Record<string, any> | null;
  is_default: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface CreateTemplatePayload {
  name: string;
  body_template: string;
  category?: string;
  header?: string | null;
  signature?: string | null;
  caption_rules?: Record<string, any> | null;
  is_default?: boolean;
}

export interface RenderTemplateResponse {
  success: boolean;
  template_id: string;
  template_name: string;
  rendered_caption: string;
  context_applied: Record<string, string>;
}

export const templatesApi = {
  async listTemplates(category?: string): Promise<CaptionTemplate[]> {
    const searchParams = new URLSearchParams();
    if (category && category !== "ALL") {
      searchParams.append("category", category);
    }
    const res = await fetch(`${API_BASE_URL}/templates?${searchParams.toString()}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Error al obtener plantillas");
    }
    return res.json();
  },

  async createTemplate(payload: CreateTemplatePayload): Promise<CaptionTemplate> {
    const res = await fetch(`${API_BASE_URL}/templates`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Error al crear la plantilla");
    }
    return res.json();
  },

  async updateTemplate(templateId: string, payload: CreateTemplatePayload): Promise<CaptionTemplate> {
    const res = await fetch(`${API_BASE_URL}/templates/${templateId}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Error al actualizar la plantilla");
    }
    return res.json();
  },

  async deleteTemplate(templateId: string): Promise<{ success: boolean; deleted_template_id: string }> {
    const res = await fetch(`${API_BASE_URL}/templates/${templateId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Error al eliminar la plantilla");
    }
    return res.json();
  },

  async renderTemplate(
    templateId: string,
    context?: Record<string, any>
  ): Promise<RenderTemplateResponse> {
    const res = await fetch(`${API_BASE_URL}/templates/${templateId}/render`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ context: context || {}, apply_rules: true }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Error al renderizar plantilla");
    }
    return res.json();
  },
};
