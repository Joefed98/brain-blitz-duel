/** Placeholder until scripts/slider-level-bank.ts writes the proved banks. Server-only. */
export interface SliderLevelBankEntry {
  grid: string;
  words: string[];
  par: number;
}
export const SLIDER_LEVEL_BANK: Record<"hard" | "expert", SliderLevelBankEntry[]> = {"hard":[],"expert":[]};
