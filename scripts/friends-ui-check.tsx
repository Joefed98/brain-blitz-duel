/**
 * friends-ui-check (wave 2 B1; happy-dom, a few seconds): the Friends screens against a stand-in for the server
 * functions (setFriendsFunctionsForChecks). The rules themselves are friends-check's (PostgreSQL).
 *
 *  1. Guests can't reach Friends: Profile's Friends opens the save-your-progress sheet and goes nowhere.
 *  2. An account's Friends button carries the waiting requests' badge.
 *  3. The list (FR1): Requests with Accept / Decline (Accept answers the request), Online and Offline from each
 *     friend's status ("In room BLTZ, 3 of 16" with Join, "Playing Practice", "In a game", last seen), a hidden
 *     friend shows no status line, three offline then "Show all", "Show when I'm online" as a switch that sends the
 *     setting, room invites with Join and challenges with Play.
 *  4. Add a friend (FR2): an under-18 sees no search, only the invite link; an adult's search shows each player's
 *     standing ("Already friends", "Request sent", Add); Add sends the request; no QR code anywhere.
 *  5. A friend's profile (FR3, FR4): Challenge and, only in a lobby, Invite to room; the head-to-head; the options
 *     sheet's Remove friend, Block and Report (wave 1's reasons), and Block's confirm sends the block.
 *  6. An invite link opened by a guest says whose it is and offers an account.
 *
 *   bun scripts/friends-ui-check.tsx
 */

const failures: string[] = [];
let checks = 0;
const check = (ok: boolean, message: string) => {
  checks++;
  if (!ok) {
    failures.push(message);
    console.log(`FAIL ${message}`);
  }
};

