/**
 * The Number games' lever pictures (D2, 22 Nov 2026; plan section 6.1): a small drawing of what each level changes, made
 * from the level's own settings (GAME_LEVELS through gameLevelSettings; Normal from the game's own constants), never a
 * hand-made image, so a picture cannot drift from the game. Read by P2's slot (src/lib/levels/leverPicture.tsx) through
 * its glob of ./pictures/*.tsx and this file's named export LEVER_PICTURES; nothing else imports it. Display only.
 */
import type { JSX, ReactNode } from "react";
import { gameLevelSettings } from "../gameLevels";
import type { Level } from "../levels";
import { BALANCE_NORMAL, type BalanceLevelSettings } from "@/lib/duel/balanceLevels";
import { CHECKOUT_NORMAL, KAKURO_NORMAL, type CheckoutLevelSettings, type KakuroLevelSettings } from "@/lib/duel/numberLevels";
import { MEASURE_NORMAL, type MeasureLevelSettings } from "@/lib/duel/measureLevels";
import type { NpLevelSettings } from "@/lib/duel/numberPyramidLevels";

export interface LeverPictureProps {
  level: Level;
  /** The drawing's width and height in CSS pixels (square). */
  size?: number | undefined;
}

type Picture = (props: LeverPictureProps) => JSX.Element;

const INK = "var(--jz-text-2)";
const DIM = "var(--jz-text-3)";
const GOLD = "var(--jz-gold)";
const RED = "var(--jz-red)";

/** A square SVG with a 100-unit view box. */
function Frame({ size = 64, label, children }: { size?: number | undefined; label: string; children: ReactNode }): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={label} data-lever-picture="">
      {children}
    </svg>
  );
}

/** Counterweight: the first scale's beam and notches, the weights already hung (gold) and those to hang. */
const balance: Picture = ({ level, size }) => {
  const s = (level === "normal" ? BALANCE_NORMAL : gameLevelSettings<BalanceLevelSettings>("balance", level)) ?? BALANCE_NORMAL;
  const scale = (s.scales ?? BALANCE_NORMAL.scales!)[0]!;
  const notches = scale.pegs;
  const step = 86 / notches;
  return (
    <Frame size={size} label={`${notches} notches, ${scale.fixed} hung, ${scale.loose} to hang${s.hide ? ", no readout" : ""}`}>
      <rect x={6} y={40} width={88} height={5} rx={2} fill={INK} />
      <polygon points="50,46 42,62 58,62" fill={DIM} />
      {Array.from({ length: notches }, (_, i) => (
        <rect key={i} x={7 + i * step + step / 2 - 1} y={36} width={2} height={4} fill={DIM} />
      ))}
      {Array.from({ length: scale.fixed }, (_, i) => (
        <rect key={`f${i}`} x={7 + (i * 3 + 1) * step} y={46} width={step - 1} height={9} rx={2} fill={GOLD} />
      ))}
      {Array.from({ length: scale.loose }, (_, i) => (
        <rect key={`l${i}`} x={8 + i * 13} y={76} width={10} height={14} rx={2} fill={INK} />
      ))}
      {s.hide ? null : <rect x={36} y={8} width={28} height={14} rx={4} fill={DIM} />}
    </Frame>
  );
};

/** Exact: one plate a target in the round, and the six numbers under them. */
const target: Picture = ({ level, size }) => {
  const s = level === "normal" ? null : gameLevelSettings<{ rounds?: unknown[]; target?: readonly [number, number] }>("target", level);
  const targets = s?.rounds?.length ?? 1;
  const twoDigit = !!s?.target && s.target[1] < 100;
  const w = 86 / targets;
  return (
    <Frame size={size} label={`${targets === 1 ? "one target" : `${targets} targets in a row`}${twoDigit ? ", two digits" : ""}`}>
      {Array.from({ length: targets }, (_, i) => (
        <rect key={i} x={7 + i * w} y={8} width={w - 4} height={34} rx={6} fill={i === 0 ? GOLD : DIM} />
      ))}
      {Array.from({ length: 6 }, (_, i) => (
        <rect key={`t${i}`} x={7 + (i % 3) * 30} y={52 + Math.floor(i / 3) * 24} width={26} height={20} rx={4} fill={INK} />
      ))}
    </Frame>
  );
};

