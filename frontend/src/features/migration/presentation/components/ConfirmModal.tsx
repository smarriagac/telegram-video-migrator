import React from "react";
import { AlertTriangle, ArrowRight, ShieldCheck } from "lucide-react";
import { useMigrationStore } from "../../application/useMigrationStore";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const channels = useMigrationStore((state) => state.channels);
  const selectedSourceId = useMigrationStore((state) => state.selectedSourceId);
  const selectedTargetId = useMigrationStore((state) => state.selectedTargetId);
  const isStarting = useMigrationStore((state) => state.isStartingJob);

  if (!isOpen) return null;

  const sourceChannel = channels.find((c) => c.id === selectedSourceId);
  const targetChannel = channels.find((c) => c.id === selectedTargetId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#14161F] border border-white/10 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">Confirmar Migración</h3>
            <p className="text-xs text-zinc-400">Verificá los canales antes de disparar el proceso</p>
          </div>
        </div>

        {/* Source -> Target representation */}
        <div className="p-4 rounded-2xl bg-zinc-950/80 border border-white/5 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500 font-mono">ORIGEN:</span>
            <span className="text-cyan-400 font-semibold">{sourceChannel?.title || selectedSourceId}</span>
          </div>
          <div className="flex justify-center text-zinc-600">
            <ArrowRight className="w-4 h-4 rotate-90 md:rotate-0" />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500 font-mono">DESTINO:</span>
            <span className="text-emerald-400 font-semibold">{targetChannel?.title || selectedTargetId}</span>
          </div>
        </div>

        {/* Technical safeguards bullet list */}
        <div className="space-y-2 text-xs text-zinc-400">
          <div className="flex items-start space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>Los videos se clonan directamente por referencia interna sin descargar archivos a disco.</span>
          </div>
          <div className="flex items-start space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>Se preservan las descripciones originales, etiquetas y hashtags sin etiqueta de reenvío.</span>
          </div>
          <div className="flex items-start space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>Se aplica un delay seguro de 1.5–2.0s por video para proteger la cuenta contra spam.</span>
          </div>
        </div>

        <div className="flex items-center justify-end space-x-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isStarting}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isStarting}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-black bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 transition-all shadow-lg shadow-emerald-950/50 flex items-center gap-2"
          >
            {isStarting ? "Iniciando..." : "Iniciar Migración"}
          </button>
        </div>
      </div>
    </div>
  );
};
