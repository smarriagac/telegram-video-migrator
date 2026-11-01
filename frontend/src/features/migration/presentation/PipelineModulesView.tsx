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
} from "lucide-react";
import { useMigrationStore } from "../application/useMigrationStore";

export const PipelineModulesView: React.FC = () => {
  // STRICT ARCHITECTURAL CONSTRAINT: Max 2 useState hooks
  const [activeTab, setActiveTab] = useState<"captions" | "drip" | "dedup">("captions");
  const [testText, setTestText] = useState<string>(
    "¡Nuevo estreno en https://t.me/canal_spam! Sigan a @canal_spam para ganar bono gratis VIP."
  );

  const captionRules = useMigrationStore((state) => state.captionRules);
  const setCaptionRules = useMigrationStore((state) => state.setCaptionRules);
  const dripDelaySeconds = useMigrationStore((state) => state.dripDelaySeconds);
  const setDripDelaySeconds = useMigrationStore((state) => state.setDripDelaySeconds);

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

  return (
    <div className="w-full h-full flex flex-col space-y-4 min-h-0 overflow-y-auto pr-1">
      {/* Header */}
      <header className="border-b border-zinc-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-emerald-400" />
            <h1 className="text-base font-bold text-zinc-100 font-mono">
              Pipeline & Módulos de Procesamiento
            </h1>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Configuración global de los 3 motores de migración: Sanitización de texto, Goteo programado y Deduplicador inteligente.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-zinc-900 border border-zinc-800 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab("captions")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === "captions"
                ? "bg-zinc-800 text-emerald-400 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Captions
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("drip")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === "drip"
                ? "bg-zinc-800 text-sky-400 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Drip Feed
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("dedup")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === "dedup"
                ? "bg-zinc-800 text-indigo-400 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Duplicate Guard
          </button>
        </div>
      </header>

      {/* Module 1: Caption Transformation Pipeline */}
      {activeTab === "captions" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Left: Rules Configuration Form */}
            <div className="lg:col-span-7 bg-[#0e1015] border border-zinc-800 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <span className="text-xs font-semibold text-zinc-200 font-mono uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> Reglas de Sanitización
                </span>
                <span className="text-[11px] text-zinc-500 font-mono">Aplicado en tiempo real</span>
              </div>

              {/* Toggles */}
              <div className="space-y-2">
                <label className="flex items-center justify-between p-3 rounded-lg border border-zinc-800/80 bg-zinc-900/40 cursor-pointer hover:border-zinc-700 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <Link2 className="w-4 h-4 text-sky-400" />
                    <div>
                      <div className="font-medium text-xs text-zinc-200">Limpiar enlaces externos (URLs)</div>
                      <div className="text-[11px] text-zinc-400">Elimina enlaces web (http, https y t.me/...)</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={captionRules.strip_links ?? false}
                    onChange={(e) => setCaptionRules({ strip_links: e.target.checked })}
                    className="w-4 h-4 rounded border-zinc-700 text-emerald-500 focus:ring-0 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-lg border border-zinc-800/80 bg-zinc-900/40 cursor-pointer hover:border-zinc-700 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <AtSign className="w-4 h-4 text-amber-400" />
                    <div>
                      <div className="font-medium text-xs text-zinc-200">Eliminar todas las menciones</div>
                      <div className="text-[11px] text-zinc-400">Quita cualquier username de spam (@usuario)</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={captionRules.strip_all_mentions ?? false}
                    onChange={(e) => setCaptionRules({ strip_all_mentions: e.target.checked })}
                    className="w-4 h-4 rounded border-zinc-700 text-emerald-500 focus:ring-0 cursor-pointer"
                  />
                </label>
              </div>

              {/* Reemplazo de mención */}
              <div className="p-3 rounded-lg border border-zinc-800/80 bg-zinc-900/40 space-y-2">
                <div className="text-xs font-medium text-zinc-200 flex items-center gap-1.5">
                  <AtSign className="w-3.5 h-3.5 text-zinc-400" /> Reemplazo automático de mención
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
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
                    className="bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50"
                  />
                  <input
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
                    className="bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
              </div>

              {/* Blacklist de palabras */}
              <div className="p-3 rounded-lg border border-zinc-800/80 bg-zinc-900/40 space-y-1.5">
                <div className="text-xs font-medium text-zinc-200 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-400" /> Palabras prohibidas (separadas por comas)
                </div>
                <input
                  type="text"
                  placeholder="apuestas, bono gratis, vip, promo, casino"
                  value={(captionRules.remove_words || []).join(", ")}
                  onChange={(e) => {
                    const words = e.target.value.split(",").map((w) => w.trim()).filter(Boolean);
                    setCaptionRules({ remove_words: words });
                  }}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              {/* Encabezado y Firma */}
              <div className="space-y-2">
                <div>
                  <div className="text-xs font-medium text-zinc-200 mb-1">Encabezado superior (Header)</div>
                  <input
                    type="text"
                    placeholder="Ej: 🎬 ¡Nuevo contenido subido!"
                    value={captionRules.prepend_header || ""}
                    onChange={(e) => setCaptionRules({ prepend_header: e.target.value || null })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50"
                  />
                </div>

                <div>
                  <div className="text-xs font-medium text-zinc-200 mb-1">Firma al pie (Signature / Branding)</div>
                  <textarea
                    rows={2}
                    placeholder="Ej: 👉 Canal oficial: https://t.me/mi_canal"
                    value={captionRules.append_signature || ""}
                    onChange={(e) => setCaptionRules({ append_signature: e.target.value || null })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Right: Live Interactive Sandbox Preview */}
            <div className="lg:col-span-5 bg-[#0e1015] border border-zinc-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <span className="text-xs font-semibold text-zinc-200 font-mono uppercase tracking-wider flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-cyan-400" /> Simulador en Tiempo Real
                </span>
                <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                  Preview interactivo
                </span>
              </div>

              <div>
                <label className="text-[11px] font-medium text-zinc-400 block mb-1">
                  Texto de entrada original (editable para probar):
                </label>
                <textarea
                  rows={3}
                  value={testText}
                  onChange={(e) => setTestText(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs text-zinc-300 focus:outline-none focus:border-cyan-500/50 resize-none font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-emerald-400 block mb-1 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Resultado post-sanitización:
                </label>
                <div className="w-full bg-zinc-950/80 border border-emerald-500/30 rounded p-3 text-xs text-zinc-200 font-mono whitespace-pre-wrap min-h-24">
                  {previewResult || <span className="text-zinc-600 italic">El texto sanitizado quedó vacío.</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Module 2: Drip Feed & Scheduler Pacing */}
      {activeTab === "drip" && (
        <div className="bg-[#0e1015] border border-zinc-800 rounded-xl p-5 space-y-5 max-w-3xl">
          <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
            <Clock className="w-4 h-4 text-sky-400" />
            <div>
              <h2 className="text-sm font-semibold text-zinc-100 font-mono">
                Control de Ritmo y Publicación Programada (Drip Feed)
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Regula el intervalo de tiempo entre cada post clonado para proteger la cuenta contra FloodWait de Telegram y evitar saturar a los suscriptores.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { sec: 0, title: "Inmediato (2s)", desc: "Delay anti-flood básico de 1.5–2.0s por archivo. Ideal para canales nuevos vacíos." },
              { sec: 60, title: "Goteo 1 minuto", desc: "1 post por minuto. Distribución constante sin alerta de spam." },
              { sec: 300, title: "Goteo 5 minutos", desc: "1 post cada 5 minutos. Ritmo orgánico recomendado para canales activos." },
              { sec: 900, title: "Goteo 15 minutos", desc: "1 post cada 15 minutos. Mantiene la actividad viva a lo largo del día." },
              { sec: 1800, title: "Goteo 30 minutos", desc: "1 post cada media hora. Pacing suave para contenido de alta retención." },
            ].map((option) => (
              <label
                key={option.sec}
                className={`p-3.5 rounded-lg border cursor-pointer transition-all flex flex-col justify-between ${
                  dripDelaySeconds === option.sec
                    ? "bg-sky-500/10 border-sky-500/40 text-sky-300"
                    : "bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-zinc-200 font-mono">{option.title}</span>
                  <input
                    type="radio"
                    name="drip_delay"
                    checked={dripDelaySeconds === option.sec}
                    onChange={() => setDripDelaySeconds(option.sec)}
                    className="w-4 h-4 text-sky-500 focus:ring-0 cursor-pointer"
                  />
                </div>
                <p className="text-[11px] text-zinc-400 mt-1.5 leading-relaxed">{option.desc}</p>
              </label>
            ))}
          </div>

          <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-400 space-y-1 font-mono">
            <span className="text-zinc-300 font-medium">⚡ Estado Actual:</span>{" "}
            {dripDelaySeconds === 0
              ? "Modo Instantáneo (delay aleatorio 1.5–2.0s)."
              : `Modo Goteo Activo: 1 mensaje cada ${dripDelaySeconds >= 60 ? `${dripDelaySeconds / 60} min` : `${dripDelaySeconds} seg`}.`}
          </div>
        </div>
      )}

      {/* Module 3: Duplicate Guard */}
      {activeTab === "dedup" && (
        <div className="bg-[#0e1015] border border-zinc-800 rounded-xl p-5 space-y-5 max-w-3xl">
          <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
            <div>
              <h2 className="text-sm font-semibold text-zinc-100 font-mono">
                Deduplicador Inteligente por Huella Digital (Duplicate Guard)
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Previene la clonación accidental de videos y fotos repetidos en el canal destino mediante huellas SHA-256 persistidas.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-semibold text-zinc-200">Motor de Deduplicación Activo</span>
              </div>
              <span className="text-[10px] font-mono bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded">
                SHA-256 Engine
              </span>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Cada archivo migrado genera una huella criptográfica determinística calculada a partir de su identificador MTProto global (<code className="text-zinc-300">input_document_id</code>), tamaño en bytes y dimensiones. Si el elemento ya fue publicado previamente en el canal destino, el sistema lo marcará como <span className="text-amber-400 font-mono">SKIPPED</span> automáticamente sin consumir ancho de banda ni duplicar el feed.
            </p>

            <div className="pt-2 border-t border-zinc-800/80 grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-2.5 rounded bg-zinc-900 border border-zinc-800">
                <span className="text-zinc-500 block text-[10px]">Almacenamiento</span>
                <span className="text-zinc-200 font-semibold">PostgreSQL (migrated_media_fingerprints)</span>
              </div>
              <div className="p-2.5 rounded bg-zinc-900 border border-zinc-800">
                <span className="text-zinc-500 block text-[10px]">Estrategia</span>
                <span className="text-emerald-400 font-semibold">Omitir Idénticos (Zero-Duplicate)</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
