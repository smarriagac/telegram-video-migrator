import React, { useState, useRef } from "react";
import {
  UploadCloud,
  FileVideo,
  FileImage,
  FileText,
  X,
  Loader2,
  CheckCircle2,
  ArrowRight,
  Tv,
} from "lucide-react";
import { useMigrationStore } from "../../application/useMigrationStore";
import { migrationApi } from "../../infrastructure/migrationApi";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  targetChannelId: number | null;
  targetChannelTitle?: string;
  onUploadSuccess?: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export const DirectUploadModal: React.FC<Props> = ({
  isOpen,
  onClose,
  targetChannelId,
  targetChannelTitle,
  onUploadSuccess,
}) => {
  const addLog = useMigrationStore((state) => state.addLog);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [caption, setCaption] = useState<string>("");
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setError(null);
      setSuccessMsg(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
      setError(null);
      setSuccessMsg(null);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetChannelId) {
      setError("No se ha seleccionado un canal de destino.");
      return;
    }
    if (!selectedFile && !caption.trim()) {
      setError("Seleccioná un archivo o escribí un texto para publicar.");
      return;
    }

    setIsUploading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await migrationApi.uploadToChannel(
        targetChannelId,
        selectedFile,
        caption,
        caption
      );
      setSuccessMsg(`¡Contenido publicado con éxito! (Mensaje #${res.id})`);
      addLog(`Subida local completada con éxito: Mensaje #${res.id} en ${targetChannelTitle || targetChannelId}`, "success");
      setSelectedFile(null);
      setCaption("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (onUploadSuccess) onUploadSuccess();
    } catch (err: any) {
      setError(err.message || "Error al subir el archivo.");
      addLog(`Error al subir archivo local: ${err.message}`, "error");
    } finally {
      setIsUploading(false);
    }
  };

  const getFileIcon = (mime: string) => {
    if (mime.startsWith("video/")) return <FileVideo className="w-8 h-8 text-purple-400" />;
    if (mime.startsWith("image/")) return <FileImage className="w-8 h-8 text-cyan-400" />;
    return <FileText className="w-8 h-8 text-amber-400" />;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isUploading && onClose()}>
      <DialogContent className="max-w-lg bg-card border border-border p-6 space-y-4 shadow-xl">
        {/* Header */}
        <DialogHeader>
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-foreground">
                Publicar Contenido Local en Telegram
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Subí videos, fotos o documentos desde tu computadora directamente al canal sin pasar por clonación.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Target Channel Pill */}
        <div className="p-2.5 rounded-lg bg-secondary/60 border border-border flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold text-[11px] uppercase">
              Canal Destino:
            </span>
            <span className="text-foreground font-medium font-mono">
              {targetChannelTitle || (targetChannelId ? `#${targetChannelId}` : "Sin seleccionar")}
            </span>
          </div>
          <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-mono flex items-center gap-1">
            <Tv className="w-3 h-3" /> Publicación Directa
          </span>
        </div>

        {/* Success Banner */}
        {successMsg && (
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <X className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* File Drag and Drop Zone */}
          <div>
            <label className="text-xs font-semibold text-foreground block mb-1.5 font-mono">
              Archivo Multimedia (Video, Foto o Documento):
            </label>

            {!selectedFile ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-md p-6 text-center cursor-pointer transition-colors flex flex-col items-center justify-center space-y-2 ${
                  isDragging
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/40 bg-secondary/30 hover:bg-secondary/60"
                }`}
              >
                <div className="w-10 h-10 rounded-md bg-secondary border border-border flex items-center justify-center text-muted-foreground group-hover:text-primary">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">
                    Hacé click para buscar o arrastrá tu archivo aquí
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                    Soporta MP4, MKV, MOV, JPG, PNG, WEBP, PDF y más
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-md bg-secondary/50 border border-primary/30 flex items-center justify-between gap-3 shadow-md">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-secondary border border-border shrink-0">
                    {getFileIcon(selectedFile.type)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate font-mono">
                      {selectedFile.name}
                    </p>
                    <p className="text-[10px] font-mono text-primary mt-0.5">
                      {formatBytes(selectedFile.size)} · {selectedFile.type || "Archivo"}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleRemoveFile}
                  disabled={isUploading}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                  title="Eliminar archivo seleccionado"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Caption / Text Area */}
          <div>
            <label className="text-xs font-semibold text-foreground block mb-1 font-mono">
              Descripción / Caption del mensaje (Opcional si hay archivo):
            </label>
            <textarea
              rows={3}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Escribí el texto, emojis, hashtags o descripción que acompañará la publicación..."
              className="w-full bg-secondary/50 border border-border rounded-md p-2.5 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary resize-none font-sans"
              disabled={isUploading}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={isUploading}
              className="h-9 text-xs text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </Button>

            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isUploading || (!selectedFile && !caption.trim()) || !targetChannelId}
              className="h-9 px-5 text-xs flex items-center gap-1.5"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  Subiendo y publicando...
                </>
              ) : (
                <>
                  <UploadCloud className="w-3.5 h-3.5 mr-1" />
                  Publicar en Canal
                  <ArrowRight className="w-3 h-3 ml-1" />
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
