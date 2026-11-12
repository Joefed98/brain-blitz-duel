import { emoteOf, ensureCosmeticStyles } from "@/design/identity/cosmetics";

/* One { __html } per emote (CLAUDE.md working rule 6), its ids prefixed once. */
const EMOTE_HTML = new Map<string, { __html: string }>();
function emoteHtml(code: string): { __html: string } | null {
  const hit = EMOTE_HTML.get(code);
  if (hit) return hit;
  const emote = emoteOf(code);
  if (!emote) return null;
  const html = { __html: emote.svg.replaceAll("{{p}}", `em${EMOTE_HTML.size}-`) };
  EMOTE_HTML.set(code, html);
  return html;
}

/** A reaction pack's emote (wave 2 E2), drawn from its approved art, at `height` px. */
export function Emote({ code, height }: { code: string; height: number }) {
  const html = emoteHtml(code);
  if (!html) return null;
  ensureCosmeticStyles();
  return <span className="jzc jz-emote" data-emote={code} style={{ height }} dangerouslySetInnerHTML={html} />;
}

