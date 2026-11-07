import { createFileRoute, notFound } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";

import { PhoneShell } from "@/components/duel/PhoneShell";
import {
  Button,
  Chip,
  CodeInput,
  GameTile,
  Icon,
  ICON_LABELS,
  ICON_NAMES,
  Input,
  LiveTag,
  Medal,
  Nameplate,
  Panel,
  Row,
  SectionHeader,
  Segmented,
  Sheet,
  Skeleton,
  SwitchKnob,
  TabBar,
  Toast,
  type AppTab,
} from "@/design/components";
import { Badge, Emblem, Trophy, TROPHY_SIZES, type BadgeKind, type Tier, type TrophyKind } from "@/design/art";

/**
 * The component gallery (design foundation F2, DESIGN.md section 5; development only, as /dev-crash: a
 * production build answers this address with the not-found page). Every shared component in every
 * state: rest, hover, pressed, focus-visible and disabled (the three forced states are drawn still with
 * data-jz-state), plus each variant and size.
 */
export const Route = createFileRoute("/dev-design")({
  ssr: false,
  // A plain `import.meta.env.DEV` (no cast) so Vite folds it to false and drops the page.
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound();
  },
  component: DevDesign,
});

const TIERS: Tier[] = ["spark", "charge", "volt", "surge", "storm", "lightning"];
const TROPHIES: TrophyKind[] = ["bronze", "silver", "gold", "championship"];
const BADGES: BadgeKind[] = ["winner", "arena", "club", "founder"];

const STATES = ["rest", "hover", "pressed", "focus", "disabled"] as const;
type State = (typeof STATES)[number];
const stateProps = (state: State) =>
  state === "disabled" ? { disabled: true } : state === "rest" ? {} : { "data-jz-state": state };

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <SectionHeader title={title} />
      {children}
    </section>
  );
}

function Labelled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="flex flex-col items-start gap-1">
      <span className="jz-gallery-label">{label}</span>
      {children}
    </span>
  );
}

