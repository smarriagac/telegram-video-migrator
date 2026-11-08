import React, { useEffect, useState } from "react";
import {
  Sparkles,
  Film,
  Copy,
  Check,
  Type,
  Sliders,
  ShieldCheck,
  Ratio,
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Input } from "@/shared/components/ui/input";
import { Switch } from "@/shared/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  rulesPlaygroundApi,
  SimulationResult,
} from "../../infrastructure/rulesPlaygroundApi";
import { useMigrationStore } from "../../application/useMigrationStore";
import { cn } from "@/shared/lib/utils";

export const RulesPlaygroundCard: React.FC = () => {
  // STRICT ARCHITECTURAL CONSTRAINT: At most 2 useState hooks
  // Hook 1: Simulation Form / Playground Parameters
  const [config, setConfig] = useState<{
    caption: string;
    aspectRatio: "16:9" | "9:16" | "1:1";
    watermarkText: string;
    watermarkPosition: "bottom_right" | "top_right" | "bottom_left" | "top_left" | "center";
    withBox: boolean;
    delogoPreset: "none" | "center" | "top_right" | "bottom_right" | "bottom_bar";
    filterType: "watermark_text" | "delogo" | "delogo_and_watermark";
  }>({
    caption:
      "¡Estreno exclusivo! Miralo en https://t.me/canal_spam y seguinos en @canal_antiguo para promos VIP.",
    aspectRatio: "16:9",
    watermarkText: "@MiCanalOficial",
    watermarkPosition: "bottom_right",
    withBox: true,
    delogoPreset: "top_right",
    filterType: "delogo_and_watermark",
  });

  // Hook 2: Simulation Response & UI Execution State
  const [simState, setSimState] = useState<{
    result: SimulationResult | null;
    isLoading: boolean;
    isCopied: boolean;
    error: string | null;
  }>({
    result: null,
    isLoading: false,
    isCopied: false,
    error: null,
  });

  const captionRules = useMigrationStore((state) => state.captionRules);

  const getDimensions = (ar: "16:9" | "9:16" | "1:1"): { width: number; height: number } => {
    switch (ar) {
      case "9:16":
        return { width: 1080, height: 1920 };
      case "1:1":
        return { width: 1080, height: 1080 };
      case "16:9":
      default:
        return { width: 1920, height: 1080 };
    }
  };

  const runSimulation = async () => {
    setSimState((prev) => ({ ...prev, isLoading: true, error: null }));
    const dims = getDimensions(config.aspectRatio);

    const actualFilterType =
      config.delogoPreset === "none" ? "watermark_text" : config.filterType;

    try {
      const res = await rulesPlaygroundApi.simulateRules({
        sample_caption: config.caption,
        caption_rules: captionRules,
        video_width: dims.width,
        video_height: dims.height,
        filter_type: actualFilterType,
        filter_params: {
          preset: config.delogoPreset !== "none" ? config.delogoPreset : "center",
          watermark_text: config.watermarkText,
          watermark_position: config.watermarkPosition,
          with_box: config.withBox,
          margin: 25,
        },
      });

      setSimState((prev) => ({
        ...prev,
        result: res,
        isLoading: false,
      }));
    } catch (err: any) {
      setSimState((prev) => ({
        ...prev,
        isLoading: false,
        error: err.message || "Error al simular reglas",
      }));
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      runSimulation();
    }, 250);
    return () => clearTimeout(timer);
  }, [config, captionRules]);

  const copyFFmpegCommand = () => {
    if (!simState.result) return;
    const cmd = `ffmpeg -i input.mp4 ${simState.result.ffmpeg_args.join(" ")} -c:a copy output.mp4`;
    navigator.clipboard.writeText(cmd);
    setSimState((prev) => ({ ...prev, isCopied: true }));
    setTimeout(() => {
      setSimState((prev) => ({ ...prev, isCopied: false }));
    }, 2500);
  };

  const { result } = simState;

  return (
    <div className="space-y-6">
      {/* Simulation Controls & Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Controls Column (5 cols) */}
        <div className="lg:col-span-5 bg-card border border-border rounded-lg p-4 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-border pb-2.5">
            <div className="flex items-center space-x-2">
              <Sliders className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground font-mono">
                Parámetros de Simulación
              </h3>
            </div>
            <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
              Live Preview
            </Badge>
          </div>

          {/* Aspect Ratio Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Formato de Video (Aspect Ratio)</span>
              <Ratio className="w-3.5 h-3.5 text-muted-foreground" />
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["16:9", "9:16", "1:1"] as const).map((ratio) => (
                <button
                  key={ratio}
                  type="button"
                  onClick={() => setConfig((prev) => ({ ...prev, aspectRatio: ratio }))}
                  className={cn(
                    "py-1.5 px-2 rounded-md text-xs font-mono font-medium border text-center transition-all",
                    config.aspectRatio === ratio
                      ? "bg-primary text-primary-foreground border-primary shadow-sm font-semibold"
                      : "bg-secondary/50 border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {ratio}
                </button>
              ))}
            </div>
          </div>

          {/* Watermark Text & Position */}
          <div className="space-y-2 pt-1 border-t border-border">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Type className="w-3.5 h-3.5 text-primary" />
                <span>Texto de Marca / Watermark</span>
              </label>
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <span>Fondo:</span>
                <Switch
                  checked={config.withBox}
                  onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, withBox: checked }))}
                />
              </div>
            </div>

            <Input
              type="text"
              placeholder="@TuCanalTelegram"
              value={config.watermarkText}
              onChange={(e) => setConfig((prev) => ({ ...prev, watermarkText: e.target.value }))}
              className="h-8 text-xs font-mono bg-secondary/40 border-border"
            />

            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <span className="text-[10px] text-muted-foreground block mb-1">Posición Watermark:</span>
                <Select
                  value={config.watermarkPosition}
                  onValueChange={(val: any) => setConfig((prev) => ({ ...prev, watermarkPosition: val }))}
                >
                  <SelectTrigger className="h-8 text-xs font-mono bg-secondary/40 border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="text-xs font-mono">
                    <SelectItem value="bottom_right">Inferior Derecha</SelectItem>
                    <SelectItem value="top_right">Superior Derecha</SelectItem>
                    <SelectItem value="bottom_left">Inferior Izquierda</SelectItem>
                    <SelectItem value="top_left">Superior Izquierda</SelectItem>
                    <SelectItem value="center">Centro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <span className="text-[10px] text-muted-foreground block mb-1">Zona Delogo (Remoción):</span>
                <Select
                  value={config.delogoPreset}
                  onValueChange={(val: any) => setConfig((prev) => ({ ...prev, delogoPreset: val }))}
                >
                  <SelectTrigger className="h-8 text-xs font-mono bg-secondary/40 border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="text-xs font-mono">
                    <SelectItem value="none">Sin Delogo (Solo Watermark)</SelectItem>
                    <SelectItem value="top_right">Superior Derecha</SelectItem>
                    <SelectItem value="bottom_right">Inferior Derecha</SelectItem>
                    <SelectItem value="center">Centro</SelectItem>
                    <SelectItem value="bottom_bar">Barra Inferior Completa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Sample Caption Input */}
          <div className="space-y-1.5 pt-1 border-t border-border">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground">Subtítulo de Prueba</label>
              <span className="text-[10px] text-muted-foreground font-mono">
                {config.caption.length} caracteres
              </span>
            </div>
            <textarea
              rows={3}
              value={config.caption}
              onChange={(e) => setConfig((prev) => ({ ...prev, caption: e.target.value }))}
              placeholder="Escribí o pegá un mensaje con enlaces y menciones..."
              className="w-full text-xs font-sans p-2.5 rounded-md bg-secondary/40 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Live Canvas & Simulation Results (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Simulated Video Canvas */}
          <div className="bg-card border border-border rounded-lg p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Film className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-semibold text-foreground font-mono">
                  Lienzo de Video Simulado ({config.aspectRatio})
                </span>
              </div>
              {result && (
                <span className="text-[11px] text-muted-foreground font-mono">
                  Resolución: {result.video_dimensions.width}x{result.video_dimensions.height} px
                </span>
              )}
            </div>

            {/* Video Preview Frame */}
            <div
              className={cn(
                "relative mx-auto rounded-lg overflow-hidden border border-border/80 shadow-inner bg-slate-950 flex items-center justify-center transition-all",
                config.aspectRatio === "16:9" && "w-full aspect-video max-h-[300px]",
                config.aspectRatio === "9:16" && "w-[180px] aspect-[9/16]",
                config.aspectRatio === "1:1" && "w-[240px] aspect-square"
              )}
            >
              {/* Decorative Player Grid Background */}
              <div className="absolute inset-0 bg-gradient-to-tr from-slate-950 via-slate-900 to-slate-950 opacity-90" />
              <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px] opacity-25" />

              {/* Watermark Text Overlay */}
              {result?.watermark && config.watermarkText && (
                <div
                  data-testid="simulated-watermark"
                  style={{
                    position: "absolute",
                    ...(config.watermarkPosition === "bottom_right" && { right: "12px", bottom: "12px" }),
                    ...(config.watermarkPosition === "top_right" && { right: "12px", top: "12px" }),
                    ...(config.watermarkPosition === "bottom_left" && { left: "12px", bottom: "12px" }),
                    ...(config.watermarkPosition === "top_left" && { left: "12px", top: "12px" }),
                    ...(config.watermarkPosition === "center" && {
                      top: "50%",
                      left: "50%",
                      transform: "translate(-50%, -50%)",
                    }),
                  }}
                  className={cn(
                    "px-2 py-0.5 rounded text-[11px] font-bold font-mono tracking-wide select-none z-20 pointer-events-none transition-all shadow-md",
                    config.withBox ? "bg-black/60 text-white border border-white/20" : "text-white drop-shadow-md"
                  )}
                >
                  {result.watermark.text}
                </div>
              )}

              {/* Delogo Mask Overlay */}
              {result?.delogo && config.delogoPreset !== "none" && (
                <div
                  data-testid="simulated-delogo"
                  style={{
                    position: "absolute",
                    left: `${result.delogo.x_pct * 100}%`,
                    top: `${result.delogo.y_pct * 100}%`,
                    width: `${result.delogo.w_pct * 100}%`,
                    height: `${result.delogo.h_pct * 100}%`,
                  }}
                  className="border-2 border-dashed border-rose-500/80 bg-rose-500/20 backdrop-blur-sm z-10 flex items-center justify-center"
                >
                  <span className="text-[9px] font-mono font-bold text-rose-300 uppercase px-1 bg-black/70 rounded">
                    Delogo: {result.delogo.preset}
                  </span>
                </div>
              )}

              {/* Video Player Mock Play Button Center */}
              <div className="absolute w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white/40 pointer-events-none">
                <Film className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Caption Transformation Diff Card */}
          <div className="bg-card border border-border rounded-lg p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold text-foreground font-mono">
                  Transformación de Subtítulo en Tiempo Real
                </span>
              </div>
              {result?.caption && (
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] font-mono",
                      result.caption.delta_length <= 0
                        ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                        : "text-amber-400 border-amber-500/30 bg-amber-500/10"
                    )}
                  >
                    Δ {result.caption.delta_length} chars ({result.caption.transformed_length} total)
                  </Badge>
                </div>
              )}
            </div>

            {/* Side-by-side or stacked diff */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 rounded-md bg-secondary/30 border border-border space-y-1">
                <span className="text-[10px] font-semibold text-muted-foreground block uppercase tracking-wider">
                  Texto Original
                </span>
                <p className="text-muted-foreground whitespace-pre-wrap font-sans text-[11px] leading-relaxed">
                  {config.caption || <span className="italic text-muted-foreground/60">Sin texto</span>}
                </p>
              </div>

              <div className="p-2.5 rounded-md bg-primary/5 border border-primary/20 space-y-1">
                <span className="text-[10px] font-semibold text-primary block uppercase tracking-wider">
                  Texto Transformado (Salida)
                </span>
                <p
                  data-testid="transformed-caption-output"
                  className="text-foreground whitespace-pre-wrap font-sans text-[11px] leading-relaxed font-medium"
                >
                  {result?.caption.transformed_caption || (
                    <span className="italic text-muted-foreground">Procesando...</span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* FFmpeg Generated Filter Command Card */}
          {result?.ffmpeg_filter_string && (
            <div className="bg-card border border-border rounded-lg p-3.5 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground font-mono flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                  <span>Comando FFmpeg Generado</span>
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyFFmpegCommand}
                  className="h-7 text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground"
                >
                  {simState.isCopied ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  <span>{simState.isCopied ? "¡Copiado!" : "Copiar Comando"}</span>
                </Button>
              </div>
              <div className="p-2 rounded bg-slate-950 border border-border/80 font-mono text-[11px] text-emerald-400 overflow-x-auto whitespace-pre">
                {`ffmpeg -i input.mp4 ${result.ffmpeg_args.join(" ")} -c:a copy output.mp4`}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
