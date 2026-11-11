import { useState } from "react";

import { Coin } from "@/components/app/CoinCounter";
import { Button, EmptyState, Icon, Skeleton } from "@/design/components";
import { claimReward, testPremium, usePass } from "@/lib/pass/passApi";
import type { PassCell, PassView, PassWeekly } from "@/lib/pass/types";

import { JoulesBolt } from "./JoulesBolt";

/**
 * The Pass part of the Shop tab (wave 2, session D2; mockup docs/art/wave-2/screens/battle-pass.png): the season's
 * name and days left, the level with its Joules bar (electric lime, the bolt mark), the premium unlock (a tester's test
 * purchase until real payments exist), both tracks level by level with claim buttons, the big rewards, and this week's
 * three challenges with their progress. The server decides everything; this draws its answer.
 */
export function PassScreen() {
  const pass = usePass();
  const [busy, setBusy] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);

  if (pass.state === "none" || pass.state === "loading")
    return (
      <div className="pass-loading" aria-busy="true" aria-label="Loading the pass">
        <Skeleton height={120} />
        <Skeleton height={320} />
      </div>
    );
  if (pass.state === "closed")
    return (
      <div className="shop-soon" data-shop-soon="pass" data-pass-closed={pass.reason}>
        <EmptyState
          layout="card"
          tone="cool"
          title={pass.reason === "busy" ? "One moment" : pass.reason === "error" ? "Couldn’t load the pass" : "The pass is coming"}
          body={
            pass.reason === "busy"
              ? "That’s a lot of taps. Try again in a minute."
              : pass.reason === "error"
                ? "Check your connection and try again."
                : "Season 1 rewards will show here when the season starts."
          }
        />
      </div>
    );

  const view = pass.view;
  const claim = async (cell: PassCell) => {
    setBusy(`${cell.track}:${cell.level}`);
    const out = await claimReward(cell.track, cell.level);
    setBusy(null);
    setSaid(out.ok ? `${cell.title}: claimed.` : out.message);
  };
  const buyTest = async () => {
    setBusy("premium");
    const out = await testPremium();
    setBusy(null);
    setSaid(out.ok ? "Test purchase: the premium track is unlocked (no payment)." : out.message);
  };

  return (
    <div className="pass-screen" data-pass-screen={view.season.id}>
      <header className="pass-head">
        <div>
          <h1 className="ap-title pass-title">{view.season.test ? "Test season" : "Season 1 pass"}</h1>
          <p className="pass-season-name">{view.season.test ? "Testers only" : view.season.name}</p>
        </div>
        <span className="pass-days" data-pass-days>
          {view.season.ended ? "Season over" : view.season.daysLeft === null ? "" : `${view.season.daysLeft} ${view.season.daysLeft === 1 ? "day" : "days"} left`}
        </span>
      </header>

      <LevelCard view={view} />

      {said ? (
        <p className="shop-said" role="status" data-pass-said>
          {said}
        </p>
      ) : null}

      {view.premium ? (
        <p className="pass-premium-on" data-pass-premium={view.premium.source}>
          Premium track unlocked{view.premium.source === "test" ? " · test purchase" : view.premium.source === "plus" ? " · Joulz Plus" : ""}
        </p>
      ) : view.tester && !view.season.ended ? (
        <div className="pass-unlock">
          <Button variant="gold" size={58} block disabled={busy === "premium"} onClick={() => void buyTest()} data-pass-test-purchase>
            Test purchase: unlock Premium
          </Button>
          <p className="pass-note">Testers only: no payment is taken. Included with Joulz Plus.</p>
        </div>
      ) : (
        <div className="pass-unlock">
          <Button variant="secondary" size={52} block disabled data-pass-premium-soon>
            Premium unlock coming soon
          </Button>
          <p className="pass-note">Included with Joulz Plus.</p>
        </div>
      )}

      <section className="pass-tracks" aria-label="Rewards by level">
        <div className="pass-track-heads" aria-hidden="true">
          <span />
          <span>Free</span>
          <span className="pass-premium-word">Premium</span>
        </div>
        <ol className="pass-levels">
          {view.levels.map((row) => (
            <li key={row.level} className="pass-row" data-pass-level={row.level} data-current={row.level === view.level ? "" : undefined}>
              <span className="pass-level-disc" aria-label={`Level ${row.level}`}>
                {row.level}
              </span>
              <RewardCell cell={row.free} busy={busy} onClaim={claim} />
              <RewardCell cell={row.premium} busy={busy} onClaim={claim} />
            </li>
          ))}
        </ol>
      </section>

      <BigRewards view={view} />

      {view.weekly ? <ThisWeek challenges={view.weekly.challenges} /> : null}
    </div>
  );
}

