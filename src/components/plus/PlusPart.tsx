/**
 * The Plus part of the Shop tab (wave 2, session E2; docs/art/wave-2/boards/joulz-plus-screens.png, screen 1 "The
 * Joulz Plus offer"): the offer (monthly or yearly, the perks) and, for a member, what Plus gives them now.
 *
 * Until real payments exist the only way in is a tester's "Test purchase" (no payment, marked as a test, removable by
 * Joe). Plus shows only where it is open (the shop's testers until PLUS_FOR_EVERYONE is on); anyone else keeps the
 * calm "Joulz Plus is coming" card. Only the perks Plus gives now are listed (PLUS_PERKS); the later ones are added
 * when each is built.
 */
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";

import { Button, EmptyState, Icon, Row, Skeleton, SwitchKnob } from "@/design/components";
import { useAccount } from "@/lib/account/accountApi";
import { PLUS_FOR_EVERYONE, PLUS_MONTHLY_COINS, PLUS_MONTHLY_FREEZES, PLUS_PRICES } from "@/config/plusConfig";
import { setPlusMark, testPurchasePlus, usePlusStatus, type PlusStatus } from "@/lib/plus/plusApi";

type Plan = "monthly" | "yearly";

type IconName = Parameters<typeof Icon>[0]["name"];

/**
 * The perks Plus gives now, in the board's order. Full stats, the weekly report and drills, replay review and ghost
 * races are planned for the polish stage and are added here only when each is built (Joe, 13 Nov 2026).
 */
export const PLUS_PERKS: readonly { icon: IconName; title: string; sub: string }[] = [
  { icon: "rewards", title: "Premium pass, every season", sub: "Every Neon Circuit reward and every season after" },
  { icon: "shop", title: `${PLUS_MONTHLY_COINS} coins every month`, sub: "Spend them in the shop" },
  { icon: "streak", title: `${PLUS_MONTHLY_FREEZES} streak freezes a month`, sub: "Keep your Daily streak on busy days" },
  { icon: "calendar", title: "Daily archive", sub: "Play any past Daily, just for fun" },
  { icon: "star", title: "Early access", sub: "New games in Practice before everyone else" },
];

function Perks() {
  return (
    <ul className="plus-perks" data-plus-perks>
      {PLUS_PERKS.map((perk) => (
        <li key={perk.title} className="plus-perk">
          <span className="plus-perk-icon">
            <Icon name={perk.icon} size={20} />
          </span>
          <span className="plus-perk-text">
            <span className="plus-perk-title">{perk.title}</span>
            <span className="plus-perk-sub">{perk.sub}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function Offer({ status }: { status: PlusStatus }) {
  const [plan, setPlan] = useState<Plan>("yearly");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const buy = async () => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    const answer = await testPurchasePlus(plan);
    setBusy(false);
    if (!answer.ok) setMessage(answer.message);
  };
  return (
    <div className="plus-offer" data-plus-offer>
      <div className="plus-hero">
        <span className="plus-hero-mark" aria-hidden="true">
          <Icon name="streak" size={24} />
        </span>
        <h2>Joulz Plus</h2>
        <p>Get better, faster. Look the part.</p>
      </div>
      <div role="radiogroup" aria-label="Plan" className="plus-plans">
        <button type="button" role="radio" aria-checked={plan === "monthly"} onClick={() => setPlan("monthly")} className="plus-plan press" data-plus-plan="monthly">
          <span className="plus-plan-label">Monthly</span>
          <span className="plus-plan-price">
            {PLUS_PRICES.monthly} <small>/month</small>
          </span>
        </button>
        <button type="button" role="radio" aria-checked={plan === "yearly"} onClick={() => setPlan("yearly")} className="plus-plan press" data-plus-plan="yearly">
          <span className="plus-plan-save">Save 27%</span>
          <span className="plus-plan-label">Yearly</span>
          <span className="plus-plan-price">
            {PLUS_PRICES.yearly} <small>/year</small>
          </span>
        </button>
      </div>
      <Perks />
      {message ? (
        <p role="alert" className="cz-message" data-plus-message>
          {message}
        </p>
      ) : null}
      {status.tester ? (
        <>
          <Button variant="gold" size={52} block disabled={busy} onClick={() => void buy()} data-plus-test-purchase={plan}>
            {busy ? "Starting…" : "Test purchase"}
          </Button>
          <p className="plus-test-note" data-plus-test-note>
            A test purchase for testers: no payment is taken, and it’s marked as a test.
          </p>
        </>
      ) : (
        <Button variant="secondary" size={52} block disabled data-plus-coming>
          Coming soon
        </Button>
      )}
      <p className="plus-small-print">
        Cancel any time. Plus never helps you win: ratings, scores and matchmaking are the same for everyone, and rooms
        are always free.
      </p>
    </div>
  );
}

function Member({ status }: { status: PlusStatus }) {
  const router = useRouter();
  const member = status.member!;
  const [message, setMessage] = useState<string | null>(null);
  const toggleMark = async () => {
    setMessage(null);
    const answer = await setPlusMark(!member.showMark);
    if (!answer.ok) setMessage(answer.message);
  };
  return (
    <div className="plus-offer" data-plus-member={member.plan}>
      <div className="plus-hero">
        <span className="plus-hero-mark" aria-hidden="true">
          <Icon name="check" size={24} />
        </span>
        <h2>You have Joulz Plus</h2>
        <p>
          {member.plan === "yearly" ? "Yearly" : "Monthly"}
          {member.test ? " · test purchase" : ""}
        </p>
      </div>
      <div className="jz-panel plus-member">
        <Row as="button" role="switch" aria-checked={member.showMark} aria-label="Show the PLUS chip on my profile" onClick={() => void toggleMark()} data-plus-mark-toggle>
          <span className="jz-row-text items-start text-left">
            <span className="jz-row-title">PLUS chip on my profile</span>
            <span className="jz-row-sub">Off unless you turn it on</span>
          </span>
          <SwitchKnob on={member.showMark} />
        </Row>
        <Row as="button" onClick={() => void router.navigate({ to: "/daily-archive" })} data-plus-archive-open>
          <span className="jz-row-text items-start text-left">
            <span className="jz-row-title">Daily archive</span>
            <span className="jz-row-sub">Play any past Daily, unrated</span>
          </span>
          <Icon name="chevron-right" size={20} tone="text-3" />
        </Row>
      </div>
      {message ? (
        <p role="alert" className="cz-message">
          {message}
        </p>
      ) : null}
      <p className="plus-small-print" data-plus-perks-paid={status.monthsPaid}>
        {PLUS_MONTHLY_COINS} coins and {PLUS_MONTHLY_FREEZES} streak freezes arrive at the start of each Plus month.
        {status.premiumPass ? " Your premium pass is on." : " Your premium pass arrives with Season 1."}
      </p>
      <Perks />
    </div>
  );
}

export function PlusPart({ soon }: { soon: { title: string; body: string } }) {
  const account = useAccount();
  const status = usePlusStatus(account.kind === "account");
  if (account.kind === "unknown" || (account.kind === "account" && status === null))
    return <Skeleton kind="card" />;
  if (!status || (!status.open && !PLUS_FOR_EVERYONE)) {
    return (
      <div className="shop-soon" data-shop-soon="plus">
        <EmptyState layout="card" tone="cool" title={soon.title} body={soon.body} />
      </div>
    );
  }
  return status.member ? <Member status={status} /> : <Offer status={status} />;
}
