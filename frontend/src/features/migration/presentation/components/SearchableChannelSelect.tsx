import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/shared/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";
import { Channel } from "../../domain/types";

interface SearchableChannelSelectProps {
  value: number | null;
  onChange: (id: number | null) => void;
  channels: Channel[];
  disabledId?: number | null;
  placeholder?: string;
  disabled?: boolean;
  accentColor?: "cyan" | "emerald";
}

export const SearchableChannelSelect: React.FC<SearchableChannelSelectProps> = ({
  value,
  onChange,
  channels,
  disabledId,
  placeholder = "Seleccionar canal...",
  disabled = false,
}) => {
  const [open, setOpen] = React.useState(false);
  const selectedChannel = channels.find((c) => c.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full h-8 px-2.5 rounded-md bg-card border border-input text-left text-xs flex items-center justify-between transition-all select-none hover:border-border focus:outline-none focus:border-primary",
            disabled && "opacity-50 cursor-not-allowed",
            open && "border-primary ring-1 ring-primary/20"
          )}
        >
          <div className="truncate flex-1 mr-2">
            {selectedChannel ? (
              <span className="flex items-center gap-1.5 truncate">
                {selectedChannel.account_name && (
                  <span className="text-[9px] text-primary font-medium px-1 rounded bg-primary/10 border border-primary/20 shrink-0">
                    {selectedChannel.account_name}
                  </span>
                )}
                {selectedChannel.can_post && (
                  <span className="text-[10px] text-emerald-500 dark:text-emerald-400 font-bold px-1 rounded bg-emerald-500/10 border border-emerald-500/20 shrink-0">
                    ★ Admin
                  </span>
                )}
                <span className="text-foreground font-medium truncate">{selectedChannel.title}</span>
                {selectedChannel.username ? (
                  <span className="text-[10px] text-muted-foreground">(@{selectedChannel.username})</span>
                ) : (
                  <span className="text-[10px] text-muted-foreground font-mono">[{selectedChannel.id}]</span>
                )}
              </span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </div>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[max(var(--radix-popover-trigger-width),420px)] max-w-[95vw] p-0 border-border bg-popover shadow-2xl z-50 text-popover-foreground"
        align="start"
      >
        <Command>
          <CommandInput placeholder="Buscar por nombre, @usuario o ID..." />
          <CommandList className="max-h-60">
            <CommandEmpty>No se encontraron canales.</CommandEmpty>
            <CommandGroup>
              {channels.map((c) => {
                const isSelected = c.id === value;
                const isDisabled = c.id === disabledId;
                return (
                  <CommandItem
                    key={c.id}
                    value={`${c.title} ${c.username || ""} ${c.id}`}
                    disabled={isDisabled}
                    onSelect={() => {
                      onChange(c.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex items-center justify-between",
                      isSelected && "text-primary font-medium bg-primary/10"
                    )}
                  >
                    <div className="flex items-center gap-1.5 truncate mr-2 min-w-0 flex-1">
                      {c.account_name && (
                        <span className="text-[9px] text-primary font-medium px-1 py-0.2 rounded bg-primary/10 border border-primary/20 shrink-0">
                          {c.account_name}
                        </span>
                      )}
                      {c.can_post && (
                        <span className="text-[9px] text-emerald-500 dark:text-emerald-400 font-semibold px-1 py-0.2 rounded bg-emerald-500/10 border border-emerald-500/20 shrink-0">
                          ★ Admin
                        </span>
                      )}
                      <span className="truncate text-foreground font-medium">{c.title}</span>
                      {c.username ? (
                        <span className="text-[10px] text-zinc-500 shrink-0">@{c.username}</span>
                      ) : (
                        <span className="text-[10px] text-zinc-600 font-mono shrink-0">
                          [{c.id}]
                        </span>
                      )}
                    </div>
                    {isSelected && <Check className="h-3.5 w-3.5 text-cyan-400 shrink-0" />}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
