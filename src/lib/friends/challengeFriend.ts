/**
 * A challenge made from a friend's profile (wave 2 B1; docs/friends.md): which friend it's for, kept on the device
 * from making it until its creator finishes playing it (a reload in between keeps it), when the server records
 * friend_challenge_received for that friend (friends.server.ts `sendChallenge`, which checks the friendship and that
 * the challenge is the caller's own).
 */
import { playerIdOk } from "./friends";

const KEY = "duelz-challenge-friend:v1";

function read(): Record<string, string> {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function write(map: Record<string, string>): void {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* storage blocked: the challenge still works, the friend isn't told */
  }
}

export function rememberChallengeFriend(code: string, friendId: string): void {
  if (!playerIdOk(friendId)) return;
  write({ ...read(), [code]: friendId });
}

export function challengeFriendFor(code: string): string | null {
  const id = read()[code];
  return playerIdOk(id) ? id : null;
}

export function forgetChallengeFriend(code: string): void {
  const map = read();
  delete map[code];
  write(map);
}