function DevDesign() {
  const [seg, setSeg] = useState<"a" | "b" | "c">("a");
  const [chips, setChips] = useState<string[]>(["word"]);
  const [code, setCode] = useState("JU");
  const [text, setText] = useState("");
  const [sheet, setSheet] = useState(false);
  const [on, setOn] = useState(true);
  const [tab, setTab] = useState<AppTab>("play");
  return (
    <PhoneShell skin="profile">
      <div data-dev-design className="flex flex-col gap-6 pb-12">
        <h1 className="jz-title">Components</h1>

        <Block title="Button">
          {(["gold", "secondary", "quiet"] as const).map((variant) => (
            <div key={variant} className="jz-gallery-grid">
              {STATES.map((state) => (
                <Labelled key={state} label={`${variant} · ${state}`}>
                  <Button variant={variant} size={variant === "gold" ? 52 : 44} {...stateProps(state)}>
                    {variant === "gold" ? "Create a room" : variant === "secondary" ? "Share" : "See all"}
                  </Button>
                </Labelled>
              ))}
            </div>
          ))}
          <div className="jz-gallery-grid">
            {STATES.map((state) => (
              <Labelled key={state} label={`icon · ${state}`}>
                <Button variant="icon" aria-label="Settings" {...stateProps(state)}>
                  <Icon name="settings" size={20} />
                </Button>
              </Labelled>
            ))}
          </div>
          <div className="jz-gallery-grid">
            {([44, 46, 48, 50, 52, 58] as const).map((size) => (
              <Labelled key={size} label={`size ${size}`}>
                <Button variant="gold" size={size}>
                  Play
                </Button>
              </Labelled>
            ))}
            <Labelled label="small cut">
              <Button variant="gold" size={44} small>
                Play
              </Button>
            </Labelled>
          </div>
          <Button variant="gold" size={58} block>
            Block gold
          </Button>
        </Block>

        <Block title="Icon">
          <p className="jz-body">Every Joulz icon (docs/icons), 24 px, in the text colour, with its label.</p>
          <div data-dev-icons className="jz-gallery-grid">
            {ICON_NAMES.map((name) => (
              <Labelled key={name} label={`${name} · ${ICON_LABELS[name]}`}>
                <Icon name={name} size={24} />
              </Labelled>
            ))}
          </div>
          <div className="jz-gallery-grid">
            {([18, 20, 22, 24] as const).map((size) => (
              <Labelled key={size} label={`size ${size}`}>
                <Icon name="play" size={size} />
              </Labelled>
            ))}
          </div>
          <div className="jz-gallery-grid">
            <Labelled label="tab · text-3">
              <Icon name="practice" tone="text-3" />
            </Labelled>
            <Labelled label="tab active · gold">
              <Icon name="practice-on" tone="gold" />
            </Labelled>
            <Labelled label="wrong · red">
              <Icon name="cross" tone="red" />
            </Labelled>
            <Labelled label="done · cyan">
              <Icon name="check" tone="cyan" />
            </Labelled>
            <Labelled label="close">
              <Icon name="close" />
            </Labelled>
          </div>
        </Block>

        <Block title="Panel and Row">
          <Panel>
            <Row title="Plain row" sub="A second line, cut with an ellipsis when it runs long" />
            <Row as="button" title="Interactive row" sub="Hover, pressed and focus states">
              <ChevronRight aria-hidden="true" className="ap-chevron" />
            </Row>
            <Row as="button" title="Forced focus" data-jz-state="focus">
              <ChevronRight aria-hidden="true" className="ap-chevron" />
            </Row>
            <Row as="button" role="switch" aria-checked={on} aria-label="A switch row" onClick={() => setOn((v) => !v)}>
              <span className="jz-row-title flex-1">A switch row</span>
              <SwitchKnob on={on} />
            </Row>
          </Panel>
          <Panel pad striped>
            <p className="jz-body">Striped panel (daily cards and the standings header only).</p>
          </Panel>
          <Panel pad tone="cyan">
            <p className="jz-body">Cyan panel (head-to-head, next up).</p>
          </Panel>
        </Block>

        <Block title="SectionHeader">
          <SectionHeader title="Warm up" right={<span>All 92 games</span>} />
        </Block>

        <Block title="Chip">
          <div className="jz-gallery-grid">
            {STATES.map((state) => (
              <Labelled key={state} label={state}>
                <Chip selected={false} {...stateProps(state)}>
                  All games
                </Chip>
              </Labelled>
            ))}
            <Labelled label="selected">
              <Chip selected>All games</Chip>
            </Labelled>
          </div>
          <div className="jz-gallery-grid">
            {["word", "number", "speed", "logic", "retro", "sports"].map((cat) => (
              <Chip key={cat} cat={cat} tint selected={chips.includes(cat)} onClick={() => setChips((c) => (c.includes(cat) ? c.filter((x) => x !== cat) : [...c, cat]))} className="capitalize">
                {cat}
              </Chip>
            ))}
          </div>
          <div className="jz-gallery-grid">
            <Chip cat="pattern" selected={false}>
              Pattern (diamond)
            </Chip>
            <span className="jz-chip-quiet">Beta player</span>
          </div>
        </Block>

        <Block title="Chip: status (HUD pills; not a control)">
          <div className="jz-gallery-grid" data-category="logic">
            <Labelled label="label and value">
              <Chip variant="status" label="Moves" value={12} />
            </Labelled>
            <Labelled label="value only">
              <Chip variant="status" value="25 / 36" />
            </Labelled>
            <Labelled label="accent (par)">
              <Chip variant="status" label="Par" value={14} tone="accent" />
            </Labelled>
            <Labelled label="good">
              <Chip variant="status" label="Found" value="5 / 5" tone="good" />
            </Labelled>
            <Labelled label="warn">
              <Chip variant="status" label="Moves left" value={2} tone="warn" />
            </Labelled>
          </div>
        </Block>

        <Block title="Segmented">
          <Segmented
            label="Example"
            value={seg}
            onChange={setSeg}
            options={[
              { value: "a", label: "Mixed" },
              { value: "b", label: "Puzzles" },
              { value: "c", label: "Arcade", disabled: true },
            ]}
          />
          <Segmented
            label="Gold example"
            tone="gold"
            value={seg === "c" ? "a" : seg}
            onChange={setSeg}
            options={[
              { value: "a", label: "Puzzles", count: 51 },
              { value: "b", label: "Arcade", count: 41 },
            ]}
          />
        </Block>

        <Block title="Input and CodeInput">
          <Input placeholder="Your name" value={text} onChange={(e) => setText(e.target.value)} aria-label="Your name" />
          <Input placeholder="Forced focus" aria-label="Forced focus" data-jz-state="focus" />
          <Input search size={44} placeholder="Search puzzles" aria-label="Search puzzles" />
          <Panel pad className="flex gap-2">
            <CodeInput value={code} onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 4))} aria-label="Room code" className="flex-1" />
            <Button variant="secondary" size={50}>
              Join
            </Button>
          </Panel>
        </Block>

        <Block title="Sheet">
          <Button variant="secondary" onClick={() => setSheet(true)}>
            Open a sheet
          </Button>
          <Sheet open={sheet} onClose={() => setSheet(false)} title="Settings" skin="profile">
            <div className="flex flex-col gap-3 px-4 pb-8">
              <p className="jz-body">Drag down to dismiss; the sheet follows the finger.</p>
              <Panel>
                <Row title="A row in a sheet" />
              </Panel>
            </div>
          </Sheet>
        </Block>

        <Block title="Toast">
          <Toast tone="info">Saved.</Toast>
          <Toast tone="live">Sam: nice one</Toast>
          <Toast tone="error">Couldn’t reach the server. Try again.</Toast>
        </Block>

        <Block title="Skeleton">
          <Skeleton kind="line" width="60%" />
          <Skeleton kind="row" />
          <Skeleton kind="card" />
          <div className="jz-gallery-grid">
            <Skeleton kind="tile" />
            <Skeleton kind="tile" />
          </div>
        </Block>

        <Block title="LiveTag">
          <div className="jz-gallery-grid">
            <LiveTag kind="live" />
            <LiveTag kind="next" />
          </div>
        </Block>

        <Block title="GameTile">
          <div className="jz-gallery-grid">
            <GameTile type="sudoku" size="s" />
            <GameTile type="matchup" size="m" name="Gemstone" best="Best 132" charge={0.6} />
          </div>
          <GameTile type="tilt" size="l" name="Tilt" best="Not played" onClick={() => undefined} />
        </Block>

        <Block title="Nameplate">
          <Nameplate look={{ colour: 4, icon: null }} name="Priya" kind="strip" you />
          <Nameplate look={{ colour: 7, icon: null }} name="Sam" kind="mini" meta="612" />
          <Nameplate look={{ colour: 1, icon: null }} name="Jo" kind="full" />
        </Block>

        <Block title="Medal">
          {(["s", "m", "l"] as const).map((size) => (
            <Labelled key={size} label={`${size.toUpperCase()} · ${{ s: 22, m: 36, l: 64 }[size]} px: gold, silver, bronze, 4th, shared 1st, shared 4th`}>
              <div className="jz-gallery-grid">
                {[1, 2, 3, 4].map((place) => (
                  <Medal key={place} place={place} size={size} />
                ))}
                <Medal place={1} shared size={size} />
                <Medal place={4} shared size={size} />
              </div>
            </Labelled>
          ))}
        </Block>

        <Block title="Emblem">
          <Labelled label="150 px (rank card): the six tiers, division II, Lightning #37">
            <div className="jz-gallery-grid">
              {TIERS.map((tier) => (
                <Emblem key={tier} tier={tier} size={150} division={tier === "lightning" ? undefined : 2} rank={tier === "lightning" ? 37 : undefined} />
              ))}
            </div>
          </Labelled>
          <Labelled label="Divisions III, II, I (Volt, 64 px)">
            <div className="jz-gallery-grid">
              {([3, 2, 1] as const).map((division) => (
                <Emblem key={division} tier="volt" size={64} division={division} />
              ))}
            </div>
          </Labelled>
          <Labelled label="28 px (standings row): no marker, the name beside it">
            <div className="jz-gallery-grid">
              {TIERS.map((tier) => (
                <Emblem key={tier} tier={tier} size={28} marker={false} division={2} rank={37} />
              ))}
            </div>
          </Labelled>
          <Panel>
            {(
              [
                ["lightning", "Sam", "Lightning #37", 1842, 7],
                ["storm", "TheInventor", "Storm I", 1611, 3],
                ["volt", "Priya", "Volt III", 1204, 8],
              ] as const
            ).map(([tier, name, rank, score, colour]) => (
              <div key={name} className="jz-row">
                <Nameplate look={{ colour, icon: null }} name={name} kind="mini" meta={`${rank} · ${score.toLocaleString("en-GB")}`} />
                <Emblem tier={tier} size={28} marker={false} label={rank} />
              </div>
            ))}
          </Panel>
        </Block>

        <Block title="Trophy">
          <div className="jz-gallery-grid">
            {TROPHIES.map((kind) => (
              <Labelled key={kind} label={`${kind} · ${TROPHY_SIZES[kind]} px`}>
                <Trophy kind={kind} />
              </Labelled>
            ))}
          </div>
          <Labelled label="56 px (profile cabinet row)">
            <div className="jz-gallery-grid">
              {TROPHIES.map((kind) => (
                <Trophy key={kind} kind={kind} size={56} />
              ))}
            </div>
          </Labelled>
        </Block>

        <Block title="Badge">
          <Labelled label="104 px (player card); the founder's number is data (players 42 and 1337)">
            <div className="jz-gallery-grid">
              {BADGES.map((kind) => (
                <Badge key={kind} kind={kind} player={42} />
              ))}
              <Badge kind="founder" player={1337} />
            </div>
          </Labelled>
          <Labelled label="48 px">
            <div className="jz-gallery-grid">
              {BADGES.map((kind) => (
                <Badge key={kind} kind={kind} player={42} size={48} />
              ))}
            </div>
          </Labelled>
        </Block>

        <Block title="TabBar">
          <nav aria-label="Gallery tabs" className="flex">
            <TabBar
              variant="bar"
              current={tab}
              onOpen={(next) => (event) => {
                event.preventDefault();
                setTab(next);
              }}
            />
          </nav>
        </Block>
      </div>
    </PhoneShell>
  );
}