/** Operator: the first equation's numbers and its gaps (gold circles for signs, gold squares for numbers). */
const equation: Picture = ({ level, size }) => {
  type Line = { count: number; numberGaps: number; signGaps: number };
  const s = level === "normal" ? null : gameLevelSettings<{ lines: readonly Line[] }>("equation", level);
  // Normal's first equation (operatorGaps.server.ts OPERATOR_GAP_RECIPES[0]): three numbers, both signs open.
  const line: Line = s?.lines[0] ?? { count: 3, numberGaps: 0, signGaps: 2 };
  const slots = line.count * 2 - 1;
  const w = 92 / slots;
  return (
    <Frame size={size} label={`${line.count} numbers, ${line.signGaps + line.numberGaps} gaps`}>
      {Array.from({ length: slots }, (_, i) => {
        const isSign = i % 2 === 1;
        const k = Math.floor(i / 2);
        const open = isSign ? k < line.signGaps : k < line.numberGaps;
        return isSign ? (
          <circle key={i} cx={4 + i * w + w / 2} cy={50} r={w / 2.6} fill={open ? GOLD : DIM} />
        ) : (
          <rect key={i} x={4 + i * w + 1} y={50 - w / 2} width={w - 2} height={w} rx={2} fill={open ? GOLD : INK} />
        );
      })}
    </Frame>
  );
};

/** Integer Pyramid: the first pyramid's rows, the stones given (ink) and empty (outline), and how many pyramids. */
const numpyramid: Picture = ({ level, size }) => {
  const s = level === "normal" ? null : gameLevelSettings<NpLevelSettings>("numpyramid", level);
  // Normal's first board (numberPyramidBank.server.ts): five rows, six or seven empty; four boards.
  const stage = s?.stages[0] ?? { rows: 5, minEmpty: 7 };
  const boards = s?.stages.length ?? 4;
  const rows = stage.rows;
  const cells = (rows * (rows + 1)) / 2;
  const cell = 70 / rows;
  let n = 0;
  const stones: JSX.Element[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c <= r; c++, n++) {
      const empty = (n * 7) % cells < stage.minEmpty;
      stones.push(<rect key={n} x={50 - ((r + 1) * cell) / 2 + c * cell} y={4 + r * cell} width={cell - 1.5} height={cell - 1.5} rx={1.5} fill={empty ? "none" : INK} stroke={empty ? GOLD : "none"} strokeWidth={1.5} />);
    }
  return (
    <Frame size={size} label={`${boards} pyramids of ${rows} rows, ${stage.minEmpty} empty`}>
      {stones}
      {Array.from({ length: boards }, (_, i) => (
        <circle key={`b${i}`} cx={50 - (boards - 1) * 6 + i * 12} cy={90} r={4} fill={i === 0 ? GOLD : DIM} />
      ))}
    </Frame>
  );
};

/** Brimful: the first puzzle's jugs and whether the tap is there. */
const measure: Picture = ({ level, size }) => {
  const s = (level === "normal" ? MEASURE_NORMAL : gameLevelSettings<MeasureLevelSettings>("measure", level)) ?? MEASURE_NORMAL;
  const board = "boards" in s ? s.boards[0]! : { jugs: 2, tap: true };
  const w = 70 / board.jugs;
  return (
    <Frame size={size} label={`${board.jugs} jugs${board.tap ? " and the tap" : ", no tap"}`}>
      {board.tap ? <rect x={8} y={6} width={30} height={8} rx={3} fill={GOLD} /> : null}
      {Array.from({ length: board.jugs }, (_, i) => (
        <rect key={i} x={15 + i * w} y={30 + i * 8} width={w - 6} height={62 - i * 8} rx={4} fill="none" stroke={INK} strokeWidth={3} />
      ))}
    </Frame>
  );
};

