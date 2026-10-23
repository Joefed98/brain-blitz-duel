import { LogoMark } from "./LogoMark";

/**
 * The tab screens' wordmark (Prompt R, 23 Oct 2026): the name in Archivo 900, every letter white but
 * the last, which is shiny gold, then the gold logo mark (polish-layout/app-pages.css).
 *
 * TODO: use APP_NAME (src/lib/brand.ts) once the rename to Joulz lands (Prompt N); until then the
 * new name is spelled here so the header shows it, and every other screen keeps APP_NAME.
 */
const WORDMARK_NAME = "JOULZ";

export function AppWordmark() {
  const name = WORDMARK_NAME.toUpperCase();
  return (
    <span data-app-wordmark className="ap-wordmark" aria-label={name} role="img">
      <span aria-hidden="true" className="ap-wordmark-text">
        {name.slice(0, -1)}
        <span className="ap-wordmark-last">{name.slice(-1)}</span>
      </span>
      <LogoMark width={17} height={22} className="ap-wordmark-mark" />
    </span>
  );
}
