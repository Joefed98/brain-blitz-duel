/**
 * shareResult(): the one way the app shares a result (rooms' final screens today; the daily
 * challenge and friend challenges later). Presentation only: it never reads or writes a game.
 *
 * It opens the phone's share sheet (navigator.share) with the text, the link inside the text, and
 * the image card attached where the phone can share files (navigator.canShare({ files })). Where
 * there's no share sheet (most desktop browsers, older Android WebViews) it copies the text and
 * link to the clipboard instead, and the caller shows "Copied".
 *
 * iOS only opens the share sheet straight from a tap, so the image must be ready before the tap
 * (the caller makes it when the screen opens); a share started while it's still drawing goes
 * without it rather than wait.
 */

export interface ShareResultInput {
  /** The share sheet's title (some targets show it; most use the text). */
  title: string;
  /** The message, one string per line, without the link. */
  lines: readonly string[];
  /** The link; added after the lines as "Play: <link>". */
  link: string;
  /** The results card (a PNG), attached where files can be shared. */
  image?: File | null;
  /** What goes before the link ("Play: " when absent; the daily's text has none: ""). */
  linkPrefix?: string;
}

/**
 * How the share went: "shared" (the sheet was used), "cancelled" (the player closed it),
 * "copied" (no sheet, the text and link are on the clipboard) or "failed" (neither worked).
 */
export type ShareOutcome = "shared" | "cancelled" | "copied" | "failed";

/** The text a share sends: the lines, then "Play: <link>" (or the link after `prefix`). */
export function shareText(lines: readonly string[], link: string, prefix = "Play: "): string {
  const body = lines
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
  return body ? `${body} ${prefix}${link}` : `${prefix}${link}`;
}

type ShareNavigator = Pick<Navigator, "clipboard"> & {
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data: ShareData) => boolean;
};

/** Which route a share will take on this phone: the share sheet, or the clipboard. */
export function shareMethod(
  nav: ShareNavigator | undefined = currentNavigator(),
): "native" | "copy" {
  return typeof nav?.share === "function" ? "native" : "copy";
}

function currentNavigator(): ShareNavigator | undefined {
  return typeof navigator === "undefined" ? undefined : (navigator as ShareNavigator);
}

function canShareFiles(nav: ShareNavigator, file: File): boolean {
  try {
    return typeof nav.canShare === "function" && nav.canShare({ files: [file] });
  } catch {
    return false;
  }
}

/** Copies text, through the async clipboard when allowed, else a hidden textarea's copy command. */
export async function copyText(
  text: string,
  nav: ShareNavigator | undefined = currentNavigator(),
): Promise<boolean> {
  try {
    if (nav?.clipboard?.writeText) {
      await nav.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the old way (iOS refuses the async clipboard outside a tap) */
  }
  try {
    if (typeof document === "undefined") return false;
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = typeof document.execCommand === "function" && document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

export async function shareResult(
  input: ShareResultInput,
  nav: ShareNavigator | undefined = currentNavigator(),
): Promise<ShareOutcome> {
  const text = shareText(input.lines, input.link, input.linkPrefix);
  if (nav && typeof nav.share === "function") {
    // The link rides in the text, never also as `url`, so targets that append the url don't show it twice.
    const data: ShareData = { title: input.title, text };
    if (input.image && canShareFiles(nav, input.image)) data.files = [input.image];
    try {
      await nav.share(data);
      return "shared";
    } catch (err) {
      if ((err as { name?: string } | null)?.name === "AbortError") return "cancelled";
      // Refused (no tap left, a file it won't take): copy instead, so the tap still does something.
    }
  }
  return (await copyText(text, nav)) ? "copied" : "failed";
}
