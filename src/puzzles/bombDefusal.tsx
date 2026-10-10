import {\nconst TOKEN_RE = /(wires \d and \d|wire \d|button [AB]|press [AB]|\\b(?:Red|Blue|Green|Yellow|White|Black)\\b)/gi;\n
function Swatch({ colour }: { colour: WireColour }) {
  return (
    <span
      className="mx-0.5 inline-block h-2.5 w-4 shrink-0 rounded-[2px] align-middle shadow-[0_0_0_1px_rgba(0,0,0,0.3)]"
      style={{
        backgroundColor: WIRE_HEX[colour],
        border: colour === "BLACK" ? "1px solid rgba(255,255,255,0.2)" : "none",
      }}
    />
  );
}

function RuleText({
  text,
  wires,
  buttons,
}: {
  text: string;
  wires: WireColour[];
  buttons: { label: "A" | "B"; colour: WireColour }[];
}) {
  const parts = text.split(TOKEN_RE);
  return (
    <>
      {parts.map((part, index) => {
        if (index % 2 === 0) return <span key={index}>{part}</span>;
        const lower = part.toLowerCase();
        
        if (lower.startsWith("wires ")) {
          const [a, b] = (part.match(/\d/g) ?? []).map(Number);
          const c1 = wires[(a ?? 1) - 1] ?? "WHITE";
          const c2 = wires[(b ?? 1) - 1] ?? "WHITE";
          return (
            <span key={index} className="inline-flex items-center font-bold text-foreground/90">
              wires&nbsp;
              <Swatch colour={c1} />
              <span>{a}</span>
              &nbsp;and&nbsp;
              <Swatch colour={c2} />
              <span>{b}</span>
            </span>
          );
        }
        
        if (lower.startsWith("wire ")) {
          const n = Number(part.slice(5));
          const colour = wires[n - 1] ?? "WHITE";
          return (
            <span key={index} className="inline-flex items-center font-bold text-foreground/90">
              <Swatch colour={colour} />
              {part}
            </span>
          );
        }
        
        if (lower.startsWith("button ") || lower.startsWith("press ")) {
          const label = part.slice(-1) as "A" | "B";
          const colour = buttons.find((b) => b.label === label)?.colour ?? "WHITE";
          return (
            <span key={index} className="inline-flex items-center font-bold text-foreground/90">
              <Swatch colour={colour} />
              {part}
            </span>
          );
        }
        
        const colour = part.toUpperCase() as WireColour;
        return (
          <span key={index} className="inline-flex items-center font-bold uppercase tracking-tight text-foreground/90">
            <Swatch colour={colour} />
            {part}
          </span>
        );
      })}
    </>
  );
}
\n/** Fixed intro example — never randomised. */
function IntroExample() {
  return (
    <div className="flex flex-col items-center gap-3">
      <div style={{ width: 150, height: 118 }}>
        <Panel
          wires={["RED", "BLUE"]}
          buttons={[{ label: "A", colour: "WHITE" }]}
          light
          serial="317"
          switchPosition="MID"
          cutWires={[1]}
          compact
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Rule: “If the light is ON, cut wire 2.” The light is on, so wire 2 is cut. Read every rule, work out the six actions and their order, then do them.
      </p>
    </div>
  );
}

function Stage({
  puzzle,
  phaseStartedAt,
  now,
  locked,
  onSubmit,
  onDraftAnswer,
  stateKey = "bomb",
}: PuzzleStageProps) {
  const isBomb = puzzle.type === "bomb";
  const [actions, setActions] = useStageState<BombAction[]>(stateKey, "bombActions", () => []);
  const submitted = useRef(false);

  useEffect(() => {
    onDraftAnswer?.(encodeBombActions(actions));
  }, [actions, onDraftAnswer]);

  const act = (action: BombAction) => {
    if (locked || submitted.current) return;
    hapticTick();
    const next = [...actions, action];
    setActions(next);
  };

  useEffect(() => {
    if (locked || submitted.current || !isBomb) return;
    if (now < phaseStartedAt + (puzzle.timeLimitMs ?? BOMB_TIME_MS) - 400) return;
    submitted.current = true;
    onSubmit(encodeBombActions(actions));
  }, [now, phaseStartedAt, actions, locked, isBomb, onSubmit]);

  if (!isBomb) return null;

  const cutWires = actions.filter(isCut).map((action) => Number.parseInt(action.slice(1), 10));
  const pressed = actions
    .filter((action) => !isCut(action))
    .map((action) => action.slice(1) as "A" | "B");

  return (
    <div data-stage-column="2" data-polish="bomb" className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="shrink-0 rounded-xl border border-border bg-card p-2">
        {puzzle.rules.map((rule, index) => (
          <p key={rule.id} className="text-[14px] leading-snug">
            <span className="font-mono text-primary">{index + 1}.</span>{" "}
            <RuleText text={rule.text} wires={puzzle.wires} buttons={puzzle.buttons} />
          </p>
        ))}
      </div>

      <div data-game-arena="board" className="flex min-h-0 flex-1">
        <Panel
          wires={puzzle.wires}
          buttons={puzzle.buttons}
          light={puzzle.light}
          serial={puzzle.serial}
          switchPosition={puzzle.switchPosition}
          cutWires={cutWires}
          pressed={pressed}
          onWire={(index) => act(cutAction(index))}
          onButton={(label) => act(pressAction(label))}
        />
      </div>

      <div data-game-controls="actions" className="flex shrink-0 items-center justify-between">
        <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          steps <span className="text-primary">{actions.length}</span> / {puzzle.stepCount || BOMB_MAX_SEQUENCE}
        </p>
        <div className="flex flex-1 items-center justify-center">
        <Button
          type="button"
          disabled={locked || !actions.length}
          onClick={() => {
            if (locked || submitted.current) return;
            submitted.current = true;
            playLock();
            onSubmit(encodeBombActions(actions));
          }}
          className="h-9 w-3/4 rounded-lg px-4 font-display text-[10.5px] font-bold uppercase tracking-widest disabled:opacity-40"
        >
          Defuse
        </Button>
        </div>
        <button
          type="button"
          disabled={locked || !actions.length || submitted.current}
          onClick={() => {
            setActions([]);
          }}
          className="h-11 rounded-xl border border-border px-4 font-mono text-xs uppercase tracking-widest text-muted-foreground disabled:opacity-40"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

/** Whether a revealed plan replays as an explosion; the answer reveal plays its cue. */
export function bombRevealExploded(puzzle: PuzzleRevealProps["puzzle"], answer: string | null | undefined): boolean {
  if (puzzle.type !== "bomb") return false;
  const required = decodeBombActions(puzzle.required ?? puzzle.sequence ?? "");
  return checkBombPlan(required, decodeBombConstraints(puzzle.constraints ?? ""), decodeBombActions(answer ?? "")).exploded;
}

function Reveal({ timeLimitMs, puzzle, myAnswer, myCorrect, myMsRemaining }: PuzzleRevealProps) {
  if (puzzle.type !== "bomb") return null;
  const required = decodeBombActions(puzzle.required ?? puzzle.sequence ?? "");
  const constraints = decodeBombConstraints(puzzle.constraints ?? "");
  const shown = decodeBombActions(puzzle.sequence ?? "");
  const mine = decodeBombActions(myAnswer ?? "");
  const replay = checkBombPlan(required, constraints, mine);
  const elapsed =
    myMsRemaining === undefined ? null : Math.round((timeLimitMs - myMsRemaining) / 100) / 10;

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div className="grid w-full grid-cols-2 gap-3 text-base">
        <div>
          <p className="mb-1 text-center font-mono uppercase text-primary">One valid plan</p>
          {shown.map((action, index) => (
            <p key={`${action}-${index}`} className="break-words">
              <span className="font-mono text-primary">{index + 1}.</span>{" "}
              {actionLabel(action, puzzle.wires)}
            </p>
          ))}
        </div>
        <div>
          <p className="mb-1 text-center font-mono uppercase text-muted-foreground">Yours</p>
          {mine.map((action, index) => (
            <p
              key={`${action}-${index}`}
              className={index === replay.firstWrong ? "break-words text-warn" : "break-words"}
            >
              <span className="font-mono">{index + 1}.</span> {actionLabel(action, puzzle.wires)}
              {index === replay.firstWrong ? " ✗" : ""}
            </p>
          ))}
        </div>
      </div>
      <p className="font-display text-xl font-bold">
        <span className={myCorrect ? "text-primary" : "text-warn"}>
          {replay.exploded
            ? `Exploded at step ${replay.correctPrefix + 1}`
            : replay.defused
              ? "Defused"
              : `${replay.correctPrefix} / ${required.length} steps`}
        </span>
        {myCorrect && elapsed !== null && (
          <span className="ml-2 font-mono text-base uppercase tracking-widest text-muted-foreground">
            {elapsed.toFixed(1)}s
          </span>
        )}
      </p>
    </div>
  );
}

/** The rules and panel are public; the required sequence is server-side only. */
export const bombDefusalPuzzle: PuzzleDefinition = {
  key: "bomb",
  name: gameDisplayName("bomb"),
  category: "logic",
  // New six-step rounds carry their own 90 s clock; this default covers stored four-step rounds.
  timeLimitMs: BOMB_TIME_MS,
  revealMs: 8_000,
  generate: () =>
    ({
      type: "bomb",
      wires: new Array<WireColour>(BOMB_WIRES).fill("RED"),
      buttons: [
        { label: "A", colour: "WHITE" },
        { label: "B", colour: "RED" },
      ],
      light: false,
      serial: "000",
      switchPosition: "MID",
      rules: [],
      stepCount: 0,
    }) satisfies BombPuzzleData,
  check: () => false,
  revealHeading: "The right moves",
  IntroExample,
  Stage,
  Reveal,
};
