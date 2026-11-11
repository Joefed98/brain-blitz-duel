import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

import { Coin } from "@/components/app/CoinCounter";
import { PhoneShell } from "@/components/duel/PhoneShell";
import { lookFromLoadout } from "@/components/identity/ProfileCard";
import { Button, Chip, EmptyState, Icon, Segmented, Skeleton } from "@/design/components";
import { gemUnlockLine } from "@/lib/practice/progressRules";
import { Avatar, AVATARS, CardPiece, GEMS, NamePiece, PlayerCard, type CardLook } from "@/design/identity";
import { useAccount } from "@/lib/account/accountApi";
import { APP_NAME } from "@/lib/brand";
import { PLAYER_COLOURS } from "@/lib/duel/playerLook";
import { NO_CHOICES, optionRows, type AvatarChoice, type AvatarOptionKind, type LoadoutSlot } from "@/lib/identity/backend";
import { ownedOfKind, RARITY_LABEL, slotItems } from "@/lib/identity/customise";
import { saveAvatar, saveSlot, useMyIdentity } from "@/lib/identity/identityApi";
import { recordIdentityEvent } from "@/lib/identity/identityEvents";
import { useShopOn } from "@/lib/identity/shopSwitch";
import { saveCardBadges, saveTitle, useMyBadges } from "@/lib/badges/badgesApi";
import { BADGE_BY_SLUG, CARD_BADGE_SLOTS, PASS_TITLE_DEFS, SEASON_TITLE_DEFS, TITLES, badgeArtUrl, badgeHowLine, titleName, titlesUnlocked } from "@/lib/badges/catalogue";

/**
 * Customise (wave 2, session A2; mockups docs/art/wave-2/screens/customise-1-avatar, -2-card-and-frame,
 * -3-badges-and-title): the live card at the top, then Avatar, Card, Badges and title, and Save.
 *
 * - Avatar: the 32 game avatars and the 32 colours, all free; the avatar builder's accent, feature, accessory and
 *   background (A1's getAvatarOptions) only where an avatar has more than one choice (none do yet: the art has one
 *   accent and background each and no features or accessories); the ten gem colours, each unlocked by the account's
 *   star total (C1a; a locked gem says "Unlocks at N stars"); avatar finishes, the accessory item (Neon Bolt) and the special-edition avatar list owned items
 *   only.
 * - Card: card arts, frames and name colours. Owned ones can be chosen (the 8 free card arts and Plain from the
 *   start); the rest show locked with where they come from (catalogue), shop items hidden while the Shop is off.
 * - Badges and title (C2): up to three earned badges for the card, in the order picked, and one title from those
 *   unlocked (Rookie for everyone; badge titles with their badge; locked ones show which badge unlocks them). Only
 *   earned badges and unlocked titles can be chosen; the server checks again (badges.functions.ts).
 *
 * Save sends each change through A1's equip() and setAvatar(); a refusal shows its plain message and puts that part
 * of the card back as it was (and records equip_refused by slot and reason). Accounts only: a guest is sent to
 * Profile, whose Customise opens the save-your-progress sheet.
 */
export const Route = createFileRoute("/customise")({
  ssr: false,
  head: () => ({
    meta: [{ title: `${APP_NAME} customise` }, { name: "robots", content: "noindex" }],
  }),
  component: CustomiseScreen,
});

type Tab = "avatar" | "card" | "badges";
type CardSlot = "card-art" | "frame" | "name-colour";
const CARD_SLOTS: readonly CardSlot[] = ["card-art", "frame", "name-colour"];
const AVATAR_SLOTS: readonly { kind: LoadoutSlot; label: string; empty: string }[] = [
  { kind: "avatar-finish", label: "Finish", empty: "No finishes yet. Finishes you own show here." },
  { kind: "avatar-accessory", label: "Accessory", empty: "No accessories yet. Accessories you own show here." },
  { kind: "avatar-special-edition", label: "Special edition", empty: "No special editions yet. They come from the pass." },
];
const FIRST_AVATARS = 7;

