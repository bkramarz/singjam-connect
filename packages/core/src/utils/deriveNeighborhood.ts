// Derives the stored "neighborhood" string from a Google Places autocomplete
// suggestion's structured format. Used by both web (LocationAutocomplete) and
// native (ProfileForm) so the same place produces an identical stored value.

export function deriveNeighborhood(
  mainText: string,
  secondaryText: string | undefined,
  citiesOnly = false,
): string {
  if (citiesOnly) {
    return secondaryText ? `${mainText}, ${secondaryText.split(", ")[0]}` : mainText;
  }
  if (!secondaryText) return mainText;
  // Secondary text is typically "Street, City, State, Country".
  // We want just "City, State" — drop street-level parts and the country.
  const parts = secondaryText.split(", ");
  if (parts.length >= 3) {
    return parts.slice(-3, -1).join(", ");
  }
  return parts.slice(0, 2).join(", ");
}
