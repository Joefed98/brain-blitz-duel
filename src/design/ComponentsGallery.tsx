import { useState, type ReactNode } from "react";

import {
  Button,
  Chip,
  GameTile,
  Icon,
  Input,
  ModeButton,
  Panel,
  Row,
  SectionHeader,
  Segmented,
  StatTile,
  SwitchKnob,
  TabBar,
  Toast,
} from "@/design/components";
import { MiniCard, NameplateStrip, PlayerCard, DEFAULT_LOOK, type NameplatePlayer } from "@/design/identity";

/**
 * The components sheet (phase 2 step 2, 14 Nov 2026; docs/design/style-guide/components.png): every shared component
 * in every state, laid out like the guide's sheet. Drawn by /dev-design (development only) and by the screen harness
 * for theme-check and no-wrap-check (mode=components; `theme="light"` on <html> draws it in the light tokens, the
 * gallery being a `.jz-nav` scope). States are forced still with data-jz-state (hover, pressed, focus), disabled and
 * loading are the real props.
 */
const STATES = ["default", "hover", "pressed", "focus", "disabled", "loading"] as const;
type State = (typeof STATES)[number];
const forced = (state: State) =>
  state === "disabled"
    ? { disabled: true }
    : state === "loading"
      ? { loading: true }
      : state === "default"
        ? {}
        : { "data-jz-state": state === "pressed" ? "pressed" : state };

const CARD_PLAYER: NameplatePlayer = {
  kind: "card",
  name: "Nova",
  playerNumber: 412,
  card: { avatarId: "captain-joulz", colour: 4, gem: null, cardArt: null, frame: null, nameColour: null, badges: [], title: null },
};

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="jz-gallery-block">
      <h2 className="jz-gallery-kicker">{title}</h2>
      {children}
    </section>
  );
}

function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="jz-gallery-cell">
      <span className="jz-gallery-label">{label}</span>
      {children}
    </div>
  );
}

