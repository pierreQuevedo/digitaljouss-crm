// components/ui/multiselect.tsx
"use client";

import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

export type Option = {
  value: string;
  label: string;
  disabled?: boolean;
};

type MultipleSelectorProps = {
  options: Option[];
  value?: Option[];
  defaultValue?: Option[];
  onChange?: (value: Option[]) => void;
  placeholder?: string;
  emptyIndicator?: React.ReactNode;
  className?: string;
};

export default function MultipleSelector({
  options,
  value,
  defaultValue,
  onChange,
  placeholder = "Sélectionner…",
  emptyIndicator = "Aucun résultat.",
  className,
}: MultipleSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [internalValue, setInternalValue] = React.useState<Option[]>(
    defaultValue ?? [],
  );

  const selected = value ?? internalValue;

  const toggleOption = (option: Option) => {
    const exists = selected.some((o) => o.value === option.value);
    let next: Option[];
    if (exists) {
      next = selected.filter((o) => o.value !== option.value);
    } else {
      next = [...selected, option];
    }

    if (!value) {
      setInternalValue(next);
    }
    onChange?.(next);
  };

  const clearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!value) {
      setInternalValue([]);
    }
    onChange?.([]);
  };

  const filteredOptions = React.useMemo(() => {
    if (!search) return options;
    const s = search.toLowerCase();
    return options.filter((opt) => opt.label.toLowerCase().includes(s));
  }, [options, search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "h-auto min-h-10 w-full justify-between rounded-md border bg-background px-3 py-2 text-left text-sm",
            className,
          )}
        >
          <div className="flex flex-wrap items-center gap-1">
            {selected.length > 0 ? (
              selected.map((opt) => (
                <Badge
                  key={opt.value}
                  variant="secondary"
                  className="flex items-center gap-1"
                >
                  <span className="text-xs">{opt.label}</span>
                  {/* ⬇️ plus de <button> imbriqué : span clickable */}
                  <span
                    role="button"
                    aria-label={`Retirer ${opt.label}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleOption(opt);
                    }}
                    className="inline-flex cursor-pointer items-center"
                  >
                    <X className="h-3 w-3" />
                  </span>
                </Badge>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">
                {placeholder}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {selected.length > 0 && (
              // ⬇️ idem ici : span au lieu de button
              <span
                role="button"
                aria-label="Effacer la sélection"
                onClick={clearAll}
                className="mr-1 inline-flex cursor-pointer items-center text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </span>
            )}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className={cn(
          "max-h-60 w-[260px] overflow-y-auto overscroll-contain p-0",
          "bg-popover text-popover-foreground",
        )}
        // Empêche le scroll de remonter au Sheet / body
        onWheelCapture={(e) => {
          e.stopPropagation();
        }}
      >
        <Command shouldFilter={false} className="h-auto">
          <CommandInput
            placeholder="Rechercher…"
            value={search}
            onValueChange={setSearch}
            className="h-9 px-3"
          />
          <CommandList className="max-h-none">
            <CommandEmpty>{emptyIndicator}</CommandEmpty>
            <CommandGroup>
              {filteredOptions.map((opt) => {
                const isSelected = selected.some(
                  (s) => s.value === opt.value,
                );
                return (
                  <CommandItem
                    key={opt.value}
                    disabled={opt.disabled}
                    onSelect={() => toggleOption(opt)}
                    className={cn(
                      "cursor-pointer",
                      opt.disabled && "cursor-not-allowed opacity-50",
                    )}
                  >
                    <div className="mr-2 flex h-4 w-4 items-center justify-center border border-input">
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                    <span>{opt.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}