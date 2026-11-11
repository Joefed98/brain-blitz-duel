/**
 * The Friends screens (wave 2 B1; mockups docs/art/wave-2/screens/friends-1-list, -2-add, -3-profile, -4-options;
 * docs/friends.md). Only real data: no ratings, trophies or strongest categories until their waves, and no QR codes
 * (decided 10 Nov).
 *
 * - FriendsList (FR1): search your friends, Requests (accept / decline), room invites and challenges from friends,
 *   Online and Offline with each friend's status (as their setting allows), "Show when I'm online", blocked players.
 * - AddFriend (FR2): find by username (adults only; under-18s are told to share their link), the invite link with
 *   Copy link, Share and Reset link.
 * - FriendProfileView (FR3): the player card (A1's getPublicCard), Challenge (the existing friend challenge flow),
 *   Invite to room (when the viewer is in a lobby), the head-to-head from rooms and challenges both played.
 * - FriendOptions (FR4): remove (silent), block (both ways; not told), report (wave 1's reasons and thank-you).
 */
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

import { lookFromLoadout } from "@/components/identity/ProfileCard";
import { PlayerBadge } from "@/components/duel/PlayerBadge";
import { ReportReasons } from "@/components/duel/ReportSheet";
import {
  Button,
  EmptyState,
  Icon,
  Input,
  Panel,
  Row,
  SectionHeader,
  Sheet,
  Skeleton,
  SwitchKnob,
  Toast,
} from "@/design/components";
import { PlayerCard } from "@/design/identity";
import { isLiveType, puzzleName } from "@/lib/duel/catalogue";
import {
  FRIENDS_MESSAGES,
  isOnline,
  joinableRoom,
  statusText,
  type FriendsRefusal,
} from "@/lib/friends/friends";
import { friendsApi, type FriendCard, type FriendProfile, type Overview, type SearchHit } from "@/lib/friends/friendsApi";
import { identityBackend } from "@/lib/identity/backend";
import type { CardLook } from "@/design/identity";
import { REPORT_THANKS, type ReportReason } from "@/lib/safety/reports";

/** How many offline friends show before "Show all". */
const OFFLINE_FIRST = 3;

function Head({ title, onBack, right }: { title: string; onBack: () => void; right?: React.ReactNode }) {
  return (
    <header className="fr-head">
      <span className="fr-head-title">
        <Button variant="icon" aria-label="Back" onClick={onBack} className="-ml-2.5">
          <Icon name="back" size={22} />
        </Button>
        <h1 data-ellipsis>{title}</h1>
      </span>
      {right ?? null}
    </header>
  );
}

function Badge({ card, size = 44 }: { card: Pick<FriendCard, "username" | "colour">; size?: number }) {
  return <PlayerBadge look={{ colour: card.colour, icon: null }} name={card.username} size={size} className="fr-badge" />;
}

/** A short message strip (sent, accepted, refused), cleared after a few seconds. */
function useNotice(): [string | null, (text: string | null, tone?: "info" | "error") => void, "info" | "error"] {
  const [notice, setNotice] = useState<{ text: string; tone: "info" | "error" } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const show = (text: string | null, tone: "info" | "error" = "info") => {
    window.clearTimeout(timer.current);
    setNotice(text ? { text, tone } : null);
    if (text) timer.current = window.setTimeout(() => setNotice(null), 4000);
  };
  return [notice?.text ?? null, show, notice?.tone ?? "info"];
}

function Notice({ text, tone }: { text: string | null; tone: "info" | "error" }) {
  if (!text) return null;
  return (
    <Toast tone={tone === "error" ? "error" : "info"} className="fr-notice" data-friends-notice>
      {text}
    </Toast>
  );
}

const messageOf = (answer: FriendsRefusal) => answer.message || FRIENDS_MESSAGES.error;

/* ================================================================== FR1: the list */

