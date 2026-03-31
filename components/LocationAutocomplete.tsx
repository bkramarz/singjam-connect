"use client";

import { useState, useRef, useEffect } from "react";

type Suggestion = {
  placePrediction: {
    placeId: string;
    structuredFormat: {
      mainText: { text: string };
      secondaryText?: { text: string };
    };
  };
};

export type LocationValue = {
  fullAddress: string;
  neighborhood: string;
};

function extractNeighborhood(secondaryText: string | undefined, mainText: string): string {
  if (!secondaryText) return mainText;
  // Secondary text is typically "Street, City, State, Country"
  // We want just "City, State" — drop street-level parts and country
  const parts = secondaryText.split(", ");
  if (parts.length >= 3) {
    // Drop the last part (country) and take the last 2 remaining (city, state)
    return parts.slice(-3, -1).join(", ");
  }
  return parts.slice(0, 2).join(", ");
}

export default function LocationAutocomplete({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (location: LocationValue) => void;
  placeholder?: string;
}) {
  const [inputValue, setInputValue] = useState(value);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

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
    setInputValue(q);
    // Propagate raw text too so the input stays controlled
    onChange({ fullAddress: q, neighborhood: q });

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 3) { setSuggestions([]); setOpen(false); return; }

    debounceRef.current = setTimeout(async () => {
      const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
      if (!key) return;
      try {
        const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key },
          body: JSON.stringify({
            input: q,
            locationBias: {
              circle: { center: { latitude: 37.8044, longitude: -122.2712 }, radius: 50000 },
            },
          }),
        });
        const json = await res.json();
        setSuggestions(json.suggestions ?? []);
        setOpen(true);
      } catch {
        // silently ignore
      }
    }, 300);
  }

  function select(s: Suggestion) {
    const { mainText, secondaryText } = s.placePrediction.structuredFormat;
    const fullAddress = secondaryText
      ? `${mainText.text}, ${secondaryText.text}`
      : mainText.text;
    const neighborhood = extractNeighborhood(secondaryText?.text, mainText.text);

    setInputValue(fullAddress);
    onChange({ fullAddress, neighborhood });
    setSuggestions([]);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
        value={inputValue}
        onChange={handleInput}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full rounded-xl border border-zinc-200 bg-white shadow-lg overflow-hidden">
          {suggestions.map((s) => {
            const { placeId, structuredFormat } = s.placePrediction;
            const { mainText, secondaryText } = structuredFormat;
            return (
              <li key={placeId}>
                <button
                  type="button"
                  onMouseDown={() => select(s)}
                  className="w-full px-3 py-2.5 text-left text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
                >
                  <span className="font-medium">{mainText.text}</span>
                  {secondaryText && (
                    <span className="text-zinc-400"> — {secondaryText.text}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
