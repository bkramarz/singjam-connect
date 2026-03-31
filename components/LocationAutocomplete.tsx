"use client";

import { useState, useRef, useEffect } from "react";

type Suggestion = {
  place_id: number;
  display_name: string;
  name: string;
  address: {
    road?: string;
    house_number?: string;
    city?: string;
    town?: string;
    suburb?: string;
    state?: string;
  };
};

function formatSuggestion(s: Suggestion): string {
  const { name, address } = s;
  const street = address.house_number && address.road
    ? `${address.house_number} ${address.road}`
    : address.road ?? null;
  const city = address.city ?? address.town ?? address.suburb ?? null;
  const parts = [name, street, city].filter(Boolean);
  // Avoid "Foo, Foo" when name === street
  const deduped = parts.filter((p, i) => i === 0 || p !== parts[i - 1]);
  return deduped.join(", ");
}

export default function LocationAutocomplete({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    onChange(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 3) { setSuggestions([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      // Nominatim (OpenStreetMap) — free, no API key, great POI/venue/park coverage
      const params = new URLSearchParams({
        q,
        format: "json",
        addressdetails: "1",
        limit: "6",
        countrycodes: "us",
        // viewbox biased to Bay Area but not bounded so broader searches still work
        viewbox: "-122.6,38.1,-121.7,37.3",
      });
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
          headers: { "Accept-Language": "en" },
        });
        const json: Suggestion[] = await res.json();
        setSuggestions(json);
        setOpen(true);
      } catch {
        // silently ignore
      }
    }, 400);
  }

  function select(suggestion: Suggestion) {
    onChange(formatSuggestion(suggestion));
    setSuggestions([]);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
        value={value}
        onChange={handleInput}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full rounded-xl border border-zinc-200 bg-white shadow-lg overflow-hidden">
          {suggestions.map((s) => (
            <li key={s.place_id}>
              <button
                type="button"
                onMouseDown={() => select(s)}
                className="w-full px-3 py-2.5 text-left text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
              >
                <span className="font-medium">{s.name}</span>
                {s.address.road || s.address.city || s.address.town ? (
                  <span className="text-zinc-400">
                    {" — "}
                    {[
                      s.address.house_number && s.address.road
                        ? `${s.address.house_number} ${s.address.road}`
                        : s.address.road,
                      s.address.city ?? s.address.town ?? s.address.suburb,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
