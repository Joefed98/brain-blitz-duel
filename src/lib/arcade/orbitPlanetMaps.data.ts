/** Orbit's planet surface maps (rendered in Blender by scripts/orbit-planets-blender.py; display only, never read by a sim). */
export const ORBIT_PLANET_MAPS = {
  "gas-a": { kind: "tone", url: "/orbit/planets/gas-a.webp?v=278241daef", height: null },
  "gas-b": { kind: "tone", url: "/orbit/planets/gas-b.webp?v=c206c66091", height: null },
  "marble": { kind: "tone", url: "/orbit/planets/marble.webp?v=34de5de732", height: "/orbit/planets/marble-h.webp?v=6fd990bf92" },
  "moon": { kind: "tone", url: "/orbit/planets/moon.webp?v=974b2c83a4", height: "/orbit/planets/moon-h.webp?v=af7c14a179" },
  "desert": { kind: "colour", url: "/orbit/planets/desert.webp?v=f7b0888825", height: "/orbit/planets/desert-h.webp?v=1ccdd4b98c" },
  "lava": { kind: "colour", url: "/orbit/planets/lava.webp?v=e2c0b9a2b5", height: "/orbit/planets/lava-h.webp?v=fbb8912bdc" },
  "terran": { kind: "colour", url: "/orbit/planets/terran.webp?v=7ddc8c4674", height: "/orbit/planets/terran-h.webp?v=119b84f2a2" },
  "ice-a": { kind: "colour", url: "/orbit/planets/ice-a.webp?v=cce8785910", height: "/orbit/planets/ice-a-h.webp?v=9f8e03e8b5" },
  "ice-b": { kind: "colour", url: "/orbit/planets/ice-b.webp?v=c352f40077", height: "/orbit/planets/ice-b-h.webp?v=fb671475f6" },
} as const;
/** Their total size in bytes (colour and height maps). */
export const ORBIT_PLANET_MAP_BYTES = 363486;
