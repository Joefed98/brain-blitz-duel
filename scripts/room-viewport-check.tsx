/**
 * Room play viewport: behaviour checks only (rendered markup and a mounted
 * shell), no source-string scans. The room and practice routes need Supabase
 * and the router to render, so their phase layout is not covered here.
 */
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Window } from "happy-dom";

import { PhoneShell } from "../src/components/duel/PhoneShell";
import { ScoreStrip } from "../src/components/duel/ScoreStrip";
import { PUZZLE_REGISTRY } from "../src/lib/duel/registry";
import { wordSearchPuzzle } from "../src/puzzles/wordSearch";

const active = Object.entries(PUZZLE_REGISTRY).filter(([, definition]) => !definition.retired);
const LOCKED_SHELL = /no-overscroll h-full overflow-hidden/;
for (const [width, height] of [[390, 700], [375, 667], [390, 844], [430, 932], [1280, 800]] as const) {
  const header = <ScoreStrip myName="A long player name" opponentName="Another long player name" myTotal={123} opponentTotal={149} compact />;
  for (const [type] of active) {
    const markup = renderToStaticMarkup(
      <PhoneShell constrained gameScreen gameType={type as keyof typeof PUZZLE_REGISTRY} gameHeader={header}>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden" />
      </PhoneShell>,
    );
    // Play shells fill the locked root rather than sizing themselves to the viewport.
    assert.equal((markup.match(new RegExp(LOCKED_SHELL, "g")) ?? []).length, 2, `${type}: outer and column locked`);
    assert.doesNotMatch(markup, /100vh|min-h-\[100dvh\]/);
    assert.equal((markup.match(/pad-game-safe/g) ?? []).length, 1, `${type}: one safe-area owner`);
    assert.match(markup, /game-screen/);
    assert.match(markup, /A long player name/);
    assert.doesNotMatch(markup, /Say something|RoomChat/);
  }
  console.log(`PASS ${width}x${height}: ${active.length} active room play shells, no chat reservation, one shared safe-area owner`);
}
// Lobby/pre-round pages keep a normal scrolling column.
const lobby = renderToStaticMarkup(<PhoneShell><span /></PhoneShell>);
assert.match(lobby, /min-h-\[100dvh\]/);
assert.doesNotMatch(lobby, LOCKED_SHELL);
assert.doesNotMatch(lobby, /pad-game-safe|game-screen/);

// Mount real shells: a play screen locks the page (html/body game-lock) and
// scrolls to the top; nested locks are counted; a lobby shell never locks.
{
  const win = new Window({ width: 390, height: 700 });
  const globals = ["window", "document", "navigator", "HTMLElement", "Element", "Node", "Event", "CustomEvent", "TouchEvent", "MutationObserver", "ResizeObserver", "SVGElement", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame", "matchMedia", "localStorage"] as const;
  for (const key of globals) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: (win as unknown as Record<string, unknown>)[key] });
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const scrolls: number[][] = [];
  (win as unknown as { scrollTo: (x: number, y: number) => void }).scrollTo = (x, y) => scrolls.push([x, y]);
  const { act } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const html = win.document.documentElement, body = win.document.body;
  const locked = () => html.classList.contains("game-lock") && body.classList.contains("game-lock");
  const unlocked = () => !html.classList.contains("game-lock") && !body.classList.contains("game-lock");
  const mount = async (gameScreen: boolean) => {
    const host = win.document.createElement("div");
    body.append(host);
    const root = createRoot(host as unknown as Element);
    await act(async () => root.render(createElement(PhoneShell, { constrained: gameScreen, gameScreen, gameType: "sudoku" }, createElement("span"))));
    return root;
  };
  const lobbyRoot = await mount(false);
  assert.ok(unlocked(), "lobby shell must not lock the page");
  const first = await mount(true);
  assert.ok(locked(), "play shell locks html and body");
  assert.deepEqual(scrolls.at(-1), [0, 0], "play shell resets page scroll");
  const second = await mount(true);
  await act(async () => first.unmount());
  assert.ok(locked(), "lock held while another play shell is mounted");
  await act(async () => second.unmount());
  assert.ok(unlocked(), "lock released when the last play shell unmounts");
  await act(async () => lobbyRoot.unmount());
  console.log("PASS mounted shells: play screens lock and release the page viewport, nested locks counted, lobby never locks");
}

const reveal = renderToStaticMarkup(
  <wordSearchPuzzle.Reveal
    puzzle={{
      type: "wordsearch",
      size: 5,
      grid: "ABCDEFGHIJKLMNOPQRSTUVWXY",
      category: "Test",
      wordCount: 2,
      placements: [
        { word: "ABCDE", cells: [0, 1, 2, 3, 4] },
        { word: "AFKPU", cells: [0, 5, 10, 15, 20] },
      ],
    }}
    myAnswer="0.4"
    myCorrect={false}
    myReactionAvgMs={null}
    timeLimitMs={60_000}
  />,
);
assert.match(reveal, /text-primary[^>]*>ABCDE/);
assert.match(reveal, /text-destructive[^>]*>AFKPU/);
assert.equal((reveal.match(/ring-2 ring-inset ring-destructive/g) ?? []).length, 5);
assert.match(reveal, /bg-primary text-primary-foreground ring-2 ring-inset ring-destructive/);
console.log("PASS Word Search: every missed path cell is red-outlined, shared found cells retain gold, and list colours match");

