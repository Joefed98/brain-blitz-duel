import { useState } from "react";

import { PhoneShell } from "@/components/duel/PhoneShell";
import { betaValue } from "@/lib/beta/betaValues";
import { agreeToTerms, termsAgreement } from "@/lib/beta/terms";
import { APP_NAME } from "@/lib/brand";
import { unlockAudio } from "@/lib/sound";

/** "22 Oct 2026" in UK time. */
function agreedDay(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Europe/London",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1">
      <h2 className="whitespace-nowrap text-[17px] font-bold text-foreground">
        {title}
      </h2>
      <div className="flex flex-col gap-1.5 text-[15px] leading-relaxed text-[#D6D3DC]">
        {children}
      </div>
    </section>
  );
}

/** Who runs the beta: the operator the terms name ("Joulz ('we', 'us')"). */
const OPERATOR = "Joulz";

/**
 * The beta terms in plain English (/terms; shown once before a device's first room, daily or
 * challenge). Not legal advice: Joe's adviser reviews the wording before the beta. The contact line
 * shows only once CONTACT_EMAIL (src/config/betaConfig.ts) is set.
 */
export function TermsContent() {
  const contact = betaValue("CONTACT_EMAIL");
  return (
    <div data-terms-content className="flex flex-col gap-5">
      <Section title="An early-access beta">
        <p>
          {`${OPERATOR} ("we", "us") runs this early-access beta of ${APP_NAME}. It's free to play. Games, scores and features may change, break or be reset while we test.`}
        </p>
      </Section>
      <Section title="For ages 18 and over">
        <p>You must be 18 or over to play the beta.</p>
      </Section>
      <Section title="Our games stay ours">
        <p>
          {`The games, puzzles, art, sounds and code belong to ${OPERATOR}. Please don't copy, reverse engineer, scrape or redistribute them.`}
        </p>
      </Section>
      <Section title="What other players see">
        <p>
          Your nickname and scores appear on leaderboards, and on the result cards players choose to
          share.
        </p>
      </Section>
      <Section title="What we record, and why">
        <p>
          A device ID, the nicknames you use, your scores and play events, chat messages you send in
          a room, and crash reports. We use them to run the game and make it better.
        </p>
      </Section>
      <Section title="Deleting your data">
        <p>Ask us and we'll delete your data.</p>
        {contact ? (
          <p data-terms-contact>
            Contact:{" "}
            <a
              href={`mailto:${contact}`}
              className="font-semibold text-foreground underline underline-offset-2"
            >
              {contact}
            </a>
          </p>
        ) : null}
      </Section>
    </div>
  );
}

/**
 * The terms as a screen. Not yet agreed: I AGREE at the bottom (kept on the device with its date and
 * recorded with the beta events), then `onAgree`. Agreed: the date, and Back when given.
 */
export function TermsScreen({ onAgree, onBack }: { onAgree?: () => void; onBack?: () => void }) {
  const [agreement, setAgreement] = useState(() => termsAgreement());
  return (
    <PhoneShell skin="profile">
      <div data-terms className="flex flex-1 flex-col gap-5">
        <div>
          <p className="th-kicker">Before you play</p>
          <h1 className="ap-title mt-1 whitespace-nowrap text-[28px]">Beta terms</h1>
          <p className="ap-sub mt-1">The short version, in plain English.</p>
        </div>
        {/* Readable text on the page itself (Polish batch R): no bordered card. */}
        <div className="px-1">
          <TermsContent />
        </div>
        <div
          data-terms-actions
          className="sticky bottom-0 z-10 mt-auto flex flex-col gap-2 bg-background pb-2 pt-3"
          style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom, 0px))" }}
        >
          {agreement ? (
            <>
              <p
                data-terms-agreed
                className="whitespace-nowrap text-center text-[13px] text-muted-foreground"
              >
                You agreed on {agreedDay(agreement.agreedAt)}
              </p>
              {onBack ? (
                <button
                  type="button"
                  onClick={onBack}
                  className="rs-btn press tap-target h-[52px] w-full"
                >
                  Back
                </button>
              ) : null}
            </>
          ) : (
            <button
              type="button"
              data-terms-agree
              onClick={() => {
                unlockAudio();
                setAgreement(agreeToTerms());
                onAgree?.();
              }}
              className="th-btn-gold ap-btn-gold press tap-target h-[52px] w-full whitespace-nowrap rounded-[14px] text-[17px]"
            >
              I agree
            </button>
          )}
        </div>
      </div>
    </PhoneShell>
  );
}
