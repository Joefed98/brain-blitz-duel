/**
 * Report reasons and the safety notices' words (safety, 10 Nov 2026; docs/moderation.md). Shared by the phone and the
 * server. A report is two taps: a player's name or a chat message, then one of these reasons.
 */

export const REPORT_REASONS = ["offensive_name", "abusive_chat", "cheating"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/** The reason buttons' words. */
export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  offensive_name: "Offensive name",
  abusive_chat: "Abusive chat",
  cheating: "Cheating",
};

export function isReportReason(value: unknown): value is ReportReason {
  return typeof value === "string" && (REPORT_REASONS as readonly string[]).includes(value);
}

/** Where players write to about a ban. */
export const SUPPORT_EMAIL = "support@joulz.uk";

/** What a muted player sees in chat (the automatic mute: three players' reports within 24 hours). */
export const CHAT_MUTED_MESSAGE = "Chat is paused for 24 hours after reports from other players.";

/** What a banned player sees when making or joining a room, or chatting. */
export const BANNED_MESSAGE = `You can’t make or join rooms or chat right now. Practice still works. Questions? Email ${SUPPORT_EMAIL}.`;

/** The thank-you after a report (the same whether or not it counted; the reported player is never told). */
export const REPORT_THANKS = "Thanks. We’ve got your report.";
