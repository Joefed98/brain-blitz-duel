/**
 * Game icons for the puzzle games: each game's own art at icon size. Where a game draws its hero
 * with a component (Gridlock's gold car, Blackout's bulb, Eagle Eye's eagle, Heave's crate…), the
 * icon renders that same component, so it stays in step with the game. Where a board is styled
 * DOM rather than a drawing (letter tiles, the Box Six grid, Flash's screen…), the icon is its
 * most recognisable board element redrawn in SVG from the game's own geometry and colours (each
 * one says where from). Text is never shown: any <text> an art component draws is hidden
 * (app-shell.css `.game-icon text`), and letter or number tiles are drawn blank.
 */
import type { ReactNode } from "react";

import { EagleArt } from "@/puzzles/eagleEyeArt";
import { SweetArt } from "@/puzzles/doubleTakeArt";
import { TallyDefs, TallyGlyph } from "@/puzzles/countUp";
import { CardFace } from "@/puzzles/pairMatch";
import { Bulb, BulbDefs } from "@/puzzles/lightsOut";
import { TentIcon, TreeIcon } from "@/puzzles/tents";
import { ChainDefs, NodeGlyph } from "@/puzzles/chainTap";
import { BOARD_DEFS, BoardArt } from "@/puzzles/checkout";
import { EXACT_RINGS } from "@/puzzles/targetNumber";
import { UnblockCarArt } from "@/components/puzzles/pattern/unblockArt";
import { BlockArtDefs, PieceArt } from "@/components/puzzles/pattern/blockPartyArt";
import { PipeArt, PipeDefs } from "@/components/puzzles/pattern/pipesArt";
import { FlowTubes } from "@/components/puzzles/pattern/flowArt";
import { CrateArt, WorkerArt } from "@/components/puzzles/pattern/pushArt";
import { LaserGem } from "@/components/puzzles/pattern/laserArt";
import { RingsDeck } from "@/components/puzzles/pattern/ringsDeck";
import { tilesRampFill } from "@/components/puzzles/pattern/tilesBoard";
import { BALANCE_DEFS, IronKettlebell } from "@/components/puzzles/balanceArt";
import { pieceColour } from "@/components/puzzles/BlockPartyPuzzle";
import { GLYPH_COLOURS } from "@/components/duel/ShapeGlyph";
import { FLOW_COLOUR_HEX } from "@/lib/duel/flow";
import { WIRE_HEX } from "@/lib/duel/bomb";
import { PIPE_E, PIPE_S } from "@/lib/duel/logic";

/** An art component placed in the tile (percentages of the tile); its own <svg> fills the box. */
function Box({
  x,
  y,
  w,
  h,
  children,
  rotate,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  children: ReactNode;
  rotate?: number;
}) {
  return (
    <span
      className="game-icon-box"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: `${w}%`,
        height: `${h}%`,
        transform: rotate ? `rotate(${rotate}deg)` : undefined,
      }}
    >
      {children}
    </span>
  );
}

/** A redrawn board element in a 64-unit space. */
function Art({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className="game-icon-art">
      {children}
    </svg>
  );
}

const GOLD = "#F5B82E";
const SLATE_TOP = "#3A3D4C";
const SLATE_LOW = "#2A2C38";

/** A blank letter tile (the shared word-letter-tile paint: slate, a lighter top, a dark bottom lip). */
function LetterTile({
  x,
  y,
  s,
  fill = SLATE_TOP,
  low = SLATE_LOW,
  edge = "rgba(255,255,255,.12)",
  r = 3,
}: {
  x: number;
  y: number;
  s: number;
  fill?: string;
  low?: string;
  edge?: string;
  r?: number;
}) {
  const id = `lt-${fill.replace(/\W/g, "")}`;
  return (
    <g>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={fill} />
          <stop offset="1" stopColor={low} />
        </linearGradient>
      </defs>
      <rect
        x={x}
        y={y}
        width={s}
        height={s}
        rx={r}
        fill={`url(#${id})`}
        stroke={edge}
        strokeWidth="0.8"
      />
      <rect x={x + 1} y={y + s - 2.2} width={s - 2} height="1.6" rx="0.8" fill="rgba(0,0,0,.28)" />
    </g>
  );
}

