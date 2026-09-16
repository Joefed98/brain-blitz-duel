import { useEffect, useState } from "react";

import {
  SOUND_NAMES,
  soundDiagnostics,
  unlockAudio,
  playCue,
  startMusic,
  stopMusic,
  type Cue,
  type SoundDiagnostics,
} from "@/lib/sound";

const TRACKS = new Set(["lobby_loop", "tension_loop"]);

/** Temporary on-device sound diagnostics, shown at /practice?sound=1. */
export function SoundDebugPanel() {
  const [info, setInfo] = useState<SoundDiagnostics | null>(null);
  const [testing, setTesting] = useState<string | null>(null);

  useEffect(() => {
    const read = () => setInfo(soundDiagnostics());
    read();
    const id = window.setInterval(read, 500);
    return () => window.clearInterval(id);
  }, []);

  const testAll = async () => {
    unlockAudio();
    for (const name of SOUND_NAMES) {
      setTesting(name);
      if (TRACKS.has(name)) {
        startMusic(name as "lobby_loop" | "tension_loop");
        await new Promise((r) => setTimeout(r, 1500));
        stopMusic(200);
      } else {
        playCue(name as Cue);
        await new Promise((r) => setTimeout(r, 900));
      }
    }
    setTesting(null);
  };

  return (
    <div className="mb-4 rounded-xl border border-border bg-card p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
      <p className="uppercase tracking-widest text-foreground">Sound debug</p>
      <p>state: {info?.state ?? "-"}</p>
      <p>unlocked: {String(info?.unlocked ?? false)}</p>
      <p>muted: {String(info?.muted ?? false)}</p>
      <p>
        volumes: music {info?.musicVolume ?? "-"} / fx {info?.effectsVolume ?? "-"}
      </p>
      <p>track: {info?.currentTrack ?? "none"}</p>
      <p>
        loaded ({info?.loaded.length ?? 0}): {info?.loaded.join(", ") || "-"}
      </p>
      <p>pending: {info?.pending.join(", ") || "-"}</p>
      <p>failed: {info?.failed.join(", ") || "-"}</p>
      {testing && <p className="text-foreground">playing: {testing}</p>}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => unlockAudio()}
          className="press rounded-lg border border-border px-3 py-2 text-foreground"
        >
          Unlock
        </button>
        <button
          type="button"
          onClick={() => void testAll()}
          className="press rounded-lg bg-primary px-3 py-2 text-primary-foreground"
        >
          Test all
        </button>
      </div>
    </div>
  );
}