const { Window } = await import("happy-dom");
const win = new Window({ url: "https://joulz.uk/", width: 390, height: 844 });
for (const key of ["window", "document", "navigator", "HTMLElement", "Element", "Node", "Event", "KeyboardEvent", "PointerEvent", "MouseEvent", "HTMLButtonElement", "HTMLAnchorElement", "HTMLInputElement", "SVGElement", "getComputedStyle", "matchMedia", "requestAnimationFrame", "cancelAnimationFrame", "localStorage", "sessionStorage", "MutationObserver", "CustomEvent", "location", "history", "scrollTo", "DOMParser", "InputEvent"] as const) {
  const value = (win as unknown as Record<string, unknown>)[key];
  const bind = typeof value === "function" && !/^[A-Z]/.test(key);
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: bind ? (value as (...a: unknown[]) => unknown).bind(win) : value });
}
Object.defineProperty(win.navigator, "webdriver", { configurable: true, value: true });
(globalThis as { ResizeObserver?: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
(win as unknown as { ResizeObserver: unknown }).ResizeObserver = (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const origError = console.error;
console.error = () => {};
console.warn = () => {};

const React = await import("react");
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider } = await import("@tanstack/react-router");
const { setAccount } = await import("../src/lib/account/accountApi");
const { setFriendsFunctionsForChecks } = await import("../src/lib/friends/friendsApi");
const { setIdentityBackend } = await import("../src/lib/identity/backend");
const { ProfileCard } = await import("../src/components/identity/ProfileCard");
const screens = await import("../src/components/friends/FriendsScreens");

setIdentityBackend(null);

const $ = (sel: string) => document.querySelector(sel) as unknown as HTMLElement | null;
const $$ = (sel: string) => [...document.querySelectorAll(sel)] as unknown as HTMLElement[];
const click = async (el: HTMLElement | null) => act(async () => void el?.click());
const settle = async (ms = 30) => act(async () => void (await new Promise((r) => setTimeout(r, ms))));
const text = () => document.body.textContent ?? "";

/* ------------------------------------------------------------------ the stand-in */
const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const card = (n: number, username: string, colour = n % 32) => ({ id: uid(n), username, colour, playerNumber: n, founding: false });
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const calls: { fn: string; data: unknown }[] = [];
let overview = {
  friends: [
    { ...card(1, "Priya"), since: ago(1e9), status: { kind: "room", code: "BLTZ", players: 3, maxPlayers: 16 } },
    { ...card(2, "Sam"), since: ago(1e9), status: { kind: "playing", code: "QQQQ" } },
    { ...card(3, "Ali"), since: ago(1e9), status: { kind: "practice" } },
    { ...card(4, "Jo"), since: ago(1e9), status: { kind: "offline", lastSeen: ago(2 * 3600_000) } },
    { ...card(5, "Mia"), since: ago(1e9), status: { kind: "offline", lastSeen: ago(30 * 3600_000) } },
    { ...card(6, "Raj"), since: ago(1e9), status: { kind: "offline", lastSeen: ago(3 * 86_400_000) } },
    { ...card(7, "Zed"), since: ago(1e9), status: { kind: "hidden" } },
  ],
  incoming: [{ ...card(8, "Kai"), requestId: uid(80), via: "link", at: ago(60_000) }],
  outgoing: [],
  invites: [{ ...card(1, "Priya"), code: "BLTZ", at: ago(60_000) }],
  challenges: [{ ...card(2, "Sam"), code: "ABCDEF", at: ago(60_000), expiresAt: ago(-86_400_000) }],
  blocked: [],
  count: 7,
  cap: 200,
  showOnline: true,
  showOnlineSetting: null,
  adult: true,
};
const profile = (relation: string, myRoom: { code: string } | null) => ({
  card: card(2, "Sam"),
  relation,
  requestId: null,
  status: { kind: "online" },
  headToHead: { matches: 12, wins: 7, losses: 5, draws: 0, last: ["win", "win", "loss", "win", "loss"], best: { game: "wordsearch", wins: 4, played: 4 } },
  myRoom,
});
let currentProfile = profile("friends", { code: "MINE" });
const fn = (name: string, answer: (data: unknown) => unknown) => async (opts?: { data?: unknown }) => {
  calls.push({ fn: name, data: opts?.data });
  return answer(opts?.data);
};
setFriendsFunctionsForChecks({
  friendsOverviewFn: fn("overview", () => ({ ok: true, overview })),
  friendsWaitingFn: fn("waiting", () => 2),
  friendProfileFn: fn("profile", () => ({ ok: true, profile: currentProfile })),
  friendSearchFn: fn("search", () => ({
    ok: true,
    results: [
      { ...card(1, "Priya"), relation: "friends" },
      { ...card(9, "Priya_K"), relation: "requested" },
      { ...card(10, "Priya_X"), relation: "none" },
    ],
  })),
  friendRequestFn: fn("request", () => ({ ok: true, outcome: "sent" })),
  friendRespondFn: fn("respond", () => ({ ok: true, outcome: "accepted" })),
  friendRemoveFn: fn("remove", () => ({ ok: true, removed: true })),
  friendBlockFn: fn("block", () => ({ ok: true, removed: true })),
  friendUnblockFn: fn("unblock", () => ({ ok: true, unblocked: true })),
  friendReportFn: fn("report", () => ({ ok: true, message: "Thanks." })),
  friendInviteFn: fn("invite", () => ({ ok: true, code: "MINE" })),
  friendLinkFn: fn("link", () => ({ ok: true, token: "abcdefghjkmn", link: "https://joulz.uk/friends?invite=abcdefghjkmn" })),
  friendShowOnlineFn: fn("showOnline", (d) => ({ ok: true, showOnline: (d as { show: boolean }).show })),
} as never);

/* ------------------------------------------------------------------ mounting */
async function mount(ui: () => React.ReactElement, path = "/friends") {
  document.body.innerHTML = "";
  const host = document.createElement("div");
  document.body.appendChild(host);
  const rootRoute = createRootRoute({ component: () => React.createElement(Outlet) });
  const paths = new Set([path, "/", "/profile", "/friends", "/account", "/challenge", "/duel/$code"]);
  const routes = [...paths].map((p) =>
    createRoute({ getParentRoute: () => rootRoute, path: p, component: p === path ? ui : () => React.createElement("p", { "data-at": p }, p) }),
  );
  const router = createRouter({ routeTree: rootRoute.addChildren(routes), history: createMemoryHistory({ initialEntries: [path] }) });
  (router as unknown as { _rendered?: unknown[] })._rendered ??= [];
  await router.load();
  const went: { to: string; search?: Record<string, unknown>; params?: Record<string, unknown> }[] = [];
  (router as unknown as { navigate: (o: unknown) => Promise<void> }).navigate = async (o: unknown) => {
    went.push(o as { to: string });
  };
  const root = createRoot(host as unknown as Element);
  await act(async () => root.render(React.createElement(RouterProvider, { router } as never)));
  await settle(60);
  return { root, went };
}

const ACCOUNT = {
  kind: "account",
  userId: uid(100),
  username: "Me_Here",
  colour: 4,
  playerNumber: 100,
  founding: false,
  country: null,
  createdAt: ago(0),
  status: "active",
  isUnder18: false,
  deletion: null,
  rename: { free: true },
} as const;

/* ------------------------------------------------------------------ 1. guests */
{
  const mod = await import("../src/lib/account/accountApi");
  await act(async () => void (await mod.refreshAccount()));
  const { root, went } = await mount(() => React.createElement(ProfileCard, { guestName: "Sam", guestColour: 3 }), "/profile");
  check(!!$("[data-friends-open]"), "Profile has a Friends button");
  check(!$("[data-friends-waiting]") && !calls.some((c) => c.fn === "waiting"), "a guest's Friends has no badge and asks nothing");
  await click($("[data-friends-open]"));
  await settle();
  check(!!$("[data-save-progress='sheet']"), "a guest's Friends opens the save-your-progress sheet");
  check(!went.some((w) => w.to === "/friends"), "a guest's Friends goes nowhere");
  root.unmount();
}

/* ------------------------------------------------------------------ 2. the badge */
{
  setAccount(ACCOUNT as never, null);
  const { root, went } = await mount(() => React.createElement(ProfileCard, { guestName: "Me", guestColour: 4 }), "/profile");
  await settle(60);
  check($("[data-friends-waiting]")?.textContent === "2", `an account's Friends shows the waiting requests (${$("[data-friends-waiting]")?.textContent})`);
  await click($("[data-friends-open]"));
  check(went.some((w) => w.to === "/friends"), "an account's Friends opens the list");
  root.unmount();
}

/* ------------------------------------------------------------------ 3. the list */
{
  const opened: string[] = [];
  let added = 0;
  const { root, went } = await mount(() =>
    React.createElement(screens.FriendsList, { onBack: () => {}, onAdd: () => void added++, onOpen: (id: string) => void opened.push(id) }),
  );
  await settle(60);
  check(!!$("[data-friends-screen='list']"), "the list draws");
  check(!!$("[data-friend-request]") && text().includes("Kai") && text().includes("Used your invite link"), "Requests show the sender and how");
  const online = $("[data-friends-section='online']");
  const offline = $("[data-friends-section='offline']");
  check(!!online && ["Priya", "Sam", "Ali"].every((n) => online.textContent?.includes(n)), "Online holds the friends who are about");
  check(online?.textContent?.includes("In room BLTZ, 3 of 16") === true, "a friend in a lobby: its code and seats");
  check(!!$("[data-friend-join='BLTZ']"), "a friend in a lobby has Join");
  check(online?.textContent?.includes("In a game") === true && online?.textContent?.includes("Playing Practice") === true, "in a game, playing Practice");
  check(!!offline && offline.textContent?.includes("2 h ago") === true, "offline: last seen");
  const zed = $(`[data-friend='${uid(7)}']`);
  check(!zed || zed.querySelector(".fr-sub") === null, "a hidden friend shows no status line");
  check($$("[data-friends-section='offline'] [data-friend]").length === 3 && !!$("[data-friends-show-all]"), "three offline friends, then Show all");
  await click($("[data-friends-show-all]"));
  check($$("[data-friends-section='offline'] [data-friend]").length === 4, "Show all shows every offline friend");
  check(!!$("[data-friend-invite='BLTZ']") && !!$("[data-friend-challenge='ABCDEF']"), "room invites and challenges from friends show");
  await click($("[data-friend-join='BLTZ']"));
  check(went.some((w) => w.to === "/duel/$code" && w.params?.["code"] === "BLTZ"), "Join opens the friend's room");
  const sw = $("[data-friends-show-online]");
  check(sw?.getAttribute("role") === "switch" && sw.getAttribute("aria-checked") === "true", "Show when I'm online: a switch, on");
  await click(sw);
  await settle();
  check(calls.some((c) => c.fn === "showOnline" && (c.data as { show: boolean }).show === false), "turning it off sends the setting");
  await click($("[data-friend-accept]"));
  await settle();
  check(calls.some((c) => c.fn === "respond" && (c.data as { accept: boolean; requestId: string }).accept === true && (c.data as { requestId: string }).requestId === uid(80)), "Accept answers the request");
  await click($("[data-friend-decline]"));
  await settle();
  check(calls.some((c) => c.fn === "respond" && (c.data as { accept: boolean }).accept === false), "Decline answers the request");
  await click($("[data-friends-add]"));
  check(added === 1, "the add icon opens Add a friend");
  root.unmount();

  overview = { ...overview, friends: [], incoming: [], invites: [], challenges: [] };
  const empty = await mount(() => React.createElement(screens.FriendsList, { onBack: () => {}, onAdd: () => {}, onOpen: () => {} }));
  await settle(60);
  check(!!$("[data-friends-empty]"), "no friends: the empty state with Add a friend");
  empty.root.unmount();
}

/* ------------------------------------------------------------------ 4. add a friend */
{
  const teen = await mount(() => React.createElement(screens.AddFriend, { onBack: () => {}, onOpen: () => {}, adult: false }));
  await settle(60);
  check(!$("[data-friend-search]") && !!$("[data-friends-search-off]"), "an under-18 sees no search");
  check(!!$("[data-friend-invite-link]") && text().includes("https://joulz.uk/friends?invite=abcdefghjkmn"), "an under-18 has their invite link");
  check(!!$("[data-friend-copy]") && !!$("[data-friend-share]") && !!$("[data-friend-reset]"), "Copy link, Share and Reset link");
  check(!/scan|QR/i.test(text()), "no QR codes");
  teen.root.unmount();

  calls.length = 0;
  const adult = await mount(() => React.createElement(screens.AddFriend, { onBack: () => {}, onOpen: () => {}, adult: true }));
  await settle(60);
  const input = $("[data-friend-search]") as unknown as HTMLInputElement;
  check(!!input, "an adult can search");
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value")!.set!;
    setter.call(input, "priya");
    input.dispatchEvent(new (window as unknown as { Event: typeof Event }).Event("input", { bubbles: true }));
  });
  await settle(400);
  check(calls.some((c) => c.fn === "search" && (c.data as { query: string }).query === "priya"), "typing searches");
  const rows = $$("[data-friend-result]");
  check(rows.length === 3 && text().includes("Already friends") && text().includes("Request sent"), "results say how you stand");
  await click($(`[data-friend-add='${uid(10)}']`));
  await settle();
  check(calls.some((c) => c.fn === "request" && (c.data as { playerId: string }).playerId === uid(10)), "Add sends the request");
  check($(`[data-friend-result='${uid(10)}']`)?.getAttribute("data-relation") === "requested", "then it reads Requested");
  adult.root.unmount();
}

