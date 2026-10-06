import { useEffect, useState } from "react";

import { DEV_DISPLAY_EVENT, devDisplayAllowed } from "@/lib/devDisplay";

interface Box {
  label: string;
  top: number;
  left: number;
  width: number;
  height: number;
  tone: "topbar" | "arena" | "controls";
}

interface Reading {
  boxes: Box[];
  gap: number | null;
  below: number | null;
}

const TONE: Record<Box["tone"], string> = {
  topbar: "border-muted-foreground text-muted-foreground",
  arena: "border-primary text-primary",
  controls: "border-destructive text-destructive",
};

function union(elements: Element[]): DOMRect | null {
  const rects = elements.map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0);
  if (!rects.length) return null;
  const top = Math.min(...rects.map((r) => r.top));
  const left = Math.min(...rects.map((r) => r.left));
  const bottom = Math.max(...rects.map((r) => r.bottom));
  const right = Math.max(...rects.map((r) => r.right));
  return new DOMRect(left, top, right - left, bottom - top);
}

function measure(): Reading {
  const column = document.querySelector("[data-game-column]");
  const region = column?.querySelector("[data-game-region]");
  const stage = region?.querySelector("[data-game-stage]");
  if (!column || !region || !stage) return { boxes: [], gap: null, below: null };
  const boxes: Box[] = [];
  const regionRect = region.getBoundingClientRect();
  const bar = union(Array.from(column.querySelectorAll("[data-game-topbar]")));
  if (bar) {
    // Top bar = shell bar, round heading and timer: everything above the game region.
    boxes.push({ label: "top bar", tone: "topbar", top: bar.top, left: bar.left, width: bar.width, height: regionRect.top - bar.top });
  }
  const arenaEl = stage.querySelector("[data-game-arena]");
  const arena = arenaEl?.getBoundingClientRect() ?? null;
  if (arena) boxes.push({ label: "arena", tone: "arena", top: arena.top, left: arena.left, width: arena.width, height: arena.height });
  const controls = union(Array.from(stage.querySelectorAll("[data-game-controls]")));
  if (controls) boxes.push({ label: "controls", tone: "controls", top: controls.top, left: controls.left, width: controls.width, height: controls.height });
  const columnRect = column.getBoundingClientRect();
  const padBottom = parseFloat(getComputedStyle(column).paddingBottom) || 0;
  const lastBottom = Math.max(controls?.bottom ?? 0, arena?.bottom ?? 0);
  return {
    boxes,
    gap: arena && controls ? controls.top - arena.bottom : null,
    below: lastBottom ? columnRect.bottom - padBottom - lastBottom : null,
  };
}

/**
 * Accepted-key developer readout: outlines the top bar, arena and control
 * block with their heights so the in-game column can be read on a device.
 * Presentation only; pointer events pass straight through.
 */
export function GameLayoutDevOverlay() {
  const [on, setOn] = useState(false);
  const [reading, setReading] = useState<Reading>({ boxes: [], gap: null, below: null });

  useEffect(() => {
    const sync = () => setOn(devDisplayAllowed());
    sync();
    window.addEventListener(DEV_DISPLAY_EVENT, sync);
    window.addEventListener("popstate", sync);
    return () => {
      window.removeEventListener(DEV_DISPLAY_EVENT, sync);
      window.removeEventListener("popstate", sync);
    };
  }, []);

  useEffect(() => {
    if (!on) return;
    const tick = () => setReading(measure());
    tick();
    const id = window.setInterval(tick, 300);
    window.addEventListener("resize", tick);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("resize", tick);
    };
  }, [on]);

  if (!on) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[80]">
      {reading.boxes.map((box) => (
        <div
          key={box.label}
          className={`absolute border ${TONE[box.tone]}`}
          style={{ top: box.top, left: box.left, width: box.width, height: Math.max(0, box.height) }}
        >
          <span className="absolute right-0 top-0 bg-background/85 px-1 font-mono text-[10px] leading-4">
            {box.label} {Math.round(box.height)}px
          </span>
        </div>
      ))}
      <span className="absolute bottom-1 left-1 bg-background/85 px-1 font-mono text-[10px] leading-4 text-foreground">
        gap {reading.gap === null ? "–" : `${Math.round(reading.gap)}px`} · below {reading.below === null ? "–" : `${Math.round(reading.below)}px`} · viewport {typeof window === "undefined" ? "" : `${window.innerWidth}×${window.innerHeight}`}
      </span>
    </div>
  );
}
