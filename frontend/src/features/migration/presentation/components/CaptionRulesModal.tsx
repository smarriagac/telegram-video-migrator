import React, { useState } from "react";
import { Link2, AtSign, ShieldAlert, Sparkles, Check } from "lucide-react";
import { useMigrationStore } from "../../application/useMigrationStore";
import { Button } from "@/shared/components/ui/button";
import { Switch } from "@/shared/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/components/ui/dialog";

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
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col p-0 bg-card border-border text-foreground">
        {/* Header */}
        <DialogHeader className="p-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <DialogTitle className="text-sm font-semibold text-foreground">
              Reglas de Caption y Sanitización
            </DialogTitle>
          </div>
        </DialogHeader>

        {/* Form Body */}
        <div className="p-4 overflow-y-auto space-y-4 text-xs text-foreground">
          {/* Toggles */}
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/50 hover:bg-secondary/70 transition-colors">
              <div className="flex items-center gap-2.5">
                <Link2 className="w-4 h-4 text-primary" />
                <div>
                  <div className="font-medium text-foreground">Limpiar enlaces externos</div>
                  <div className="text-[11px] text-muted-foreground">Elimina URLs (http, https, t.me)</div>
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

            <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/50 hover:bg-secondary/70 transition-colors">
              <div className="flex items-center gap-2.5">
                <AtSign className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                <div>
                  <div className="font-medium text-foreground">Eliminar todas las menciones</div>
                  <div className="text-[11px] text-muted-foreground">Quita usernames de terceros (@canal)</div>
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
          <div className="p-3 rounded-lg border border-border bg-secondary/50 space-y-2">
            <div className="font-medium text-foreground flex items-center gap-1.5">
              <AtSign className="w-3.5 h-3.5 text-muted-foreground" /> Reemplazar mención específica
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="@canal_origen"
                value={formState.oldMention}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, oldMention: e.target.value }))
                }
                className="bg-card border border-border rounded px-2.5 py-1.5 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary"
              />
              <input
                type="text"
                placeholder="@mi_canal_destino"
                value={formState.newMention}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, newMention: e.target.value }))
                }
                className="bg-card border border-border rounded px-2.5 py-1.5 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Remove words blacklist */}
          <div className="p-3 rounded-lg border border-border bg-secondary/50 space-y-1.5">
            <div className="font-medium text-foreground flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" /> Palabras prohibidas / Blacklist
            </div>
            <input
              type="text"
              placeholder="apuestas, bono gratis, vip, promo (separar por coma)"
              value={formState.removeWords}
              onChange={(e) =>
                setFormState((prev) => ({ ...prev, removeWords: e.target.value }))
              }
              className="w-full bg-card border border-border rounded px-2.5 py-1.5 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary"
            />
          </div>

          {/* Header & Signature */}
          <div className="space-y-2">
            <div>
              <div className="font-medium text-foreground mb-1">Encabezado (arriba de cada post)</div>
              <input
                type="text"
                placeholder="Ej: 🎬 ¡Estreno exclusivo!"
                value={formState.prependHeader}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, prependHeader: e.target.value }))
                }
                className="w-full bg-card border border-border rounded px-2.5 py-1.5 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <div className="font-medium text-foreground mb-1">Firma / Footer (al final de cada post)</div>
              <textarea
                rows={2}
                placeholder="Ej: Únete a nuestro canal oficial: @mi_canal"
                value={formState.appendSignature}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, appendSignature: e.target.value }))
                }
                className="w-full bg-card border border-border rounded px-2.5 py-1.5 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary resize-none"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="p-3 border-t border-border flex flex-row items-center justify-between bg-muted/30 sm:justify-between shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Restablecer
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs border-border bg-secondary text-secondary-foreground hover:bg-muted"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold flex items-center gap-1.5 shadow-sm"
            >
              <Check className="w-3.5 h-3.5" /> Guardar Reglas
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