/* ------------------------------------------------------------------ 5. a friend's profile */
{
  calls.length = 0;
  const { root, went } = await mount(() => React.createElement(screens.FriendProfileView, { playerId: uid(2), onBack: () => {} }));
  await settle(80);
  check(!!$("[data-friend-challenge-start]") && text().includes("Challenge Sam"), "Challenge Sam");
  check(!!$("[data-friend-invite-room='MINE']"), "Invite to room in a lobby");
  check($("[data-head-to-head]")?.getAttribute("data-head-to-head") === "7-5-0" && text().includes("12 matches"), "the head-to-head");
  check(!!$("[data-head-to-head-best='wordsearch']") && text().includes("won 4 of 4"), "the best game against them");
  await click($("[data-friend-invite-room='MINE']"));
  await settle();
  check(calls.some((c) => c.fn === "invite" && (c.data as { playerId: string }).playerId === uid(2)), "Invite to room sends the invite");
  await click($("[data-friend-challenge-start]"));
  check(went.some((w) => w.to === "/challenge" && w.search?.["friend"] === uid(2)), "Challenge opens the friend challenge flow for them");
  await click($("[data-friend-options]"));
  await settle(60);
  check(!!$("[data-friend-remove]") && !!$("[data-friend-block]") && !!$("[data-friend-report]"), "options: remove, block, report");
  check(text().includes("They’re not told."), "options: blocking's line");
  await click($("[data-friend-report]"));
  await settle();
  check($$("[data-report-reason]").length === 3, "report: wave 1's three reasons");
  root.unmount();

  const again = await mount(() => React.createElement(screens.FriendProfileView, { playerId: uid(2), onBack: () => {} }));
  await settle(80);
  await click($("[data-friend-options]"));
  await settle(60);
  await click($("[data-friend-block]"));
  await settle();
  await click($("[data-friend-block-confirm]"));
  await settle();
  check(calls.some((c) => c.fn === "block" && (c.data as { playerId: string }).playerId === uid(2)), "Block's confirm sends the block");
  again.root.unmount();

  currentProfile = profile("friends", null);
  const noRoom = await mount(() => React.createElement(screens.FriendProfileView, { playerId: uid(2), onBack: () => {} }));
  await settle(80);
  check(!$("[data-friend-invite-room]"), "no Invite to room outside a lobby");
  noRoom.root.unmount();
}

