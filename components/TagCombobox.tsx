"use client";

import { useState, useRef } from "react";

type Item = { id: string; name: string };

export default function TagCombobox({
  label,
  placeholder,
  options,
  selected,
  onChange,
  optional,
}: {
  label: string;
  placeholder?: string;
  options: Item[];
  selected: string[];
  onChange: (ids: string[]) => void;
  optional?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query.length === 0
    ? []
    : options.filter(
        (o) =>
          !selected.includes(o.id) &&
          o.name.toLowerCase().includes(query.toLowerCase())
      );

  function add(id: string) {
    onChange([...selected, id]);
    setQuery("");
    setOpen(false);
    inputRef.current?.focus();
  }

  function remove(id: string) {
    onChange(selected.filter((s) => s !== id));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && filtered.length > 0) {
      e.preventDefault();
      add(filtered[0].id);
    }
    if (e.key === "Escape") setOpen(false);
    if (e.key === "Backspace" && query === "" && selected.length > 0) {
      remove(selected[selected.length - 1]);
    }
  }

  const selectedItems = selected.map((id) => options.find((o) => o.id === id)).filter(Boolean) as Item[];

  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">
        {label}
        {optional && <span className="ml-1.5 text-xs font-normal text-zinc-400">optional</span>}
      </label>
      {selectedItems.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedItems.map((item) => (
            <span
              key={item.id}
              className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700"
            >
              {item.name}
              <button
                type="button"
                onClick={() => remove(item.id)}
                className="text-amber-400 hover:text-amber-600 leading-none"
                aria-label={`Remove ${item.name}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <input
          ref={inputRef}
          className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => query.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? `Search ${label.toLowerCase()}…`}
          autoComplete="off"
        />
        {open && filtered.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full rounded-xl border border-zinc-200 bg-white shadow-lg overflow-hidden max-h-48 overflow-y-auto">
            {filtered.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onMouseDown={() => add(item.id)}
                  className="w-full px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
                >
                  {item.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
