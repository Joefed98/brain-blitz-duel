// Scene description → GLSL for engine.html. A scene is a list of rounded primitives in world units (the floor is
// the lowest point of the scene; about 2–3 units across is the usual size). Each primitive has one colour on the
// shared gloss material, and may carry a pattern (stripes, rings, bands, checks), a decal from the glyph atlas
// (text or a small painted picture on one face) or a cut (a primitive subtracted from it).
const D = Math.PI / 180;
const mul = (A, B) => A.map((r, i) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
const app = (R, v) => R.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
const I3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const rx = (a) => [[1, 0, 0], [0, Math.cos(a), -Math.sin(a)], [0, Math.sin(a), Math.cos(a)]];
const ry = (a) => [[Math.cos(a), 0, Math.sin(a)], [0, 1, 0], [-Math.sin(a), 0, Math.cos(a)]];
const rz = (a) => [[Math.cos(a), -Math.sin(a), 0], [Math.sin(a), Math.cos(a), 0], [0, 0, 1]];
/** Local → world rotation for Euler degrees [x, y, z]: z first, then x, then y (spin about the vertical last). */
export const euler = (r = [0, 0, 0]) => mul(ry(r[1] * D), mul(rx(r[0] * D), rz(r[2] * D)));
const add = (a, b) => a.map((v, i) => v + b[i]);

let LIST = null;
const mk = (kind, args, o = {}) => {
  const p = { kind, ...args, pos: o.pos || [0, 0, 0], rm: euler(o.rot), col: o.col || '#C9D3EA', emit: o.emit || 0, pattern: o.pattern, decal: o.decal, cut: o.cut || [] };
  if (o.decals) p.decals = o.decals;
  if (LIST && !o.isCut) LIST.push(p);
  return p;
};
// Half extents throughout.
export const box = (s, o = {}) => mk('box', { s, r: o.r ?? Math.min(...s) * 0.25 }, o);
export const sphere = (r, o = {}) => mk('sphere', { r }, o);
export const ell = (s, o = {}) => mk('ell', { s }, o);
export const cyl = (r, h, o = {}) => mk('cyl', { r, h, rr: o.r ?? Math.min(r, h) * 0.3 }, o);
export const cap = (a, b, r, o = {}) => mk('cap', { a, b, r }, o);
export const torus = (R, r, o = {}) => mk('torus', { R, r }, o);
export const cone = (r1, r2, h, o = {}) => mk('cone', { r1, r2, h, rr: o.r ?? 0.02 }, o);
/** An extruded polygon: pts in the local XY plane, depth h (half) along local Z. */
export const prism = (pts, h, o = {}) => mk('prism', { pts, h, rr: o.r ?? 0.02 }, o);
export const star = (ro, ri, h, o = {}) => {
  const n = o.points || 5, pts = [];
  for (let i = 0; i < n * 2; i++) { const a = Math.PI / 2 + (i * Math.PI) / n, r = i % 2 ? ri : ro; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
  return prism(pts, h, { r: 0.03, ...o });
};
export const cutOf = (fn) => { const save = LIST; LIST = null; const c = fn(); LIST = save; return Array.isArray(c) ? c : [c]; };

/** Build a scene: fn() calls the primitive builders; returns the flat list. */
export function build(fn) { LIST = []; fn(); const out = LIST; LIST = null; return out; }
/** Apply a transform (and a uniform scale) to primitives already built, in place. */
export function place(prims, { pos = [0, 0, 0], rot, scale = 1 } = {}) {
  const R = euler(rot);
  const tf = (p) => {
    p.pos = add(app(R, p.pos.map((v) => v * scale)), pos); p.rm = mul(R, p.rm);
    if (scale !== 1) {
      for (const k of ['r', 'h', 'rr', 'R', 'r1', 'r2']) if (typeof p[k] === 'number') p[k] *= scale;
      if (p.s) p.s = p.s.map((v) => v * scale);
      if (p.a) { p.a = p.a.map((v) => v * scale); p.b = p.b.map((v) => v * scale); }
      if (p.pts) p.pts = p.pts.map(([x, y]) => [x * scale, y * scale]);
      if (p.decal) for (const k of ['w', 'h']) if (p.decal[k]) p.decal[k] *= scale;
      if (p.pattern) for (const k of ['w', 'step', 'w2']) if (p.pattern[k]) p.pattern[k] *= scale;
    }
    for (const c of p.cut) tf(c);
  };
  // Cuts are given in their parent's frame: move them into it once, the first time the parent is placed.
  for (const p of prims) { for (const c of p.cut) if (!c._placed) { c.pos = add(app(p.rm, c.pos), p.pos); c.rm = mul(p.rm, c.rm); c._placed = true; } }
  prims.forEach(tf);
  return prims;
}
/** Group: build primitives inside fn, then place them. */
export const group = (fn, o) => { const save = LIST; LIST = []; fn(); const g = LIST; LIST = save; place(g, o); LIST.push(...g); return g; };

export function bound(p) {
  switch (p.kind) {
    case 'box': return Math.hypot(...p.s);
    case 'sphere': return p.r;
    case 'ell': return Math.max(...p.s);
    case 'cyl': return Math.hypot(p.r, p.h);
    case 'cap': return Math.max(Math.hypot(...p.a), Math.hypot(...p.b)) + p.r;
    case 'torus': return p.R + p.r;
    case 'cone': return Math.hypot(Math.max(p.r1, p.r2), p.h);
    case 'prism': return Math.hypot(Math.max(...p.pts.map(([x, y]) => Math.hypot(x, y))), p.h);
  }
}
/** Points on the hull for framing and the floor (world space). */
export function hullPoints(p) {
  const pts = [];
  if (p.kind === 'box') { for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) pts.push(add(app(p.rm, [sx * p.s[0], sy * p.s[1], sz * p.s[2]]), p.pos)); return pts; }
  if (p.kind === 'cap') { for (const e of [p.a, p.b]) { const c = add(app(p.rm, e), p.pos); for (const d of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) pts.push(add(c, d.map((v) => v * p.r))); } return pts; }
  const ext = p.kind === 'sphere' ? [p.r, p.r, p.r] : p.kind === 'ell' ? p.s : p.kind === 'cyl' ? [p.r, p.h, p.r] : p.kind === 'torus' ? [p.R + p.r, p.r, p.R + p.r]
    : p.kind === 'cone' ? [Math.max(p.r1, p.r2), p.h, Math.max(p.r1, p.r2)] : (() => { const m = Math.max(...p.pts.map(([x, y]) => Math.max(Math.abs(x), Math.abs(y)))); return [m, m, p.h]; })();
  const round = p.kind === 'sphere' || p.kind === 'ell' || p.kind === 'torus' || p.kind === 'cyl' || p.kind === 'cone';
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const v = [sx * ext[0], sy * ext[1], sz * ext[2]];
    if (round) { v[0] *= 0.82; v[2] *= 0.82; if (p.kind === 'sphere' || p.kind === 'ell') v[1] *= 0.82; }
    pts.push(add(app(p.rm, v), p.pos));
  }
  if (round) for (const d of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) pts.push(add(app(p.rm, d.map((v, i) => v * ext[i])), p.pos));
  return pts;
}