function sameAvatar(a: AvatarChoice | null, b: AvatarChoice | null): boolean {
  return (
    (a?.id ?? null) === (b?.id ?? null) &&
    (a?.colour ?? null) === (b?.colour ?? null) &&
    (a?.gem ?? null) === (b?.gem ?? null) &&
    JSON.stringify(a?.choices ?? NO_CHOICES) === JSON.stringify(b?.choices ?? NO_CHOICES)
  );
}

const OPTION_LABEL: Record<AvatarOptionKind, string> = { accent: "Accent colour", feature: "Feature", accessory: "Accessory", background: "Background" };
/** An option id as words ("storm-crown" → "Storm crown"); the art names them when it draws them. */
const optionName = (id: string) => {
  const words = id.replace(/^[a-z0-9-]+\./, "").replace(/[-_]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

function CustomiseScreen() {
  const router = useRouter();
  const account = useAccount();
  const identity = useMyIdentity();
  const shopOn = useShopOn();
  const [tab, setTab] = useState<Tab>("avatar");
  const [allAvatars, setAllAvatars] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const signedIn = account.kind === "account" ? account : null;

  // Guests can't customise: Profile's Customise offers them the save-your-progress sheet instead.
  useEffect(() => {
    if (account.kind !== "unknown" && account.kind !== "account") void router.navigate({ to: "/profile", replace: true });
  }, [account.kind, router]);

  const opened = useRef(false);
  useEffect(() => {
    if (!signedIn || opened.current) return;
    opened.current = true;
    recordIdentityEvent({ event: "customise_opened" });
  }, [signedIn]);

  // The saved look (A1's loadout) and the draft the player is building on it.
  const saved = useMemo(() => {
    const look = lookFromLoadout(identity.loadout, signedIn?.colour ?? 0);
    const avatar: AvatarChoice = identity.loadout?.avatar ?? { id: "captain-joulz", colour: signedIn?.colour ?? 0, gem: null, choices: { ...NO_CHOICES } };
    const slots: Partial<Record<LoadoutSlot, string | null>> = {
      ...identity.loadout?.slots,
      "card-art": look.cardArt,
      frame: look.frame,
      "name-colour": look.nameColour,
    };
    return { avatar, slots };
  }, [identity.loadout, signedIn?.colour]);
  const [draftAvatar, setDraftAvatar] = useState<AvatarChoice | null>(null);
  // C2: the card's badges and the title (badgesApi.ts), and the drafts on them.
  const myBadges = useMyBadges();
  const mine = myBadges.badges?.account ? myBadges.badges : null;
  const [draftCard, setDraftCard] = useState<string[] | null>(null);
  const [draftTitle, setDraftTitle] = useState<string | null>(null);
  const cardBadges = draftCard ?? mine?.card ?? [];
  const title = draftTitle ?? mine?.title ?? "rookie";
  const cardChanged = draftCard !== null && draftCard.join() !== (mine?.card ?? []).join();
  const titleChanged = draftTitle !== null && draftTitle !== (mine?.title ?? "rookie");
  const [draftSlots, setDraftSlots] = useState<Partial<Record<LoadoutSlot, string | null>>>({});
  const avatar = draftAvatar ?? saved.avatar;
  const slotValue = (slot: LoadoutSlot): string | null => (slot in draftSlots ? draftSlots[slot]! : (saved.slots[slot] ?? null));
  const look: CardLook = {
    cardArt: slotValue("card-art"),
    frame: slotValue("frame"),
    nameColour: slotValue("name-colour"),
    avatar,
  };
  const changedSlots = (Object.keys(draftSlots) as LoadoutSlot[]).filter((slot) => (draftSlots[slot] ?? null) !== (saved.slots[slot] ?? null));
  const avatarChanged = draftAvatar !== null && !sameAvatar(draftAvatar, saved.avatar);
  const dirty = changedSlots.length > 0 || avatarChanged || cardChanged || titleChanged;

  const pick = (slot: LoadoutSlot, id: string | null) => {
    setMessage(null);
    setDraftSlots((d) => ({ ...d, [slot]: id }));
  };
  // Gem colours this account has unlocked (the server's, through A1's loadout).
  const unlockedGems = new Set(identity.loadout?.unlockedGems ?? []);
  const pickAvatar = (change: Partial<AvatarChoice>) => {
    setMessage(null);
    setDraftAvatar({ ...avatar, ...change });
  };

  const save = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    setMessage(null);
    const refusals: string[] = [];
    for (const slot of changedSlots) {
      const answer = await saveSlot(slot, draftSlots[slot] ?? null);
      if (!answer.ok) {
        refusals.push(answer.message);
        recordIdentityEvent({ event: "equip_refused", slot, reason: answer.reason });
      }
    }
    if (avatarChanged && draftAvatar) {
      const answer = await saveAvatar(draftAvatar);
      if (!answer.ok) {
        refusals.push(answer.message);
        recordIdentityEvent({ event: "equip_refused", slot: "avatar", reason: answer.reason });
      }
    }
    if (cardChanged && draftCard) {
      const answer = await saveCardBadges(draftCard);
      if (!answer.ok) refusals.push(answer.message);
    }
    if (titleChanged && draftTitle) {
      const answer = await saveTitle(draftTitle);
      if (!answer.ok) refusals.push(answer.message);
    }
    setDraftCard(null);
    setDraftTitle(null);
    // Saved parts now come from the loadout A1 answered with; refused parts go back to what was saved (the draft is
    // dropped either way, so the card shows exactly the saved look).
    setDraftSlots({});
    setDraftAvatar(null);
    setSaving(false);
    if (refusals.length) setMessage([...new Set(refusals)].join(" "));
  };

  const coins = identity.coins;
  const name = signedIn?.username ?? "";

  return (
    <PhoneShell skin="profile" bare>
      <div className="cz-page" data-customise={signedIn ? (identity.live ? "ready" : "not-ready") : "loading"}>
        <header className="cz-head">
          <span className="cz-head-title">
            <Button variant="icon" aria-label="Back" onClick={() => router.history.back()} className="-ml-2.5">
              <Icon name="back" size={22} />
            </Button>
            <h1>Customise</h1>
          </span>
          {shopOn && coins !== null ? (
            <span className="jz-coins" data-coin-counter="customise" aria-label={`${coins.toLocaleString("en-GB")} coins`}>
              <Coin />
              <span className="jz-coins-value">{coins.toLocaleString("en-GB")}</span>
            </span>
          ) : null}
        </header>

        {!signedIn ? (
          <Skeleton kind="card" />
        ) : (
          <>
            <PlayerCard
              look={look}
              name={name}
              playerNumber={signedIn.playerNumber}
              title={mine ? titleName(title) : null}
              badges={mine ? cardBadges : undefined}
              label="Your card, as it will look"
            />
            <Segmented<Tab>
              label="Customise"
              radio
              value={tab}
              onChange={setTab}
              options={[
                { value: "avatar", label: "Avatar", data: { "data-customise-tab": "avatar" } },
                { value: "card", label: "Card", data: { "data-customise-tab": "card" } },
                { value: "badges", label: "Badges and title", data: { "data-customise-tab": "badges" } },
              ]}
            />
            {message ? (
              <p role="alert" className="cz-message" data-customise-message>
                {message}
              </p>
            ) : null}
            {!identity.live ? (
              <EmptyState layout="card" tone="cool" title="Customise opens soon" body="Your card’s looks can’t be saved yet." data-customise-soon="" />
            ) : tab === "avatar" ? (
              <>
                <section className="cz-section" aria-label="Avatar">
                  <span className="cz-label">Avatar</span>
                  <div role="radiogroup" aria-label="Avatar" className="cz-avatars">
                    {(allAvatars ? AVATARS : AVATARS.slice(0, FIRST_AVATARS)).map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        role="radio"
                        aria-checked={avatar.id === a.id}
                        data-avatar-choice={a.id}
                        onClick={() => pickAvatar({ id: a.id, choices: { ...NO_CHOICES } })}
                        className="cz-avatar press"
                      >
                        <Avatar look={{ id: a.id, colour: avatar.colour, gem: avatar.gem }} size={52} />
                        <span>{a.name}</span>
                      </button>
                    ))}
                    {allAvatars ? null : (
                      <button type="button" onClick={() => setAllAvatars(true)} className="cz-avatar press" data-avatars-all>
                        <span className="ap-best">+{AVATARS.length - FIRST_AVATARS}</span>
                        <span>All {AVATARS.length}</span>
                      </button>
                    )}
                  </div>
                </section>
                <section className="cz-section" aria-label="Gem colours">
                  <span className="cz-label-row">
                    <span className="cz-label">Gem colours</span>
                    <span className="cz-meta">Earned with mastery stars</span>
                  </span>
                  {/* Unlocked with the account's star total (wave 2 C1a, progressRules.ts GEM_THRESHOLDS; the server's
                      gem_unlocks); a locked gem says the stars it needs. setAvatar refuses a locked gem whatever is sent. */}
                  <div className="cz-gems" data-gems-locked>
                    {GEMS.map((g) => {
                      const swatch = { ["--sw" as string]: `linear-gradient(160deg, ${g.stops.join(", ")})` };
                      if (unlockedGems.has(g.id)) {
                        return (
                          <button
                            key={g.id}
                            type="button"
                            role="radio"
                            aria-checked={avatar.gem === g.id}
                            aria-label={g.name}
                            data-gem={g.id}
                            data-gem-choice={g.id}
                            onClick={() => pickAvatar({ gem: g.id })}
                            className="cz-gem press"
                          >
                            <span style={swatch} data-unlocked="" />
                            <span>{g.name}</span>
                          </button>
                        );
                      }
                      const line = gemUnlockLine(g.id);
                      return (
                        <span key={g.id} className="cz-gem" data-gem={g.id} data-locked="" aria-label={`${g.name}, locked. ${line}`} role="img">
                          <span style={swatch}>
                            <Icon name="lock" size={18} tone="text" />
                          </span>
                          <span>{g.name}</span>
                          <span data-gem-unlock className="cz-gem-unlock">{line}</span>
                        </span>
                      );
                    })}
                  </div>
                </section>
                <section className="cz-section" aria-label="Main colour">
                  <span className="cz-label">Main colour</span>
                  <div role="radiogroup" aria-label="Main colour" className="cz-swatches">
                    {PLAYER_COLOURS.map((c, i) => (
                      <button
                        key={c.name}
                        type="button"
                        role="radio"
                        aria-checked={avatar.colour === i && !avatar.gem}
                        aria-label={c.name}
                        data-colour-choice={i}
                        onClick={() => pickAvatar({ colour: i, gem: null })}
                        className="cz-swatch press"
                      >
                        <span style={{ ["--sw" as string]: `var(--jz-player-${i})` }} />
                      </button>
                    ))}
                  </div>
                </section>
                {/* The avatar builder's own options (getAvatarOptions): a row only where there is a real choice (more than one). */}
                {optionRows(identity.avatarOptions, avatar.id).map((row) => {
                  const chosen = avatar.choices?.[row.kind] ?? row.default;
                  return (
                    <section key={row.kind} className="cz-section" aria-label={OPTION_LABEL[row.kind]} data-avatar-option={row.kind}>
                      <span className="cz-label">{OPTION_LABEL[row.kind]}</span>
                      <div role="radiogroup" aria-label={OPTION_LABEL[row.kind]} className="flex flex-wrap gap-2">
                        {row.options.map((option) => (
                          <Chip
                            key={option}
                            role="radio"
                            selected={chosen === option}
                            data-option-choice={option}
                            onClick={() => pickAvatar({ choices: { ...NO_CHOICES, ...avatar.choices, [row.kind]: option } })}
                          >
                            {optionName(option)}
                          </Chip>
                        ))}
                      </div>
                    </section>
                  );
                })}
                {AVATAR_SLOTS.map(({ kind, label, empty }) => {
                  const mine = ownedOfKind(identity.catalogue, kind, identity.owned);
                  return (
                    <section key={kind} className="cz-section" aria-label={label} data-avatar-slot={kind}>
                      <span className="cz-label">{label}</span>
                      {mine.length ? (
                        <div className="flex flex-wrap gap-2">
                          <Chip selected={slotValue(kind) === null} onClick={() => pick(kind, null)}>
                            None
                          </Chip>
                          {mine.map((item) => (
                            <Chip key={item.id} selected={slotValue(kind) === item.id} onClick={() => pick(kind, item.id)} data-item={item.id}>
                              {item.name}
                            </Chip>
                          ))}
                        </div>
                      ) : (
                        <p className="cz-empty" data-slot-empty>
                          {empty}
                        </p>
                      )}
                    </section>
                  );
                })}
              </>
            ) : tab === "card" ? (
              CARD_SLOTS.map((slot) => {
                const rows = slotItems(identity.catalogue, slot, identity.owned, shopOn);
                const label = slot === "card-art" ? "Card art" : slot === "frame" ? "Frame" : "Name colour";
                return (
                  <section key={slot} className="cz-section" aria-label={label} data-card-slot={slot}>
                    <span className="cz-label">{label}</span>
                    <div role="radiogroup" aria-label={label} className="cz-items">
                      {slot === "name-colour" ? (
                        <button
                          type="button"
                          role="radio"
                          aria-checked={slotValue(slot) === null}
                          data-item-choice="plain"
                          onClick={() => pick(slot, null)}
                          className="cz-item press"
                        >
                          <NamePiece id={null} name={name} />
                          <span className="cz-item-name">Plain</span>
                          <span className="cz-item-sub">
                            <span>{slotValue(slot) === null ? "Equipped" : "Owned"}</span>
                          </span>
                        </button>
                      ) : null}
                      {rows.map(({ item, owned, from }) => {
                        const on = slotValue(slot) === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            aria-disabled={!owned || undefined}
                            data-item-choice={item.id}
                            data-locked={owned ? undefined : ""}
                            onClick={() => (owned ? pick(slot, item.id) : undefined)}
                            className="cz-item press"
                          >
                            {item.rarity ? (
                              <span className="cz-rarity" data-rarity={item.rarity}>
                                {RARITY_LABEL[item.rarity]}
                              </span>
                            ) : null}
                            {slot === "name-colour" ? <NamePiece id={item.id} name={name} /> : <CardPiece id={item.id} />}
                            <span className="cz-item-name">{item.name}</span>
                            <span className="cz-item-sub">
                              {owned ? (
                                <span>{on ? "Equipped" : "Owned"}</span>
                              ) : (
                                <>
                                  <Icon name="lock" size={18} tone="text-3" className="-m-px" />
                                  <span>{from}</span>
                                </>
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              })
            ) : (
              <BadgesAndTitle
                mine={mine}
                live={myBadges.live}
                card={cardBadges}
                title={title}
                onCard={(next) => {
                  setMessage(null);
                  setDraftCard(next);
                }}
                onTitle={(next) => {
                  setMessage(null);
                  setDraftTitle(next);
                }}
              />
            )}
          </>
        )}
      </div>
      {signedIn && identity.live ? (
        <div className="cz-footer">
          <Button variant="gold" size={52} block disabled={!dirty || saving} onClick={() => void save()} data-customise-save>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      ) : null}
    </PhoneShell>
  );
}

/** Customise's third tab (C2; mockup docs/art/wave-2/screens/customise-3-badges-and-title.png). */
function BadgesAndTitle({
  mine,
  live,
  card,
  title,
  onCard,
  onTitle,
}: {
  mine: { earned: { slug: string; number: number | null }[]; passTitles?: string[]; seasonTitles?: string[] } | null;
  live: boolean;
  card: string[];
  title: string;
  onCard: (next: string[]) => void;
  onTitle: (next: string) => void;
}) {
  if (!live || !mine) {
    return <EmptyState layout="card" tone="cool" title="Badges are loading" body="Your badges and titles show here." data-badges-soon="" />;
  }
  const earned = mine.earned.filter((b) => BADGE_BY_SLUG.has(b.slug));
  const unlocked = new Set(titlesUnlocked(new Set(earned.map((b) => b.slug))).map((t) => t.id));
  // The Season pass's titles (wave 2 D2): listed once unlocked on the pass, and equippable.
  const passTitles = PASS_TITLE_DEFS.filter((t) => mine.passTitles?.includes(t.id));
  for (const t of passTitles) unlocked.add(t.id);
  // The season titles (wave 4 W4d): listed once granted at a season's end, and equippable.
  const seasonTitles = SEASON_TITLE_DEFS.filter((t) => mine.seasonTitles?.includes(t.id));
  for (const t of seasonTitles) unlocked.add(t.id);
  const toggle = (slug: string) => {
    if (card.includes(slug)) onCard(card.filter((s) => s !== slug));
    else if (card.length < CARD_BADGE_SLOTS) onCard([...card, slug]);
  };
  return (
    <>
      <section className="cz-section" aria-label="Badges" data-badge-slots>
        <span className="cz-label-row">
          <span className="cz-label">Show up to 3 on your card</span>
          <span className="cz-meta" data-badges-chosen>
            {card.length} of {CARD_BADGE_SLOTS} chosen
          </span>
        </span>
        {earned.length ? (
          <div className="bd-grid" role="group" aria-label="Your badges">
            {earned.map((b) => {
              const def = BADGE_BY_SLUG.get(b.slug)!;
              const on = card.includes(b.slug);
              const full = !on && card.length >= CARD_BADGE_SLOTS;
              return (
                <button
                  key={b.slug}
                  type="button"
                  aria-pressed={on}
                  aria-disabled={full || undefined}
                  data-badge-choice={b.slug}
                  onClick={() => toggle(b.slug)}
                  className="bd-tile press"
                >
                  <img src={badgeArtUrl(b.slug)} alt="" width={56} height={56} draggable={false} />
                  <span className="bd-name">{def.name}</span>
                  <span className="bd-how">{b.number !== null ? `#${String(b.number).padStart(4, "0")}` : on ? "On your card" : "Earned"}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="cz-empty" data-badges-empty>
            Badges you earn show here. See them all on your Profile.
          </p>
        )}
      </section>
      <section className="cz-section" aria-label="Title" data-title-slot>
        <span className="cz-label">Title, shown under your name</span>
        <div role="radiogroup" aria-label="Title" className="bd-titles">
          {[...TITLES.filter((t) => t.kind === "starter" || t.kind === "badge"), ...passTitles, ...seasonTitles].map((t) => {
            const open = unlocked.has(t.id);
            const badge = t.badge ? BADGE_BY_SLUG.get(t.badge) : undefined;
            const how = t.kind === "starter" ? "Everyone starts here" : t.kind === "pass" ? "Season 1 pass" : t.kind === "season" ? "Season 1 peak tier" : open ? `${badge?.name ?? ""} badge` : badge ? `${badge.name} badge: ${badgeHowLine(badge)}` : "";
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={title === t.id}
                aria-disabled={!open || undefined}
                data-title-choice={t.id}
                data-locked={open ? undefined : ""}
                onClick={() => (open ? onTitle(t.id) : undefined)}
                className="bd-title press"
              >
                <span className="bd-radio" aria-hidden="true" />
                <span className="bd-title-text">
                  <span className="bd-title-name">{t.name}</span>
                  <span className="bd-title-how">{how}</span>
                </span>
                {open ? null : <Icon name="lock" size={18} tone="text-3" />}
              </button>
            );
          })}
        </div>
      </section>
    </>
  );
}
