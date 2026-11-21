/**
 * The Word games' lever pictures (D1, 21 Nov 2026; plan section 6.1): a small drawing of what each level changes, made from
 * the level's own settings (GAME_LEVELS through gameLevelSettings; Normal from the rules' own constants), never a
 * hand-made image, so a picture cannot drift from the game. Read by P2's slot (src/lib/levels/leverPicture.tsx) through
 * its glob of ./pictures/*.tsx and this file's named export LEVER_PICTURES; nothing else imports it. Display only.
 */
import type { JSX, ReactNode } from "react";
import { gameLevelSettings } from "../gameLevels";
import type { Level } from "../levels";
import type { WordsmithLevelSettings } from "../word/wordsmith";
import type { WordHuntLevelSettings } from "../word/wordhunt";
import { WORDSEARCH_LEVEL_SETTINGS } from "../word/wordsearch";
import type { LetterWheelLevelSettings } from "../word/letterwheel";
import { STRIKEOUT_LEVEL_SETTINGS, STRIKEOUT_NORMAL_GIVENS } from "../word/strikeout";
import { WORDHUNT_MIN_LENGTH, WORDSMITH_MIN_LENGTH } from "@/lib/duel/types";
import { WS_SIZE, WS_WORDS } from "@/lib/duel/wordSearch";
import { LW_LEVEL_LIMITS, LW_REV5_LIMITS } from "@/lib/duel/letterWheel";
import { SW_EXPERT_LATTICE, SW_HARD_LATTICE, SW_NORMAL_LATTICE, type SwLattice } from "@/lib/duel/swapword";
import { SWAPWORD_LEVEL_SETTINGS } from "../word/swapword";
import { CW_SIZE, CODEWORD_REV, codewordGivensFor } from "@/lib/duel/codeword";
import type { CodewordLevelSettings } from "../word/codeword";
import { TG_SIZE, TG_TILES } from "@/lib/duel/tileGrid";
import { TILEGRID_LEVEL_SETTINGS } from "../word/tilegrid";

export interface LeverPictureProps {
  level: Level;
  /** The drawing's width and height in CSS pixels (square). */
  size?: number | undefined;
}

type Picture = (props: LeverPictureProps) => JSX.Element;

const INK = "var(--jz-text-2)";
const DIM = "var(--jz-text-3)";
const GOLD = "var(--jz-gold)";

/** A square SVG with a 100-unit view box. */
function Frame({ size = 64, label, children }: { size?: number | undefined; label: string; children: ReactNode }): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={label} data-lever-picture="">
      {children}
    </svg>
  );
}

/** A "N+" badge (the shortest word that counts) in the corner. */
function MinBadge({ n }: { n: number }): JSX.Element {
  return (
    <g>
      <rect x={64} y={2} width={34} height={20} rx={6} fill={GOLD} />
      <text x={81} y={17} textAnchor="middle" fontSize={14} fontWeight={800} fill="var(--jz-on-gold)">{`${n}+`}</text>
    </g>
  );
}

/** Nucleus: the ring's letters and the shortest word that counts. */
const wordsmith: Picture = ({ level, size }) => {
  const s = gameLevelSettings<WordsmithLevelSettings>("wordsmith", level);
  const letters = s ? s.sizes[s.sizes.length - 1]! : 9;
  const min = s?.minLength ?? WORDSMITH_MIN_LENGTH;
  const outer = letters - 1;
  return (
    <Frame size={size} label={`${letters} letters, words of ${min} or more`}>
      <circle cx={46} cy={56} r={9} fill={GOLD} />
      {Array.from({ length: outer }, (_, i) => {
        const a = (2 * Math.PI * i) / outer - Math.PI / 2;
        return <circle key={i} cx={46 + 30 * Math.cos(a)} cy={56 + 30 * Math.sin(a)} r={7} fill={INK} />;
      })}
      <MinBadge n={min} />
    </Frame>
  );
};

/** Forage: the 6 × 6 board and the shortest word that counts. */
const wordhunt: Picture = ({ level, size }) => {
  const s = gameLevelSettings<WordHuntLevelSettings>("wordhunt", level);
  const min = s?.minLength ?? WORDHUNT_MIN_LENGTH;
  const n = 6;
  const cell = 76 / n;
  return (
    <Frame size={size} label={`Words of ${min} or more letters`}>
      {Array.from({ length: n * n }, (_, i) => (
        <rect key={i} x={6 + (i % n) * cell} y={20 + Math.floor(i / n) * cell} width={cell - 2} height={cell - 2} rx={2} fill={i < min ? GOLD : DIM} />
      ))}
      <MinBadge n={min} />
    </Frame>
  );
};

/** Lookout: the grid's columns and rows and one chip a word to find. */
const wordsearch: Picture = ({ level, size }) => {
  const s = level === "normal" ? null : WORDSEARCH_LEVEL_SETTINGS[level];
  const cols = s?.cols ?? WS_SIZE;
  const rows = s?.rows ?? WS_SIZE;
  const words = s?.words ?? WS_WORDS;
  const cell = Math.min(70 / cols, 64 / rows);
  const chipW = 100 / Math.max(5, Math.ceil(words / 2)) - 2;
  return (
    <Frame size={size} label={`${cols} by ${rows} grid, ${words} words`}>
      {Array.from({ length: cols * rows }, (_, i) => (
        <rect key={i} x={50 - (cols * cell) / 2 + (i % cols) * cell} y={2 + Math.floor(i / cols) * cell} width={cell - 1} height={cell - 1} fill={DIM} />
      ))}
      {Array.from({ length: words }, (_, i) => (
        <rect key={`w${i}`} x={1 + (i % Math.ceil(words / 2)) * (chipW + 2)} y={i < Math.ceil(words / 2) ? 78 : 90} width={chipW} height={8} rx={3} fill={GOLD} />
      ))}
    </Frame>
  );
};

