/**
 * The two big tournament events' switches (wave 4, W4c; docs/tournaments/events.md). Built now and switched off at
 * launch (decided 11 Nov 2026); Joe switches each on, as numbers grow, by setting it to true here and merging to main
 * (the deploy ships it).
 *
 * While a switch is off the server refuses everything about that event for whatever a phone sends (entering, the
 * event page, ticking it on, its standings), the phone shows no card, page or link for it, and nothing is created.
 * The server reads these on every call (`eventRefusal` in src/lib/tournaments/eventsFlow.server.ts), never a copy.
 */

/** The Category Cup: a Swiss tournament on Saturdays at 7 pm UK, one category a week, 150 coins or a ticket. */
export const CATEGORY_CUP_ENABLED = false;

/** The Joulz Championship: a Knockout on the last Sunday of the month for the month's top 64 Score Attack players. */
export const JOULZ_CHAMPIONSHIP_ENABLED = false;
