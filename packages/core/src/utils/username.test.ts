import { describe, it, expect } from "vitest";
import {
  USERNAME_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  RESERVED_USERNAMES,
  normalizeUsername,
  isValidUsername,
  suggestUsername,
} from "./username";

describe("normalizeUsername", () => {
  it("lowercases and trims", () => {
    expect(normalizeUsername("  JamFan  ")).toBe("jamfan");
  });

  it("strips characters that are not letters, numbers, or underscores", () => {
    expect(normalizeUsername("jam.fan!")).toBe("jamfan");
    expect(normalizeUsername("a b-c")).toBe("abc");
  });

  it("keeps underscores and digits", () => {
    expect(normalizeUsername("jam_fan_99")).toBe("jam_fan_99");
  });
});

describe("isValidUsername", () => {
  it("accepts a normal lowercase username", () => {
    expect(isValidUsername("jamfan")).toBe(true);
    expect(isValidUsername("jam_fan_99")).toBe(true);
  });

  it("accepts uppercase input by normalizing it first", () => {
    expect(isValidUsername("JamFan")).toBe(true);
  });

  it("rejects usernames shorter than the minimum", () => {
    expect(isValidUsername("ab")).toBe(false);
  });

  it("rejects usernames longer than the maximum", () => {
    expect(isValidUsername("a".repeat(USERNAME_MAX_LENGTH + 1))).toBe(false);
  });

  it("accepts usernames at the length boundaries", () => {
    expect(isValidUsername("a".repeat(USERNAME_MIN_LENGTH))).toBe(true);
    expect(isValidUsername("a".repeat(USERNAME_MAX_LENGTH))).toBe(true);
  });

  it("rejects reserved usernames", () => {
    for (const reserved of RESERVED_USERNAMES) {
      expect(isValidUsername(reserved)).toBe(false);
    }
  });

  it("rejects a value that normalizes below the minimum length", () => {
    // "a.b" strips to "ab" (2 chars)
    expect(isValidUsername("a.b")).toBe(false);
  });
});

describe("suggestUsername", () => {
  it("derives a normalized username from the email local part", () => {
    expect(suggestUsername("JamFan@example.com")).toBe("jamfan");
    expect(suggestUsername("jam.fan.99@example.com")).toBe("jamfan99");
  });

  it("truncates to the maximum length", () => {
    expect(suggestUsername("a".repeat(30) + "@example.com")).toBe("a".repeat(USERNAME_MAX_LENGTH));
  });

  it("returns empty string when the local part can't form a valid username", () => {
    expect(suggestUsername("a.b@example.com")).toBe(""); // normalizes to "ab" (too short)
    expect(suggestUsername("admin@example.com")).toBe(""); // reserved
  });
});
