import { useState } from "react";

import { Button, SectionHeader } from "@/design/components";
import { Emblem, MedalArt, Trophy } from "@/design/art";
import { Arc, Charge, Current, Spark, surge } from "@/design/motifs";

/**
 * The bolt motifs and the current texture on /dev-design (S1 PR 2, development only). Each motif has a button that
 * plays it again (a new key remounts it, or surge() flashes). Not wired into any screen: stages 2a–2c do that.
 */
export function MotifsShowcase() {
  const [run, setRun] = useState(0);
  const [level, setLevel] = useState(0.4);
  const [arc, setArc] = useState(0);
  const [spark, setSpark] = useState(0);
  return (
    <section data-motifs-showcase className="flex flex-col gap-4">
      <h2 className="jz-title">Bolt motifs</h2>

      <SectionHeader title="Charge" />
      <div className="jz-motif-demo">
        <Charge key={`b${run}`} run size={40} label="Charge, building" />
        <Charge key={`c${run}`} run crackle size={40} ms={900} />
        <Charge level={level} size={40} label={`Charge at ${Math.round(level * 100)} %`} />
        <Charge key={`r${run}`} shape="bar" run size={160} />
        <Charge shape="bar" level={level} size={160} />
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" size={44} onClick={() => setRun((n) => n + 1)}>
          Build again
        </Button>
        <Button variant="secondary" size={44} onClick={() => setLevel((l) => (l >= 1 ? 0 : Math.min(1, l + 0.2)))}>
          Level +20 %
        </Button>
      </div>

      <SectionHeader title="Arc" />
      <div className="jz-motif-demo jz-motif-stage" data-arc-demo>
        <span className="jz-motif-dot" style={{ left: 24, top: 48 }} />
        <span className="jz-motif-dot" style={{ left: 296, top: 48 }} />
        <Arc key={`a${arc}`} from={{ x: 24, y: 48 }} to={{ x: 296, y: 48 }} width={320} height={96} seed={arc + 1} />
        <Arc key={`g${arc}`} from={{ x: 24, y: 84 }} to={{ x: 296, y: 20 }} width={320} height={96} seed={arc + 7} tone="gold" />
      </div>
      <Button variant="secondary" size={44} onClick={() => setArc((n) => n + 1)}>
        Strike again
      </Button>

      <SectionHeader title="Spark" />
      <div className="jz-motif-demo jz-motif-stage" data-spark-demo>
        <Spark key={`s${spark}`} x={80} y={48} />
        <Spark key={`t${spark}`} x={240} y={48} tone="inherit" />
      </div>
      <Button variant="secondary" size={44} onClick={() => setSpark((n) => n + 1)}>
        Spark again
      </Button>

      <SectionHeader title="Surge" />
      <Button variant="secondary" size={44} onClick={() => surge()}>
        Surge (once a second at most)
      </Button>

      <SectionHeader title="The current (metal only)" />
      <div className="jz-motif-demo">
        <Current radius="round">
          <Emblem tier="lightning" size={96} />
        </Current>
        <Current>
          <Trophy kind="gold" size={96} />
        </Current>
        <Current radius="round">
          <MedalArt metal="gold" size={64} />
        </Current>
        <Current radius={14}>
          <span className="jz-motif-podium" />
        </Current>
      </div>
    </section>
  );
}