export function FriendsList({
  onBack,
  onAdd,
  onOpen,
  arrival,
}: {
  onBack: () => void;
  onAdd: () => void;
  onOpen: (playerId: string) => void;
  /** A line to show once on arrival (an invite link's answer). */
  arrival?: string | null;
}) {
  const navigate = useNavigate();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [allOffline, setAllOffline] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice, tone] = useNotice();
  const now = Date.now();

  const load = async () => {
    const answer = await friendsApi.overview();
    if (answer.ok) {
      setOverview(answer.overview);
      setFailed(null);
    } else setFailed(messageOf(answer));
  };
  useEffect(() => {
    void load();
    if (arrival) setNotice(arrival);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 60_000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const respond = async (requestId: string, accept: boolean, name: string) => {
    setBusy(requestId);
    const answer = await friendsApi.respond(requestId, accept);
    setBusy(null);
    if (!answer.ok) return setNotice(messageOf(answer), "error");
    if (answer.outcome === "accepted") setNotice(`You and ${name} are friends`);
    await load();
  };

  const setShow = async (show: boolean) => {
    if (!overview) return;
    setOverview({ ...overview, showOnline: show, showOnlineSetting: show });
    const answer = await friendsApi.setShowOnline(show);
    if (!answer.ok) {
      setNotice(messageOf(answer), "error");
      await load();
    }
  };

  const unblock = async (id: string, name: string) => {
    setBusy(id);
    const answer = await friendsApi.unblock(id);
    setBusy(null);
    if (!answer.ok) return setNotice(messageOf(answer), "error");
    setNotice(`${name} unblocked`);
    await load();
  };

  const friends = overview?.friends ?? [];
  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? friends.filter((f) => f.username.toLowerCase().includes(q)) : friends;
  }, [friends, filter]);
  const online = shown.filter((f) => isOnline(f.status));
  const offline = shown
    .filter((f) => !isOnline(f.status))
    .sort((a, b) => {
      const at = (f: typeof a) => (f.status.kind === "offline" && f.status.lastSeen ? Date.parse(f.status.lastSeen) : 0);
      return at(b) - at(a);
    });
  const offlineShown = allOffline || filter ? offline : offline.slice(0, OFFLINE_FIRST);

  return (
    <div className="fr-page" data-friends-screen="list">
      <Head
        title="Friends"
        onBack={onBack}
        right={
          <Button variant="icon" aria-label="Add a friend" onClick={onAdd} data-friends-add>
            <Icon name="addfriend" size={24} tone="gold" />
          </Button>
        }
      />
      <Notice text={notice} tone={tone} />
      {!overview ? (
        failed ? (
          <EmptyState layout="card" title="Can’t load your friends" body={failed} action={{ label: "Try again", onClick: () => void load() }} />
        ) : (
          <Skeleton kind="card" />
        )
      ) : (
        <>
          {friends.length > 0 ? (
            <label className="fr-search">
              <Icon name="search" size={20} tone="text-3" />
              <Input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder={`Search your ${friends.length === 1 ? "friend" : `${friends.length} friends`}`}
                aria-label="Search your friends"
                data-friends-filter
              />
            </label>
          ) : null}

          {overview.incoming.length ? (
            <section aria-label="Requests" data-friends-section="requests">
              <SectionHeader title="Requests" right={<span className="fr-count">{overview.incoming.length}</span>} />
              <div className="fr-requests">
                {overview.incoming.map((r) => (
                  <div key={r.requestId} className="fr-request" data-friend-request={r.requestId}>
                    <button type="button" className="fr-request-who press" onClick={() => onOpen(r.id)}>
                      <Badge card={r} />
                      <span className="fr-who-text">
                        <span className="fr-name">{r.username}</span>
                        <span className="fr-sub">{r.via === "link" ? "Used your invite link" : "Found you by username"}</span>
                      </span>
                    </button>
                    <Button
                      variant="secondary"
                      size={48}
                      aria-label={`Decline ${r.username}`}
                      className="fr-decline"
                      disabled={busy === r.requestId}
                      onClick={() => void respond(r.requestId, false, r.username)}
                      data-friend-decline
                    >
                      <Icon name="close" size={20} tone="red" />
                    </Button>
                    <Button
                      variant="gold"
                      size={48}
                      disabled={busy === r.requestId}
                      onClick={() => void respond(r.requestId, true, r.username)}
                      data-friend-accept
                    >
                      Accept
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {overview.invites.length || overview.challenges.length ? (
            <section aria-label="Invites" data-friends-section="invites">
              <SectionHeader title="Invites" />
              <Panel>
                {overview.invites.map((i) => (
                  <Row key={`room-${i.id}`} icon="44" leading={<Badge card={i} />} title={i.username} sub={`Invited you to room ${i.code}`} data-friend-invite={i.code}>
                    <Button variant="secondary" size={44} onClick={() => void navigate({ to: "/duel/$code", params: { code: i.code } })}>
                      Join
                    </Button>
                  </Row>
                ))}
                {overview.challenges.map((c) => (
                  <Row key={`ch-${c.code}`} icon="44" leading={<Badge card={c} />} title={c.username} sub="Challenged you" data-friend-challenge={c.code}>
                    <Button variant="secondary" size={44} onClick={() => void navigate({ to: "/challenge", search: { code: c.code } as never })}>
                      Play
                    </Button>
                  </Row>
                ))}
              </Panel>
            </section>
          ) : null}

          {friends.length === 0 ? (
            <EmptyState
              layout="card"
              title="No friends yet"
              body="Add friends by username or send them your invite link. Then you can see when they’re about and play together."
              action={{ label: "Add a friend", onClick: onAdd }}
              gold
              data-friends-empty=""
            />
          ) : (
            <>
              {online.length ? (
                <section aria-label="Online" data-friends-section="online">
                  <SectionHeader title="Online" right={<span className="fr-count">{online.length}</span>} />
                  <Panel>
                    {online.map((f) => (
                      <FriendRow key={f.id} friend={f} now={now} onOpen={onOpen} />
                    ))}
                  </Panel>
                </section>
              ) : null}
              {offline.length ? (
                <section aria-label="Offline" data-friends-section="offline">
                  <SectionHeader title="Offline" right={<span className="fr-count">{offline.length}</span>} />
                  <Panel>
                    {offlineShown.map((f) => (
                      <FriendRow key={f.id} friend={f} now={now} onOpen={onOpen} />
                    ))}
                  </Panel>
                  {offlineShown.length < offline.length ? (
                    <Button variant="quiet" block onClick={() => setAllOffline(true)} data-friends-show-all>
                      Show all {offline.length}
                    </Button>
                  ) : null}
                </section>
              ) : null}
            </>
          )}

          <section aria-label="Privacy" data-friends-section="privacy">
            <Panel>
              <Row
                as="button"
                role="switch"
                aria-checked={overview.showOnline}
                aria-label="Show when I’m online"
                data-friends-show-online={overview.showOnline ? "on" : "off"}
                onClick={() => void setShow(!overview.showOnline)}
              >
                <span className="jz-row-text items-start text-left">
                  <span className="jz-row-title">Show when I’m online</span>
                  <span className="jz-row-sub">Friends see when you’re about and which room you’re in.</span>
                </span>
                <SwitchKnob on={overview.showOnline} />
              </Row>
            </Panel>
          </section>

          {overview.blocked.length ? (
            <details className="fr-blocked" data-friends-section="blocked">
              <summary className="fr-sub press">Blocked players ({overview.blocked.length})</summary>
              <Panel>
                {overview.blocked.map((b) => (
                  <Row key={b.id} title={b.username} data-blocked-player={b.id}>
                    <Button variant="secondary" size={44} disabled={busy === b.id} onClick={() => void unblock(b.id, b.username)}>
                      Unblock
                    </Button>
                  </Row>
                ))}
              </Panel>
            </details>
          ) : null}
        </>
      )}
    </div>
  );
}

function FriendRow({
  friend,
  now,
  onOpen,
}: {
  friend: Overview["friends"][number];
  now: number;
  onOpen: (id: string) => void;
}) {
  const navigate = useNavigate();
  const status = friend.status;
  const line = statusText(status, now);
  const room = joinableRoom(status);
  const kind = status.kind;
  return (
    <Row icon="44" data-friend={friend.id} data-friend-status={kind}>
      <button type="button" className="fr-row-open press" onClick={() => onOpen(friend.id)} aria-label={`${friend.username}’s profile`}>
        <span className="fr-badge-wrap">
          <Badge card={friend} />
          {isOnline(status) ? <span className="fr-dot" data-tone={kind === "playing" ? "red" : "cyan"} aria-hidden="true" /> : null}
        </span>
        <span className="fr-who-text">
          <span className="fr-name">{friend.username}</span>
          {line ? (
            <span className="fr-sub" data-tone={kind === "playing" ? "red" : isOnline(status) ? "cyan" : undefined}>
              {line}
            </span>
          ) : null}
        </span>
      </button>
      {room ? (
        <Button variant="secondary" size={44} onClick={() => void navigate({ to: "/duel/$code", params: { code: room } })} data-friend-join={room}>
          Join
        </Button>
      ) : kind === "online" || kind === "practice" ? (
        <Button
          variant="secondary"
          size={44}
          onClick={() => void navigate({ to: "/challenge", search: { friend: friend.id, friendName: friend.username } as never })}
          data-friend-challenge-open
        >
          Challenge
        </Button>
      ) : (
        <Button variant="icon" aria-label={`More for ${friend.username}`} onClick={() => onOpen(friend.id)}>
          <Icon name="more" size={22} tone="text-2" />
        </Button>
      )}
    </Row>
  );
}

/* ================================================================== FR2: add a friend */

export function AddFriend({ onBack, onOpen, adult }: { onBack: () => void; onOpen: (id: string) => void; adult: boolean | null }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchHit[] | null>(null);
  const [searchNote, setSearchNote] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [notice, setNotice, tone] = useNotice();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    void friendsApi.myLink().then((a) => (a.ok ? setLink(a.link) : setNotice(messageOf(a), "error")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2 || adult === false) {
      setResults(null);
      setSearchNote(null);
      return;
    }
    const mine = ++seq.current;
    const timer = window.setTimeout(async () => {
      const answer = await friendsApi.search(q);
      if (mine !== seq.current) return;
      if (answer.ok) {
        setResults(answer.results);
        setSearchNote(answer.results.length ? null : "No players found.");
      } else {
        setResults(null);
        setSearchNote(messageOf(answer));
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query, adult]);

  const add = async (hit: SearchHit) => {
    setBusy(hit.id);
    const answer = await friendsApi.request(hit.id);
    setBusy(null);
    if (!answer.ok) return setNotice(messageOf(answer), "error");
    const relation = answer.outcome === "sent" ? "requested" : "friends";
    setResults((rows) => rows?.map((r) => (r.id === hit.id ? { ...r, relation } : r)) ?? rows);
    setNotice(answer.outcome === "sent" ? `Request sent to ${hit.username}` : `You and ${hit.username} are friends`);
  };

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setNotice("Link copied");
    } catch {
      setNotice("Couldn’t copy. Press and hold the link to copy it.", "error");
    }
  };
  const share = async () => {
    if (!link) return;
    const text = "Add me as a friend on Joulz:";
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ text: `${text} ${link}` });
        return;
      } catch {
        return;
      }
    }
    await copy();
  };
  const reset = async () => {
    setConfirmReset(false);
    const answer = await friendsApi.myLink(true);
    if (!answer.ok) return setNotice(messageOf(answer), "error");
    setLink(answer.link);
    setNotice("New link made. The old one no longer works.");
  };

  return (
    <div className="fr-page" data-friends-screen="add">
      <Head title="Add a friend" onBack={onBack} />
      <Notice text={notice} tone={tone} />
      {adult === false ? (
        <p className="fr-note" data-friends-search-off>
          {FRIENDS_MESSAGES.under18}
        </p>
      ) : (
        <section aria-label="Find by username" className="fr-find">
          <label className="fr-label" htmlFor="friend-search">
            Find by username
          </label>
          <span className="fr-search" data-focus-gold>
            <Icon name="search" size={20} tone="text-3" />
            <Input
              id="friend-search"
              value={query}
              onChange={(e) => setQuery(e.target.value.replace(/[^A-Za-z0-9_]/g, "").slice(0, 16))}
              placeholder="Username"
              autoCapitalize="none"
              autoComplete="off"
              spellCheck={false}
              data-friend-search
            />
          </span>
          {results && results.length ? (
            <Panel data-friend-results>
              {results.map((hit) => (
                <Row key={hit.id} icon="44" data-friend-result={hit.id} data-relation={hit.relation}>
                  <button type="button" className="fr-row-open press" onClick={() => onOpen(hit.id)}>
                    <Badge card={hit} />
                    <span className="fr-who-text">
                      <span className="fr-name">{hit.username}</span>
                      <span className="fr-sub" data-tone={hit.relation === "requested" ? "cyan" : undefined}>
                        {hit.relation === "friends"
                          ? "Already friends"
                          : hit.relation === "requested"
                            ? "Request sent"
                            : hit.relation === "incoming"
                              ? "Asked to be your friend"
                              : `Player #${String(hit.playerNumber).padStart(4, "0")}`}
                      </span>
                    </span>
                  </button>
                  {hit.relation === "requested" ? (
                    <Button variant="secondary" size={44} disabled>
                      Requested
                    </Button>
                  ) : hit.relation === "none" || hit.relation === "incoming" ? (
                    <Button variant="secondary" size={44} disabled={busy === hit.id} onClick={() => void add(hit)} data-friend-add={hit.id}>
                      {hit.relation === "incoming" ? "Accept" : "Add"}
                    </Button>
                  ) : null}
                </Row>
              ))}
            </Panel>
          ) : searchNote ? (
            <p className="fr-note">{searchNote}</p>
          ) : null}
        </section>
      )}

      <Panel pad className="fr-invite" data-friend-invite-link>
        <h2 className="fr-invite-title">Your invite</h2>
        <p className="fr-sub">Send your link to friends. When they open it, they’ll ask to add you.</p>
        <p className="fr-link" data-ellipsis>
          {link ?? "…"}
        </p>
        <div className="fr-invite-actions">
          <Button variant="secondary" size={48} onClick={() => void copy()} disabled={!link} data-friend-copy>
            <Icon name="link" size={20} /> Copy link
          </Button>
          <Button variant="secondary" size={48} onClick={() => void share()} disabled={!link} data-friend-share>
            <Icon name="share" size={20} /> Share
          </Button>
        </div>
        {confirmReset ? (
          <div className="fr-reset-confirm">
            <p className="fr-sub">A new link stops the old one working. Requests already sent stay.</p>
            <div className="fr-invite-actions">
              <Button variant="quiet" size={44} onClick={() => setConfirmReset(false)}>
                Keep it
              </Button>
              <Button variant="secondary" size={44} onClick={() => void reset()} data-friend-reset-confirm>
                Make a new link
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="quiet" size={44} onClick={() => setConfirmReset(true)} disabled={!link} data-friend-reset>
            Reset link
          </Button>
        )}
      </Panel>
    </div>
  );
}

