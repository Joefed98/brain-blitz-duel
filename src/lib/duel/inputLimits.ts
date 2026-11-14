/**
 * The size limits of the room, chat, practice and replay functions' inputs (validation batch 1, 14 Nov 2026; checked
 * through src/lib/validate.ts). Each is well above anything the app sends: the largest dealt public half is ~25 KB
 * (countup) and the largest sealed practice token ~17 KB (wordhunt), measured over every game; replays show answers up
 * to 400,000 characters (REPLAY_MAX_ANSWER_CHARS). The checks are of type, shape and size only: what a value means (a
 * room that exists, a round that is live, a colour that is free) stays the handler's own rule and answer.
 */

/** Room, duel and message ids (a uuid is 36). */
export const ID_MAX = 64;
/** Room and challenge codes (4 and 6 characters). */
export const CODE_MAX = 32;
/** Names as typed, before the name cleaner cuts them to 16 code points. */
export const NAME_MAX = 200;
/** Short words: kinds, phases, reasons, input types, build ids, emoji and emote codes, icon ids. */
export const SHORT_MAX = 64;
/** A typed chat message, before the server's own cut to MESSAGE_MAX_LENGTH. */
export const CHAT_MAX = 2_000;
/** A round's answer or move list (arcade input logs are the longest). */
export const ANSWER_MAX = 800_000;
/** A word sent to the word check. */
export const WORD_MAX = 64;
/** The words found so far. */
export const FOUND_MAX = 2_000;
/** A traced path's cells. */
export const PATH_MAX = 400;
/** Round and slot numbers (the handler decides which exist). */
export const COUNT_MAX = 100_000;
/** Milliseconds, colours and other plain numbers (the handler clamps them). */
export const NUMBER_MAX = 1e9;
/** A submitted answer's extra figures. */
export const EXTRA_MAX = 20_000;
/** A dealt puzzle's public half as the phone sends it back. */
export const PUZZLE_MAX = 400_000;
/** A sealed practice token or start token. */
export const SEALED_MAX = 200_000;
/** A remembered colour and icon. */
export const LOOK_MAX = 2_000;
/** Lists of game types, codes, categories and picks. */
export const LIST_MAX = 200;
/** The demo key. */
export const KEY_MAX = 512;
