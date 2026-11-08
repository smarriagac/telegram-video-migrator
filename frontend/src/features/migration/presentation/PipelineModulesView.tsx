import React, { useState } from "react";
import {
  Sparkles,
  Clock,
  ShieldCheck,
  Link2,
  AtSign,
  ShieldAlert,
  Check,
  Eye,
  Sliders,
  Filter,
  Film,
  FileText,
  Image,
  Play,
} from "lucide-react";
import { useMigrationStore } from "../application/useMigrationStore";
import { RulesPlaygroundCard } from "./components/RulesPlaygroundCard";
import { TemplateManagerModal } from "./components/TemplateManagerModal";
import { CaptionTemplate } from "../infrastructure/templatesApi";
import { Switch } from "@/shared/components/ui/switch";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { ViewHeader } from "@/shared/components/ViewHeader";
import { cn } from "@/shared/lib/utils";

export const PipelineModulesView: React.FC = () => {
  // STRICT ARCHITECTURAL CONSTRAINT: Max 2 useState hooks
  const [uiState, setUiState] = useState<{
    activeTab: "captions" | "drip" | "dedup" | "quality" | "playground";
    isTemplateModalOpen: boolean;
    appliedTemplateName: string | null;
  }>({
    activeTab: "captions",
    isTemplateModalOpen: false,
    appliedTemplateName: null,
  });
  const [testText, setTestText] = useState<string>(
    "¡Nuevo estreno en https://t.me/canal_spam! Sigan a @canal_spam para ganar bono gratis VIP."
  );

  const activeTab = uiState.activeTab;
  const setActiveTab = (tab: "captions" | "drip" | "dedup" | "quality" | "playground") =>
    setUiState((prev) => ({ ...prev, activeTab: tab }));

  const captionRules = useMigrationStore((state) => state.captionRules);
  const setCaptionRules = useMigrationStore((state) => state.setCaptionRules);
  const dripDelaySeconds = useMigrationStore((state) => state.dripDelaySeconds);
  const setDripDelaySeconds = useMigrationStore((state) => state.setDripDelaySeconds);
  const mediaFilterRules = useMigrationStore((state) => state.mediaFilterRules);
  const setMediaFilterRules = useMigrationStore((state) => state.setMediaFilterRules);

  // Client-side preview of caption sanitization
  const computePreview = (raw: string): string => {
    let out = raw;
    if (captionRules.strip_links) {
      out = out.replace(/https?:\/\/[^\s]+|t\.me\/[^\s]+/gi, "");
    }
    if (captionRules.replace_mentions) {
      for (const [oldM, newM] of Object.entries(captionRules.replace_mentions)) {
        out = out.split(oldM).join(newM);
      }
    }
    if (captionRules.strip_all_mentions) {
      out = out.replace(/@[a-zA-Z0-9_]{3,32}/g, "");
    }
    if (captionRules.remove_words && captionRules.remove_words.length > 0) {
      for (const word of captionRules.remove_words) {
        if (!word.trim()) continue;
        const reg = new RegExp(word.trim(), "gi");
        out = out.replace(reg, "");
      }
    }
    out = out.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    if (captionRules.prepend_header) {
      out = `${captionRules.prepend_header.trim()}\n\n${out}`;
    }
    if (captionRules.append_signature) {
      out = `${out}\n\n${captionRules.append_signature.trim()}`;
    }
    return out.trim();
  };

  const previewResult = computePreview(testText);

  const handleApplyTemplate = (tpl: CaptionTemplate) => {
    setCaptionRules({
      prepend_header: tpl.header,
      append_signature: tpl.signature,
      ...(tpl.caption_rules || {}),
    });
    if (tpl.body_template) {
      setTestText(tpl.body_template);
    }
    setUiState((prev) => ({
      ...prev,
      isTemplateModalOpen: false,
      appliedTemplateName: tpl.name,
    }));
  };

  return (
    <div className="w-full h-full flex flex-col space-y-3 sm:space-y-4 min-h-0 overflow-y-auto pr-0 sm:pr-1">
      {/* Header */}
      <ViewHeader
        icon={<Sliders className="w-4 h-4" />}
        iconBoxColor="cyan"
        title="Pipeline & Módulos de Procesamiento"
        subtitle="Configuración global de los motores del pipeline: Sanitización de texto, Goteo programado, Duplicate Guard y Filtros de Calidad."
      >

        {/* Tab Switcher: 2x2 grid on mobile (< 640px), inline row on >= 640px */}
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-1 p-0.5 sm:p-1 rounded-lg bg-secondary/60 border border-border w-full sm:w-auto shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("captions")}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center justify-center sm:justify-start gap-1.5 text-center",
              activeTab === "captions"
                ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50 font-medium"
            )}
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>Captions</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("drip")}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center justify-center sm:justify-start gap-1.5 text-center",
              activeTab === "drip"
                ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50 font-medium"
            )}
          >
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>Drip Feed</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("dedup")}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center justify-center sm:justify-start gap-1.5 text-center",
              activeTab === "dedup"
                ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50 font-medium"
            )}
          >
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden xs:inline">Duplicate Guard</span>
            <span className="xs:hidden">Dedup</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("quality")}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center justify-center sm:justify-start gap-1.5 text-center",
              activeTab === "quality"
                ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50 font-medium"
            )}
          >
            <Filter className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden xs:inline">Filtros Calidad</span>
            <span className="xs:hidden">Calidad</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("playground")}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center justify-center sm:justify-start gap-1.5 text-center",
              activeTab === "playground"
                ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50 font-medium"
            )}
          >
            <Play className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden xs:inline">Simulador / Playground</span>
            <span className="xs:hidden">Simulador</span>
          </button>
        </div>
      </ViewHeader>

      {/* Module 1: Caption Transformation Pipeline */}
      {activeTab === "captions" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Left: Rules Configuration Form */}
            <div className="lg:col-span-7 bg-card border border-border rounded-md p-3.5 sm:p-4 space-y-3.5 sm:space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <span className="text-xs font-semibold text-foreground font-mono uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" /> Reglas de Sanitización
                </span>
                <button
                  type="button"
                  onClick={() => setUiState((prev) => ({ ...prev, isTemplateModalOpen: true }))}
                  className="h-7 px-2.5 rounded bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Plantillas Guardadas</span>
                </button>
              </div>

              {uiState.appliedTemplateName && (
                <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-between text-xs text-primary font-mono">
                  <div className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" />
                    <span>Plantilla activa: <strong>{uiState.appliedTemplateName}</strong></span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUiState((prev) => ({ ...prev, appliedTemplateName: null }))}
                    className="text-[10px] text-muted-foreground hover:text-foreground underline"
                  >
                    Descartar
                  </button>
                </div>
              )}

              {/* Toggles */}
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/50 hover:bg-secondary/70 transition-colors gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Link2 className="w-4 h-4 text-primary shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium text-xs text-foreground">Limpiar enlaces externos (URLs)</div>
                      <div className="text-[11px] text-muted-foreground truncate sm:whitespace-normal">Elimina enlaces web (http, https y t.me/...)</div>
                    </div>
                  </div>
                  <Switch
                    checked={Boolean(captionRules.strip_links)}
                    onCheckedChange={(checked) => setCaptionRules({ strip_links: checked })}
                    aria-label="Limpiar enlaces externos"
                    className="shrink-0"
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/50 hover:bg-secondary/70 transition-colors gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <AtSign className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium text-xs text-foreground">Eliminar todas las menciones</div>
                      <div className="text-[11px] text-muted-foreground truncate sm:whitespace-normal">Quita cualquier username de spam (@usuario)</div>
                    </div>
                  </div>
                  <Switch
                    checked={Boolean(captionRules.strip_all_mentions)}
                    onCheckedChange={(checked) => setCaptionRules({ strip_all_mentions: checked })}
                    aria-label="Eliminar todas las menciones"
                    className="shrink-0"
                  />
                </div>
              </div>

              {/* Reemplazo de mención */}
              <div className="p-3 rounded-lg border border-border bg-secondary/50 space-y-2">
                <div className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <AtSign className="w-3.5 h-3.5 text-muted-foreground" /> Reemplazo automático de mención
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Input
                    type="text"
                    placeholder="@canal_viejo"
                    value={Object.keys(captionRules.replace_mentions || {})[0] || ""}
                    onChange={(e) => {
                      const val = e.target.value.trim();
                      const currentDest = Object.values(captionRules.replace_mentions || {})[0] || "";
                      setCaptionRules({
                        replace_mentions: val && currentDest ? { [val]: currentDest } : {},
                      });
                    }}
                    className="h-8 text-xs font-mono"
                  />
                  <Input
                    type="text"
                    placeholder="@mi_canal_nuevo"
                    value={Object.values(captionRules.replace_mentions || {})[0] || ""}
                    onChange={(e) => {
                      const currentSrc = Object.keys(captionRules.replace_mentions || {})[0] || "";
                      const val = e.target.value.trim();
                      setCaptionRules({
                        replace_mentions: currentSrc && val ? { [currentSrc]: val } : {},
                      });
                    }}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Blacklist de palabras */}
              <div className="p-3 rounded-lg border border-border bg-secondary/50 space-y-1.5">
                <div className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" /> Palabras prohibidas (separadas por comas)
                </div>
                <Input
                  type="text"
                  placeholder="apuestas, bono gratis, vip, promo, casino"
                  value={(captionRules.remove_words || []).join(", ")}
                  onChange={(e) => {
                    const words = e.target.value.split(",").map((w) => w.trim()).filter(Boolean);
                    setCaptionRules({ remove_words: words });
                  }}
                  className="h-8 text-xs font-mono"
                />
              </div>

              {/* Encabezado y Firma */}
              <div className="space-y-2">
                <div>
                  <div className="text-xs font-medium text-foreground mb-1">Encabezado superior (Header)</div>
                  <Input
                    type="text"
                    placeholder="Ej: 🎬 ¡Nuevo contenido subido!"
                    value={captionRules.prepend_header || ""}
                    onChange={(e) => setCaptionRules({ prepend_header: e.target.value || null })}
                    className="h-8 text-xs font-mono"
                  />
                </div>

                <div>
                  <div className="text-xs font-medium text-foreground mb-1">Firma al pie (Signature / Branding)</div>
                  <textarea
                    rows={2}
                    placeholder="Ej: 👉 Canal oficial: https://t.me/mi_canal"
                    value={captionRules.append_signature || ""}
                    onChange={(e) => setCaptionRules({ append_signature: e.target.value || null })}
                    className="w-full bg-card border border-border rounded px-2.5 py-1.5 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Right: Live Interactive Sandbox Preview */}
            <div className="lg:col-span-5 bg-card border border-border rounded-md p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <span className="text-xs font-semibold text-foreground font-mono uppercase tracking-wider flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-primary" /> Simulador en Tiempo Real
                </span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                  Preview interactivo
                </span>
              </div>

              <div>
                <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                  Texto de entrada original (editable para probar):
                </label>
                <textarea
                  rows={3}
                  value={testText}
                  onChange={(e) => setTestText(e.target.value)}
                  className="w-full bg-secondary/50 border border-border rounded p-2 text-xs text-foreground focus:outline-none focus:border-primary resize-none font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 block mb-1 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Resultado post-sanitización:
                </label>
                <div className="w-full bg-secondary/50 border border-emerald-500/30 rounded p-3 text-xs text-foreground font-mono whitespace-pre-wrap min-h-24">
                  {previewResult || <span className="text-muted-foreground italic">El texto sanitizado quedó vacío.</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Module 2: Drip Feed & Scheduler Pacing */}
      {activeTab === "drip" && (
        <div className="bg-card border border-border rounded-md p-3.5 sm:p-5 space-y-4 sm:space-y-5 max-w-3xl">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <Clock className="w-4 h-4 text-primary shrink-0" />
            <div>
              <h2 className="text-sm font-semibold text-foreground font-mono">
                Control de Ritmo y Publicación Programada (Drip Feed)
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Regula el intervalo de tiempo entre cada post clonado para proteger la cuenta contra FloodWait de Telegram y evitar saturar a los suscriptores.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
            {[
              { sec: 0, title: "Inmediato (2s)", desc: "Delay anti-flood básico de 1.5–2.0s por archivo. Ideal para canales nuevos vacíos." },
              { sec: 60, title: "Goteo 1 minuto", desc: "1 post por minuto. Distribución constante sin alerta de spam." },
              { sec: 300, title: "Goteo 5 minutos", desc: "1 post cada 5 minutos. Ritmo orgánico recomendado para canales activos." },
              { sec: 900, title: "Goteo 15 minutos", desc: "1 post cada 15 minutos. Mantiene la actividad viva a lo largo del día." },
              { sec: 1800, title: "Goteo 30 minutos", desc: "1 post cada media hora. Pacing suave para contenido de alta retención." },
            ].map((option) => (
              <label
                key={option.sec}
                className={cn(
                  "p-3 sm:p-3.5 rounded-lg border cursor-pointer transition-all flex flex-col justify-between gap-1.5",
                  dripDelaySeconds === option.sec
                    ? "bg-cyan-500/10 border-cyan-500/40 text-cyan-300 shadow-sm"
                    : "bg-card border-border text-muted-foreground hover:border-border/80 hover:bg-secondary/40"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-foreground font-mono">{option.title}</span>
                  <input
                    type="radio"
                    name="drip_delay"
                    checked={dripDelaySeconds === option.sec}
                    onChange={() => setDripDelaySeconds(option.sec)}
                    className="w-4 h-4 text-primary focus:ring-0 cursor-pointer"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{option.desc}</p>
              </label>
            ))}
          </div>

          <div className="p-3 rounded-lg bg-secondary/40 border border-border text-xs text-muted-foreground space-y-1 font-mono">
            <span className="text-foreground font-medium">⚡ Estado Actual:</span>{" "}
            {dripDelaySeconds === 0
              ? "Modo Instantáneo (delay aleatorio 1.5–2.0s)."
              : `Modo Goteo Activo: 1 mensaje cada ${dripDelaySeconds >= 60 ? `${dripDelaySeconds / 60} min` : `${dripDelaySeconds} seg`}.`}
          </div>
        </div>
      )}

      {/* Module 3: Duplicate Guard */}
      {activeTab === "dedup" && (
        <div className="bg-card border border-border rounded-md p-3.5 sm:p-5 space-y-4 sm:space-y-5 max-w-3xl">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
            <div>
              <h2 className="text-sm font-semibold text-foreground font-mono">
                Deduplicador Inteligente por Huella Digital (Duplicate Guard)
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Previene la clonación accidental de videos y fotos repetidos en el canal destino mediante huellas SHA-256 persistidas.
              </p>
            </div>
          </div>

          <div className="p-3.5 sm:p-4 rounded-lg bg-secondary/40 border border-border space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-semibold text-foreground">Motor de Deduplicación Activo</span>
              </div>
              <span className="text-[10px] font-mono bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded">
                SHA-256 Engine
              </span>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Cada archivo migrado genera una huella criptográfica determinística calculada a partir de su identificador MTProto global (<code className="text-foreground">input_document_id</code>), tamaño en bytes y dimensiones. Si el elemento ya fue publicado previamente en el canal destino, el sistema lo marcará como <span className="text-amber-500 font-mono">SKIPPED</span> automáticamente sin consumir ancho de banda ni duplicar el feed.
            </p>

            <div className="pt-2 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 text-xs font-mono">
              <div className="p-2.5 rounded bg-secondary/70 border border-border">
                <span className="text-muted-foreground block text-[10px]">Almacenamiento</span>
                <span className="text-foreground font-semibold break-words">PostgreSQL (migrated_media_fingerprints)</span>
              </div>
              <div className="p-2.5 rounded bg-secondary/70 border border-border">
                <span className="text-muted-foreground block text-[10px]">Estrategia</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Omitir Idénticos (Zero-Duplicate)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Module 4: Quality & Duration Gates */}
      {activeTab === "quality" && (
        <div className="bg-card border border-border rounded-md p-3.5 sm:p-5 space-y-4 sm:space-y-5 max-w-3xl">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <Filter className="w-4 h-4 text-amber-500 shrink-0" />
            <div>
              <h2 className="text-sm font-semibold text-foreground font-mono">
                Filtros de Calidad y Duración (Quality Gates)
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Descarta clips cortos, reels de baja resolución o archivos pesados antes de copiar, sin consumo de CPU ni descargas.
              </p>
            </div>
          </div>

          {/* Presets Rápidos */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground font-mono">
              Presets Rápidos Recomendados:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() =>
                  setMediaFilterRules({
                    min_duration_seconds: null,
                    max_duration_seconds: null,
                    min_height: null,
                    min_file_size_bytes: null,
                    max_file_size_bytes: null,
                    allowed_media_types: ["video", "photo", "document", "text"],
                  })
                }
                className="p-2.5 rounded-lg border border-border bg-card hover:bg-secondary/40 text-left transition-colors cursor-pointer"
              >
                <div className="text-xs font-semibold text-foreground">Todo el Canal</div>
                <div className="text-[10px] text-muted-foreground">Sin restricciones</div>
              </button>

              <button
                type="button"
                onClick={() =>
                  setMediaFilterRules({
                    min_duration_seconds: 15,
                    min_height: 720,
                    allowed_media_types: ["video"],
                  })
                }
                className="p-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:border-amber-500/50 text-left transition-colors cursor-pointer"
              >
                <div className="text-xs font-semibold text-amber-300">Solo Videos HD</div>
                <div className="text-[10px] text-muted-foreground">&gt; 15s · &ge; 720p</div>
              </button>

              <button
                type="button"
                onClick={() =>
                  setMediaFilterRules({
                    min_duration_seconds: 30,
                  })
                }
                className="p-2.5 rounded-lg border border-border bg-card hover:bg-secondary/40 text-left transition-colors cursor-pointer"
              >
                <div className="text-xs font-semibold text-foreground">Anti-Shorts</div>
                <div className="text-[10px] text-muted-foreground">Omitir &lt; 30s</div>
              </button>

              <button
                type="button"
                onClick={() =>
                  setMediaFilterRules({
                    max_file_size_bytes: 250 * 1024 * 1024,
                  })
                }
                className="p-2.5 rounded-lg border border-border bg-card hover:bg-secondary/40 text-left transition-colors cursor-pointer"
              >
                <div className="text-xs font-semibold text-foreground">Ligero</div>
                <div className="text-[10px] text-muted-foreground">Máx 250 MB</div>
              </button>
            </div>
          </div>

          {/* Tipos de Contenido Permitidos */}
          <div className="p-3.5 sm:p-4 rounded-lg bg-card border border-border space-y-2.5">
            <span className="text-xs font-medium text-foreground font-mono block">
              Tipos de Medios Permitidos:
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { type: "video", label: "Videos", icon: Film },
                { type: "photo", label: "Fotos", icon: Image },
                { type: "document", label: "Documentos", icon: FileText },
                { type: "text", label: "Solo Texto", icon: FileText },
              ].map(({ type, label, icon: Icon }) => {
                const currentTypes = mediaFilterRules.allowed_media_types || ["video", "photo", "document", "text"];
                const isSelected = currentTypes.includes(type);
                return (
                  <div
                    key={type}
                    onClick={() => {
                      const next = isSelected
                        ? currentTypes.filter((t) => t !== type)
                        : [...currentTypes, type];
                      setMediaFilterRules({ allowed_media_types: next });
                    }}
                    className={cn(
                      "flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-colors",
                      isSelected
                        ? "bg-amber-500/10 border-amber-500/40 text-amber-300"
                        : "bg-secondary/30 border-border text-muted-foreground hover:bg-secondary/50"
                    )}
                  >
                    <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span className="text-xs font-medium truncate">{label}</span>
                    </div>
                    <Switch
                      checked={isSelected}
                      onCheckedChange={(checked) => {
                        const next = checked
                          ? [...currentTypes, type]
                          : currentTypes.filter((t) => t !== type);
                        setMediaFilterRules({ allowed_media_types: next });
                      }}
                      className="data-[state=checked]:bg-amber-500 shrink-0 scale-90"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Reglas Cuantitativas (Duración, Resolución, Peso) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
            {/* Duración Mínima */}
            <div className="p-3 sm:p-3.5 rounded-lg bg-card border border-border space-y-1.5">
              <label className="text-xs font-medium text-foreground flex items-center justify-between">
                <span>Duración Mínima:</span>
                <span className="text-[10px] text-muted-foreground font-mono">segundos</span>
              </label>
              <Input
                type="number"
                min="0"
                placeholder="Ej: 15 (0 = off)"
                value={mediaFilterRules.min_duration_seconds ?? ""}
                onChange={(e) => {
                  const val = e.target.value ? parseInt(e.target.value, 10) : null;
                  setMediaFilterRules({ min_duration_seconds: val });
                }}
                className="h-8 text-xs font-mono"
              />
              <span className="text-[10px] text-muted-foreground block">
                Descarta reels o clips ultracortos.
              </span>
            </div>

            {/* Resolución Mínima */}
            <div className="p-3 sm:p-3.5 rounded-lg bg-card border border-border space-y-1.5">
              <label className="text-xs font-medium text-foreground flex items-center justify-between">
                <span>Resolución Mínima:</span>
                <span className="text-[10px] text-muted-foreground font-mono">altura (p)</span>
              </label>
              <Select
                value={String(mediaFilterRules.min_height ?? 0)}
                onValueChange={(val) => {
                  const num = parseInt(val, 10);
                  setMediaFilterRules({ min_height: num > 0 ? num : null });
                }}
              >
                <SelectTrigger className="w-full text-xs h-8 font-mono">
                  <SelectValue placeholder="Cualquiera (Sin filtro)" />
                </SelectTrigger>
                <SelectContent className="font-mono">
                  <SelectItem value="0">Cualquiera (Sin filtro)</SelectItem>
                  <SelectItem value="480">&ge; 480p (SD)</SelectItem>
                  <SelectItem value="720">&ge; 720p (HD)</SelectItem>
                  <SelectItem value="1080">&ge; 1080p (Full HD)</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-[10px] text-muted-foreground block">
                Filtra videos con baja definición.
              </span>
            </div>

            {/* Tamaño Máximo */}
            <div className="p-3 sm:p-3.5 rounded-lg bg-card border border-border space-y-1.5">
              <label className="text-xs font-medium text-foreground flex items-center justify-between">
                <span>Tamaño Máximo:</span>
                <span className="text-[10px] text-muted-foreground font-mono">MB</span>
              </label>
              <Input
                type="number"
                min="0"
                placeholder="Ej: 500 (vacío = ilimitado)"
                value={
                  mediaFilterRules.max_file_size_bytes
                    ? Math.round(mediaFilterRules.max_file_size_bytes / (1024 * 1024))
                    : ""
                }
                onChange={(e) => {
                  const mb = e.target.value ? parseInt(e.target.value, 10) : null;
                  setMediaFilterRules({
                    max_file_size_bytes: mb ? mb * 1024 * 1024 : null,
                  });
                }}
                className="h-8 text-xs font-mono"
              />
              <span className="text-[10px] text-muted-foreground block">
                Evita saturar almacenamiento.
              </span>
            </div>
          </div>

          {/* Architecture Guarantee Footer */}
          <div className="p-3 rounded-lg bg-secondary/40 border border-border text-xs text-muted-foreground space-y-1 font-mono">
            <span className="text-foreground font-medium">⚡ Eficiencia Zero-Download:</span>{" "}
            Los metadatos se validan directamente vía MTProto (<code className="text-foreground">DocumentAttributeVideo</code>) antes de encolar o transferir, manteniendo la velocidad de 0.5s por post.
          </div>
        </div>
      )}

      {/* Module 5: Interactive Rules & Watermark Simulation Playground */}
      {activeTab === "playground" && (
        <RulesPlaygroundCard />
      )}

      {/* Reusable Caption & Message Template Manager Modal */}
      <TemplateManagerModal
        isOpen={uiState.isTemplateModalOpen}
        onClose={() => setUiState((prev) => ({ ...prev, isTemplateModalOpen: false }))}
        onSelectTemplate={handleApplyTemplate}
      />
    </div>
  );
};
