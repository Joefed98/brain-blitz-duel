import { useEffect, useRef, useState, type FormEvent } from "react";

import { PlayerBadge } from "@/components/duel/PlayerBadge";
import { arcadeGroupOf } from "@/lib/duel/arcadeGroups";
import { finishedThisRound } from "@/lib/duel/finishedPings";
import type { PlayerLooks } from "@/lib/duel/playerLook";
import { isLiveType, puzzleDef, puzzleName } from "@/lib/duel/registry";
import type { RoomChatState } from "@/lib/duel/useRoomChat";
import type { DuelPlayerRow, StoredPuzzleType } from "@/lib/duel/types";
import { Icon, Input } from "@/design/components";

/**
 * A room's right panel on the computer layout (31 Oct 2026, presentation only; docs/desktop-layout.md):
 * 380 px on the right of every room screen from 1024 px wide (PhoneShell's RoomPanelSlot), never on a
 * phone or tablet. The room code; "Round x of y" over a bar of one segment per round in that round's
 * category colour (an arcade round its group's); the live standings for up to 16 (badge and initial,
 * name, status and total), totals only through the last round everyone has seen (never the round being
 * played: a player's status says "playing" or "finished ✓", from the same column and buzzer rule as the
 * live "finished" pings); and the chat between rounds where the room has it, a quiet line otherwise.
 */
export interface RoomPanelRow {
  slot: number;
  name: string;
  total: number;
  position: number;
}

export function RoomPanel({
  roomCode,
  round,
  totalRounds,
  roundOrder,
  status,
  inRound,
  rows,
  players,
  mySlot,
  myAnswered,
  looks,
  chat,
  chatAvailable,
  myUserId,
}: {
  roomCode: string;
  /** The current round (0 in the lobby). */
  round: number;
  totalRounds: number;
  roundOrder: readonly StoredPuzzleType[];
  status: "waiting" | "in_progress" | "finished";
  /** A round is being played (intro to reveal): chat is closed and statuses show. */
  inRound: boolean;
  rows: readonly RoomPanelRow[];
  players: readonly DuelPlayerRow[];
  mySlot: number;
  myAnswered: boolean;
  looks: PlayerLooks;
  chat: RoomChatState;
  chatAvailable: boolean;
  myUserId: string;
}) {
  const finished = new Set(finishedThisRound(players, round, mySlot).map((p) => p.slot));
  if (myAnswered) finished.add(mySlot);
  const done = status === "finished" ? totalRounds : Math.max(0, round - (inRound ? 1 : 0));
  // The lobby: the order is dealt only at the start, so no bar yet (the lobby's own line says the settings).
  const label =
    status === "waiting"
      ? "Waiting to start"
      : status === "finished"
        ? "Game over"
        : `Round ${round} of ${totalRounds}`;
  const playerOf = new Map(players.map((p) => [p.player_slot, p]));
  return (
    <aside aria-label="Room" data-room-panel-body data-skin="room" className="dk-room-panel">
      <div className="dk-rp-head">
        <span className="dk-rp-label">Room</span>
        <span data-room-panel-code className="dk-rp-code">
          {roomCode}
        </span>
      </div>

      <section aria-label="Rounds" className="dk-rp-section">
        <div className="dk-rp-row">
          <h2 className="dk-rp-title">{label}</h2>
          {round > 0 && status !== "finished" && isLiveType(roundOrder[round - 1]) ? (
            <span data-ellipsis className="dk-rp-meta">
              {puzzleName(roundOrder[round - 1]!)}
            </span>
          ) : null}
        </div>
        {status === "waiting" ? null : (
          <div
            data-room-progress
            className="dk-rp-progress"
            role="img"
            aria-label={`${done} of ${totalRounds} rounds played`}
          >
            {Array.from({ length: totalRounds }, (_, i) => {
              const type = roundOrder[i];
              const cat =
                type && isLiveType(type)
                  ? puzzleDef(type).category === "arcade"
                    ? (arcadeGroupOf(type) ?? "arcade")
                    : puzzleDef(type).category
                  : undefined;
              const state =
                i < done ? "done" : i === round - 1 && status === "in_progress" ? "now" : "next";
              return <span key={i} data-cat={cat} data-round-state={state} className="dk-rp-seg" />;
            })}
          </div>
        )}
      </section>

      <section aria-label="Standings" data-room-standings className="dk-rp-section dk-rp-grow">
        <div className="dk-rp-row">
          <h2 className="dk-rp-title">Players</h2>
          <span className="dk-rp-meta">{rows.length} of 16</span>
        </div>
        <ol className="dk-rp-list">
          {rows.map((row) => {
            const p = playerOf.get(row.slot);
            const state =
              p?.status === "left"
                ? "left"
                : status === "waiting"
                  ? p?.user_id === myUserId
                    ? "you"
                    : "ready"
                  : inRound
                    ? finished.has(row.slot)
                      ? "finished"
                      : "playing"
                    : "";
            const word =
              state === "finished"
                ? "finished ✓"
                : state === "playing"
                  ? "playing"
                  : state === "left"
                    ? "left"
                    : state === "you"
                      ? "you"
                      : "";
            return (
              <li
                key={row.slot}
                data-room-player={row.slot}
                data-me={row.slot === mySlot || undefined}
                data-state={state || undefined}
                className="dk-rp-player"
              >
                <span className="dk-rp-place">{status === "waiting" ? "" : row.position}</span>
                <PlayerBadge look={looks.get(row.slot)} name={row.name} size={26} />
                <span className="dk-rp-name-wrap">
                  <span data-ellipsis className="dk-rp-name">
                    {row.name || "Player"}
                  </span>
                  {word ? <span className="dk-rp-status">{word}</span> : null}
                </span>
                {status === "waiting" ? null : <span className="dk-rp-score">{row.total}</span>}
              </li>
            );
          })}
        </ol>
      </section>

      <section
        aria-label="Chat"
        data-room-panel-chat={chatAvailable ? "open" : "closed"}
        className="dk-rp-section dk-rp-chat"
      >
        <h2 className="dk-rp-title">Chat</h2>
        {chatAvailable ? (
          <PanelChat chat={chat} myUserId={myUserId} />
        ) : (
          <p className="dk-rp-quiet">
            <Icon name="chat" size={18} className="-m-px" /> Chat opens between rounds
          </p>
        )}
      </section>
    </aside>
  );
}

function PanelChat({ chat, myUserId }: { chat: RoomChatState; myUserId: string }) {
  const [text, setText] = useState("");
  const list = useRef<HTMLUListElement | null>(null);
  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.messages.length]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = text.trim();
    if (!value || chat.sending) return;
    void chat.send(value).then(() => setText(""));
  };
  return (
    <>
      <ul ref={list} data-scrollable className="dk-rp-messages">
        {chat.messages.length === 0 ? <li className="dk-rp-quiet">Quiet in here</li> : null}
        {chat.messages.slice(-40).map((m) => (
          <li
            key={m.id}
            data-mine={m.sender_user_id === myUserId || undefined}
            className="dk-rp-msg"
          >
            <span className="dk-rp-msg-name">{m.sender_name}</span> {m.text}
          </li>
        ))}
      </ul>
      <form onSubmit={submit} className="dk-rp-send">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Chat…"
          aria-label="Chat message"
          maxLength={200}
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={!text.trim() || chat.sending}
          className="dk-rail-icon press"
        >
          <Icon name="send" size={20} />
        </button>
      </form>
      {chat.error ? <p className="dk-rp-quiet">{chat.error}</p> : null}
    </>
  );
}
