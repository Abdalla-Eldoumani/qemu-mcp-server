/** Generate human-readable VM IDs in adjective-noun-digits format. */

/** Computing and nature themed adjectives. */
const ADJECTIVES = [
  "swift",
  "bold",
  "calm",
  "keen",
  "warm",
  "cool",
  "fast",
  "slim",
  "tall",
  "wise",
  "bright",
  "sharp",
  "quick",
  "steady",
  "silent",
  "gentle",
  "fierce",
  "proud",
  "brave",
  "vivid",
  "agile",
  "clear",
  "solid",
  "quiet",
  "dark",
];

/** Animal and computing themed nouns. */
const NOUNS = [
  "fox",
  "owl",
  "ram",
  "elk",
  "ant",
  "bee",
  "jay",
  "cod",
  "emu",
  "yak",
  "wolf",
  "hawk",
  "lynx",
  "puma",
  "crab",
  "dove",
  "frog",
  "hare",
  "mule",
  "wren",
  "bear",
  "deer",
  "goat",
  "seal",
  "vole",
];

/** Pick a random element from an array. */
function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/** Generate a random 4-digit number as a zero-padded string. */
function randomDigits(): string {
  return String(Math.floor(Math.random() * 10000)).padStart(4, "0");
}

/** Generate a human-readable VM ID like "swift-fox-4821". */
export function generateVmId(): string {
  const adjective = pickRandom(ADJECTIVES);
  const noun = pickRandom(NOUNS);
  const digits = randomDigits();
  return `${adjective}-${noun}-${digits}`;
}
