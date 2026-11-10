/**
 * Account switches (10 Nov 2026; docs/accounts/README.md). Joe flips a switch to true only after the provider is set
 * up in the Supabase dashboard (and, for Apple, the Apple Developer account); while false the phone offers nothing for
 * it and the server refuses it.
 */

/** Google sign-in (Supabase's Google provider). Off until Joe has configured it. */
export const GOOGLE_SIGN_IN_ENABLED = false;

/** Sign in with Apple (needs the Apple Developer account). Off. */
export const APPLE_SIGN_IN_ENABLED = false;

/** Who the account emails come from and where replies go (set in Supabase's SMTP settings; see the README). */
export const ACCOUNT_EMAIL_FROM = "Joulz <hello@joulz.uk>";
export const ACCOUNT_EMAIL_REPLY_TO = "support@joulz.uk";

/** Accounts created before this moment (26 Jan 2027 00:00 UK time) are Founding Players (the database sets the flag). */
export const FOUNDING_CUTOFF_ISO = "2027-01-26T00:00:00Z";
