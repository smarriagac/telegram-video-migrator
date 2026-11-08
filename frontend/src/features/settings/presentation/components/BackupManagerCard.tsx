import React, { useEffect, useState } from "react";
import {
  Database,
  Download,
  ShieldCheck,
  Trash2,
  RefreshCw,
  HardDrive,
  Layers,
  AlertCircle,
  CheckCircle2,
  Archive,
  Clock,
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/shared/components/ui/table";
import { ConfirmDialog } from "@/shared/components/ui/confirm-dialog";
import {
  backupsApi,
  BackupMetadata,
  VerifyBackupResponse,
} from "../../infrastructure/backupsApi";
import { cn } from "@/shared/lib/utils";

export const BackupManagerCard: React.FC = () => {
  // STRICT ARCHITECTURAL CONSTRAINT: At most 2 useState hooks
  // Hook 1: Snapshots list
  const [backups, setBackups] = useState<BackupMetadata[]>([]);
  // Hook 2: Consolidated UI state (loading, creating, verifying, feedback, stats, dialogs)
  const [state, setState] = useState<{
    isLoading: boolean;
    isCreating: boolean;
    verifyingId: string | null;
    verifyResult: VerifyBackupResponse | null;
    feedback: { message: string; isError?: boolean } | null;
    totalSizeBytes: number;
    retentionLimit: number;
    confirmDeleteId: string | null;
  }>({
    isLoading: true,
    isCreating: false,
    verifyingId: null,
    verifyResult: null,
    feedback: null,
    totalSizeBytes: 0,
    retentionLimit: 7,
    confirmDeleteId: null,
  });

  const showFeedback = (message: string, isError = false) => {
    setState((prev) => ({ ...prev, feedback: { message, isError } }));
    setTimeout(() => {
      setState((prev) => ({ ...prev, feedback: null }));
    }, 4000);
  };

  const loadBackups = async () => {
    setState((prev) => ({ ...prev, isLoading: true }));
    try {
      const data = await backupsApi.listBackups();
      setBackups(data.snapshots || []);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        totalSizeBytes: data.total_size_bytes || 0,
        retentionLimit: data.retention_limit || 7,
      }));
    } catch (err: any) {
      setState((prev) => ({ ...prev, isLoading: false }));
      showFeedback(err.message || "Error al cargar copias de seguridad", true);
    }
  };

  useEffect(() => {
    loadBackups();
  }, []);

  const handleCreateBackup = async () => {
    setState((prev) => ({ ...prev, isCreating: true }));
    try {
      const newBackup = await backupsApi.createBackup({ trigger: "MANUAL" });
      setBackups((prev) => [newBackup, ...prev]);
      setState((prev) => ({
        ...prev,
        isCreating: false,
        totalSizeBytes: prev.totalSizeBytes + newBackup.size_bytes,
      }));
      showFeedback(`Snapshot ${newBackup.snapshot_id} generado correctamente.`);
    } catch (err: any) {
      setState((prev) => ({ ...prev, isCreating: false }));
      showFeedback(err.message || "Error al generar la copia de seguridad", true);
    }
  };

  const handleVerify = async (snapshotId: string) => {
    setState((prev) => ({ ...prev, verifyingId: snapshotId, verifyResult: null }));
    try {
      const res = await backupsApi.verifyBackup(snapshotId);
      setState((prev) => ({ ...prev, verifyingId: null, verifyResult: res }));
      showFeedback(`Snapshot verificado: Archivo íntegro (${res.size_bytes ? Math.round(res.size_bytes / 1024) : 0} KB).`);
    } catch (err: any) {
      setState((prev) => ({ ...prev, verifyingId: null }));
      showFeedback(err.message || "Fallo en la verificación del respaldo", true);
    }
  };

  const handleDelete = async () => {
    if (!state.confirmDeleteId) return;
    const targetId = state.confirmDeleteId;
    setState((prev) => ({ ...prev, confirmDeleteId: null }));
    try {
      await backupsApi.deleteBackup(targetId);
      setBackups((prev) => prev.filter((b) => b.snapshot_id !== targetId));
      showFeedback("Copia de seguridad eliminada con éxito.");
    } catch (err: any) {
      showFeedback(err.message || "Error al eliminar la copia de seguridad", true);
    }
  };

  const handleDownload = (snapshotId: string) => {
    const token =
      localStorage.getItem("telegram_hub_token") ||
      localStorage.getItem("auth_token") ||
      localStorage.getItem("token");
    const url = backupsApi.getDownloadUrl(snapshotId);

    // Fetch as blob to attach auth header
    fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => {
        if (!res.ok) throw new Error("Error al descargar el archivo");
        return res.blob();
      })
      .then((blob) => {
        const link = document.createElement("a");
        link.href = window.URL.createObjectURL(blob);
        link.download = `${snapshotId}.tar.gz`;
        document.body.appendChild(link);
        link.click();
        link.remove();
      })
      .catch((err) => {
        showFeedback(err.message || "Error en la descarga", true);
      });
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Feedback banner */}
      {state.feedback && (
        <div
          data-testid="feedback-banner"
          className={cn(
            "p-3.5 rounded-lg border text-xs font-medium flex items-center justify-between shadow-sm animate-in fade-in duration-200",
            state.feedback.isError
              ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
              : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
          )}
        >
          <div className="flex items-center space-x-2">
            {state.feedback.isError ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            <span>{state.feedback.message}</span>
          </div>
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg bg-card border border-border shadow-sm flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
            <Archive className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-medium text-muted-foreground block uppercase tracking-wider">
              Snapshots Activos
            </span>
            <div className="flex items-baseline space-x-2">
              <span className="text-xl font-bold text-foreground">
                {backups.length}
              </span>
              <span className="text-xs text-muted-foreground">
                / {state.retentionLimit} máx. rotación
              </span>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-lg bg-card border border-border shadow-sm flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-medium text-muted-foreground block uppercase tracking-wider">
              Almacenamiento Usado
            </span>
            <span className="text-xl font-bold text-foreground block">
              {formatBytes(state.totalSizeBytes)}
            </span>
          </div>
        </div>

        <div className="p-4 rounded-lg bg-card border border-border shadow-sm flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-medium text-muted-foreground block uppercase tracking-wider">
              Política de Retención
            </span>
            <span className="text-xs font-semibold text-foreground block">
              Últimos {state.retentionLimit} snapshots
            </span>
            <span className="text-[11px] text-muted-foreground block">
              Auto-purga los respaldos antiguos
            </span>
          </div>
        </div>
      </div>

      {/* Snapshot Verification Details Box if active */}
      {state.verifyResult && (
        <div className="p-4 rounded-lg bg-emerald-950/20 border border-emerald-500/30 text-xs space-y-2">
          <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
            <div className="flex items-center space-x-2 text-emerald-400 font-semibold">
              <ShieldCheck className="w-4 h-4" />
              <span>Verificación de Integridad Exitosa: {state.verifyResult.snapshot_id}</span>
            </div>
            <button
              onClick={() => setState((prev) => ({ ...prev, verifyResult: null }))}
              className="text-muted-foreground hover:text-foreground text-[11px]"
            >
              Cerrar
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px] text-muted-foreground">
            <div>
              <span className="block text-foreground font-medium">Checksum SHA256:</span>
              <span className="font-mono text-[10px] break-all">{state.verifyResult.sha256?.substring(0, 24)}...</span>
            </div>
            <div>
              <span className="block text-foreground font-medium">Dumping PostgreSQL:</span>
              <span className="text-emerald-400">Presente (tables.json)</span>
            </div>
            <div>
              <span className="block text-foreground font-medium">SQLite DB:</span>
              <span>{state.verifyResult.has_sqlite_db ? "Empaquetada" : "Omitida (Postgres único)"}</span>
            </div>
            <div>
              <span className="block text-foreground font-medium">Total Registros:</span>
              <span className="text-foreground font-semibold">
                {state.verifyResult.manifest?.total_records ?? 0}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Action header & Snapshots Table */}
      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Copias de Seguridad (Disaster Recovery)
              </h3>
              <p className="text-xs text-muted-foreground">
                Snapshots completos de base de datos comprimidos (.tar.gz) listos para contingencias.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadBackups}
              disabled={state.isLoading}
              className="h-8 text-xs flex items-center gap-1.5"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", state.isLoading && "animate-spin")} />
              <span>Actualizar</span>
            </Button>
            <Button
              size="sm"
              onClick={handleCreateBackup}
              disabled={state.isCreating}
              className="h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-1.5"
            >
              {state.isCreating ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Archive className="w-3.5 h-3.5" />
              )}
              <span>{state.isCreating ? "Generando..." : "Crear Snapshot Ahora"}</span>
            </Button>
          </div>
        </div>

        {/* Table Content */}
        {state.isLoading && backups.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground flex flex-col items-center justify-center space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin text-primary" />
            <span>Cargando catálogo de copias de seguridad...</span>
          </div>
        ) : backups.length === 0 ? (
          <div className="p-12 text-center text-xs text-muted-foreground flex flex-col items-center justify-center space-y-2">
            <Database className="w-8 h-8 text-muted-foreground/40 mb-1" />
            <span className="font-medium text-foreground">No hay copias de seguridad registradas</span>
            <p className="max-w-xs text-muted-foreground text-[11px]">
              Creá tu primer snapshot manual de base de datos para habilitar la recuperación ante desastres.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-semibold">Identificador / Archivo</TableHead>
                  <TableHead className="text-xs font-semibold">Fecha</TableHead>
                  <TableHead className="text-xs font-semibold">Origen</TableHead>
                  <TableHead className="text-xs font-semibold">Tamaño</TableHead>
                  <TableHead className="text-xs font-semibold">Registros</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {backups.map((b) => (
                  <TableRow key={b.snapshot_id} className="text-xs">
                    <TableCell className="font-mono font-medium text-foreground py-3">
                      <div className="flex items-center space-x-2">
                        <Layers className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="truncate max-w-[220px]" title={b.snapshot_id}>
                          {b.snapshot_id}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {new Date(b.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] px-1.5 py-0.5",
                          b.trigger === "MANUAL"
                            ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                            : "bg-purple-500/10 text-purple-400 border-purple-500/30"
                        )}
                      >
                        {b.trigger}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold text-foreground whitespace-nowrap">
                      {formatBytes(b.size_bytes)}
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {b.total_records ?? "-"}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <div className="flex items-center justify-end space-x-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleVerify(b.snapshot_id)}
                          disabled={state.verifyingId === b.snapshot_id}
                          title="Verificar integridad del archivo"
                          className="h-7 px-2 text-xs text-muted-foreground hover:text-emerald-400"
                        >
                          <ShieldCheck
                            className={cn(
                              "w-3.5 h-3.5",
                              state.verifyingId === b.snapshot_id && "animate-pulse text-emerald-400"
                            )}
                          />
                          <span className="ml-1 hidden sm:inline">Verificar</span>
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(b.snapshot_id)}
                          title="Descargar archivo .tar.gz"
                          className="h-7 px-2 text-xs text-muted-foreground hover:text-primary"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span className="ml-1 hidden sm:inline">Descargar</span>
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setState((prev) => ({
                              ...prev,
                              confirmDeleteId: b.snapshot_id,
                            }))
                          }
                          title="Eliminar snapshot"
                          className="h-7 px-2 text-xs text-muted-foreground hover:text-rose-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      {state.confirmDeleteId && (
        <ConfirmDialog
          isOpen={true}
          onClose={() => setState((prev) => ({ ...prev, confirmDeleteId: null }))}
          onConfirm={handleDelete}
          title="¿Eliminar copia de seguridad?"
          description={`Esta acción eliminará permanentemente el archivo comprimido '${state.confirmDeleteId}.tar.gz' del disco.`}
          confirmLabel="Eliminar Definitivamente"
          variant="destructive"
        />
      )}
    </div>
  );
};
