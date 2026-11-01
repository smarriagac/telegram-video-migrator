export interface AuditLogItem {
  id: number;
  user_id: number | null;
  user_email: string | null;
  action: string;
  resource: string | null;
  details: Record<string, any> | null;
  ip_address: string | null;
  created_at: string | null;
}
