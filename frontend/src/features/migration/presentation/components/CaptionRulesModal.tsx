import React, { useState } from "react";
import { Link2, AtSign, ShieldAlert, Sparkles, X, Check } from "lucide-react";
import { useMigrationStore } from "../../application/useMigrationStore";
import { Button } from "@/shared/components/ui/button";
import { Switch } from "@/shared/components/ui/switch";

interface CaptionRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CaptionRulesModal: React.FC<CaptionRulesModalProps> = ({
  isOpen,
  onClose,
}) => {
  const currentRules = useMigrationStore((state) => state.captionRules);
  const setCaptionRules = useMigrationStore((state) => state.setCaptionRules);

  const [formState, setFormState] = useState<{
    strip_links: boolean;
    strip_all_mentions: boolean;
    oldMention: string;
    newMention: string;
    removeWords: string;
    prependHeader: string;
    appendSignature: string;
  }>(() => {
    const mentions = currentRules.replace_mentions || {};
    const firstKey = Object.keys(mentions)[0] || "";
    return {
      strip_links: currentRules.strip_links ?? false,
      strip_all_mentions: currentRules.strip_all_mentions ?? false,
      oldMention: firstKey,
      newMention: mentions[firstKey] || "",
      removeWords: (currentRules.remove_words || []).join(", "),
      prependHeader: currentRules.prepend_header || "",
      appendSignature: currentRules.append_signature || "",
    };
  });

  if (!isOpen) return null;

  const handleSave = () => {
    const replaceMap: Record<string, string> = {};
    if (formState.oldMention.trim() && formState.newMention.trim()) {
      const src = formState.oldMention.trim().startsWith("@")
        ? formState.oldMention.trim()
        : `@${formState.oldMention.trim()}`;
      const tgt = formState.newMention.trim().startsWith("@")
        ? formState.newMention.trim()
        : `@${formState.newMention.trim()}`;
      replaceMap[src] = tgt;
    }

    const words = formState.removeWords
      .split(",")
      .map((w) => w.trim())
      .filter(Boolean);

    setCaptionRules({
      strip_links: formState.strip_links,
      strip_all_mentions: formState.strip_all_mentions,
      replace_mentions: Object.keys(replaceMap).length > 0 ? replaceMap : undefined,
      remove_words: words.length > 0 ? words : undefined,
      prepend_header: formState.prependHeader.trim() || null,
      append_signature: formState.appendSignature.trim() || null,
    });
    onClose();
  };

  const handleReset = () => {
    setFormState({
      strip_links: false,
      strip_all_mentions: false,
      oldMention: "",
      newMention: "",
      removeWords: "",
      prependHeader: "",
      appendSignature: "",
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#12141a] border border-zinc-800 rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-zinc-100">
              Reglas de Caption y Sanitización
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 p-1 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-4 overflow-y-auto space-y-4 text-xs text-zinc-300">
          {/* Toggles */}
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 rounded-lg border border-zinc-800/80 bg-zinc-900/40 hover:border-zinc-700 transition-colors">
              <div className="flex items-center gap-2.5">
                <Link2 className="w-4 h-4 text-sky-400" />
                <div>
                  <div className="font-medium text-zinc-200">Limpiar enlaces externos</div>
                  <div className="text-[11px] text-zinc-400">Elimina URLs (http, https, t.me)</div>
                </div>
              </div>
              <Switch
                checked={formState.strip_links}
                onCheckedChange={(checked) =>
                  setFormState((prev) => ({ ...prev, strip_links: checked }))
                }
                aria-label="Limpiar enlaces externos"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-zinc-800/80 bg-zinc-900/40 hover:border-zinc-700 transition-colors">
              <div className="flex items-center gap-2.5">
                <AtSign className="w-4 h-4 text-amber-400" />
                <div>
                  <div className="font-medium text-zinc-200">Eliminar todas las menciones</div>
                  <div className="text-[11px] text-zinc-400">Quita usernames de terceros (@canal)</div>
                </div>
              </div>
              <Switch
                checked={formState.strip_all_mentions}
                onCheckedChange={(checked) =>
                  setFormState((prev) => ({ ...prev, strip_all_mentions: checked }))
                }
                aria-label="Eliminar todas las menciones"
              />
            </div>
          </div>

          {/* Replace mention */}
          <div className="p-3 rounded-lg border border-zinc-800/80 bg-zinc-900/40 space-y-2">
            <div className="font-medium text-zinc-200 flex items-center gap-1.5">
              <AtSign className="w-3.5 h-3.5 text-zinc-400" /> Reemplazar mención específica
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="@canal_origen"
                value={formState.oldMention}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, oldMention: e.target.value }))
                }
                className="bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50"
              />
              <input
                type="text"
                placeholder="@mi_canal_destino"
                value={formState.newMention}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, newMention: e.target.value }))
                }
                className="bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50"
              />
            </div>
          </div>

          {/* Remove words blacklist */}
          <div className="p-3 rounded-lg border border-zinc-800/80 bg-zinc-900/40 space-y-1.5">
            <div className="font-medium text-zinc-200 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" /> Palabras prohibidas / Blacklist
            </div>
            <input
              type="text"
              placeholder="apuestas, bono gratis, vip, promo (separar por coma)"
              value={formState.removeWords}
              onChange={(e) =>
                setFormState((prev) => ({ ...prev, removeWords: e.target.value }))
              }
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          {/* Header & Signature */}
          <div className="space-y-2">
            <div>
              <div className="font-medium text-zinc-200 mb-1">Encabezado (arriba de cada post)</div>
              <input
                type="text"
                placeholder="Ej: 🎬 ¡Estreno exclusivo!"
                value={formState.prependHeader}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, prependHeader: e.target.value }))
                }
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50"
              />
            </div>

            <div>
              <div className="font-medium text-zinc-200 mb-1">Firma / Footer (al final de cada post)</div>
              <textarea
                rows={2}
                placeholder="Ej: Únete a nuestro canal oficial: @mi_canal"
                value={formState.appendSignature}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, appendSignature: e.target.value }))
                }
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 resize-none"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-zinc-800 flex items-center justify-between bg-zinc-950/40">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-xs text-zinc-400 hover:text-zinc-200"
          >
            Restablecer
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs border-zinc-800 text-zinc-300 hover:bg-zinc-800"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" /> Guardar Reglas
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