export const PUZZLE_ICON_ART: Record<string, () => ReactNode> = {
  /* ------------------------------------------------------------------ word */
  // Nucleus: the atom board (WordsmithRing: orbit r37, a 28% nucleus, 18% discs), discs blank.
  wordsmith: () => (
    <Art>
      <circle
        cx="32"
        cy="32"
        r="23.7"
        fill="none"
        stroke="rgba(77,140,255,.45)"
        strokeWidth="1.4"
      />
      <circle cx="32" cy="32" r="9.5" fill="#2F5FB8" stroke="#A9C6FF" strokeWidth="1.4" />
      {Array.from({ length: 6 }, (_, i) => {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / 6;
        return (
          <circle
            key={i}
            cx={32 + 23.7 * Math.cos(a)}
            cy={32 + 23.7 * Math.sin(a)}
            r="6"
            fill={i === 1 ? GOLD : "#3A3D4C"}
            stroke="rgba(160,190,255,.5)"
            strokeWidth="1"
          />
        );
      })}
    </Art>
  ),
  // Interlock: a cross of blank letter tiles, the made word underlined teal (tileGrid's interlock cells).
  tilegrid: () => (
    <Art>
      {[
        [22, 8],
        [8, 22],
        [22, 22],
        [36, 22],
        [22, 36],
        [22, 50 - 0],
      ]
        .slice(0, 5)
        .map(([x, y], i) => (
          <g key={i}>
            <LetterTile x={x!} y={y!} s={13} />
            {y === 22 ? <rect x={x! + 1} y={y! + 11} width="11" height="2" fill="#2ED3B7" /> : null}
          </g>
        ))}
      <LetterTile x={50} y={22} s={13} />
      <rect x={51} y={33} width="11" height="2" fill="#2ED3B7" />
    </Art>
  ),
  // Slider: rows of blank tiles, the top row locked (gold lock, teal row: wordSlide's Board).
  wordslide: () => (
    <Art>
      {[0, 1, 2].map((row) => (
        <g key={row}>
          {[0, 1, 2].map((col) => (
            <LetterTile
              key={col}
              x={6 + col * 14}
              y={10 + row * 16}
              s={12}
              fill={row === 0 ? "#2E5F58" : SLATE_TOP}
              low={row === 0 ? "#1F403C" : SLATE_LOW}
              edge={row === 0 ? GOLD : "rgba(255,255,255,.12)"}
            />
          ))}
        </g>
      ))}
      {/* lucide Lock, as Slider's row lock */}
      <g
        transform="translate(47 9) scale(0.6)"
        fill="none"
        stroke={GOLD}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </g>
    </Art>
  ),
  // Forage: blank tiles with the swipe path and lit cells (WordHuntBoard's look).
  wordhunt: () => (
    <Art>
      {Array.from({ length: 16 }, (_, i) => {
        const lit = [0, 5, 6, 11].includes(i);
        return (
          <LetterTile
            key={i}
            x={5 + (i % 4) * 14}
            y={5 + Math.floor(i / 4) * 14}
            s={12}
            fill={lit ? "#5A4A22" : SLATE_TOP}
            low={lit ? "#3E3418" : SLATE_LOW}
            edge={lit ? GOLD : "rgba(255,255,255,.12)"}
          />
        );
      })}
      <polyline
        points="11,11 25,25 39,25 53,39"
        fill="none"
        stroke="#4D8CFF"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.75"
      />
    </Art>
  ),
  // Lookout: a grid with a found word's gold run and its strike line (wordSearch's Grid).
  wordsearch: () => (
    <Art>
      {Array.from({ length: 16 }, (_, i) => {
        const found = [0, 5, 10, 15].includes(i);
        return (
          <LetterTile
            key={i}
            x={5 + (i % 4) * 14}
            y={5 + Math.floor(i / 4) * 14}
            s={12}
            fill={found ? GOLD : SLATE_TOP}
            low={found ? "#C99317" : SLATE_LOW}
          />
        );
      })}
      <line
        x1="9"
        y1="9"
        x2="55"
        y2="55"
        stroke="#1F1A0C"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </Art>
  ),
  // Roundabout: the wheel with its letter discs and the gold trace (letterWheel's Wheel), discs blank.
  letterwheel: () => {
    const at = (i: number) => {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
      return [32 + 17 * Math.cos(a), 32 + 17 * Math.sin(a)] as const;
    };
    return (
      <Art>
        <circle cx="32" cy="32" r="28" fill="#262834" />
        <polyline
          points={[0, 1, 3].map((i) => at(i).join(",")).join(" ")}
          fill="none"
          stroke={GOLD}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.7"
        />
        {[0, 1, 2, 3, 4].map((i) => (
          <circle
            key={i}
            cx={at(i)[0]}
            cy={at(i)[1]}
            r="7.2"
            fill={[0, 1, 3].includes(i) ? GOLD : "#3A3D4C"}
          />
        ))}
      </Art>
    );
  },
  // Strikeout: hidden and solved tiles with a strike marker (strikeout's Row and Strikes).
  strikeout: () => (
    <Art>
      {[0, 1, 2, 3].map((i) => (
        <LetterTile
          key={i}
          x={5 + i * 14}
          y={30}
          s={12}
          fill={i % 2 ? GOLD : "#3B3E4D"}
          low={i % 2 ? "#C99317" : "#2C2E3A"}
        />
      ))}
      <circle cx="18" cy="15" r="7" fill="#FF4D4D" />
      <path d="M15 12l6 6M21 12l-6 6" stroke="#2A0A0A" strokeWidth="2" strokeLinecap="round" />
      <circle cx="35" cy="15" r="7" fill="none" stroke="#FF4D4D" strokeWidth="1.6" opacity="0.6" />
    </Art>
  ),
  // Cryptogrid: white cells and black blocks, one cell selected (codeword's Grid).
  codeword: () => (
    <Art>
      <rect x="4" y="4" width="56" height="56" rx="4" fill="#0B0B0F" />
      {Array.from({ length: 16 }, (_, i) => {
        const block = [1, 6, 11, 12].includes(i);
        const sel = i === 9;
        return (
          <rect
            key={i}
            x={6 + (i % 4) * 13.2}
            y={6 + Math.floor(i / 4) * 13.2}
            width="12"
            height="12"
            rx="1.5"
            fill={block ? "#050506" : sel ? "#5D4C1F" : "#2C2E3A"}
            stroke={sel ? GOLD : "none"}
            strokeWidth="1.2"
          />
        );
      })}
    </Art>
  ),
  // Swapword: the figure-eight board's tiles in gold, teal and slate (swapword's Board, SW_TILE_CELLS), blank.
  swapword: () => {
    const cells = [0, 1, 2, 3, 6, 9, 12, 15, 17, 18, 19, 20, 21, 22, 23, 27, 29, 32, 33, 34, 35];
    return (
      <Art>
        {cells.map((cell, i) => {
          const look = i % 5 === 0 ? 2 : i % 3 === 0 ? 1 : 0;
          const fill = look === 2 ? GOLD : look === 1 ? "#2ED3B7" : "#3A3D4C";
          return (
            <rect
              key={cell}
              x={4 + (cell % 6) * 9.4}
              y={4 + Math.floor(cell / 6) * 9.4}
              width="8.4"
              height="8.4"
              rx="1.9"
              fill={fill}
              stroke="rgba(0,0,0,.35)"
              strokeWidth="0.8"
            />
          );
        })}
      </Art>
    );
  },

  /* ---------------------------------------------------------------- number */
  // Counterweight: two cast-iron kettlebells (balanceArt IronKettlebell; its number hidden) under the brass beam.
  balance: () => (
    <>
      <svg width="0" height="0" className="absolute" aria-hidden="true">
        {BALANCE_DEFS}
      </svg>
      <Art>
        <path d="M29 22h6l4 30H25Z" fill="url(#bal-column)" />
        <rect x="16" y="50" width="32" height="6" rx="1.5" fill="url(#bal-wood)" />
        <rect x="5" y="17" width="54" height="6" rx="2.5" fill="url(#bal-brass)" />
        <circle cx="32" cy="20" r="3.2" fill="url(#bal-brass-h)" />
      </Art>
      <Box x={2} y={36} w={30} h={36}>
        <IronKettlebell value={0} fixed={false} width={44} height={52} />
      </Box>
      <Box x={66} y={36} w={30} h={36}>
        <IronKettlebell value={0} fixed width={44} height={52} />
      </Box>
    </>
  ),
  // Exact: the faint bullseye behind the target (targetNumber's EXACT_RINGS), lifted, with a gold hit tile.
  target: () => (
    <>
      <Box x={4} y={4} w={92} h={92}>
        <span className="game-icon-bright">{EXACT_RINGS}</span>
      </Box>
      <Art>
        <rect x="23" y="23" width="18" height="18" rx="5" fill={GOLD} />
        <rect x="23" y="23" width="18" height="6" rx="3" fill="#FFD56A" opacity="0.7" />
      </Art>
    </>
  ),
  // Operator: the gold operator chip in its recessed slot (equation's OperatorSlot, .op-chip), a × drawn as strokes.
  equation: () => (
    <Art>
      <defs>
        <linearGradient id="gi-op" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#FFD56A" />
          <stop offset="0.6" stopColor={GOLD} />
          <stop offset="1" stopColor="#D99A14" />
        </linearGradient>
      </defs>
      <rect x="10" y="10" width="44" height="44" rx="9" fill="#0C0C11" />
      <rect x="13" y="13" width="38" height="38" rx="7.5" fill="url(#gi-op)" />
      <path d="M24 24l16 16M40 24 24 40" stroke="#1A1406" strokeWidth="4.5" strokeLinecap="round" />
    </Art>
  ),
  // Integer Pyramid: stacked sandstone and grey blocks on the plinth (numberPyramid's NP_CSS), blank.
  numpyramid: () => (
    <Art>
      <rect x="4" y="52" width="56" height="6" rx="1.5" fill="#4B463F" />
      {[
        [26, 10, 0],
        [16, 24, 1],
        [36, 24, 0],
        [6, 38, 0],
        [26, 38, 1],
        [46, 38, 1],
      ].map(([x, y, given], i) => (
        <rect
          key={i}
          x={x}
          y={y}
          width="18"
          height="12"
          rx="1.5"
          fill={given ? "#6A655E" : "#D5B27A"}
          stroke={given ? "#48433D" : "#B48B52"}
          strokeWidth="1.2"
        />
      ))}
    </Art>
  ),
  // Trail: the worn footpath over mossy ground with blank stepping stones (trail's TR_CSS, Capsule colours).
  trail: () => (
    <Art>
      <rect x="0" y="0" width="64" height="64" fill="#1C2619" />
      <path
        d="M12 52 L12 32 L32 32 L32 12 L52 12"
        fill="none"
        stroke="#4A3A26"
        strokeWidth="11"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 52 L12 32 L32 32 L32 12 L52 12"
        fill="none"
        stroke="#8F7451"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {[
        [12, 52],
        [12, 32],
        [32, 32],
        [32, 12],
        [52, 12],
      ].map(([x, y], i) => (
        <ellipse
          key={i}
          cx={x}
          cy={y}
          rx="5.5"
          ry="5"
          fill="#D4C9B2"
          stroke="#B3A68B"
          strokeWidth="1"
        />
      ))}
    </Art>
  ),
  // Brimful: the glass jug with its water, ticks and the dashed gold target (measure's MEASURE_CSS).
  measure: () => (
    <Art>
      <path d="M18 8h28v42a8 8 0 0 1-8 8H26a8 8 0 0 1-8-8Z" fill="rgba(200,225,255,.07)" />
      <path d="M19 30 Q25 27.5 32 30 T45 30 V50a7 7 0 0 1-7 7H26a7 7 0 0 1-7-7Z" fill="#3D9BFF" />
      <path d="M19 30 Q25 27.5 32 30 T45 30" fill="none" stroke="#9CCBFF" strokeWidth="1.6" />
      <path
        d="M18 8h28v42a8 8 0 0 1-8 8H26a8 8 0 0 1-8-8Z"
        fill="none"
        stroke="rgba(200,225,255,.6)"
        strokeWidth="2"
      />
      {[18, 28, 38, 48].map((y) => (
        <path key={y} d={`M19 ${y}h5`} stroke="rgba(236,244,255,.9)" strokeWidth="1.3" />
      ))}
      <path d="M14 24h36" stroke={GOLD} strokeWidth="2.4" strokeDasharray="4 3" />
    </Art>
  ),
  // Checkout: the fairground dartboard (checkout's BoardArt, bare: no numbers).
  checkout: () => (
    <svg viewBox="0 0 200 200" aria-hidden="true" className="game-icon-art">
      {BOARD_DEFS}
      <BoardArt wedges={Array(20).fill(1)} quad={false} bare />
    </svg>
  ),
  // Ballpark: the steel tape with its end notches and the gold pushpin (numline's Line and Pin colours), no labels.
  numline: () => (
    <Art>
      <defs>
        <linearGradient id="gi-steel" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#F1F3F7" />
          <stop offset="0.5" stopColor="#C2C7D0" />
          <stop offset="1" stopColor="#959AA6" />
        </linearGradient>
        <radialGradient id="gi-pin" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#FFF3CF" />
          <stop offset="0.5" stopColor={GOLD} />
          <stop offset="1" stopColor="#A8700E" />
        </radialGradient>
      </defs>
      <rect x="4" y="38" width="56" height="12" rx="4" fill="url(#gi-steel)" />
      <path d="M5 50h54" stroke="#30323B" strokeWidth="1" />
      {[10, 54].map((x) => (
        <path key={x} d={`M${x} 38v6`} stroke="#14151A" strokeWidth="3" />
      ))}
      {[20, 27, 34, 41, 48].map((x) => (
        <path key={x} d={`M${x} 38v3`} stroke="#14151A" strokeWidth="1.2" />
      ))}
      <path d="M38 22V40" stroke={GOLD} strokeWidth="2" />
      <circle cx="38" cy="18" r="8" fill="url(#gi-pin)" stroke="#1A1B21" strokeWidth="1.2" />
    </Art>
  ),

  /* ----------------------------------------------------------------- speed */
  // Flash: the arena lit gold, with its soft centre glow and top highlight (reaction's flash-arena).
  reaction: () => (
    <Art>
      <defs>
        <radialGradient id="gi-flash" cx="0.5" cy="0.45" r="0.6">
          <stop offset="0" stopColor="#FFF4CC" />
          <stop offset="0.55" stopColor={GOLD} />
          <stop offset="1" stopColor="#C98A12" />
        </radialGradient>
      </defs>
      <rect x="8" y="8" width="48" height="48" rx="11" fill="url(#gi-flash)" />
      <rect x="10" y="9" width="44" height="1.5" rx="0.75" fill="rgba(255,255,255,.5)" />
    </Art>
  ),
  // Ascend: domed discs on the felt, one done in gold (numberHunt's ascend-disc), blank.
  numhunt: () => (
    <Art>
      <defs>
        <radialGradient id="gi-disc-done" cx="0.35" cy="0.28" r="0.8">
          <stop offset="0" stopColor="#FFE7A6" />
          <stop offset="0.5" stopColor={GOLD} />
          <stop offset="1" stopColor="#C98A12" />
        </radialGradient>
        <radialGradient id="gi-disc" cx="0.35" cy="0.28" r="0.8">
          <stop offset="0" stopColor="#5A5D6C" />
          <stop offset="0.48" stopColor="#30323E" />
          <stop offset="1" stopColor="#1C1D25" />
        </radialGradient>
      </defs>
      <path
        d="M18 46 30 30 46 18"
        stroke="rgba(245,184,46,.35)"
        strokeWidth="2"
        strokeDasharray="2 3"
        fill="none"
      />
      <circle cx="18" cy="46" r="10" fill="url(#gi-disc-done)" stroke="#C98A12" strokeWidth="1.5" />
      <circle cx="32" cy="29" r="9" fill="url(#gi-disc)" stroke="#4A4D5C" strokeWidth="1.5" />
      <circle cx="47" cy="17" r="8" fill="url(#gi-disc)" stroke="#4A4D5C" strokeWidth="1.5" />
    </Art>
  ),
  // Bang On: the gauge face with its ticks, the gold zone and line, and the white marker (stopWatch's Bar).
  stopwatch: () => (
    <Art>
      <rect
        x="4"
        y="20"
        width="56"
        height="24"
        rx="7"
        fill="#22232D"
        stroke="#3A3A46"
        strokeWidth="2"
      />
      {Array.from({ length: 11 }, (_, i) => (
        <path
          key={i}
          d={`M${8 + i * 4.8} 22v${i % 2 ? 2 : 4}M${8 + i * 4.8} 42v-${i % 2 ? 2 : 4}`}
          stroke="rgba(255,255,255,.34)"
          strokeWidth="0.9"
        />
      ))}
      <rect x="26" y="22" width="12" height="20" fill="rgba(245,184,46,.45)" />
      <rect x="30.5" y="22" width="3" height="20" fill={GOLD} />
      <rect x="40" y="21" width="4" height="22" rx="2" fill="#F4F4F7" />
    </Art>
  ),
  // Don't Break the Chain: enamel charms joined by gold links (chainTap's NodeGlyph and its link colour).
  chain: () => (
    <>
      <ChainDefs />
      <Art>
        <path
          d="M18 20 32 34 46 20"
          fill="none"
          stroke="#8A6214"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M18 20 32 34 46 20"
          fill="none"
          stroke={GOLD}
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Art>
      <Box x={10} y={14} w={30} h={30}>
        <NodeGlyph shape="circle" size={30} colour={GLYPH_COLOURS.RED} />
      </Box>
      <Box x={36} y={40} w={30} h={30}>
        <NodeGlyph shape="square" size={30} colour={GLYPH_COLOURS.BLUE} />
      </Box>
      <Box x={60} y={14} w={30} h={30}>
        <NodeGlyph shape="triangle" size={30} colour={GLYPH_COLOURS.GREEN} />
      </Box>
    </>
  ),

  /* ------------------------------------------------------------- attention */
  // Eagle Eye: the eagle seen from above (eagleEyeArt's EagleArt).
  symscan: () => (
    <Box x={14} y={14} w={72} h={72}>
      <span className="game-icon-gold">
        <EagleArt dir="N" size={46} />
      </span>
    </Box>
  ),
  // Double Take: a lollipop from the sweet shop (doubleTakeArt's SweetArt).
  spotdiff: () => (
    <svg viewBox="-4 -4 48 48" aria-hidden="true" className="game-icon-art">
      <SweetArt kind="circle" fill="var(--sweet-pink)" />
    </svg>
  ),
  // Tally: three bevelled shapes in the tray (countUp's TallyGlyph).
  countup: () => (
    <>
      <TallyDefs />
      <Box x={8} y={10} w={46} h={46}>
        <TallyGlyph shape="star" colour="GOLD" size={28} />
      </Box>
      <Box x={48} y={30} w={42} h={42}>
        <TallyGlyph shape="circle" colour="BLUE" size={26} />
      </Box>
      <Box x={14} y={54} w={38} h={38}>
        <TallyGlyph shape="triangle" colour="GREEN" size={24} />
      </Box>
    </>
  ),
  // Labyrinth: stone walls on the flagstone floor, the gold route, star and player (mazeDash's MazeBoard colours).
  maze: () => (
    <Art>
      <rect x="4" y="4" width="56" height="56" rx="3" fill="#1A1F26" />
      <path
        d="M8 8h48v48H8Z M22 8v28 M36 22v34 M22 36h-8 M36 22h12 M48 22v20"
        fill="none"
        stroke="rgba(0,0,0,.6)"
        strokeWidth="5.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        transform="translate(0.8 1.2)"
      />
      <path
        d="M8 8h48v48H8Z M22 8v28 M36 22v34 M22 36h-8 M36 22h12 M48 22v20"
        fill="none"
        stroke="#8E9AA8"
        strokeWidth="4.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 8h48v48H8Z M22 8v28 M36 22v34 M22 36h-8 M36 22h12 M48 22v20"
        fill="none"
        stroke="#C9D2DC"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points="15,48 15,44 29,44 29,15 42,15 42,30 52,30 52,48"
        fill="none"
        stroke={GOLD}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.85"
      />
      <circle cx="15" cy="48" r="3.6" fill={GOLD} />
      <polygon
        points="52,43 53.5,46.6 57.2,46.8 54.3,49.1 55.3,52.8 52,50.7 48.7,52.8 49.7,49.1 46.8,46.8 50.5,46.6"
        fill={GOLD}
      />
    </Art>
  ),
  // Matchmaker: a card back and a face-up card (pairMatch's CardFace).
  pairmatch: () => (
    <>
      <Art>
        <defs>
          <pattern
            id="gi-lattice"
            width="5"
            height="5"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <path d="M0 0v5" stroke="rgba(255,107,214,.35)" strokeWidth="1.2" />
          </pattern>
        </defs>
        <rect
          x="6"
          y="10"
          width="26"
          height="36"
          rx="4"
          fill="#3A1F33"
          transform="rotate(-8 19 28)"
        />
        <rect
          x="6"
          y="10"
          width="26"
          height="36"
          rx="4"
          fill="url(#gi-lattice)"
          transform="rotate(-8 19 28)"
        />
        <rect
          x="31"
          y="18"
          width="27"
          height="36"
          rx="4"
          fill="#2C2E3A"
          stroke={GOLD}
          strokeWidth="1.4"
          transform="rotate(7 44 36)"
        />
      </Art>
      <Box x={53} y={39} w={30} h={30} rotate={7}>
        <CardFace card={{ shape: "star", colour: "PINK" }} size={20} />
      </Box>
    </>
  ),

  /* --------------------------------------------------------------- pattern */
  // Gridlock: the gold car (unblockArt's UnblockCarArt).
  unblock: () => (
    <Box x={8} y={30} w={84} h={42}>
      <UnblockCarArt id={0} axis="h" len={2} />
    </Box>
  ),
  // Tessellate: a bevelled L piece (blockPartyArt's PieceArt).
  blockparty: () => (
    <svg viewBox="-20 -20 240 240" aria-hidden="true" className="game-icon-art">
      <BlockArtDefs>
        <PieceArt
          cells={[
            [0, 0],
            [0, 1],
            [1, 1],
          ]}
          colour={pieceColour(3)}
        />
      </BlockArtDefs>
    </svg>
  ),
  // Pipeline: a wet elbow pipe on its steel tile (pipesArt's PipeArt and PipeDefs).
  pipes: () => (
    <>
      <PipeDefs id="gi-pipe" />
      <Box x={0} y={0} w={100} h={100}>
        <PipeArt id="gi-pipe" mask={PIPE_E | PIPE_S} wet source={false} inflow={0} turnKey={0} />
      </Box>
    </>
  ),
  // Chroma Lines: two marble dots joined by a tube (flowArt's FlowTubes, flow's dot paint).
  flow: () => {
    const red = FLOW_COLOUR_HEX.RED;
    return (
      <Art>
        <FlowTubes
          tubes={[
            {
              colour: red,
              points: [
                { x: 14, y: 16 },
                { x: 14, y: 48 },
                { x: 50, y: 48 },
              ],
              joined: true,
            },
          ]}
          width={9}
          pulse={new Set()}
          solved={false}
        />
        {[
          [14, 16],
          [50, 48],
        ].map(([x, y]) => (
          <g key={x}>
            <circle cx={x} cy={y} r="8.5" fill="rgba(10,11,15,.9)" />
            <circle cx={x} cy={y} r="7" fill={red} />
            <circle cx={x! - 2.2} cy={y! - 2.6} r="2.2" fill="rgba(255,255,255,.85)" />
          </g>
        ))}
      </Art>
    );
  },
  // Skid: the blue puck on pale ice with its frost trail (iceslide's ice-ball and ice sheet colours).
  iceslide: () => (
    <Art>
      <defs>
        <linearGradient id="gi-ice" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#F4FBFF" />
          <stop offset="0.5" stopColor="#DCEFF9" />
          <stop offset="1" stopColor="#C9E3F1" />
        </linearGradient>
        <radialGradient id="gi-puck" cx="0.34" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#D6EFFF" />
          <stop offset="0.18" stopColor="#5FB0EC" />
          <stop offset="0.52" stopColor="#075BA8" />
          <stop offset="1" stopColor="#03264A" />
        </radialGradient>
      </defs>
      <rect x="4" y="4" width="56" height="56" rx="6" fill="url(#gi-ice)" />
      <path d="M8 40h22" stroke="rgba(120,185,225,.55)" strokeWidth="9" strokeLinecap="round" />
      <path d="M10 40h20" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
      <circle
        cx="40"
        cy="40"
        r="11"
        fill="url(#gi-puck)"
        stroke="rgba(255,255,255,.4)"
        strokeWidth="1"
      />
      <rect x="44" y="8" width="12" height="12" rx="2" fill="#F5B82E" />
    </Art>
  ),
  // Heave: the crate and the hard-hat worker (pushArt's CrateArt and WorkerArt).
  push: () => (
    <>
      <Box x={36} y={30} w={56} h={56}>
        <CrateArt home={false} />
      </Box>
      <Box x={6} y={34} w={42} h={42}>
        <WorkerArt />
      </Box>
    </>
  ),
  // Lightbender: a lit gem with the beam reaching it (laserArt's LaserGem, the beam's colours).
  laser: () => (
    <>
      <Art>
        <path d="M0 40h26" stroke="#F7C548" strokeWidth="4" strokeLinecap="round" />
        <path d="M0 40h26" stroke="#FFF8E0" strokeWidth="1.5" strokeLinecap="round" />
      </Art>
      <Box x={30} y={24} w={60} h={60}>
        <LaserGem lit />
      </Box>
    </>
  ),
  // Topsy-Turvy: shaded balls in the tray beside a colour-ringed socket (gravity's tray, ball and socket paint).
  gravity: () => (
    <Art>
      <defs>
        <radialGradient id="gi-grav-a" cx="0.34" cy="0.28" r="0.8">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.16" stopColor="#FCE2A6" />
          <stop offset="0.46" stopColor={GOLD} />
          <stop offset="1" stopColor="#6E4F10" />
        </radialGradient>
        <radialGradient id="gi-grav-b" cx="0.34" cy="0.28" r="0.8">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.16" stopColor="#B5F0EA" />
          <stop offset="0.46" stopColor="#2FD4C4" />
          <stop offset="1" stopColor="#11564F" />
        </radialGradient>
      </defs>
      <rect
        x="4"
        y="4"
        width="56"
        height="56"
        rx="8"
        fill="#20242F"
        stroke="#3A4052"
        strokeWidth="2"
      />
      <rect x="10" y="10" width="44" height="44" rx="4" fill="#181D2A" />
      <rect x="10" y="10" width="14" height="14" rx="2" fill="#6E778B" />
      <circle cx="46" cy="18" r="6.5" fill="#0B0E16" stroke="#2FD4C4" strokeWidth="2" />
      <circle cx="20" cy="45" r="8" fill="url(#gi-grav-a)" />
      <circle cx="37" cy="45" r="8" fill="url(#gi-grav-b)" />
    </Art>
  ),
  // Jumbled: bevelled sliding tiles in the ramp's colours with the empty gap (tilesBoard's tilesRampFill), blank.
  tiles: () => (
    <Art>
      <rect x="4" y="4" width="56" height="56" rx="6" fill="#262834" />
      {Array.from({ length: 9 }, (_, i) =>
        i === 8 ? (
          <rect
            key={i}
            x={7 + (i % 3) * 17}
            y={7 + Math.floor(i / 3) * 17}
            width="16"
            height="16"
            rx="3"
            fill="#121318"
          />
        ) : (
          <g key={i}>
            <rect
              x={7 + (i % 3) * 17}
              y={7 + Math.floor(i / 3) * 17}
              width="16"
              height="16"
              rx="3"
              fill={tilesRampFill(i + 1)}
            />
            <rect
              x={7 + (i % 3) * 17}
              y={7 + Math.floor(i / 3) * 17}
              width="16"
              height="6"
              rx="3"
              fill="rgba(255,255,255,.22)"
            />
          </g>
        ),
      )}
    </Art>
  ),
  // Turntable: the record of coloured ring segments on its deck (ringsDeck's RingsDeck).
  rings: () => (
    <Box x={0} y={0} w={100} h={100}>
      <RingsDeck
        segments={Array.from({ length: 5 }, (_, r) =>
          Array.from({ length: 8 }, (_, s) => (s + r) % 4),
        )}
        offsets={[0, 0, 0, 0, 0]}
        size={64}
      />
    </Box>
  ),

  /* ----------------------------------------------------------------- logic */
  // Blackout: a lit bulb in its socket (lightsOut's Bulb and BulbDefs).
  lightsout: () => (
    <>
      <BulbDefs ids="gi-bulb" />
      <Box x={12} y={6} w={76} h={88}>
        <Bulb on ids="gi-bulb" />
      </Box>
    </>
  ),
  // Box Six: one 2 × 3 box of the grid in its thick frame, a row in teal and a gold selected cell (miniSudoku's look).
  sudoku: () => (
    <Art>
      {Array.from({ length: 6 }, (_, i) => {
        const x = 8 + (i % 3) * 16;
        const y = 16 + Math.floor(i / 3) * 16;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width="16"
            height="16"
            fill={i === 4 ? "rgba(245,184,46,.25)" : i < 3 ? "rgba(46,211,183,.16)" : "#25262F"}
            stroke={i === 4 ? GOLD : "rgba(120,124,140,.6)"}
            strokeWidth={i === 4 ? 2 : 0.8}
          />
        );
      })}
      <rect x="8" y="16" width="48" height="32" fill="none" stroke="#F2F2F5" strokeWidth="3" />
    </Art>
  ),
  // Hanoi: graduated rings on the wooden post (tower's --hanoi colours and wood).
  tower: () => (
    <Art>
      <rect x="30" y="10" width="4" height="40" rx="2" fill="#A8743F" />
      <rect x="8" y="50" width="48" height="6" rx="2" fill="#6B4423" />
      {[
        ["#7E6BF0", 44],
        ["#E0508F", 34],
        ["#FF9A3D", 24],
        ["#FFE14D", 16],
      ].map(([fill, w], i) => (
        <rect
          key={i}
          x={32 - (w as number) / 2}
          y={42 - i * 8}
          width={w}
          height="7.5"
          rx="3.75"
          fill={fill as string}
          stroke="rgba(0,0,0,.25)"
          strokeWidth="0.8"
        />
      ))}
    </Art>
  ),
  // Polypotions: a corked flask of stacked potions (sortTubes' flask, layers and cork).
  tubes: () => (
    <Art>
      <clipPath id="gi-flask">
        <path d="M23 12h18v38a9 9 0 0 1-18 0Z" />
      </clipPath>
      <g clipPath="url(#gi-flask)">
        {[GLYPH_COLOURS.RED, GLYPH_COLOURS.BLUE, GLYPH_COLOURS.GREEN, GLYPH_COLOURS.PURPLE].map(
          (fill, i) => (
            <rect key={i} x="23" y={50 - i * 9.5} width="18" height="10" fill={fill} />
          ),
        )}
      </g>
      <path
        d="M23 12h18v38a9 9 0 0 1-18 0Z"
        fill="rgba(200,225,255,.07)"
        stroke="rgba(200,225,255,.45)"
        strokeWidth="2"
      />
      <rect x="25" y="16" width="2.5" height="28" rx="1.2" fill="rgba(255,255,255,.35)" />
      <rect
        x="24"
        y="5"
        width="16"
        height="8"
        rx="2"
        fill="#B88552"
        stroke="#7A5332"
        strokeWidth="1"
      />
    </Art>
  ),
  // Safe Cracker: three brass drums with roll shading (safeCracker's logic-drum), blank.
  safe: () => (
    <Art>
      <defs>
        <linearGradient id="gi-brass" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#8C6A2A" />
          <stop offset="0.3" stopColor="#E9C77A" />
          <stop offset="0.6" stopColor="#C99A3E" />
          <stop offset="1" stopColor="#7A5A20" />
        </linearGradient>
        <linearGradient id="gi-roll" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="rgba(0,0,0,.45)" />
          <stop offset="0.3" stopColor="rgba(0,0,0,0)" />
          <stop offset="0.7" stopColor="rgba(0,0,0,0)" />
          <stop offset="1" stopColor="rgba(0,0,0,.45)" />
        </linearGradient>
      </defs>
      <rect
        x="4"
        y="14"
        width="56"
        height="36"
        rx="6"
        fill="#1D1E25"
        stroke="#3A3D45"
        strokeWidth="1.5"
      />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect
            x={9 + i * 16.5}
            y="18"
            width="13"
            height="28"
            rx="2.5"
            fill="url(#gi-brass)"
            stroke={i === 2 ? GOLD : "#5E4718"}
            strokeWidth="1.2"
          />
          <rect x={9 + i * 16.5} y="18" width="13" height="28" rx="2.5" fill="url(#gi-roll)" />
          <path d={`M${10 + i * 16.5} 32h11`} stroke="rgba(32,23,10,.55)" strokeWidth="1" />
        </g>
      ))}
    </Art>
  ),
  // Bomb Defusal: wires between gold terminals on the bomb plate, one cut (bombDefusal's Panel; WIRE_HEX).
  bomb: () => (
    <Art>
      <rect
        x="4"
        y="8"
        width="56"
        height="48"
        rx="5"
        fill="#1A1B21"
        stroke="#3A3D45"
        strokeWidth="1.5"
      />
      <path d="M4 12h56" stroke={GOLD} strokeWidth="3" strokeDasharray="4 4" />
      {[WIRE_HEX.RED, WIRE_HEX.BLUE, WIRE_HEX.YELLOW, WIRE_HEX.GREEN].map((colour, i) => {
        const y = 22 + i * 9;
        return (
          <g key={i}>
            {i === 1 ? (
              <>
                <path
                  d={`M14 ${y} Q22 ${y + 4} 28 ${y + 1}`}
                  stroke={colour}
                  strokeWidth="3.4"
                  fill="none"
                  strokeLinecap="round"
                />
                <path
                  d={`M36 ${y + 1} Q44 ${y - 3} 50 ${y}`}
                  stroke={colour}
                  strokeWidth="3.4"
                  fill="none"
                  strokeLinecap="round"
                />
                <circle cx="28.5" cy={y + 1} r="1.4" fill="#D98A3D" />
                <circle cx="35.5" cy={y + 1} r="1.4" fill="#D98A3D" />
              </>
            ) : (
              <path
                d={`M14 ${y} Q32 ${y + (i % 2 ? -4 : 4)} 50 ${y}`}
                stroke={colour}
                strokeWidth="3.4"
                fill="none"
                strokeLinecap="round"
              />
            )}
            <rect x="8" y={y - 3} width="6" height="6" rx="1.2" fill="#E2C27A" />
            <rect x="50" y={y - 3} width="6" height="6" rx="1.2" fill="#E2C27A" />
          </g>
        );
      })}
    </Art>
  ),
  // Mosaic: the gold picture cells against dark empties (nonogram's Board), clues left out.
  nonogram: () => (
    <Art>
      {["01110", "11011", "11111", "01110", "00100"].flatMap((row, r) =>
        [...row].map((on, c) => (
          <rect
            key={`${r}-${c}`}
            x={6 + c * 10.6}
            y={6 + r * 10.6}
            width="9.6"
            height="9.6"
            rx="1.4"
            fill={on === "1" ? GOLD : "#25262F"}
            stroke={on === "1" ? "#C98A12" : "rgba(120,124,140,.4)"}
            strokeWidth="0.8"
          />
        )),
      )}
    </Art>
  ),
  // Colour Flood: the wet-paint regions (colourFlood's --flood fills and edges).
  flood: () => {
    const fills = ["#E0508F", "#3D7BFF", "#5EE6C8", "#FFE14D", "#FF8A1F"];
    const grid = [0, 1, 1, 2, 0, 1, 3, 2, 3, 3, 1, 1, 2, 4, 4, 1];
    return (
      <Art>
        {grid.map((v, i) => (
          <rect
            key={i}
            x={6 + (i % 4) * 13}
            y={6 + Math.floor(i / 4) * 13}
            width="13"
            height="13"
            fill={fills[v]}
            stroke="rgba(10,10,15,.55)"
            strokeWidth="0.9"
          />
        ))}
        <rect x="6" y="6" width="13" height="13" fill="rgba(255,255,255,.24)" />
      </Art>
    );
  },
  // Tents and Trees: the striped tent beside a pine (tents' TentIcon and TreeIcon).
  tents: () => (
    <>
      <Box x={2} y={26} w={56} h={56}>
        <TentIcon />
      </Box>
      <Box x={48} y={10} w={48} h={56}>
        <TreeIcon cell={1} />
      </Box>
    </>
  ),
  // Shikaku: gold glass panes over the grid (shikaku's logic-pane), clues left out.
  shikaku: () => (
    <Art>
      {Array.from({ length: 16 }, (_, i) => (
        <rect
          key={i}
          x={6 + (i % 4) * 13}
          y={6 + Math.floor(i / 4) * 13}
          width="13"
          height="13"
          fill="#25262F"
          stroke="rgba(120,124,140,.45)"
          strokeWidth="0.7"
        />
      ))}
      {[
        [6, 6, 39, 13],
        [6, 19, 13, 39],
        [19, 19, 39, 26],
        [45, 6, 13, 52],
      ].map(([x, y, w, h], i) => (
        <g key={i}>
          <rect
            x={x! + 1.2}
            y={y! + 1.2}
            width={w! - 2.4}
            height={h! - 2.4}
            rx="2"
            fill="rgba(245,184,46,.32)"
            stroke={GOLD}
            strokeWidth="2"
          />
          <rect
            x={x! + 2.5}
            y={y! + 2.5}
            width={w! - 5}
            height="2"
            rx="1"
            fill="rgba(255,255,255,.3)"
          />
        </g>
      ))}
      <rect x="19" y="45" width="26" height="13" fill="#25262F" />
    </Art>
  ),
  // Lamplighter: a glowing lamp with its beams along the row and column, beside a wall (lightUp's lamp and beam).
  lightup: () => (
    <Art>
      <defs>
        <radialGradient id="gi-lamp" cx="0.4" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#FFFBEA" />
          <stop offset="0.35" stopColor="#FFE08A" />
          <stop offset="0.7" stopColor={GOLD} />
          <stop offset="1" stopColor="#C68412" />
        </radialGradient>
      </defs>
      <rect x="4" y="4" width="56" height="56" rx="4" fill="#17140F" />
      <rect x="4" y="27" width="56" height="6" fill="rgba(255,214,120,.55)" />
      <rect x="27" y="4" width="6" height="34" fill="rgba(255,214,120,.55)" />
      <rect
        x="20"
        y="40"
        width="20"
        height="20"
        rx="2"
        fill="#0B0B0F"
        stroke="#2A2620"
        strokeWidth="1"
      />
      <circle cx="30" cy="30" r="11" fill="rgba(255,200,90,.35)" />
      <circle cx="30" cy="30" r="8" fill="url(#gi-lamp)" />
    </Art>
  ),
};
