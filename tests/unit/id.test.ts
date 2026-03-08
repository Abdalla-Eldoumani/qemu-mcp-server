/** Tests for the VM ID generator. */

import { describe, it, expect } from "vitest";
import { generateVmId } from "../../src/utils/id.js";

/** Known adjectives from the id module. */
const ADJECTIVES = [
  "swift", "bold", "calm", "keen", "warm", "cool", "fast", "slim", "tall",
  "wise", "bright", "sharp", "quick", "steady", "silent", "gentle", "fierce",
  "proud", "brave", "vivid", "agile", "clear", "solid", "quiet", "dark",
];

/** Known nouns from the id module. */
const NOUNS = [
  "fox", "owl", "ram", "elk", "ant", "bee", "jay", "cod", "emu", "yak",
  "wolf", "hawk", "lynx", "puma", "crab", "dove", "frog", "hare", "mule",
  "wren", "bear", "deer", "goat", "seal", "vole",
];

describe("generateVmId", () => {
  it("should match the adjective-noun-4digits format", () => {
    const id = generateVmId();
    expect(id).toMatch(/^[a-z]+-[a-z]+-\d{4}$/);
  });

  it("should use an adjective from the known list", () => {
    const id = generateVmId();
    const adjective = id.split("-")[0];
    expect(ADJECTIVES).toContain(adjective);
  });

  it("should use a noun from the known list", () => {
    const id = generateVmId();
    const noun = id.split("-")[1];
    expect(NOUNS).toContain(noun);
  });

  it("should produce a 4-digit number between 0000 and 9999", () => {
    const id = generateVmId();
    const digits = id.split("-")[2];
    expect(digits).toHaveLength(4);
    const num = parseInt(digits, 10);
    expect(num).toBeGreaterThanOrEqual(0);
    expect(num).toBeLessThanOrEqual(9999);
  });

  it("should generate unique IDs across 100 calls", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateVmId());
    }
    expect(ids.size).toBe(100);
  });
});
