import { useState, type ReactNode } from "react";

import { termsAgreed } from "@/lib/beta/terms";

import { TermsScreen } from "./TermsScreen";

/**
 * Shows the beta terms at an entry point (a room link's join, the daily, a challenge) until this
 * device has agreed (once, lib/beta/terms.ts), then the screen itself. Never inside a room the device
 * is already in: the room route gates only its link join. The screens it wraps render on the phone
 * only (ssr: false), so the first render already knows: no flash of either.
 */
export function TermsGate({ children }: { children: ReactNode }) {
  const [agreed, setAgreed] = useState(() => termsAgreed());
  if (!agreed) return <TermsScreen onAgree={() => setAgreed(true)} />;
  return <>{children}</>;
}
