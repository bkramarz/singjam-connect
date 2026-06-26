export function formatComposers(composers: string[], cultures: string[]): string {
  const isTraditional = composers.some((c) => c.toLowerCase() === "traditional");
  const others = composers.filter((c) => c.toLowerCase() !== "traditional");
  const parts: string[] = [];
  if (isTraditional) {
    const uniqueCultures = [...new Set(cultures)];
    parts.push(uniqueCultures.length ? `Trad. - ${uniqueCultures.join(", ")}` : "Trad.");
  }
  parts.push(
    ...others.map((name) => {
      const w = name.trim().split(" ");
      return w.length > 1 ? `${w[0][0]}. ${w.slice(1).join(" ")}` : name;
    })
  );
  return parts.join(", ");
}
