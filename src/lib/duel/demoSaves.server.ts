/**
 * Security fix M7 (Nov 2026 audit): whether this server takes intro-demo saves. A development server always does (Joe
 * records demos there); a production build only when the server's own INTRO_DEMO_SAVES is "1", never because the
 * phone says it is in dev practice.
 */
export function demoSavesOpen(prod: boolean, flag: string | undefined): boolean {
  return !prod || flag === "1";
}