const f = (v) => (Math.abs(v) < 1e-6 ? '0.' : (+v.toFixed(5)).toString().replace(/^(-?\d+)$/, '$1.'));
const v3 = (a) => `vec3(${a.map(f).join(',')})`;
const v2 = (a) => `vec2(${a.map(f).join(',')})`;
const m3 = (R) => `mat3(${R.flat().map(f).join(',')})`; // columns = rows of R, so M = Rᵀ (world → local)
const hex = (h) => { const n = h.replace('#', ''); return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255); };
const c3 = (h) => v3(hex(h));

export function compile(prims) {
  let polys = '', np = 0;
  const sdf = (p, q) => {
    switch (p.kind) {
      case 'box': return `sdRBox(${q},${v3(p.s)},${f(p.r)})`;
      case 'sphere': return `sdSphere(${q},${f(p.r)})`;
      case 'ell': return `sdEll(${q},${v3(p.s)})`;
      case 'cyl': return `sdRCyl(${q},${f(p.r)},${f(p.h)},${f(Math.min(p.rr, p.r * 0.95, p.h * 0.95))})`;
      case 'cap': return `sdCap(${q},${v3(p.a)},${v3(p.b)},${f(p.r)})`;
      case 'torus': return `sdTorus(${q},${f(p.R)},${f(p.r)})`;
      case 'cone': return `sdCone(${q},${f(p.h)},${f(p.r1)},${f(p.r2)},${f(p.rr)})`;
      case 'prism': {
        const k = np++, n = p.pts.length;
        polys += `float poly${k}(vec2 p){vec2 v[${n}];${p.pts.map((pt, i) => `v[${i}]=${v2(pt)};`).join('')}float d=dot(p-v[0],p-v[0]);float s=1.;
 for(int i=0,j=${n - 1};i<${n};j=i,i++){vec2 e=v[j]-v[i];vec2 w=p-v[i];vec2 b=w-e*clamp(dot(w,e)/dot(e,e),0.,1.);d=min(d,dot(b,b));
  bvec3 c=bvec3(p.y>=v[i].y,p.y<v[j].y,e.x*w.y>e.y*w.x);if(all(c)||all(not(c)))s*=-1.;}return s*sqrt(d);}\n`;
        return `extrude(poly${k}((${q}).xy),(${q}).z,${f(p.h)},${f(p.rr)})`;
      }
    }
  };
  const cells = [], cellKey = new Map();
  const cellOf = (c) => { const k = JSON.stringify(c); if (!cellKey.has(k)) { cellKey.set(k, cells.length); cells.push(c); } return cellKey.get(k); };
  let scene = '', mats = '';
  prims.forEach((p, i) => {
    const B = bound(p) + 0.02;
    let d = sdf(p, `(${m3(p.rm)}*(p-${v3(p.pos)}))`);
    for (const c of p.cut) { if (!c._placed) { c.pos = add(app(p.rm, c.pos), p.pos); c.rm = mul(p.rm, c.rm); c._placed = true; } d = `max(${d},-${sdf(c, `(${m3(c.rm)}*(p-${v3(c.pos)}))`)})`; }
    scene += ` if(length(p-${v3(p.pos)})-${f(B)}<r.x){r=U(r,vec2(${d},${i}.));}\n`;
    let m = ` if(id==${i}){vec3 q=${m3(p.rm)}*(p-${v3(p.pos)});vec3 ln=${m3(p.rm)}*n;c=${c3(p.col)};emit=${f(p.emit)};\n`;
    const pt = p.pattern;
    if (pt) {
      const ax = pt.axis || 'y';
      if (pt.type === 'stripe') m += `  if(abs(q.${ax})<${f(pt.w)})c=${c3(pt.col)};\n`;
      if (pt.type === 'rings') { const a2 = ax === 'y' ? 'xz' : ax === 'z' ? 'xy' : 'yz';
        m += `  {float rr=length(q.${a2});int k=int(floor(rr/${f(pt.step)}));${pt.cols.map((cc, j) => `if(k==${j})c=${c3(cc)};`).join('')}${pt.edge ? '' : `if(k>=${pt.cols.length})c=${c3(pt.cols[pt.cols.length - 1])};`}}\n`; }
      if (pt.type === 'bands') m += `  {int k=int(floor((q.${ax}-(${f(pt.from ?? -10)}))/${f(pt.step)}));${pt.cols.map((cc, j) => `if(k==${j})c=${c3(cc)};`).join('')}}\n`;
      if (pt.type === 'checker') { const a2 = ax === 'y' ? 'xz' : 'xy'; m += `  {vec2 g=floor(q.${a2}/${f(pt.step)}+.5*${f(pt.odd ? 1 : 0)});if(mod(g.x+g.y,2.)>.5)c=${c3(pt.col)};}\n`; }
      if (pt.type === 'spiral') m += `  {float a=atan(q.z,q.x);if(mod(floor(a/${f((2 * Math.PI) / pt.n)}+.5),2.)<.5)c=${c3(pt.col)};}\n`;
    }
    for (const dc of p.decals || (p.decal ? [p.decal] : [])) {
      const k = cellOf(dc.cell);
      const face = dc.face || 'z';
      const sgn = face.startsWith('-') ? -1 : 1, axis = face.replace('-', '');
      const [uA, vA, us, vs] = axis === 'y' ? ['x', 'z', 1, -1] : axis === 'z' ? ['x', 'y', 1, 1] : ['z', 'y', -1, 1];
      const w = dc.w, h = dc.h ?? dc.w, off = dc.off || [0, 0];
      m += `  if(${sgn}.*ln.${axis}>.45){vec2 uv=vec2(${us * sgn}.*q.${uA}-(${f(off[0])}),${vs}.*q.${vA}-(${f(off[1])}))/vec2(${f(2 * w)},${f(2 * h)})+.5;vec4 dk=decal(${k}.,uv);c=mix(c,dk.rgb/max(dk.a,1e-4),dk.a);${dc.emit ? `emit=max(emit,dk.a*${f(dc.emit)});` : ''}}\n`;
    }
    mats += m + ' }\n';
  });
  if (cells.length > 256) throw new Error('atlas full');
  return { polys, scene, mats, cells };
}
