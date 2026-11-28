# PR A (S5, the rendered avatars): the check lines it needs

A proposal for Joe, never merged. Nothing under `scripts/` changes until Joe approves these exact lines. Each was
proved on a throwaway copy of its check against branch `claude/identity-art-avatars` with all 32 avatars published
(the copies deleted afterwards); the checks themselves are untouched.

Three checks need lines changed. Each fails today only because the avatars are now Blender renders, and each change
keeps what the check proves about its own subject.

The two other failures seen earlier were fixed in the app, not the checks:

- **Lightning Core.** It is a Legendary and must animate. It keeps its approved animated outer art over the render,
  so cosmetics-art-check's "the outer art" and cosmetics-motion-check's "the animated items move" pass unchanged.
- **An unknown finish.** It now draws the avatar as nothing equipped.

## 1. `scripts/offline-media-refresh-check.ts`, line 170

**Why it fails:** the line pins the offline worker's lazy list to the sounds alone. The 704 identity files in
`public/identity/` are now lazy too (kept only once shown, never in the install download), by design.

Replace:

```ts
check(realConfig.lazyMedia.length === lazyReal.length, "nothing else is lazy");
```

with:

```ts
// Changed with Joe's approval, <date> (S5 PR A): the rendered identity art is kept lazily too, only once shown.
const lazyIdentity = realConfig.lazyMedia.filter((p) => p.startsWith("/identity/"));
check(realConfig.lazyMedia.length === lazyReal.length + lazyIdentity.length, "nothing else is lazy but the identity art");
check(
  lazyIdentity.length > 0 && lazyIdentity.every((p) => !realConfig.media.includes(p) && typeof realConfig.mediaHash[p] === "string"),
  `the identity art (${lazyIdentity.length} files) is lazy with a hash, none of it in the install download`,
);
```

**Result on the copy:** exit 0, no failures.

## 2. `scripts/cosmetics-art-check.ts`, section 4 (lines 111–123)

**Why it fails:** the section asserts that, with nothing equipped, every avatar is exactly the old flat drawing. A
rendered avatar now draws its tinted render: the base, the player's colour multiplied inside the mask, and the gloss
on top. It fails 256 of 256.

The new lines keep the section's point:

- nothing equipped draws the avatar's own art in the player's colour;
- an unknown item draws exactly the same as nothing;
- an avatar without renders still draws exactly the flat drawing.

Add one import (with the other imports):

```ts
import { AVATAR_ART } from "../src/design/identity/avatarArt.data";
```

Replace lines 111–123 (from `/* 4. nothing equipped: exactly as before */` to the `check(same === 32 * 4 * 2, …)`
line):

```ts
/* 4. nothing equipped: the avatar's own art (S5: its render where it has one), the same with an unknown item */
// Changed with Joe's approval, <date> (S5 PR A): a rendered avatar draws its tinted render, not the flat drawing.
let same = 0;
for (const a of av.AVATARS) {
  for (const colour of [-1, 0, 7, 31]) {
    const look = { id: a.id, colour, gem: null };
    const [m0, m1, m2] = av.avatarStops(look);
    const before = a.svg.replaceAll("{{p}}", "x-").replace("{{m0}}", m0).replace("{{m1}}", m1).replace("{{m2}}", m2);
    const plain = av.avatarMarkup(look, "x-");
    const own = AVATAR_ART[a.id]
      ? plain.includes(`data-avatar-layers="${a.id}"`) && plain.includes(`/identity/avatars/${a.id}/tint-base.webp`) && plain.includes(`fill="${m1}"`)
      : plain === before;
    if (own && av.avatarMarkup({ ...look, finish: null, accessory: null, special: null }, "x-") === plain) same++;
    if (av.avatarMarkup({ ...look, finish: "avatar-finish.nope" }, "x-") === plain) same++;
  }
}
check(same === 32 * 4 * 2, `with nothing equipped (or an unknown item) every avatar draws its own art, tinted (${same} of ${32 * 4 * 2})`);
```

**Result on the copy:** 575 passed, 0 failed (574 + 1 before).

## 3. `scripts/identity-motion-check.tsx`, after line 115 (`const inPill = …`) and its use in `meanAt`

**Why it fails:** the check proves each card art, frame and name colour against its approved still. It compares the
whole card, the sample's Apex avatar included, and the stills were drawn with the flat Apex. With the rendered Apex,
four come out just over the limit of 10:

| Item | Mean difference |
| --- | --- |
| `card-art.tier.top-500` | 10.4 |
| `card-art.sunset` | 10.7 |
| `card-art.neon-skyline` | 10.9 |
| `frame.diamond` | 10.0 |

The avatar is proved by its own checks, so this leaves out the avatar's box, measured from the page, as the check
already leaves out the pill. The limit (`MAX_MEAN_DIFF` 10) is unchanged.

After:

```ts
    const inPill = (x: number, y: number) => x >= 160 && x < 400 && y >= 88 && y < 200;
```

add:

```ts
    // Changed with Joe's approval, <date> (S5 PR A): the sample's avatar (now a Blender render, proved by its own
    // checks) is left out, measured from the page, as the pill is.
    const av = await page.locator("[data-player-card] [data-avatar-layers]").first().boundingBox();
    const inAvatar = (x: number, y: number) =>
      !!av && x >= (av.x - box.x) * 2 - 2 && x < (av.x - box.x + av.width) * 2 + 2 && y >= (av.y - box.y) * 2 - 2 && y < (av.y - box.y + av.height) * 2 + 2;
```

and in `meanAt` replace:

```ts
          if (inPill(x, y)) continue;
```

with:

```ts
          if (inPill(x, y) || inAvatar(x, y)) continue;
```

**Result on the copy:** exit 0, PASS. The worst item is now 8.7 (it was 10.9).

## Still running

theme-check (48 parts) and no-wrap-check (63 parts) are running on the full set. If either needs a line, it is
added here before PR A opens.
