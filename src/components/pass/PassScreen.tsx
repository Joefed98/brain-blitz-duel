import { useAppMoment } from "@/components/fx/useMomentEnter";
import { useState } from "react";

import { ShopArt } from "@/components/shop/ShopArt";
import { CardPiece, NamePiece } from "@/design/identity";
import { useAccount } from "@/lib/account/accountApi";
import { Button, EmptyState, Icon, SectionHeader, Skeleton } from "@/design/components";
import { KitArt } from "@/components/shop/KitArt";
import { claimReward, testPremium, usePass } from "@/lib/pass/passApi";
import type { PassCell, PassView, PassWeekly } from "@/lib/pass/types";

import { JoulesBolt } from "./JoulesBolt";

/**
 * The Pass part of the Shop tab (wave 2, session D2; phase 2 step 3, the Shop pages session, 14 Nov 2026): the
 * season's name and days left, the level with its Joules bar (electric lime, the bolt) and where Joules come from, the
 * premium unlock (a tester's test purchase until real payments exist), the free and premium tracks as two rows of
 * reward tiles, one column a level, scrolled to the player's level (withdrawn rewards drawn as "Being redrawn" gaps),
 * and this week's three challenges with their progress. The server decides everything; this draws its answer.
 */
export function PassScreen() {
  const pass = usePass();
  const account = useAccount();
  const name = account.kind === "account" ? account.username : "Your name";
  const [busy, setBusy] = useState<string | null>(null);
  // A reward claimed (15 Nov 2026, the effects pass): its cell gets the kit's win payoff, once.
  const [claimed, setClaimed] = useState<string | null>(null);
  useAppMoment("win", `[data-pass-cell="${claimed ?? ""}"]`, claimed);
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
  const days = view.season.ended ? "Season over" : view.season.daysLeft === null ? "" : `${view.season.daysLeft} ${view.season.daysLeft === 1 ? "day" : "days"} left`;
  const claim = async (cell: PassCell) => {
    setBusy(`${cell.track}:${cell.level}`);
    const out = await claimReward(cell.track, cell.level);
    setBusy(null);
    setSaid(out.ok ? `${cell.title}: claimed.` : out.message);
    if (out.ok) setClaimed(`${cell.track}:${cell.level}`);
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
        <h2 className="pass-season-name">{view.season.test ? "Test season" : view.season.name}</h2>
        <p className="pass-kicker">
          <span className="pass-title">{view.season.test ? "Testers only" : "Season 1 pass"}</span>
          {days ? " · " : null}
          <span className="pass-days" data-pass-days>
            {days}
          </span>
        </p>
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

      <Tracks view={view} busy={busy} name={name} onClaim={claim} />

      {view.weekly ? <ThisWeek challenges={view.weekly.challenges} /> : null}
    </div>
  );
}

function LevelCard({ view }: { view: PassView }) {
  const pct = Math.round((view.into / view.of) * 100);
  return (
    <div className="pass-level-card" data-pass-joules={view.joules}>
      <div className="pass-level-line">
        <KitArt name="joules" size={40} className="pass-level-art" />
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
      <p className="pass-note">Earn Joules from Dailies, rated matches, tournaments and challenges.</p>
    </div>
  );
}

/**
 * A reward's real picture: card arts and frames through A2's player card renderer (CardPiece), name colours as this
 * player's name in the colour (NamePiece), every other item its approved still (scripts/shop-previews.ts, extended to
 * the pass's items); coins, tickets, freezes and titles their mark.
 */
function RewardArt({ cell, name }: { cell: PassCell; name: string }) {
  if (cell.itemId && (cell.itemKind === "card-art" || cell.itemKind === "frame"))
    return (
      <span className="pass-cell-art" data-pass-art="card">
        <CardPiece id={cell.itemId} />
      </span>
    );
  if (cell.itemId && cell.itemKind === "name-colour")
    return (
      <span className="pass-cell-art" data-pass-art="name">
        <NamePiece id={cell.itemId} name={name} />
      </span>
    );
  if (cell.itemId)
    return (
      <span className="pass-cell-art" data-pass-art="still">
        <ShopArt id={cell.itemId} className="pass-cell-still" />
      </span>
    );
  return (
    <span className="pass-cell-glyph" aria-hidden="true">
      <RewardGlyph cell={cell} />
    </span>
  );
}