/** Checkout: the first board's wedges (odd numbers drawn uneven), its minus wedges red and its darts. */
const checkout: Picture = ({ level, size }) => {
  const s = (level === "normal" ? CHECKOUT_NORMAL : gameLevelSettings<CheckoutLevelSettings>("checkout", level)) ?? CHECKOUT_NORMAL;
  const plan = (s.boards ?? CHECKOUT_NORMAL.boards!)[0]!;
  const odd = plan.wedges === "uneven";
  return (
    <Frame size={size} label={`${odd ? "odd numbers" : plan.wedges === "shuffled" ? "shuffled numbers" : "a standard board"}${plan.negatives ? ", minus wedges" : ""}${plan.exact ? `, exactly ${plan.maxDarts} darts` : ""}`}>
      {Array.from({ length: 20 }, (_, i) => {
        const a0 = (2 * Math.PI * i) / 20 - Math.PI / 2;
        const a1 = a0 + (2 * Math.PI) / 20;
        const r = odd ? 26 + ((i * 7) % 5) * 3 : 34;
        const minus = plan.negatives && (i === 3 || i === 12);
        return <path key={i} d={`M50 44 L${50 + r * Math.cos(a0)} ${44 + r * Math.sin(a0)} L${50 + r * Math.cos(a1)} ${44 + r * Math.sin(a1)} Z`} fill={minus ? RED : i % 2 ? INK : DIM} />;
      })}
      {Array.from({ length: plan.maxDarts }, (_, i) => (
        <rect key={`d${i}`} x={50 - plan.maxDarts * 7 + i * 14} y={86} width={10} height={10} rx={2} fill={plan.exact ? GOLD : INK} />
      ))}
    </Frame>
  );
};

/** Ballpark: the ruler and the marks across it (numbered on Easy). */
const numline: Picture = ({ level, size }) => {
  const s = level === "normal" ? null : gameLevelSettings<{ marks?: number; markLabels?: boolean }>("numline", level);
  const marks = s?.marks ?? 0;
  return (
    <Frame size={size} label={marks ? `${marks - 1} marks${s?.markLabels ? ", each numbered" : ""}` : "no marks between the ends"}>
      <rect x={6} y={46} width={88} height={8} rx={3} fill={INK} />
      <rect x={6} y={40} width={3} height={20} fill={GOLD} />
      <rect x={91} y={40} width={3} height={20} fill={GOLD} />
      {Array.from({ length: Math.max(0, marks - 1) }, (_, i) => (
        <g key={i}>
          <rect x={6 + ((i + 1) * 88) / marks - 1} y={42} width={2} height={14} fill={GOLD} />
          {s?.markLabels ? <rect x={6 + ((i + 1) * 88) / marks - 2.5} y={62} width={5} height={7} rx={1} fill={DIM} /> : null}
        </g>
      ))}
    </Frame>
  );
};

/** Kakuro: the grid's squares across and down, the clue row and column dark. */
const kakuro: Picture = ({ level, size }) => {
  const s = (level === "normal" ? KAKURO_NORMAL : gameLevelSettings<KakuroLevelSettings>("kakuro", level)) ?? KAKURO_NORMAL;
  const across = s.size ?? 6;
  const down = s.rows ?? across;
  const cell = 90 / Math.max(across, down);
  return (
    <Frame size={size} label={`${across} across by ${down} down`}>
      {Array.from({ length: across * down }, (_, i) => {
        const r = Math.floor(i / across);
        const c = i % across;
        return <rect key={i} x={5 + c * cell} y={5 + (90 - down * cell) / 2 + r * cell} width={cell - 1.5} height={cell - 1.5} rx={1} fill={r === 0 || c === 0 ? DIM : INK} />;
      })}
    </Frame>
  );
};

export const LEVER_PICTURES: Readonly<Record<string, Picture>> = { balance, target, equation, numpyramid, measure, checkout, numline, kakuro };