/* ================================================================== FR3: a friend's profile */

export function FriendProfileView({ playerId, onBack }: { playerId: string; onBack: () => void }) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<FriendProfile | null>(null);
  const [missing, setMissing] = useState<string | null>(null);
  const [look, setLook] = useState<{ look: CardLook; playerNumber: number } | null>(null);
  const [options, setOptions] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice, tone] = useNotice();

  const load = async () => {
    const answer = await friendsApi.profile(playerId);
    if (answer.ok) {
      setProfile(answer.profile);
      setMissing(null);
    } else setMissing(answer.reason === "not_found" ? "This player isn’t available." : messageOf(answer));
  };
  useEffect(() => {
    void load();
    void (async () => {
      try {
        const backend = await identityBackend();
        const card = await backend?.getPublicCard(playerId);
        if (card) setLook({ look: lookFromLoadout(card.loadout, null), playerNumber: card.playerNumber });
      } catch {
        /* the badge's colour stands in */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId]);

  const act = async (run: () => Promise<{ ok: true } | FriendsRefusal>, done: string) => {
    setBusy(true);
    const answer = await run();
    setBusy(false);
    if (!answer.ok) return setNotice(messageOf(answer), "error");
    setNotice(done);
    await load();
  };

  if (missing)
    return (
      <div className="fr-page" data-friends-screen="profile">
        <Head title="Player" onBack={onBack} />
        <EmptyState layout="card" title="Not found" body={missing} action={{ label: "Back", onClick: onBack }} />
      </div>
    );
  if (!profile)
    return (
      <div className="fr-page" data-friends-screen="profile">
        <Head title="" onBack={onBack} />
        <Skeleton kind="card" />
      </div>
    );

  const card = profile.card;
  const name = card.username;
  const cardLook: CardLook = look?.look ?? lookFromLoadout(null, card.colour);
  const relation = profile.relation;
  const status = profile.status;
  const h2h = profile.headToHead;

  return (
    <div className="fr-page" data-friends-screen="profile" data-relation={relation}>
      <Head
        title={name}
        onBack={onBack}
        right={
          relation !== "self" ? (
            <Button variant="icon" aria-label={`Options for ${name}`} onClick={() => setOptions(true)} data-friend-options>
              <Icon name="more" size={24} tone="text-2" />
            </Button>
          ) : null
        }
      />
      <Notice text={notice} tone={tone} />
      <PlayerCard look={cardLook} name={name} playerNumber={look?.playerNumber ?? card.playerNumber} />
      {status && statusText(status, Date.now()) ? (
        <p className="fr-status" data-tone={status.kind === "playing" ? "red" : isOnline(status) ? "cyan" : undefined} data-friend-profile-status={status.kind}>
          {statusText(status, Date.now())}
        </p>
      ) : null}

      {relation === "friends" ? (
        <div className="fr-actions">
          <Button
            variant="gold"
            size={52}
            block
            onClick={() => void navigate({ to: "/challenge", search: { friend: card.id, friendName: name } as never })}
            data-friend-challenge-start
          >
            Challenge {name}
          </Button>
          {profile.myRoom ? (
            <Button
              variant="secondary"
              size={52}
              block
              disabled={busy}
              onClick={() => void act(() => friendsApi.invite(card.id), `Invite sent to ${name}`)}
              data-friend-invite-room={profile.myRoom.code}
            >
              Invite to room
            </Button>
          ) : null}
        </div>
      ) : relation === "incoming" && profile.requestId ? (
        <div className="fr-actions">
          <Button variant="gold" size={52} block disabled={busy} onClick={() => void act(() => friendsApi.respond(profile.requestId!, true), `You and ${name} are friends`)}>
            Accept
          </Button>
          <Button variant="secondary" size={52} block disabled={busy} onClick={() => void act(() => friendsApi.respond(profile.requestId!, false), "Request declined")}>
            Decline
          </Button>
        </div>
      ) : relation === "none" ? (
        <Button variant="gold" size={52} block disabled={busy} onClick={() => void act(() => friendsApi.request(card.id), `Request sent to ${name}`)} data-friend-profile-add>
          Add friend
        </Button>
      ) : relation === "requested" ? (
        <Button variant="secondary" size={52} block disabled>
          Requested
        </Button>
      ) : relation === "blocked" ? (
        <Button variant="secondary" size={52} block disabled={busy} onClick={() => void act(() => friendsApi.unblock(card.id), `${name} unblocked`)} data-friend-unblock>
          Unblock {name}
        </Button>
      ) : null}

      {relation === "friends" && h2h ? <HeadToHeadPanel name={name} h2h={h2h} /> : null}

      {options ? (
        <FriendOptions
          name={name}
          playerId={card.id}
          isFriend={relation === "friends"}
          onClose={() => setOptions(false)}
          onChanged={(text) => {
            setOptions(false);
            setNotice(text);
            void load();
          }}
        />
      ) : null}
    </div>
  );
}

function HeadToHeadPanel({ name, h2h }: { name: string; h2h: NonNullable<FriendProfile["headToHead"]> }) {
  const best = h2h.best;
  const bestName = best && isLiveType(best.game) ? puzzleName(best.game) : null;
  return (
    <Panel pad className="fr-h2h" data-head-to-head={`${h2h.wins}-${h2h.losses}-${h2h.draws}`}>
      <div className="fr-h2h-head">
        <h2>You v {name}</h2>
        <span className="fr-sub">{h2h.matches === 1 ? "1 match" : `${h2h.matches} matches`}</span>
      </div>
      {h2h.matches === 0 ? (
        <p className="fr-sub" data-head-to-head-empty>
          Play {name} in a room or a challenge and your record shows here.
        </p>
      ) : (
        <>
          <div className="fr-h2h-score">
            <span>
              <strong data-tone="gold">{h2h.wins}</strong>
              <small>You</small>
            </span>
            <span aria-hidden="true">–</span>
            <span>
              <strong>{h2h.losses}</strong>
              <small data-ellipsis>{name}</small>
            </span>
          </div>
          {h2h.draws ? <p className="fr-sub">{h2h.draws === 1 ? "1 draw" : `${h2h.draws} draws`}</p> : null}
          <div className="fr-h2h-last">
            <span className="fr-sub">Last {h2h.last.length}</span>
            <span className="fr-h2h-chips">
              {h2h.last.map((r, i) => (
                <span key={i} className="fr-h2h-chip" data-result={r} aria-label={r === "win" ? "Won" : r === "loss" ? "Lost" : "Drew"}>
                  <Icon name={r === "win" ? "check" : r === "loss" ? "cross" : "collapse"} size={18} />
                </span>
              ))}
            </span>
          </div>
          {best && bestName ? (
            <p className="fr-sub" data-head-to-head-best={best.game}>
              Your best against {name}: <strong>{bestName}</strong>, won {best.wins} of {best.played}
            </p>
          ) : null}
        </>
      )}
    </Panel>
  );
}

/* ================================================================== FR4: options */

export function FriendOptions({
  name,
  playerId,
  isFriend,
  onClose,
  onChanged,
}: {
  name: string;
  playerId: string;
  isFriend: boolean;
  onClose: () => void;
  onChanged: (text: string) => void;
}) {
  const [step, setStep] = useState<"menu" | "remove" | "block" | "report">("menu");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (call: () => Promise<{ ok: true } | FriendsRefusal>, done: string) => {
    setBusy(true);
    const answer = await call();
    setBusy(false);
    if (!answer.ok) return setMessage(messageOf(answer));
    onChanged(done);
  };
  const report = (reason: ReportReason) => {
    setMessage(REPORT_THANKS);
    void friendsApi
      .report(playerId, reason)
      .then((a) => (a.ok ? null : setMessage(messageOf(a))))
      .finally(() => window.setTimeout(onClose, 1500));
  };

  return (
    <Sheet title={`${name}`} onClose={onClose} data={{ "data-friend-options-sheet": "" }}>
      {message ? (
        <p role="status" className="fr-sheet-message" data-friend-options-message>
          {message}
        </p>
      ) : step === "report" ? (
        <ReportReasons onPick={report} />
      ) : step === "remove" ? (
        <div className="fr-confirm">
          <p className="fr-sub">Remove {name} from your friends? They aren’t told.</p>
          <Button variant="secondary" block size={48} disabled={busy} onClick={() => void run(() => friendsApi.remove(playerId), `${name} removed`)} data-friend-remove-confirm>
            Remove friend
          </Button>
          <Button variant="quiet" block size={44} onClick={() => setStep("menu")}>
            Cancel
          </Button>
        </div>
      ) : step === "block" ? (
        <div className="fr-confirm">
          <p className="fr-sub">Block {name}? You stop being friends, and neither of you can add, invite or challenge the other, or see the other’s status. They’re not told.</p>
          <Button variant="secondary" block size={48} disabled={busy} onClick={() => void run(() => friendsApi.block(playerId), `${name} blocked`)} className="fr-danger" data-friend-block-confirm>
            Block {name}
          </Button>
          <Button variant="quiet" block size={44} onClick={() => setStep("menu")}>
            Cancel
          </Button>
        </div>
      ) : (
        <>
          <Panel>
            {isFriend ? (
              <Row as="button" leading={<Icon name="close" size={22} />} title="Remove friend" onClick={() => setStep("remove")} data-friend-remove />
            ) : null}
            <Row as="button" className="fr-danger" leading={<Icon name="lock" size={22} tone="red" />} title={`Block ${name}`} onClick={() => setStep("block")} data-friend-block />
            <Row as="button" className="fr-danger" leading={<Icon name="info" size={22} tone="red" />} title={`Report ${name}`} onClick={() => setStep("report")} data-friend-report />
          </Panel>
          <p className="fr-sub fr-sheet-foot">Blocking hides you from each other and stops challenges and invites. They’re not told.</p>
        </>
      )}
    </Sheet>
  );
}

/* ================================================================== an invite link, opened */

export function InviteLanding({
  owner,
  onSignUp,
  onSignIn,
}: {
  owner: FriendCard | null;
  onSignUp: () => void;
  onSignIn: () => void;
}) {
  return (
    <div className="fr-page" data-friends-screen="invite">
      {owner ? (
        <EmptyState
          layout="page"
          heading={1}
          pose="win"
          title={`${owner.username} wants to be friends`}
          body="Make a free account and we’ll send them your request. You can see when they’re about and play together."
          action={{ label: "Make an account", onClick: onSignUp, data: { "data-invite-sign-up": "" } }}
          secondary={{ label: "I have an account", onClick: onSignIn, data: { "data-invite-sign-in": "" } }}
          data-invite-owner={owner.username}
        />
      ) : (
        <EmptyState
          layout="page"
          heading={1}
          title="This invite link doesn’t work"
          body="It may have been reset. Ask your friend for a new one."
          action={{ label: "Back home", onClick: onSignIn }}
          data-invite-dead=""
        />
      )}
    </div>
  );
}
