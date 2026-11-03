import "client-only";
import { asBuffer } from "@/lib/crypto/bytes";
import { ENGLISH } from "@/lib/crypto/wordlist";

/** 128 bits, the BIP39 default. Checksum adds 4 bits, which is 12 words. */
export const PHRASE_ENTROPY_BYTES = 16;
export const PHRASE_WORD_COUNT = 12;

const WORD_INDEX = new Map(ENGLISH.map((word, index) => [word, index]));

export function normalizePhrase(phrase: string): string {
  return phrase.normalize("NFKD").trim().toLowerCase().split(/\s+/).filter(Boolean).join(" ");
}

function pushByteBits(bits: number[], byte: number) {
  for (let shift = 7; shift >= 0; shift -= 1) bits.push((byte >> shift) & 1);
}

function wordsFromBits(entropy: Uint8Array, hash: Uint8Array): string[] {
  const checksumLength = (entropy.length * 8) / 32;
  const bits: number[] = [];
  for (const byte of entropy) pushByteBits(bits, byte);
  for (let index = 0; index < checksumLength; index += 1) {
    const byte = hash[Math.floor(index / 8)] ?? 0;
    bits.push((byte >> (7 - (index % 8))) & 1);
  }
  const words: string[] = [];
  for (let index = 0; index < bits.length; index += 11) {
    let value = 0;
    for (let bit = 0; bit < 11; bit += 1) value = (value << 1) | (bits[index + bit] ?? 0);
    const word = ENGLISH[value];
    if (!word) throw new Error("Recovery words could not be created.");
    words.push(word);
  }
  return words;
}

/** A 12-word BIP39 phrase. Pass entropy only from tests. */
export async function generatePhrase(entropy: Uint8Array = crypto.getRandomValues(new Uint8Array(PHRASE_ENTROPY_BYTES))): Promise<string> {
  if (entropy.length !== PHRASE_ENTROPY_BYTES) throw new Error("Recovery words need 16 bytes of entropy.");
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", asBuffer(entropy)));
  return wordsFromBits(entropy, hash).join(" ");
}

/** Null when the words are not a 12-word BIP39 phrase. Does not check a circle key. */
export async function phraseEntropy(phrase: string): Promise<Uint8Array | null> {
  const words = normalizePhrase(phrase).split(" ");
  if (words.length !== PHRASE_WORD_COUNT) return null;
  const bits: number[] = [];
  for (const word of words) {
    const index = WORD_INDEX.get(word);
    if (index === undefined) return null;
    for (let shift = 10; shift >= 0; shift -= 1) bits.push((index >> shift) & 1);
  }
  const entropy = new Uint8Array(PHRASE_ENTROPY_BYTES);
  for (let index = 0; index < PHRASE_ENTROPY_BYTES * 8; index += 1) {
    entropy[Math.floor(index / 8)] |= (bits[index] ?? 0) << (7 - (index % 8));
  }
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", asBuffer(entropy)));
  const checksumLength = 4;
  for (let index = 0; index < checksumLength; index += 1) {
    const expected = (hash[Math.floor(index / 8)] >> (7 - (index % 8))) & 1;
    if (bits[PHRASE_ENTROPY_BYTES * 8 + index] !== expected) return null;
  }
  return entropy;
}

function randomIndex(max: number): number {
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  const sample = new Uint32Array(1);
  let value = 0;
  do {
    crypto.getRandomValues(sample);
    value = sample[0] ?? 0;
  } while (value >= limit);
  return value % max;
}

/** Three positions to type back, so continuing means the words were saved. */
export function confirmationIndexes(length = PHRASE_WORD_COUNT, randomInt: (max: number) => number = randomIndex): number[] {
  const chosen: number[] = [];
  const guard = length * 8;
  let spins = 0;
  while (chosen.length < 3 && chosen.length < length) {
    const next = randomInt(length);
    if (!chosen.includes(next)) chosen.push(next);
    spins += 1;
    if (spins > guard) break;
  }
  return chosen.sort((left, right) => left - right);
}
