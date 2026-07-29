import { describe, it, expect } from "vitest";
import { buildOptionSheet } from "./optionSheet";

const items = [
  { label: "Copy set" },
  { label: "Delete set", destructive: true },
];

describe("buildOptionSheet", () => {
  it("appends cancel last and points cancelButtonIndex at it", () => {
    const sheet = buildOptionSheet(items);
    expect(sheet.labels).toEqual(["Copy set", "Delete set", "Cancel"]);
    expect(sheet.cancelButtonIndex).toBe(2);
    expect(sheet.labels[sheet.cancelButtonIndex]).toBe("Cancel");
  });

  it("honours a custom cancel label", () => {
    const sheet = buildOptionSheet(items, "Close");
    expect(sheet.labels.at(-1)).toBe("Close");
    expect(sheet.cancelButtonIndex).toBe(2);
  });

  it("points destructiveButtonIndex at the destructive item, not the cancel button", () => {
    const sheet = buildOptionSheet(items);
    expect(sheet.destructiveButtonIndex).toBe(1);
    expect(sheet.labels[sheet.destructiveButtonIndex]).toBe("Delete set");
  });

  it("reports -1 when nothing is destructive", () => {
    expect(buildOptionSheet([{ label: "Sort" }]).destructiveButtonIndex).toBe(-1);
  });

  it("marks disabled items for iOS but omits them from the Android list", () => {
    const sheet = buildOptionSheet([
      { label: "Lead (singers only)", disabled: true },
      { label: "Support" },
      { label: "Learn" },
    ]);
    expect(sheet.disabledButtonIndices).toEqual([0]);
    expect(sheet.enabledIndices).toEqual([1, 2]);
  });

  it("keeps enabledIndices aligned with the original items so a tap runs the right one", () => {
    const source = [
      { label: "Lead", disabled: true },
      { label: "Support" },
      { label: "Add to set" },
    ];
    const { enabledIndices } = buildOptionSheet(source);
    // Android shows button 0 = "Support"; it must map back to source index 1.
    expect(source[enabledIndices[0]].label).toBe("Support");
    expect(source[enabledIndices[1]].label).toBe("Add to set");
  });

  it("handles an empty option list without claiming index 0 is cancel-able content", () => {
    const sheet = buildOptionSheet([]);
    expect(sheet.labels).toEqual(["Cancel"]);
    expect(sheet.cancelButtonIndex).toBe(0);
    expect(sheet.enabledIndices).toEqual([]);
  });
});
