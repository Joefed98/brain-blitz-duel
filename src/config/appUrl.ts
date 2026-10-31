/**
 * The app's one public address (31 Oct 2026): joulz.uk, the primary domain in Lovable
 * (playjoulz.com and the old brain-blitz-duel.lovable.app redirect to it). Every link the app hands
 * out (room invites, share links and cards, /challenge?code= links, ?ref= links, calendar files)
 * and every absolute URL in the page head (Open Graph, Twitter card, canonical) is built on it, so
 * a link shared from a preview or a dev server still leads friends to the live app.
 *
 * An https origin with no trailing slash (link-preview-check proves it).
 */
export const APP_URL = "https://joulz.uk";
