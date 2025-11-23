"use client";

import * as React from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Typage simple pour les items
type AnyItem = {
  value: string;
  label: string;
  [key: string]: unknown;
};

type ComboboxContextValue = {
  items: AnyItem[];        // items filtrés
  allItems: AnyItem[];     // tous les items
  value: AnyItem[];        // sélection actuelle (multiple)
  setValue: (value: AnyItem[]) => void;
  query: string;
  setQuery: (query: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  popupId: string;
};

const ComboboxContext = React.createContext<ComboboxContextValue | null>(null);

function useComboboxContext() {
  const ctx = React.useContext(ComboboxContext);
  if (!ctx) {
    throw new Error("Combobox components must be used within <Combobox>");
  }
  return ctx;
}

// Props du Combobox root
type ComboboxProps = {
  items: AnyItem[];
  value?: AnyItem[];
  defaultValue?: AnyItem[];
  onValueChange?: (value: AnyItem[]) => void;
  children: React.ReactNode;
  className?: string;
  multiple?: boolean; // uniquement multi, mais on garde la prop pour compat
};

export function Combobox({
  items,
  value,
  defaultValue,
  onValueChange,
  children,
  className,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [internalValue, setInternalValue] = React.useState<AnyItem[]>(
    defaultValue ?? [],
  );
  const popupId = React.useId(); // 👈 ID unique pour aria-controls / id

  const currentValue = value ?? internalValue;

  const setValue = (newValue: AnyItem[]) => {
    if (value === undefined) {
      setInternalValue(newValue);
    }
    onValueChange?.(newValue);
  };

  const filteredItems = React.useMemo(
    () =>
      query
        ? items.filter((item) =>
            item.label.toLowerCase().includes(query.toLowerCase()),
          )
        : items,
    [items, query],
  );

  const ctx: ComboboxContextValue = {
    items: filteredItems,
    allItems: items,
    value: currentValue,
    setValue,
    query,
    setQuery,
    open,
    setOpen,
    popupId,
  };

  return (
    <ComboboxContext.Provider value={ctx}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div
            className={cn(
              "flex min-h-10 w-full flex-wrap items-center gap-1 rounded-md border bg-background px-2 py-1 text-sm",
              "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background",
              className,
            )}
            onClick={() => setOpen(true)}
            role="combobox"
            aria-expanded={open}
            aria-controls={popupId} // ✅ règle a11y satisfaite
          >
            {children}
          </div>
        </PopoverTrigger>
      </Popover>
    </ComboboxContext.Provider>
  );
}

// -----------------------------------------------------------------------------
// Chips / Value / Input
// -----------------------------------------------------------------------------

type ComboboxChipsProps = {
  children: React.ReactNode;
  className?: string;
};

export function ComboboxChips({ children, className }: ComboboxChipsProps) {
  return (
    <div className={cn("flex flex-1 flex-wrap items-center gap-1", className)}>
      {children}
    </div>
  );
}

type ComboboxChipProps = React.ComponentProps<"button">;

export function ComboboxChip({ className, ...props }: ComboboxChipProps) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-foreground",
        className,
      )}
    />
  );
}

type ComboboxValueProps = {
  children: (value: AnyItem[]) => React.ReactNode;
};

export function ComboboxValue({ children }: ComboboxValueProps) {
  const { value } = useComboboxContext();
  return <>{children(value)}</>;
}

type ComboboxInputProps = React.ComponentProps<"input">;

export const ComboboxInput = React.forwardRef<
  HTMLInputElement,
  ComboboxInputProps
>(function ComboboxInput({ className, onChange, onFocus, ...props }, ref) {
  const { query, setQuery, setOpen } = useComboboxContext();

  return (
    <input
      ref={ref}
      className={cn(
        "flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground",
        "min-w-[60px]",
        className,
      )}
      value={query}
      onChange={(e) => {
        setQuery(e.target.value);
        onChange?.(e);
      }}
      onFocus={(e) => {
        setOpen(true);
        onFocus?.(e);
      }}
      {...props}
    />
  );
});

// -----------------------------------------------------------------------------
// Popup / List / Item / Empty
// -----------------------------------------------------------------------------

type ComboboxPopupProps = {
  children: React.ReactNode;
  className?: string;
};

export function ComboboxPopup({ children, className }: ComboboxPopupProps) {
  const { popupId } = useComboboxContext();

  return (
    <PopoverContent
      id={popupId} // 👈 lié à aria-controls
      align="start"
      className={cn(
        "w-[260px] p-0",
        "bg-popover text-popover-foreground border shadow-md",
        className,
      )}
    >
      <div className="max-h-60 overflow-auto py-1">{children}</div>
    </PopoverContent>
  );
}

type ComboboxEmptyProps = {
  children: React.ReactNode;
  className?: string;
};

export function ComboboxEmpty({ children, className }: ComboboxEmptyProps) {
  const { items } = useComboboxContext();
  if (items.length > 0) return null;

  return (
    <div
      className={cn(
        "px-2 py-2 text-xs text-muted-foreground",
        className,
      )}
    >
      {children}
    </div>
  );
}

type ComboboxListProps = {
  children: (item: AnyItem) => React.ReactNode;
  className?: string;
};

export function ComboboxList({ children, className }: ComboboxListProps) {
  const { items } = useComboboxContext();
  if (!items.length) return null;

  return (
    <ul className={cn("py-1", className)}>
      {items.map((item) => (
        <li key={item.value}>{children(item)}</li>
      ))}
    </ul>
  );
}

type ComboboxItemProps = {
  value: AnyItem;
  children: React.ReactNode;
  className?: string;
};

export function ComboboxItem({
  value,
  children,
  className,
}: ComboboxItemProps) {
  const { value: selected, setValue } = useComboboxContext();

  const isSelected = selected.some((v) => v.value === value.value);

  const handleClick = () => {
    let next: AnyItem[];
    if (isSelected) {
      next = selected.filter((v) => v.value !== value.value);
    } else {
      next = [...selected, value];
    }
    setValue(next);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "flex w-full cursor-pointer items-center gap-2 px-2 py-1.5 text-left text-sm",
        "hover:bg-accent hover:text-accent-foreground",
        isSelected && "bg-accent text-accent-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}