function LevelCard({ view }: { view: PassView }) {
  const pct = Math.round((view.into / view.of) * 100);
  return (
    <div className="pass-level-card" data-pass-joules={view.joules}>
      <div className="pass-level-line">
        <span className="pass-level-now">Level {view.level}</span>
        <span className="pass-joules">
          <JoulesBolt size={18} />
          {view.level >= 60 ? "Max level" : `${view.into.toLocaleString("en-GB")} / ${view.of.toLocaleString("en-GB")} Joules`}
        </span>
      </div>
      <span
        className="pass-bar"
        role="progressbar"
        aria-label="Joules to the next level"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span style={{ width: `${pct}%` }} />
      </span>
      <p className="pass-note">Joules come from every match, Daily and challenge, win or lose.</p>
    </div>
  );
}

function RewardGlyph({ cell }: { cell: PassCell }) {
  if (cell.kind === "coins") return <Coin size={26} />;
  if (cell.kind === "ticket") return <Icon name="tournaments" size={22} />;
  if (cell.kind === "freeze") return <Icon name="streak" size={22} />;
  if (cell.kind === "title") return <Icon name="rewards" size={22} />;
  return <Icon name="star" size={22} />;
}

function RewardCell({ cell, busy, onClaim }: { cell: PassCell | null; busy: string | null; onClaim: (cell: PassCell) => void }) {
  if (!cell) return <span className="pass-cell pass-cell-empty" aria-hidden="true" />;
  const id = `${cell.track}:${cell.level}`;
  return (
    <div
      className="pass-cell"
      data-pass-cell={id}
      data-state={cell.state}
      data-track={cell.track}
      data-rarity={cell.rarity ?? undefined}
    >
      <span className="pass-cell-glyph" aria-hidden="true">
        <RewardGlyph cell={cell} />
      </span>
      <span className="pass-cell-text">
        <span className="pass-cell-title">{cell.title}</span>
        <span className="pass-cell-detail">{cell.detail}</span>
        {cell.rarity ? <span className="pass-cell-rarity">{cell.rarity[0]!.toUpperCase() + cell.rarity.slice(1)}</span> : null}
      </span>
      {cell.state === "claimed" ? (
        <span className="pass-cell-mark" aria-label="Claimed">
          <Icon name="check" size={18} />
        </span>
      ) : cell.state === "claimable" ? (
        <Button variant="gold" size={44} small disabled={busy === id} onClick={() => onClaim(cell)} data-pass-claim={id}>
          Claim
        </Button>
      ) : (
        <span className="pass-cell-mark" aria-label={cell.needsPremium ? "Premium" : "Locked"}>
          <Icon name="lock" size={18} />
        </span>
      )}
    </div>
  );
}

function BigRewards({ view }: { view: PassView }) {
  const picks = [
    view.levels[49]?.free,
    view.levels[59]?.free,
    view.levels[59]?.premium,
  ].filter((c): c is PassCell => !!c);
  return (
    <section className="pass-big" aria-labelledby="pass-big-title">
      <h2 id="pass-big-title" className="shop-section-title">
        The big rewards
      </h2>
      <div className="pass-big-row">
        {picks.map((c) => (
          <div key={`${c.track}:${c.level}`} className="pass-big-item" data-track={c.track}>
            <span className="pass-big-where">
              {c.track === "free" ? "Free" : "Premium"} · Level {c.level}
            </span>
            <span className="pass-big-name">{c.title}</span>
            <span className="pass-big-kind">{c.detail}</span>
          </div>
        ))}
      </div>
      <p className="pass-note">
        {view.season.test
          ? "Test season: what you claim here is yours to try out."
          : "Season 1 only: Neon Circuit items are never sold in the shop and can’t be earned after the season ends."}
      </p>
    </section>
  );
}

const TIER_WORDS = { easy: "Easy", medium: "Medium", hard: "Hard" } as const;

function ThisWeek({ challenges }: { challenges: PassWeekly[] }) {
  return (
    <section className="shop-section" aria-labelledby="pass-week-title" data-pass-weekly>
      <div className="shop-section-head">
        <h2 id="pass-week-title" className="shop-section-title">
          This week
        </h2>
        <span className="shop-section-rule" aria-hidden="true" />
        <span className="shop-note">Resets Mon</span>
      </div>
      <ul className="pass-week">
        {challenges.map((c) => (
          <li key={c.id} className="pass-week-row" data-pass-weekly-id={c.id} data-done={c.completed ? "" : undefined}>
            <span className="pass-week-text">
              <span className="pass-week-title">{c.text}</span>
              <span className="pass-week-detail">
                {TIER_WORDS[c.tier]} · {c.done} / {c.need}
                {c.completed ? " · Done" : ""}
              </span>
            </span>
            <span className="pass-week-joules">
              <JoulesBolt size={16} />+{c.joules.toLocaleString("en-GB")}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
