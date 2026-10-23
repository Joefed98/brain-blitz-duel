import { useState, type ReactNode } from "react";

import { termsAgreed } from "@/lib/beta/terms";

import { TermsScreen } from "./TermsScreen";

/**
 * Shows the beta terms in place of a room, daily or challenge until this device has agreed (once,
 * lib/beta/terms.ts), then the screen itself. The routes it wraps render on the phone only (ssr: false),
 * so the first render already knows: no flash of either.
 */
export function TermsGate({ children }: { children: ReactNode }) {
  const [agreed, setAgreed] = useState(() => termsAgreed());
  if (!agreed) return <TermsScreen onAgree={() => setAgreed(true)} />;
  return <>{children}</>;
}
