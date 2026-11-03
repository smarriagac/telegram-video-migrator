import * as React from "react";
import { format, addMinutes, addHours, addDays, setHours, setMinutes } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarIcon, Clock, X, Sparkles } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/components/ui/button";
import { Calendar } from "@/shared/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";

export interface DateTimePickerProps {
  value?: Date | string | null;
  onChange: (date: Date | null) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

export function DateTimePicker({
  value,
  onChange,
  disabled = false,
  className,
  placeholder = "Seleccionar fecha y horario programado...",
}: DateTimePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const selectedDate: Date | null = React.useMemo(() => {
    if (!value) return null;
    const d = typeof value === "string" ? new Date(value) : value;
    return isNaN(d.getTime()) ? null : d;
  }, [value]);

  const currentHour = selectedDate ? selectedDate.getHours().toString().padStart(2, "0") : "12";
  const currentMinute = selectedDate
    ? (Math.floor(selectedDate.getMinutes() / 5) * 5).toString().padStart(2, "0")
    : "00";

  const handleSelectDate = (date: Date | undefined) => {
    if (!date) {
      onChange(null);
      return;
    }
    const h = selectedDate ? selectedDate.getHours() : 12;
    const m = selectedDate ? selectedDate.getMinutes() : 0;
    const updated = setMinutes(setHours(date, h), m);
    onChange(updated);
  };

  const handleHourChange = (hourStr: string) => {
    const base = selectedDate || new Date();
    const updated = setHours(base, parseInt(hourStr, 10));
    onChange(updated);
  };

  const handleMinuteChange = (minStr: string) => {
    const base = selectedDate || new Date();
    const updated = setMinutes(base, parseInt(minStr, 10));
    onChange(updated);
  };

  const applyPreset = (presetFn: (d: Date) => Date) => {
    const now = new Date();
    const target = presetFn(now);
    onChange(target);
  };

  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"));
  const minutes = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, "0"));

  return (
    <div className={cn("flex items-center gap-1.5 w-full", className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            disabled={disabled}
            className={cn(
              "w-full justify-start text-left font-normal h-8.5 px-3 text-xs bg-secondary/60 border-border hover:bg-secondary/90 transition-all",
              !selectedDate && "text-muted-foreground",
              selectedDate && "border-cyan-500/40 text-foreground bg-cyan-500/5 shadow-xs"
            )}
          >
            <CalendarIcon className={cn("mr-2 h-3.5 w-3.5", selectedDate ? "text-cyan-400" : "text-muted-foreground")} />
            {selectedDate ? (
              <span className="font-mono text-xs text-foreground font-medium truncate">
                {format(selectedDate, "d 'de' MMMM, yyyy · HH:mm 'hs'", { locale: es })}
              </span>
            ) : (
              <span className="truncate">{placeholder}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3 bg-card border-border shadow-2xl rounded-lg space-y-3" align="start">
          {/* Quick Presets */}
          <div className="flex items-center gap-1.5 pb-2 border-b border-border text-[11px]">
            <span className="text-[10px] text-muted-foreground font-medium mr-1 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-cyan-400" /> Atajos:
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => applyPreset((d) => addMinutes(d, 15))}
              className="h-6 px-2 text-[10px] border-border bg-secondary/40 hover:bg-cyan-500/10 hover:text-cyan-400 hover:border-cyan-500/30"
            >
              +15 min
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => applyPreset((d) => addHours(d, 1))}
              className="h-6 px-2 text-[10px] border-border bg-secondary/40 hover:bg-cyan-500/10 hover:text-cyan-400 hover:border-cyan-500/30"
            >
              +1 hora
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => applyPreset((d) => setMinutes(setHours(addDays(d, 1), 9), 0))}
              className="h-6 px-2 text-[10px] border-border bg-secondary/40 hover:bg-cyan-500/10 hover:text-cyan-400 hover:border-cyan-500/30"
            >
              Mañana 09:00
            </Button>
          </div>

          {/* Canonical Shadcn Calendar */}
          <Calendar
            mode="single"
            selected={selectedDate || undefined}
            onSelect={handleSelectDate}
          />

          {/* Time Picker Controls */}
          <div className="pt-2 border-t border-border flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span className="font-medium text-[11px] text-foreground">Horario:</span>
            </div>

            <div className="flex items-center gap-1">
              {/* Hours Select */}
              <Select value={currentHour} onValueChange={handleHourChange}>
                <SelectTrigger className="h-7 w-16 text-xs bg-secondary/80 border-border font-mono">
                  <SelectValue placeholder="HH" />
                </SelectTrigger>
                <SelectContent className="max-h-48 bg-popover border-border">
                  {hours.map((h) => (
                    <SelectItem key={h} value={h} className="text-xs font-mono">
                      {h}:00
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <span className="text-muted-foreground text-xs font-bold">:</span>

              {/* Minutes Select */}
              <Select value={currentMinute} onValueChange={handleMinuteChange}>
                <SelectTrigger className="h-7 w-16 text-xs bg-secondary/80 border-border font-mono">
                  <SelectValue placeholder="MM" />
                </SelectTrigger>
                <SelectContent className="max-h-48 bg-popover border-border">
                  {minutes.map((m) => (
                    <SelectItem key={m} value={m} className="text-xs font-mono">
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Footer Action */}
          <div className="pt-1 flex items-center justify-between text-xs">
            {selectedDate && (
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  setIsOpen(false);
                }}
                className="text-[11px] text-muted-foreground hover:text-rose-400 transition-colors flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Limpiar horario
              </button>
            )}
            <Button
              type="button"
              size="sm"
              onClick={() => setIsOpen(false)}
              className="ml-auto h-7 px-3 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            >
              Listo
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Direct Clear Button if selected */}
      {selectedDate && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange(null)}
          className="h-8.5 w-8.5 p-0 text-muted-foreground hover:text-foreground shrink-0"
          title="Eliminar programación y ejecutar inmediatamente"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      )}
    </div>
  );
}
