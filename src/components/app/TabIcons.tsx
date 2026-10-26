/**
 * The Play tab's own icon tiles (tab pages refresh, 26 Oct 2026; drawn on the design canvas's T-Play):
 * 44 px glossy gradient tiles (`.ap-tile44`, app-pages.css) with inline SVG art, no text but the
 * challenge's "VS". Display only.
 */

/** Daily Puzzle: a calendar of coloured tiles with three faint jigsaw pieces round it, on blue. */
export function DailyPuzzleTile() {
  const piece = "M0 0h2a1.1 1.1 0 1 1 2 0h2v2a1.1 1.1 0 1 1 0 2v2H0z";
  return (
    <span aria-hidden="true" data-tile="puzzle" className="ap-tile44">
      <svg width="36" height="34" viewBox="-3 -2 36 34">
        <path d={piece} fill="#FFFFFF" opacity=".38" transform="translate(-2.4 -0.6) rotate(-18) scale(.85)" />
        <path d={piece} fill="#FFFFFF" opacity=".32" transform="translate(28 13) rotate(14) scale(.8)" />
        <path d={piece} fill="#FFFFFF" opacity=".3" transform="translate(-2.6 23) rotate(8) scale(.75)" />
        <rect x="3.5" y="6" width="23" height="21" rx="4" fill="#F4F7FF" />
        <path d="M3.5 10a4 4 0 0 1 4-4h15a4 4 0 0 1 4 4v2h-23z" fill="#FF6B8A" />
        <rect x="9" y="3" width="2.6" height="6" rx="1.3" fill="#DDE6FF" />
        <rect x="18.4" y="3" width="2.6" height="6" rx="1.3" fill="#DDE6FF" />
        <rect x="7" y="15" width="4.6" height="4.6" rx="1.2" fill="#4D8CFF" />
        <rect x="12.7" y="15" width="4.6" height="4.6" rx="1.2" fill="#B26BFF" />
        <rect x="18.4" y="15" width="4.6" height="4.6" rx="1.2" fill="#4D8CFF" />
        <rect x="7" y="20.7" width="4.6" height="4.6" rx="1.2" fill="#2ED3B7" />
        <rect x="12.7" y="20.7" width="4.6" height="4.6" rx="1.2" fill="#4D8CFF" />
        <rect x="18.4" y="20.7" width="4.6" height="4.6" rx="1.2" fill="#3DDC84" />
        <path d="M19.5 23.1l1.2 1.1 2.1-2.4" fill="none" stroke="#FFFFFF" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

/** Daily Arcade: a black game controller on red. */
export function DailyArcadeTile() {
  return (
    <span aria-hidden="true" data-tile="arcade" className="ap-tile44">
      <svg width="34" height="30" viewBox="0 0 34 30">
        <path
          d="M9 7h16c4.2 0 6.8 3.2 7.6 8.2l1 6.3c.6 3.6-2.6 5.8-5.4 3.6L23.6 21H10.4l-4.6 4.1c-2.8 2.2-6-.1-5.4-3.6l1-6.3C2.2 10.2 4.8 7 9 7z"
          fill="#121218"
        />
        <path
          d="M9 7h16c3 0 5.2 1.7 6.5 4.4C29 9.6 26.6 8.8 25 8.8H9c-1.6 0-4 .8-6.5 2.6C3.8 8.7 6 7 9 7z"
          fill="#FFFFFF"
          opacity=".22"
        />
        <rect x="7.6" y="11.2" width="2.6" height="8" rx=".8" fill="#E6E6EE" />
        <rect x="4.9" y="13.9" width="8" height="2.6" rx=".8" fill="#E6E6EE" />
        <circle cx="24.6" cy="12.4" r="1.7" fill="#FFD23F" />
        <circle cx="27.9" cy="15.4" r="1.7" fill="#FF4D4D" />
        <circle cx="21.3" cy="15.4" r="1.7" fill="#4D8CFF" />
        <circle cx="24.6" cy="18.4" r="1.7" fill="#3DDC84" />
        <rect x="14.6" y="12.6" width="2.2" height="1.2" rx=".6" fill="#55555F" />
        <rect x="17.2" y="12.6" width="2.2" height="1.2" rx=".6" fill="#55555F" />
      </svg>
    </span>
  );
}

/** Challenge a friend: green and pink player badges with a soft glow, a yellow bolt and "VS", on violet. */
export function ChallengeTile() {
  return (
    <span aria-hidden="true" data-tile="challenge" className="ap-tile44">
      <svg width="32" height="30" viewBox="0 0 32 30">
        <circle cx="9.5" cy="11" r="6.6" fill="#39F08A" opacity=".35" />
        <circle cx="22.5" cy="11" r="6.6" fill="#FF4FD8" opacity=".35" />
        <circle cx="9.5" cy="11" r="5" fill="#39F08A" stroke="#FFFFFF" strokeWidth="1.4" />
        <circle cx="22.5" cy="11" r="5" fill="#FF4FD8" stroke="#FFFFFF" strokeWidth="1.4" />
        <circle cx="8.1" cy="9.5" r="1.5" fill="#FFFFFF" opacity=".55" />
        <circle cx="21.1" cy="9.5" r="1.5" fill="#FFFFFF" opacity=".55" />
        <path d="M17.4 4.5 13.6 13h3.3l-1.9 8.5 5.6-10.2h-3.4l2-6.8z" fill="#FFD23F" stroke="#3A1680" strokeWidth=".8" strokeLinejoin="round" />
        <text
          x="16"
          y="28.2"
          textAnchor="middle"
          fontFamily="Archivo, sans-serif"
          fontWeight="900"
          fontSize="8.5"
          letterSpacing=".06em"
          fill="#FFFFFF"
        >
          VS
        </text>
      </svg>
    </span>
  );
}

/**
 * A finishing place on the tab pages: a medal disc for 1st to 3rd (gold, silver, bronze), an outlined
 * number otherwise. Named for screen readers ("2nd place").
 */
export function PlaceDisc({ place, label }: { place: number; label: string }) {
  return (
    <span role="img" aria-label={label} data-place-disc={place <= 3 ? place : "n"} className="ap-place">
      <span aria-hidden="true">{place}</span>
    </span>
  );
}
