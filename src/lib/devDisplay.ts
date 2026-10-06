/** Presentation permission only; never authorizes server work. */
let acceptedKey: string | null = null;
export const DEV_DISPLAY_EVENT = "duelz-dev-display";
export function setDevDisplayKey(key: string | null): void {
  acceptedKey = key;
  if (typeof window !== "undefined") window.dispatchEvent(new Event(DEV_DISPLAY_EVENT));
}
export function devDisplayAllowed(): boolean {
  if (typeof window === "undefined" || !acceptedKey) return false;
  const params = new URLSearchParams(window.location.search);
  return params.get("dev") === "1" && params.get("key") === acceptedKey;
}