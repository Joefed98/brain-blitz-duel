/**
 * How the tournament boards, standings and the Arena opponent draw a player (Joe's rule of 11 Nov 2026: a player's
 * card, avatar and frame show wherever they appear): the shared nameplate (`NameplatePlayer`, drawn by
 * `NameplateStrip` from @/design/identity; docs/nameplate.md). The server decides each row's plate
 * (plates.server.ts) and sends it with the board, so a page costs one call.
 *
 *  - `card`: an account: its card art, frame, avatar, name colour, tier emblem, badges and title, under its username.
 *  - `plain`: no account (a guest): the room colour and initial, as rooms show them.
 *  - `hidden`: an under-18 account seen by anyone but themselves, or an account waiting for deletion: "Hidden player"
 *    on a plain neutral disc (Joe, 12 Nov 2026): no initial, no colour from their account, no cosmetics, emblem or
 *    badges. Nothing identifying is sent.
 */
import { HIDDEN_PLAYER_NAME, nameplateName, type NameplatePlayer } from "@/design/identity/nameplate";

export { HIDDEN_PLAYER_NAME };

export type PlateView = NameplatePlayer;

/** A hidden player's plate: the same for everyone, carrying nothing of the account. Also what a row draws when nothing could be read. */
export const HIDDEN_PLATE: PlateView = { kind: "hidden" };
export const UNKNOWN_PLATE: PlateView = HIDDEN_PLATE;

/** The name a plate writes ("Hidden player" for a hidden one). */
export const plateName = nameplateName;
