/**
 * What the offline service worker keeps (offline practice, 31 Oct 2026). Dependency free: read by the build
 * (swPlugin.ts, through vite.config.ts) as well as by the app.
 */

/** The pages kept for opening with no signal; any other address offline gets the worker's offline page. */
export const OFFLINE_PAGES = ["/", "/practice", "/profile", "/tournaments"] as const;

/**
 * The Google-hosted fonts the root route asks for (kept by the worker on a best-effort basis): Press Start 2P only,
 * for the Retro games' art. Every other screen is Archivo, self-hosted (design foundation F3, 6 Nov 2026: Space
 * Grotesk, Inter and JetBrains Mono no longer loaded).
 */
export const GOOGLE_FONTS_CSS = "https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap";

/** Public files that are media: the same file under the same name from build to build (one shared cache). */
export const MEDIA_DIRS = ["sounds", "tiles", "wordfall"] as const;

/** Public files never kept: the link preview image and licence texts are not used by the app itself. */
export function keepPublicFile(path: string): boolean {
  if (path === "/og-image.png" || path === "/robots.txt") return false;
  if (/\.txt$/.test(path) && !path.startsWith("/wordfall/")) return false;
  return true;
}
