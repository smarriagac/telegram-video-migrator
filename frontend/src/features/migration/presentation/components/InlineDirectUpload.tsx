import React, { useState, useRef } from "react";
import { UploadCloud, FileVideo, FileImage, X, Loader2, CheckCircle2 } from "lucide-react";
import { useMigrationStore } from "../../application/useMigrationStore";
import { migrationApi } from "../../infrastructure/migrationApi";
import { Button } from "@/shared/components/ui/button";

interface Props {
  targetChannelId: number | null;
  targetChannelTitle?: string;
  onClose: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export const InlineDirectUpload: React.FC<Props> = ({
  targetChannelId,
  targetChannelTitle,
  onClose,
}) => {
  const addLog = useMigrationStore((state) => state.addLog);

  // STRICT ARCHITECTURAL CONSTRAINT: Max 2 useState hooks (only 1 used)
  const [uploadState, setUploadState] = useState<{
    file: File | null;
    caption: string;
    isUploading: boolean;
    error: string | null;
    successMsg: string | null;
    isDragging: boolean;
  }>({
    file: null,
    caption: "",
    isUploading: false,
    error: null,
    successMsg: null,
    isDragging: false,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadState((s) => ({
        ...s,
        file: e.target.files![0],
        error: null,
        successMsg: null,
      }));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setUploadState((s) => ({ ...s, isDragging: false }));
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setUploadState((s) => ({
        ...s,
        file: e.dataTransfer.files[0],
        error: null,
        successMsg: null,
      }));
    }
  };

  const handleUpload = async () => {
    if (!targetChannelId) {
      setUploadState((s) => ({ ...s, error: "Seleccioná un canal de destino primero." }));
      return;
    }
    if (!uploadState.file && !uploadState.caption.trim()) {
      setUploadState((s) => ({ ...s, error: "Seleccioná un archivo o escribí un mensaje." }));
      return;
    }

    setUploadState((s) => ({ ...s, isUploading: true, error: null, successMsg: null }));
    try {
      const res = await migrationApi.uploadToChannel(
        targetChannelId,
        uploadState.file,
        uploadState.caption.trim()
      );
      setUploadState((s) => ({
        ...s,
        isUploading: false,
        file: null,
        caption: "",
        successMsg: `¡Publicado con éxito en ${targetChannelTitle || targetChannelId}! (Mensaje #${res.id})`,
      }));
      addLog(`Subida directa completada: Mensaje #${res.id} en ${targetChannelTitle}`, "success");
    } catch (err: any) {
      setUploadState((s) => ({
        ...s,
        isUploading: false,
        error: err.message || "Error al subir archivo al canal.",
      }));
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden animate-in fade-in flex flex-col text-xs">
      {/* Workbench Header */}
      <div className="px-5 py-3 border-b border-border bg-secondary/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UploadCloud className="w-4 h-4 text-primary" />
          <span className="font-mono text-xs font-semibold text-foreground uppercase tracking-wider">
            Publicación Directa desde tu PC a:
          </span>
          <span className="text-xs font-bold text-foreground">
            {targetChannelTitle || `#${targetChannelId}`}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted transition-colors cursor-pointer"
          title="Cerrar panel de subida"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-5 space-y-4">
        {uploadState.error && (
          <div className="p-2.5 rounded bg-destructive/10 border border-destructive/20 text-destructive text-xs font-mono">
            {uploadState.error}
          </div>
        )}

        {uploadState.successMsg && (
          <div className="p-2.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{uploadState.successMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Drag and Drop Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setUploadState((s) => ({ ...s, isDragging: true }));
            }}
            onDragLeave={() => setUploadState((s) => ({ ...s, isDragging: false }))}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
              uploadState.isDragging
                ? "border-primary bg-primary/10"
                : uploadState.file
                ? "border-emerald-500/40 bg-emerald-500/5"
                : "border-border hover:border-primary/50 bg-secondary/20"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              accept="video/*,image/*,.mp4,.mov,.mkv,.avi,.webm,.jpg,.png"
              className="hidden"
            />
            {uploadState.file ? (
              <div className="space-y-1.5">
                <div className="w-10 h-10 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center mx-auto">
                  {uploadState.file.type.startsWith("video/") ? (
                    <FileVideo className="w-5 h-5" />
                  ) : (
                    <FileImage className="w-5 h-5" />
                  )}
                </div>
                <span className="font-semibold text-foreground text-xs block truncate max-w-xs">
                  {uploadState.file.name}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono block">
                  {formatBytes(uploadState.file.size)}
                </span>
              </div>
            ) : (
              <div className="space-y-1 text-muted-foreground">
                <UploadCloud className="w-8 h-8 mx-auto text-primary/60 mb-2" />
                <span className="font-medium text-foreground text-xs block">
                  Hacé click o arrastrá un video o foto aquí
                </span>
                <span className="text-[10px] block">
                  Soporta MP4, MKV, AVI, JPG, PNG de cualquier tamaño
                </span>
              </div>
            )}
          </div>

          {/* Caption & Submit */}
          <div className="space-y-3 flex flex-col justify-between">
            <div className="space-y-1">
              <label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground block font-semibold">
                Texto / Descripción del mensaje
              </label>
              <textarea
                rows={4}
                value={uploadState.caption}
                onChange={(e) => setUploadState((s) => ({ ...s, caption: e.target.value }))}
                placeholder="Escribí un texto o mensaje para acompañar la publicación en el canal destino..."
                className="w-full bg-secondary/60 border border-border rounded-lg p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
              />
            </div>

            <Button
              type="button"
              onClick={handleUpload}
              disabled={uploadState.isUploading || (!uploadState.file && !uploadState.caption.trim())}
              className="w-full h-9 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs gap-1.5 shadow-sm cursor-pointer"
            >
              {uploadState.isUploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Subiendo al canal de Telegram...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Publicar Directamente en Destino</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