function RewardGlyph({ cell }: { cell: PassCell }) {
  if (cell.kind === "coins") return <KitArt name="coin" size={40} />;
  if (cell.kind === "ticket") return <Icon name="tournaments" size={22} />;
  if (cell.kind === "freeze") return <Icon name="streak" size={22} />;
  if (cell.kind === "title") return <Icon name="rewards" size={22} />;
  return <Icon name="star" size={22} />;
}

function RewardCell({ cell, busy, name, onClaim }: { cell: PassCell | null; busy: string | null; name: string; onClaim: (cell: PassCell) => void }) {
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
      <RewardArt cell={cell} name={name} />
      <span className="pass-cell-text">
        <span className="pass-cell-title">{cell.title}</span>
        <span className="pass-cell-meta">
          {cell.rarity ? (
            <>
              <span className="pass-cell-rarity">{cell.rarity[0]!.toUpperCase() + cell.rarity.slice(1)}</span>
              {" · "}
            </>
          ) : null}
          <span className="pass-cell-detail">{cell.detail}</span>
        </span>
      </span>
      {cell.state === "claimed" ? (
        <span className="pass-cell-mark" aria-label="Claimed">
          <Icon name="check" size={18} />
        </span>
      ) : cell.state === "withdrawn" ? (
        <span className="pass-cell-mark" aria-label="Being redrawn">
          <Icon name="timer" size={18} />
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

/**
 * The two tracks as rows of reward tiles: one row a level (its number, the free reward, the premium reward), the
 * player's level marked. All 60 levels in order.
 */
function Tracks({ view, busy, name, onClaim }: { view: PassView; busy: string | null; name: string; onClaim: (cell: PassCell) => void }) {
  return (
    <section className="pass-tracks" aria-labelledby="pass-tracks-title">
      <SectionHeader id="pass-tracks-title" title="Rewards" right={<span className="shop-note">Level {view.level} of 60</span>} />
      <div className="pass-track-heads" aria-hidden="true">
        <span />
        <span>Free</span>
        <span className="pass-premium-word">Premium</span>
      </div>
      <ol className="pass-levels" aria-label="Rewards by level, free and premium">
        {view.levels.map((row) => (
          <li key={row.level} className="pass-row" data-pass-level={row.level} data-current={row.level === view.level ? "" : undefined} data-reached={row.level <= view.level ? "" : undefined}>
            <span className="pass-level-disc" aria-label={`Level ${row.level}`}>
              {row.level}
            </span>
            <RewardCell cell={row.free} busy={busy} name={name} onClaim={onClaim} />
            <RewardCell cell={row.premium} busy={busy} name={name} onClaim={onClaim} />
          </li>
        ))}
      </ol>
      <p className="pass-note">
        {view.season.test
          ? "Test season: what you claim here is yours to try out."
          : "Season 1 only: never sold, and gone when the season ends."}
      </p>
    </section>
  );
}

const TIER_WORDS = { easy: "Easy", medium: "Medium", hard: "Hard" } as const;

function ThisWeek({ challenges }: { challenges: PassWeekly[] }) {
  return (
    <section className="shop-section" aria-labelledby="pass-week-title" data-pass-weekly>
      <SectionHeader id="pass-week-title" title="This week" right={<span className="shop-note">Resets Monday</span>} />
      <ul className="pass-week">
        {challenges.map((c) => {
          const pct = c.completed ? 100 : c.need > 0 ? Math.min(100, Math.round((c.done / c.need) * 100)) : 0;
          return (
            <li key={c.id} className="pass-week-row" data-pass-weekly-id={c.id} data-done={c.completed ? "" : undefined}>
              <span className="pass-week-mark" aria-hidden="true">
                {c.completed ? <Icon name="check" size={18} /> : null}
              </span>
              <span className="pass-week-text">
                <span className="pass-week-title">{c.text}</span>
                <span className="pass-week-detail">
                  {TIER_WORDS[c.tier]} · {c.done} / {c.need}
                  {c.completed ? " · Done" : ""}
                </span>
                <span className="pass-week-bar" aria-hidden="true">
                  <span style={{ width: `${pct}%` }} />
                </span>
              </span>
              <span className="pass-week-joules">
                <JoulesBolt size={16} />+{c.joules.toLocaleString("en-GB")}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
