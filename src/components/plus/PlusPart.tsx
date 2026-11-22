/**
 * The Plus part of the Shop tab (wave 2, session E2; phase 2 step 3, the Shop pages session, 14 Nov 2026): Joulz Plus
 * with the player's status, then (not a member) the plan and the purchase, or (a member) the PLUS chip and the Daily
 * archive, then what Plus includes as plain rows. No pressure (Joe's rule): no savings badge, no countdown.
 *
 * Until real payments exist the only way in is a tester's "Test purchase" (no payment, marked as a test, removable by
 * Joe). Plus shows only where it is open (the shop's testers until PLUS_FOR_EVERYONE is on); anyone else keeps the
 * calm "Joulz Plus is coming" card. Only the perks Plus gives now are listed (PLUS_PERKS); the later ones are added
 * when each is built.
 */
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";

import { KitArt } from "@/components/shop/KitArt";
import { Button, EmptyState, Icon, Row, SectionHeader, Skeleton, SwitchKnob } from "@/design/components";
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
    <section className="plus-section" aria-labelledby="plus-perks-title">
      <SectionHeader id="plus-perks-title" title="What’s included" />
      <ul className="plus-incl" data-plus-perks>
        {PLUS_PERKS.map((perk) => (
          <li key={perk.title} className="plus-incl-row">
            <span className="plus-incl-icon" aria-hidden="true">
              <Icon name={perk.icon} size={22} />
            </span>
            <span className="plus-incl-text">
              <span className="plus-incl-title">{perk.title}</span>
              <span className="plus-incl-sub">{perk.sub}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The page's head: the art kit's Plus, the name, and where the player stands. */
function PlusHead({ status }: { status: string }) {
  return (
    <header className="plus-head">
      <KitArt name="plus" size={56} />
      <span className="plus-head-text">
        <h2 className="plus-head-title">Joulz Plus</h2>
        <span className="plus-status" data-plus-status>
          {status}
        </span>
      </span>
    </header>
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
    <div className="plus-page" data-plus-offer>
      <PlusHead status="You’re not a member" />
      <section className="plus-section" aria-labelledby="plus-plan-title">
        <SectionHeader id="plus-plan-title" title="Choose a plan" />
        <div role="radiogroup" aria-labelledby="plus-plan-title" className="plus-choices">
          {(["monthly", "yearly"] as const).map((p) => (
            <button key={p} type="button" role="radio" aria-checked={plan === p} onClick={() => setPlan(p)} className="plus-choice press" data-plus-plan={p}>
              <span className="plus-choice-dot" aria-hidden="true">
                {plan === p ? <Icon name="check" size={18} /> : null}
              </span>
              <span className="plus-choice-label">{p === "monthly" ? "Monthly" : "Yearly"}</span>
              <span className="plus-choice-price">
                {PLUS_PRICES[p]} <small>{p === "monthly" ? "a month" : "a year"}</small>
              </span>
            </button>
          ))}
        </div>
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
            <p className="plus-note" data-plus-test-note>
              A test purchase for testers: no payment is taken, and it’s marked as a test.
            </p>
          </>
        ) : (
          <Button variant="secondary" size={52} block disabled data-plus-coming>
            Coming soon
          </Button>
        )}
      </section>
      <Perks />
      <p className="plus-note">
        Cancel any time. Plus never helps you win, and rooms are always free.
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
    <div className="plus-page" data-plus-member={member.plan}>
      <PlusHead status={`You have Plus · ${member.plan === "yearly" ? "Yearly" : "Monthly"}${member.test ? " · test purchase" : ""}`} />
      <section className="plus-section" aria-labelledby="plus-yours-title">
        <SectionHeader id="plus-yours-title" title="Your Plus" />
        <div className="jz-panel plus-member">
          <Row as="button" onClick={() => void router.navigate({ to: "/daily-archive" })} data-plus-archive-open>
            <span className="jz-row-text items-start text-left">
              <span className="jz-row-title">Daily archive</span>
              <span className="jz-row-sub">Play any past Daily, unrated</span>
            </span>
            <Icon name="chevron-right" size={20} tone="text-3" />
          </Row>
          <Row as="button" role="switch" aria-checked={member.showMark} aria-label="Show the PLUS chip on my profile" onClick={() => void toggleMark()} data-plus-mark-toggle>
            <span className="jz-row-text items-start text-left">
              <span className="jz-row-title">PLUS chip on my profile</span>
              <span className="jz-row-sub">Off unless you turn it on</span>
            </span>
            <SwitchKnob on={member.showMark} />
          </Row>
        </div>
        {message ? (
          <p role="alert" className="cz-message">
            {message}
          </p>
        ) : null}
        <p className="plus-note" data-plus-perks-paid={status.monthsPaid}>
          {PLUS_MONTHLY_COINS} coins and {PLUS_MONTHLY_FREEZES} streak freezes arrive at the start of each Plus month.
          {status.premiumPass ? " Your premium pass is on." : " Your premium pass arrives with Season 1."}
        </p>
      </section>
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