/* ------------------------------------------------------------------ 6. an invite link, as a guest */
{
  let signUp = 0;
  const { root } = await mount(() =>
    React.createElement(screens.InviteLanding, { owner: card(5, "Kai"), onSignUp: () => void signUp++, onSignIn: () => {} }),
  );
  check(text().includes("Kai wants to be friends"), "a guest sees whose link it is");
  await click($("[data-invite-sign-up]"));
  check(signUp === 1, "and is offered an account first");
  root.unmount();
}

/* ------------------------------------------------------------------ 7. cards (Joe's phone check, 11 Nov 2026) */
{
  const lookOf = (frame: string, avatar: string, colour: number, badges: string[] = []) => ({
    cardArt: "card-art.bolt-stripes",
    frame,
    nameColour: null,
    avatar: { id: avatar, colour, gem: null },
    title: "rookie",
    badges,
  });
  overview = {
    ...overview,
    friends: [
      { ...card(1, "Priya"), look: lookOf("frame.gold", "pinball", 7), since: ago(1e9), status: { kind: "online" } },
      { ...card(4, "Jo"), since: ago(1e9), status: { kind: "offline", lastSeen: ago(2 * 3600_000) } },
    ],
    incoming: [{ ...card(8, "Kai"), look: lookOf("frame.silver", "hover", 3), requestId: uid(80), via: "link", at: ago(60_000) }],
    blocked: [{ id: uid(11), username: "Nope" }],
  } as never;
  calls.length = 0;
  const list = await mount(() => React.createElement(screens.FriendsList, { onBack: () => {}, onOpen: () => {}, onAdd: () => {} }));
  await settle(60);
  const priya = $(`[data-friend='${uid(1)}'] [data-mini-card]`);
  check(
    priya?.getAttribute("data-frame") === "frame.gold" && priya.getAttribute("data-avatar") === "pinball" && priya.getAttribute("data-avatar-colour") === "7" && priya.getAttribute("data-card-art") === "card-art.bolt-stripes",
    "a friend's row draws their mini card: frame, card art, avatar and colour",
  );
  check(!!priya?.querySelector(".pcard-mini-av svg") && !!priya.querySelector(".pcard-svg svg"), "the mini card draws the avatar over the card's ends");
  check($(`[data-friend-request] [data-mini-card]`)?.getAttribute("data-frame") === "frame.silver", "a request's row draws the sender's mini card");
  check(!$(`[data-friend='${uid(4)}'] [data-mini-card]`) && !!$(`[data-friend='${uid(4)}'] .fr-badge`), "a friend whose card couldn't be read keeps their colour and initial");
  check(calls.filter((c) => c.fn === "overview").length === 1 && !calls.some((c) => c.fn === "profile"), "the list asks once (the cards come with it), never once a friend");
  check(!$("[data-friends-section='blocked'] [data-mini-card]") && !$("[data-friends-section='blocked'] [data-player-card]"), "blocked players show no card");
  const settingRow = $("[data-friends-show-online]");
  check(settingRow?.classList.contains("fr-setting-row") === true && settingRow.textContent?.includes("which room you’re in.") === true, "Show when I'm online: the wrapping row, the whole description");
  list.root.unmount();

  currentProfile = { ...profile("friends", null), card: { ...card(2, "Sam"), look: lookOf("frame.gold", "apex", 12, ["friendly"]) } } as never;
  const prof = await mount(() => React.createElement(screens.FriendProfileView, { playerId: uid(2), onBack: () => {} }));
  await settle(80);
  const pc = $("[data-player-card]");
  check(
    pc?.getAttribute("data-frame") === "frame.gold" && pc.getAttribute("data-card-art") === "card-art.bolt-stripes" && pc.getAttribute("data-avatar") === "apex",
    "a friend's profile draws their full card (frame, card art, avatar)",
  );
  check(pc?.querySelector("[data-card-title]")?.textContent === "Rookie" && pc.querySelector("[data-card-badge='friendly']") !== null, "with their title and badges");
  check(pc?.querySelector("[data-card-pill]")?.textContent === "#0002", "and their player number");
  prof.root.unmount();

  currentProfile = { ...profile("blocked", null), status: null, headToHead: null } as never;
  const blocked = await mount(() => React.createElement(screens.FriendProfileView, { playerId: uid(2), onBack: () => {} }));
  await settle(80);
  check(!$("[data-player-card]") && !$("[data-mini-card]"), "a blocked player's profile shows no card");
  blocked.root.unmount();

  const owner = await mount(() =>
    React.createElement(screens.InviteLanding, { owner: { ...card(5, "Kai"), look: lookOf("frame.bronze", "hover", 5) } as never, onSignUp: () => {}, onSignIn: () => {} }),
  );
  check($("[data-player-card]")?.getAttribute("data-frame") === "frame.bronze", "an invite link shows its owner's card");
  owner.root.unmount();

  // getPublicCard's answer (A1's flat shape) read into a loadout: why the profile drew the default card before.
  const { normalisePublicCard } = await import("../src/lib/identity/backend");
  const read = normalisePublicCard({
    playerId: uid(2), account: true, username: "Sam", playerNumber: 2, founding: false, avatarId: "apex",
    avatar: { accent: null, feature: null, accessory: null, background: null }, colour: 12, gem: null,
    cardArt: "card-art.grid", frame: "frame.gold", nameColour: null,
  });
  check(
    read?.loadout.slots["frame"] === "frame.gold" && read.loadout.slots["card-art"] === "card-art.grid" && read.loadout.avatar?.id === "apex" && read.loadout.avatar.colour === 12 && read.playerNumber === 2,
    "getPublicCard's answer is read into the card's loadout",
  );
  check(normalisePublicCard({ playerId: uid(3), account: false, username: null }) === null, "a guest's default card reads as no card");
}

console.error = origError;
console.log(`friends-ui-check: ${checks - failures.length} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS");
process.exit(0);