/** Roundabout: the wheel's letters and one bar a crossword word. */
const letterwheel: Picture = ({ level, size }) => {
  const lim = level === "normal" ? null : LW_LEVEL_LIMITS[level];
  const letters = lim?.letters ?? 7;
  const words = lim?.maxWords ?? LW_REV5_LIMITS.maxWords;
  const s = gameLevelSettings<LetterWheelLevelSettings>("letterwheel", level);
  return (
    <Frame size={size} label={`${letters} letters, up to ${words} words${s?.freeMisses !== undefined ? `, ${s.freeMisses} free misses` : ""}`}>
      {Array.from({ length: words }, (_, i) => (
        <rect key={i} x={4 + (i % 8) * 12} y={4 + Math.floor(i / 8) * 10} width={10} height={7} rx={1} fill={GOLD} />
      ))}
      <circle cx={50} cy={72} r={26} fill="none" stroke={DIM} strokeWidth={2} />
      {Array.from({ length: letters }, (_, i) => {
        const a = (2 * Math.PI * i) / letters - Math.PI / 2;
        return <circle key={`l${i}`} cx={50 + 18 * Math.cos(a)} cy={72 + 18 * Math.sin(a)} r={5.5} fill={INK} />;
      })}
    </Frame>
  );
};

/** Strikeout: five seven-letter words with their starting letters showing. */
const strikeout: Picture = ({ level, size }) => {
  const s = level === "normal" ? STRIKEOUT_NORMAL_GIVENS : STRIKEOUT_LEVEL_SETTINGS[level];
  const shown = [0, 1, 2, 3, 4].map((w) => (w < 3 ? s.givensFirst : s.givensRest)[0]);
  return (
    <Frame size={size} label={`Starting letters ${shown.join(", ")}`}>
      {shown.map((given, w) =>
        Array.from({ length: 7 }, (_, i) => (
          <rect key={`${w}-${i}`} x={4 + i * 13.4} y={6 + w * 19} width={11.4} height={15} rx={2} fill={i < given ? GOLD : DIM} />
        )),
      )}
    </Frame>
  );
};

/** Normal's most tiles in place (swapword.server.ts SW_MAX_IN_PLACE, server-only; word-levels-proof-check proves they agree). */
export const SWAPWORD_NORMAL_IN_PLACE = 5;

/** Swapword: the lattice's tiles (the loops of crossing words), the start's tiles already in place gold. */
const swapword: Picture = ({ level, size }) => {
  const s = level === "normal" ? null : SWAPWORD_LEVEL_SETTINGS[level];
  const lattice: SwLattice = s?.lattice === "hard" ? SW_HARD_LATTICE : s?.lattice === "expert" ? SW_EXPERT_LATTICE : SW_NORMAL_LATTICE;
  const inPlace = s ? s.inPlace[1] : SWAPWORD_NORMAL_IN_PLACE;
  const cell = 92 / Math.max(lattice.cols, lattice.rows);
  return (
    <Frame size={size} label={`${lattice.cells.length} tiles, ${inPlace} in place`}>
      {lattice.cells.map((c, i) => (
        <rect key={i} x={4 + (c % lattice.cols) * cell} y={4 + Math.floor(c / lattice.cols) * cell} width={cell - 1.5} height={cell - 1.5} rx={1.5} fill={i * 7 % lattice.cells.length < inPlace ? GOLD : INK} />
      ))}
    </Frame>
  );
};

/** Cryptogrid: the grid's side, its starting letters gold. */
const codeword: Picture = ({ level, size }) => {
  const s = gameLevelSettings<CodewordLevelSettings>("codeword", level);
  const side = s?.size ?? CW_SIZE;
  const givens = s?.givens ?? codewordGivensFor(CODEWORD_REV);
  const cell = 92 / side;
  return (
    <Frame size={size} label={`${side} by ${side} grid, ${givens} letters given`}>
      {Array.from({ length: side * side }, (_, i) => (
        <rect key={i} x={4 + (i % side) * cell} y={4 + Math.floor(i / side) * cell} width={cell - 1.5} height={cell - 1.5} rx={1} fill={(i * 5) % (side * side) < givens ? GOLD : DIM} />
      ))}
    </Frame>
  );
};

/** Interlock: the board's side and the tray's tiles under it. */
const tilegrid: Picture = ({ level, size }) => {
  const s = level === "normal" ? null : TILEGRID_LEVEL_SETTINGS[level];
  const side = s?.size ?? TG_SIZE;
  const tiles = s?.tiles ?? TG_TILES;
  const cell = 64 / side;
  const perRow = 12;
  return (
    <Frame size={size} label={`${tiles} tiles on a ${side} by ${side} board`}>
      {Array.from({ length: side * side }, (_, i) => (
        <rect key={i} x={50 - 32 + (i % side) * cell} y={2 + Math.floor(i / side) * cell} width={cell - 1} height={cell - 1} fill={DIM} />
      ))}
      {Array.from({ length: tiles }, (_, i) => (
        <rect key={`t${i}`} x={2 + (i % perRow) * 8.1} y={70 + Math.floor(i / perRow) * 9} width={7} height={7.5} rx={1.5} fill={GOLD} />
      ))}
    </Frame>
  );
};

export const LEVER_PICTURES: Readonly<Record<string, Picture>> = { wordsmith, wordhunt, wordsearch, letterwheel, strikeout, swapword, codeword, tilegrid };
