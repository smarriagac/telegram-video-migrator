import React, { useState } from "react";
import { Link2, AtSign, Sparkles, Check, RotateCcw, X } from "lucide-react";
import { useMigrationStore } from "../../application/useMigrationStore";
import { Button } from "@/shared/components/ui/button";
import { Switch } from "@/shared/components/ui/switch";
import { Badge } from "@/shared/components/ui/badge";

interface Props {
  onClose: () => void;
}

export const InlineCaptionRules: React.FC<Props> = ({ onClose }) => {
  const currentRules = useMigrationStore((state) => state.captionRules);
  const setCaptionRules = useMigrationStore((state) => state.setCaptionRules);

  // STRICT ARCHITECTURAL CONSTRAINT: Max 2 useState hooks (only 1 used)
  const [formState, setFormState] = useState<{
    strip_links: boolean;
    strip_all_mentions: boolean;
    oldMention: string;
    newMention: string;
    removeWords: string;
    prependHeader: string;
    appendSignature: string;
    previewText: string;
    savedToast: boolean;
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
      previewText: "🔥 Video exclusivo de prueba https://t.me/enlace_origen @canal_viejo #promo",
      savedToast: false,
    };
  });

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

    setFormState((s) => ({ ...s, savedToast: true }));
    setTimeout(() => {
      setFormState((s) => ({ ...s, savedToast: false }));
    }, 2000);
  };

  const handleReset = () => {
    setFormState((prev) => ({
      ...prev,
      strip_links: false,
      strip_all_mentions: false,
      oldMention: "",
      newMention: "",
      removeWords: "",
      prependHeader: "",
      appendSignature: "",
    }));
  };

  // Compute live preview of transformation
  const computedPreview = (() => {
    let text = formState.previewText;
    if (formState.strip_links) {
      text = text.replace(/https?:\/\/[^\s]+/gi, "").replace(/t\.me\/[^\s]+/gi, "").trim();
    }
    if (formState.strip_all_mentions) {
      text = text.replace(/@[a-zA-Z0-9_]+/gi, "").trim();
    } else if (formState.oldMention && formState.newMention) {
      text = text.replace(new RegExp(formState.oldMention, "gi"), formState.newMention);
    }
    if (formState.prependHeader.trim()) {
      text = `${formState.prependHeader.trim()}\n\n${text}`;
    }
    if (formState.appendSignature.trim()) {
      text = `${text}\n\n${formState.appendSignature.trim()}`;
    }
    return text.trim();
  })();

  return (
    <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden animate-in fade-in flex flex-col text-xs">
      {/* Workbench Header */}
      <div className="px-5 py-3 border-b border-border bg-secondary/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="font-mono text-xs font-semibold text-foreground uppercase tracking-wider">
            Reglas de Caption y Sanitización de Texto
          </span>
          {formState.savedToast && (
            <Badge variant="admin" className="text-[10px] font-mono animate-in fade-in">
              ✓ Guardado
            </Badge>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted transition-colors cursor-pointer"
          title="Cerrar panel de reglas"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Grid: Settings on Left, Live Transformation Simulator on Right */}
      <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Form: Rules Toggles & Fields (7 cols) */}
        <div className="lg:col-span-7 space-y-3.5">
          {/* Toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="p-3 rounded-lg border border-border bg-secondary/40 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <Link2 className="w-3.5 h-3.5 text-primary shrink-0" />
                <div className="min-w-0">
                  <span className="font-medium text-foreground block text-xs">Limpiar URLs</span>
                  <span className="text-[10px] text-muted-foreground block truncate">Borra http, https y t.me</span>
                </div>
              </div>
              <Switch
                checked={formState.strip_links}
                onCheckedChange={(checked) =>
                  setFormState((s) => ({ ...s, strip_links: checked }))
                }
                aria-label="Limpiar URLs"
              />
            </div>

            <div className="p-3 rounded-lg border border-border bg-secondary/40 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <AtSign className="w-3.5 h-3.5 text-primary shrink-0" />
                <div className="min-w-0">
                  <span className="font-medium text-foreground block text-xs">Borrar menciones</span>
                  <span className="text-[10px] text-muted-foreground block truncate">Elimina todos los @usuarios</span>
                </div>
              </div>
              <Switch
                checked={formState.strip_all_mentions}
                onCheckedChange={(checked) =>
                  setFormState((s) => ({ ...s, strip_all_mentions: checked }))
                }
                aria-label="Borrar menciones"
              />
            </div>
          </div>

          {/* Mention Replacement (only if not stripping all) */}
          {!formState.strip_all_mentions && (
            <div className="p-3 rounded-lg border border-border bg-secondary/30 space-y-2">
              <span className="font-medium text-foreground block text-xs">
                Reemplazo de Mención / Canal Origen
              </span>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="@canal_viejo"
                  value={formState.oldMention}
                  onChange={(e) => setFormState((s) => ({ ...s, oldMention: e.target.value }))}
                  className="bg-secondary/60 border border-border rounded px-2.5 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                />
                <input
                  type="text"
                  placeholder="@mi_canal_nuevo"
                  value={formState.newMention}
                  onChange={(e) => setFormState((s) => ({ ...s, newMention: e.target.value }))}
                  className="bg-secondary/60 border border-border rounded px-2.5 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                />
              </div>
            </div>
          )}

          {/* Blacklisted words */}
          <div className="space-y-1">
            <label className="font-medium text-foreground text-xs block">
              Palabras a eliminar (separadas por coma)
            </label>
            <input
              type="text"
              placeholder="promo, descuento, vip gratis..."
              value={formState.removeWords}
              onChange={(e) => setFormState((s) => ({ ...s, removeWords: e.target.value }))}
              className="w-full bg-secondary/60 border border-border rounded px-2.5 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            />
          </div>

          {/* Header & Signature */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-medium text-foreground text-xs block">Encabezado (al inicio)</label>
              <textarea
                rows={2}
                placeholder="🔥 Exclusivo:"
                value={formState.prependHeader}
                onChange={(e) => setFormState((s) => ({ ...s, prependHeader: e.target.value }))}
                className="w-full bg-secondary/60 border border-border rounded p-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
              />
            </div>
            <div className="space-y-1">
              <label className="font-medium text-foreground text-xs block">Firma (al final)</label>
              <textarea
                rows={2}
                placeholder="Canal Oficial: @micanal"
                value={formState.appendSignature}
                onChange={(e) => setFormState((s) => ({ ...s, appendSignature: e.target.value }))}
                className="w-full bg-secondary/60 border border-border rounded p-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
              />
            </div>
          </div>
        </div>

        {/* Right Simulator: Live Transformation Preview (5 cols) */}
        <div className="lg:col-span-5 space-y-2.5 border-t lg:border-t-0 lg:border-l border-border pt-3 lg:pt-0 lg:pl-5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Simulador de Transformación
            </span>
            <Badge variant="outline" className="text-[10px] font-mono">
              En tiempo real
            </Badge>
          </div>

          <div className="space-y-2">
            <div>
              <span className="text-[10px] text-muted-foreground font-mono block mb-1">Texto Original (Ejemplo):</span>
              <input
                type="text"
                value={formState.previewText}
                onChange={(e) => setFormState((s) => ({ ...s, previewText: e.target.value }))}
                className="w-full bg-secondary/40 border border-border rounded px-2.5 py-1 text-xs text-foreground"
              />
            </div>

            <div>
              <span className="text-[10px] text-primary font-mono block mb-1 font-semibold">
                Resultado Sanitizado:
              </span>
              <div className="p-3 rounded-lg bg-secondary/70 border border-border/80 text-xs text-foreground whitespace-pre-wrap font-sans min-h-[90px] select-text">
                {computedPreview || <span className="text-muted-foreground italic">Texto vacío</span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Workbench Footer Actions */}
      <div className="px-5 py-3 border-t border-border bg-secondary/30 flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="text-xs text-muted-foreground hover:text-foreground h-8 gap-1.5"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Restablecer</span>
        </Button>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs h-8 px-3"
          >
            Cerrar
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs h-8 px-4 gap-1.5 shadow-sm cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Aplicar y Guardar Reglas</span>
          </Button>
        </div>
      </div>
    </div>
  );
};
