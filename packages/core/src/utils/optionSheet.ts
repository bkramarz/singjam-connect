export type OptionSheetItem = {
  label: string;
  destructive?: boolean;
  // iOS greys the row out and ignores taps. Android's Alert has no equivalent,
  // so disabled items are dropped there — which is why the caller needs
  // enabledIndices to map a button back to the item it came from.
  disabled?: boolean;
};

export type OptionSheetLayout = {
  /** iOS button labels, with the cancel button appended last. */
  labels: string[];
  cancelButtonIndex: number;
  /** -1 when no item is destructive. */
  destructiveButtonIndex: number;
  disabledButtonIndices: number[];
  /** Indices of the items Android should show, in order. */
  enabledIndices: number[];
};

// Index arithmetic for an option sheet, shared by every menu in the native app.
// Kept separate from the platform call so the mapping — which decides which
// item a tap actually runs — is unit-testable.
export function buildOptionSheet(
  items: OptionSheetItem[],
  cancelLabel = 'Cancel',
): OptionSheetLayout {
  return {
    labels: [...items.map(i => i.label), cancelLabel],
    cancelButtonIndex: items.length,
    destructiveButtonIndex: items.findIndex(i => i.destructive),
    disabledButtonIndices: items.flatMap((i, index) => (i.disabled ? [index] : [])),
    enabledIndices: items.flatMap((i, index) => (i.disabled ? [] : [index])),
  };
}
