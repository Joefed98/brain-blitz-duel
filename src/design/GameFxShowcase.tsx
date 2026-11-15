import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { FxCountUp, FxNewBest, FxStars, ResultPayoff } from "@/components/fx/GameFx";
import { Button, SectionHeader, Segmented } from "@/design/components";
import { GAME_FX, GAME_FX_KINDS, forceGameFxVariant, gameFx, releaseGameFx, type GameFxKind, type GameFxVariant } from "@/lib/fx/kit";

/**
 * The effects kit's showcase (/dev-design, development only; docs/design/game-fx/README.md): every kind on a sample
 * piece, played on a tap, in any variant (Device follows this device's own settings; Full, Lite, Reduced and Calm
 * force one), and the round-end payoff. For Joe to judge the effects; never in a production build.
 */
const VARIANTS: { id: GameFxVariant; label: string }[] = [
  { id: "full", label: "Full" },
  { id: "lite", label: "Lite" },
  { id: "reduced", label: "Reduced" },
  { id: "calm", label: "Calm" },
];

const NAMES: Record<GameFxKind, string> = {
  tap: "Tap or press",
  pickUp: "Pick up",
  drop: "Drop or place",
  slide: "Slide or move",
  pour: "Pour or flow",
  match: "Match or clear",
  wrong: "Wrong",
  combo: "Combo or streak",
  countUp: "Score count-up",
  nearMiss: "Near miss",
  win: "Round-end win",
  newBest: "New best",
  stars: "Stars landing",
};

function Piece({ children, tone = "accent" }: { children?: ReactNode; tone?: "accent" | "gold" }) {
  return (
    <span data-fx-piece={tone} className="fx-demo-piece">
      {children}
    </span>
  );
}

function Demo({ kind, run }: { kind: GameFxKind; run: number }) {
  const piece = useRef<HTMLSpanElement>(null);
  const [left, setLeft] = useState(true);
  const [lifted, setLifted] = useState(false);
  const [combo, setCombo] = useState(0);
  const last = useRef<DOMRect | null>(null);
  // Slide: FLIP. The piece moves in the layout at once; the kit draws it from where it was.
  useLayoutEffect(() => {
    if (kind !== "slide" || !piece.current || !last.current) return;
    const now = piece.current.getBoundingClientRect();
    gameFx("slide", piece.current, { from: { x: last.current.left - now.left, y: last.current.top - now.top }, inGame: false });
    last.current = null;
  }, [left]); // eslint-disable-line react-hooks/exhaustive-deps

  const play = () => {
    const el = piece.current;
    if (kind === "slide") {
      last.current = el?.getBoundingClientRect() ?? null;
      setLeft((v) => !v);
      return;
    }
    if (kind === "pickUp") {
      if (lifted) gameFx("drop", el, { inGame: false });
      else gameFx("pickUp", el, { inGame: false });
      setLifted(!lifted);
      return;
    }
    if (kind === "match") {
      gameFx("match", el, { inGame: false });
      window.setTimeout(() => releaseGameFx(el), 900);
      return;
    }
    if (kind === "combo") {
      const n = combo + 1;
      setCombo(n);
      gameFx("combo", el, { count: n, inGame: false });
      return;
    }
    gameFx(kind, el, { inGame: false });
  };

  let sample: ReactNode;
  if (kind === "countUp") sample = <FxCountUp key={run} value={142} from={0} className="fx-payoff-score" />;
  else if (kind === "stars") sample = <FxStars key={run} earned={3} />;
  else if (kind === "newBest") sample = <FxNewBest key={run} />;
  else
    sample = (
      <span className={`fx-demo-track${kind === "slide" ? (left ? " fx-demo-track-left" : " fx-demo-track-right") : ""}`}>
        <span ref={piece} className="fx-demo-piece" data-fx-piece={kind === "win" ? "gold" : "accent"}>
          {kind === "combo" && combo ? `×${combo}` : null}
        </span>
      </span>
    );

  return (
    <div data-fx-demo={kind} className="fx-demo">
      <div className="fx-demo-stage">{sample}</div>
      <div className="fx-demo-foot">
        <span className="fx-demo-name">{NAMES[kind]}</span>
        <span className="fx-demo-what">{GAME_FX[kind].what}</span>
        {kind === "countUp" || kind === "stars" || kind === "newBest" ? null : (
          <Button variant="secondary" size={36} data-fx-play={kind} onClick={play}>
            {kind === "pickUp" ? (lifted ? "Drop" : "Pick up") : "Play"}
          </Button>
        )}
      </div>
    </div>
  );
}

export function GameFxShowcase() {
  const [variant, setVariant] = useState<GameFxVariant | "device">("device");
  const [run, setRun] = useState(0);
  const choose = (next: GameFxVariant | "device") => {
    setVariant(next);
    forceGameFxVariant(next === "device" ? null : next);
    setRun((r) => r + 1);
  };
  return (
    <section data-fx-showcase className="flex flex-col gap-4" data-category="logic">
      <h2 className="jz-title">Effects</h2>
      <p className="jz-gallery-label">
        The games effects kit (src/lib/fx/kit.ts): one call a moment. Pick a variant to see what each setting draws;
        Calm is the celebrations switch off (payoff kinds only).
      </p>
      <div className="flex items-center gap-2">
        <Segmented
          label="Variant"
          value={variant === "device" ? null : variant}
          onChange={(v) => choose(v)}
          options={VARIANTS.map((v) => ({ value: v.id, label: v.label }))}
        />
        <Button variant={variant === "device" ? "secondary" : "quiet"} size={36} onClick={() => choose("device")}>
          This device
        </Button>
      </div>
      <div className="fx-demo-grid">
        {GAME_FX_KINDS.map((kind) => (
          <Demo key={kind} kind={kind} run={run} />
        ))}
      </div>
      <SectionHeader title="Round-end payoff" />
      <div className="flex flex-col items-center gap-3">
        <ResultPayoff key={run} score={176} label="Your score" stars={{ earned: 2 }} newBest won />
        <Button variant="secondary" size={44} onClick={() => setRun((r) => r + 1)}>
          Play the payoff again
        </Button>
      </div>
    </section>
  );
}
