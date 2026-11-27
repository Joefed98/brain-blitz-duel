/**
 * A generated name to pre-fill the name box with (P3, 22 Nov 2026; plan section 3.6: the name box is pre-filled with a
 * generated name, one tap to go): one of the approved energy adjectives and nouns (src/lib/names/energyWords.ts, every
 * pairing proved safe by names-check) and a number, "Swift Volt 48", never longer than a guest name may be. Display
 * only: the server checks whatever name is sent, as it checks a typed one. Not a room's content, so Math.random is
 * fine here (rooms derive their content from the room seed on the server).
 */
import { ENERGY_ADJECTIVES, ENERGY_NOUNS } from "@/lib/names/energyWords";
import { GUEST_NAME_MAX } from "@/lib/names/username";

export function generatedGuestName(random: () => number = Math.random): string {
  const pick = <T,>(list: readonly T[]) => list[Math.floor(random() * list.length) % list.length]!;
  for (let i = 0; i < 20; i++) {
    const name = `${pick(ENERGY_ADJECTIVES)} ${pick(ENERGY_NOUNS)} ${10 + Math.floor(random() * 90)}`;
    if (Array.from(name).length <= GUEST_NAME_MAX) return name;
  }
  return `Swift Volt ${10 + Math.floor(random() * 90)}`;
}

/** The stored name, or a generated one when none is stored yet. */
export function nameOrGenerated(stored: string): string {
  return stored.trim() ? stored : generatedGuestName();
}