export function ComponentsGallery() {
  const [seg, setSeg] = useState<"progress" | "new" | "done">("progress");
  const [on, setOn] = useState(true);
  return (
    <div data-components-gallery className="jz-nav jz-gallery">
      <h1 className="jz-gallery-title">Components</h1>

      <Block title="Buttons">
        {(
          [
            ["gold", "Find a match", 60, false],
            ["gold small", "Play", 36, true],
            ["secondary", "Rematch", 48, false],
            ["quiet", "See all", 36, false],
          ] as const
        ).map(([name, text, size, small]) => (
          <div key={name} className="jz-gallery-row" data-gallery-button={name}>
            {STATES.map((state) => (
              <Cell key={state} label={`${name} · ${state}`}>
                <Button variant={name.startsWith("gold") ? "gold" : (name as "secondary" | "quiet")} size={size} small={small} {...forced(state)}>
                  {text}
                </Button>
              </Cell>
            ))}
          </div>
        ))}
        <div className="jz-gallery-row" data-gallery-button="icon">
          {STATES.map((state) => (
            <Cell key={state} label={`icon · ${state}`}>
              <Button variant="icon" raised aria-label={`Challenge (${state})`} {...forced(state)}>
                <Icon name="challenge" size={20} />
              </Button>
            </Cell>
          ))}
          <Cell label="icon · bare">
            <Button variant="icon" aria-label="Settings">
              <Icon name="settings" size={20} />
            </Button>
          </Cell>
        </div>
      </Block>

      <Block title="Mode button">
        <ModeButton art={<Icon name="timer" size={24} />} label="Arena" detail="Next at 20:00" />
        <ModeButton art={<Icon name="timer" size={24} />} label="Arena" detail="Pressed" data-jz-state="pressed" />
        <ModeButton art={<Icon name="timer" size={24} />} label="Arena" detail="Focus" data-jz-state="focus" />
      </Block>

      <Block title="List rows">
        <Panel>
          <Row as="button" leading={<MiniCard look={DEFAULT_LOOK} size={44} />} title="Sam_Volt" sub="1,503 · Online">
            <Icon name="chevron-right" size={20} className="ap-chevron" />
          </Row>
          <Row as="button" data-jz-state="pressed" leading={<MiniCard look={DEFAULT_LOOK} size={44} />} title="KiraPlays" sub="Pressed">
            <Icon name="chevron-right" size={20} className="ap-chevron" />
          </Row>
          <Row as="button" role="switch" aria-checked={on} aria-label="Show when I’m online" onClick={() => setOn((v) => !v)}>
            <span className="jz-row-title flex-1">Show when I’m online</span>
            <SwitchKnob on={on} />
          </Row>
        </Panel>
        <SectionHeader title="Recently played" right={<span>See all</span>} />
      </Block>

      <Block title="Segmented control">
        <Segmented
          label="Challenges"
          value={seg}
          onChange={setSeg}
          options={[
            { value: "progress", label: "In progress" },
            { value: "new", label: "New" },
            { value: "done", label: "Done" },
          ]}
        />
      </Block>

      <Block title="Chips">
        <div className="jz-gallery-row">
          <Chip selected>All</Chip>
          <Chip selected={false} cat="logic">
            Logic
          </Chip>
          <Chip selected={false} cat="word">
            Word
          </Chip>
          <Chip selected={false} data-jz-state="focus">
            Focus
          </Chip>
          <Chip selected={false} disabled>
            Disabled
          </Chip>
        </div>
      </Block>

      <Block title="Input">
        <Input search placeholder="Search games" aria-label="Search games" />
        <Input defaultValue="Nova_" aria-label="Username (focus)" data-jz-state="focus" />
        <Input defaultValue="Joulz" aria-label="Username (error)" aria-invalid="true" />
        <p className="jz-gallery-error">That name is taken.</p>
      </Block>

      <Block title="Game tile and rating tiles">
        <div className="jz-gallery-row">
          <GameTile type="tubes" size="card" name="Polypotions" stars={{ easy: true, classic: true, hard: false }} />
        </div>
        <div className="jz-gallery-stats">
          <StatTile art={<Icon name="star" size={24} tone="gold" />} value="1,482" label="Joulz Rating" />
          <StatTile art={<Icon name="practice" size={24} />} value="1,530" label="Puzzles" />
          <StatTile art={<Icon name="play" size={24} />} value="1,410" label="Arcade" />
        </div>
      </Block>

      <Block title="Toast">
        <Toast tone="live">
          <span className="flex min-w-0 flex-1 flex-col">
            <b>Challenge done</b>
            <span className="jz-gallery-sub">Pot 3 in one visit</span>
          </span>
        </Toast>
        <Toast tone="error">Couldn’t be confirmed</Toast>
      </Block>

      <Block title="Sheet header">
        <div className="jz-sheet jz-gallery-sheet" data-gallery-sheet>
          <div aria-hidden="true" className="jz-sheet-grab" />
          <div className="jz-sheet-head">
            <h2>Choose a match</h2>
            <Button variant="icon" aria-label="Close choose a match">
              <Icon name="close" size={20} />
            </Button>
          </div>
        </div>
      </Block>

      <Block title="Tab bar">
        <nav aria-label="Tab bar sample" className="jz-gallery-tabs jz-panel">
          <TabBar variant="bar" current="play" shop onOpen={() => (event) => event.preventDefault()} />
        </nav>
      </Block>

      <Block title="Nameplate">
        <Panel pad>
          <NameplateStrip player={CARD_PLAYER} />
        </Panel>
        <Panel pad>
          <NameplateStrip player={{ kind: "plain", name: "Guest Ali", colour: 6 }} />
        </Panel>
        <Panel pad>
          <NameplateStrip player={{ kind: "hidden" }} />
        </Panel>
        <div className="jz-gallery-card">
          <PlayerCard look={DEFAULT_LOOK} name="Nova" playerNumber={412} />
        </div>
      </Block>
    </div>
  );
}
