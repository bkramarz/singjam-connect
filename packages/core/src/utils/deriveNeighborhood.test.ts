import { describe, it, expect } from "vitest";
import { deriveNeighborhood } from "./deriveNeighborhood";

describe("deriveNeighborhood", () => {
  describe("citiesOnly", () => {
    it("uses mainText plus the first segment of secondaryText", () => {
      expect(deriveNeighborhood("Brooklyn", "New York, NY, USA", true)).toBe(
        "Brooklyn, New York",
      );
    });

    it("returns mainText alone when there is no secondaryText", () => {
      expect(deriveNeighborhood("San Francisco", undefined, true)).toBe("San Francisco");
    });
  });

  describe("full address (citiesOnly = false)", () => {
    it("drops street and country, keeping city and state", () => {
      expect(deriveNeighborhood("Blue Bottle", "300 Webster St, Oakland, CA, USA")).toBe(
        "Oakland, CA",
      );
    });

    it("keeps the first two parts when there are fewer than three", () => {
      expect(deriveNeighborhood("Oakland", "CA, USA")).toBe("CA, USA");
    });

    it("returns mainText when there is no secondaryText", () => {
      expect(deriveNeighborhood("Oakland", undefined)).toBe("Oakland");
    });
  });
});
