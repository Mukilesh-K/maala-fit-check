export type Pt = [number, number];
export type Ctx = CanvasRenderingContext2D;

export const W = 1920;
export const H = 1080;
export const PAPER = '#eeeae0';
export const INK = '#1b1a18';
export const RED = '#b8352a';
export const SERIF = '"Baskerville", "Iowan Old Style", "Georgia", "Times New Roman", serif';

export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const ease = (v: number) => {
  const x = clamp(v);
  return x * x * (3 - 2 * x);
};
export const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
};
/** 0→1 as frame goes from a to b, eased. */
export const ss = (a: number, b: number, x: number) => ease((x - a) / (b - a));

/** Catmull-Rom resampling so hand-placed control points become an organic brush path. */
export function curve(ctrl: Pt[], step = 6): Pt[] {
  if (ctrl.length < 3) return resample(ctrl, step);
  const out: Pt[] = [];
  const p = [ctrl[0], ...ctrl, ctrl[ctrl.length - 1]];
  for (let i = 1; i < p.length - 2; i++) {
    const [p0, p1, p2, p3] = [p[i - 1], p[i], p[i + 1], p[i + 2]];
    const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(ctrl[ctrl.length - 1]);
  return out;
}

export function resample(pts: Pt[], step = 6): Pt[] {
  const out: Pt[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const [a, b] = [pts[i - 1], pts[i]];
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let k = 1; k <= n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  return out;
}

/**
 * A tapered, bristled brush stroke drawn progressively along `path`.
 * Width swells in the middle and lifts off at the ends; a few dry bristles skip randomly.
 */
export function brush(ctx: Ctx, path: Pt[], progress: number, width: number, opts: {color?: string; alpha?: number; seed?: number; dry?: number} = {}) {
  const {color = INK, alpha = 0.92, seed = 1, dry = 0.25} = opts;
  const pts = path.length > 2 ? path : resample(path, 5);
  const n = Math.floor((pts.length - 1) * clamp(progress));
  if (n < 1) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const total = pts.length - 1;
  for (let i = 1; i <= n; i++) {
    const u = i / total;
    const taper = Math.pow(Math.sin(Math.PI * clamp(u * 0.92 + 0.06)), 0.55);
    const w = width * taper * (0.82 + 0.3 * hash(seed + i * 0.37));
    ctx.globalAlpha = alpha * (0.85 + 0.15 * hash(seed * 3 + i));
    ctx.lineWidth = Math.max(0.8, w);
    ctx.beginPath();
    ctx.moveTo(pts[i - 1][0], pts[i - 1][1]);
    ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
  }
  // Dry bristles: thin offset hairs that break up near the edges.
  if (dry > 0 && width > 4) {
    for (let b = 0; b < 4; b++) {
      const off = (hash(seed + b * 13.1) - 0.5) * width * 1.1;
      ctx.lineWidth = Math.max(0.7, width * 0.08);
      ctx.globalAlpha = alpha * 0.45;
      ctx.beginPath();
      let drawing = false;
      for (let i = 1; i <= n; i++) {
        const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
        const len = Math.hypot(x1 - x0, y1 - y0) || 1;
        const nx = -(y1 - y0) / len, ny = (x1 - x0) / len;
        const gap = hash(seed + b * 101 + Math.floor(i / 3)) < dry;
        if (gap) { drawing = false; continue; }
        if (!drawing) { ctx.moveTo(x0 + nx * off, y0 + ny * off); drawing = true; }
        ctx.lineTo(x1 + nx * off, y1 + ny * off);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** Straight brush line helper. */
export const line = (ctx: Ctx, a: Pt, b: Pt, p: number, w: number, o: Parameters<typeof brush>[4] = {}) =>
  brush(ctx, resample([a, b], 5), p, w, o);

/** Polygon wash that spreads in from the left (or bottom) with a noisy, darker wet edge and granulation. */
export function wash(ctx: Ctx, poly: Pt[], progress: number, opts: {color?: string; alpha?: number; seed?: number; dir?: 'right' | 'up'} = {}) {
  const {color = INK, alpha = 0.3, seed = 7, dir = 'right'} = opts;
  if (progress <= 0) return;
  const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const edge: Pt[] = [];
  const jitter = 10 + (1 - progress) * 14;
  if (dir === 'right') {
    const ex = minX - 30 + progress * (maxX - minX + 60);
    for (let y = minY - 20, i = 0; y <= maxY + 20; y += 10, i++) edge.push([ex + (hash(seed + i * 1.71) - 0.5) * jitter * 2, y]);
  } else {
    const ey = maxY + 30 - progress * (maxY - minY + 60);
    for (let x = minX - 20, i = 0; x <= maxX + 20; x += 10, i++) edge.push([x, ey + (hash(seed + i * 1.71) - 0.5) * jitter * 2]);
  }
  ctx.save();
  ctx.beginPath();
  poly.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  ctx.closePath();
  ctx.clip();
  ctx.beginPath();
  edge.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  if (dir === 'right') { ctx.lineTo(minX - 50, maxY + 40); ctx.lineTo(minX - 50, minY - 40); }
  else { ctx.lineTo(maxX + 40, maxY + 50); ctx.lineTo(minX - 40, maxY + 50); }
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  ctx.fillRect(minX - 60, minY - 60, maxX - minX + 120, maxY - minY + 120);
  // Pooled pigment at the advancing wet edge.
  if (progress < 0.999) {
    ctx.globalAlpha = Math.min(0.4, alpha * 0.55);
    ctx.strokeStyle = color;
    ctx.lineWidth = 9;
    ctx.beginPath();
    edge.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.stroke();
  }
  // Granulation fixed in space.
  ctx.globalAlpha = alpha * 0.35;
  const area = (maxX - minX) * (maxY - minY);
  const count = Math.min(220, Math.floor(area / 900));
  for (let i = 0; i < count; i++) {
    ctx.fillRect(minX + hash(seed + 100 + i) * (maxX - minX), minY + hash(seed + 300 + i) * (maxY - minY), 1 + hash(i + seed) * 2.5, 1 + hash(i + 9) * 5);
  }
  ctx.restore();
}

/** A wobbly ink dot / filled circle. */
export function dot(ctx: Ctx, cx: number, cy: number, r: number, p: number, opts: {color?: string; alpha?: number; seed?: number} = {}) {
  const {color = INK, alpha = 0.9, seed = 3} = opts;
  if (p <= 0) return;
  const rr = r * (p < 0.8 ? 1.1 * ease(p / 0.8) : 1 + 0.1 * (1 - (p - 0.8) / 0.2));
  ctx.save();
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha * 0.18;
  ctx.beginPath(); ctx.arc(cx, cy, rr * 1.3, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    const k = 1 + (hash(seed + i * 3.7) - 0.5) * 0.12;
    const x = cx + Math.cos(a) * rr * k, y = cy + Math.sin(a) * rr * k;
    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  }
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

/** Ensō — a single brushed circle that does not quite close. */
export function enso(ctx: Ctx, cx: number, cy: number, r: number, p: number, width: number, opts: {color?: string; alpha?: number; seed?: number; start?: number} = {}) {
  const {start = -2.2, seed = 5} = opts;
  const pts: Pt[] = [];
  const sweep = Math.PI * 1.88;
  for (let i = 0; i <= 120; i++) {
    const a = start + (i / 120) * sweep;
    const k = 1 + (hash(seed + i * 0.13) - 0.5) * 0.025 + (i / 120) * 0.03;
    pts.push([cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k]);
  }
  brush(ctx, pts, p, width, {...opts, dry: 0.35});
}

/** Calligraphic text: characters bleed in one after another. */
export function inkText(ctx: Ctx, s: string, x: number, y: number, size: number, p: number,
  opts: {color?: string; alpha?: number; align?: 'left' | 'center' | 'right'; italic?: boolean; weight?: number; font?: string} = {}) {
  if (p <= 0 || !s) return;
  const {color = INK, alpha = 0.92, align = 'left', italic = false, weight = 500, font = SERIF} = opts;
  ctx.save();
  ctx.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${font}`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = color;
  const chars = [...s];
  const widths = chars.map(c => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0);
  let cx = align === 'left' ? x : align === 'center' ? x - total / 2 : x - total;
  const spread = Math.max(1.5, chars.length * 0.15);
  chars.forEach((ch, i) => {
    const cp = clamp((p * (chars.length + spread) - i) / spread);
    if (cp > 0 && ch !== ' ') {
      // A soft bleed halo, then the crisp glyph.
      ctx.globalAlpha = alpha * cp * 0.22;
      ctx.shadowColor = color;
      ctx.shadowBlur = size * 0.18 * (1.4 - cp);
      ctx.fillText(ch, cx, y);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = alpha * ease(cp);
      ctx.fillText(ch, cx, y + (1 - ease(cp)) * size * 0.06);
    }
    cx += widths[i];
  });
  ctx.restore();
}

/** Red carved seal stamp with a short label. */
export function seal(ctx: Ctx, x: number, y: number, size: number, label: string, p: number, seed = 11) {
  if (p <= 0) return;
  const s = 1.25 - 0.25 * ease(p);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((hash(seed) - 0.5) * 0.08);
  ctx.scale(s, s);
  ctx.globalAlpha = clamp(p * 1.6) * 0.92;
  ctx.fillStyle = RED;
  ctx.beginPath();
  ctx.roundRect(-size / 2, -size / 2, size, size, size * 0.08);
  ctx.fill();
  ctx.fillStyle = PAPER;
  ctx.font = `700 ${size * (label.length > 3 ? 0.24 : 0.34)}px ${SERIF}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 0, 2);
  ctx.strokeStyle = PAPER; ctx.lineWidth = size * 0.035;
  ctx.strokeRect(-size * 0.39, -size * 0.39, size * 0.78, size * 0.78);
  // Uneven ink pickup: paper flecks showing through the stamp.
  for (let i = 0; i < 40; i++) {
    ctx.globalAlpha = 0.5 * hash(seed + i);
    ctx.fillRect((hash(seed + i * 2) - 0.5) * size, (hash(seed + i * 3) - 0.5) * size, 1 + hash(i) * 3, 1 + hash(i + 1) * 3);
  }
  ctx.restore();
}

/** Simple distant mountain range wash along the bottom. */
export function ridge(ctx: Ctx, baseY: number, amp: number, p: number, seed: number, alpha: number, x0 = 0, x1 = W) {
  const pts: Pt[] = [];
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    pts.push([x, baseY - amp * (0.35 + 0.65 * hash(seed + i * 2.3))]);
  }
  const top = curve(pts, 12);
  wash(ctx, [...top, [x1, H + 10], [x0, H + 10]], p, {alpha, seed, dir: 'up'});
  if (p > 0.3) brush(ctx, top, ss(0.3, 1, p), 2.5, {alpha: alpha * 1.4, seed: seed + 3, dry: 0.4});
}

let paperCache: HTMLCanvasElement | null = null;
export function paper(ctx: Ctx) {
  if (!paperCache) {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d')!;
    g.fillStyle = PAPER; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 2600; i++) {
      const a = 0.018 + hash(i + 901) * 0.03;
      g.fillStyle = i % 4 === 0 ? `rgba(90,76,56,${a})` : `rgba(255,255,255,${a})`;
      g.fillRect(hash(i * 1.31 + 19) * W, hash(i * 2.17 + 83) * H, 0.6 + hash(i + 77) * 1.4, 0.6 + hash(i + 177) * 2.2);
    }
    g.globalAlpha = 0.04; g.strokeStyle = '#8d806a'; g.lineWidth = 0.7;
    for (let i = 0; i < 90; i++) {
      const x = hash(i + 1100) * W, y = hash(i + 1200) * H;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + 5 + hash(i + 1300) * 17, y + (hash(i + 1400) - 0.5) * 2); g.stroke();
    }
    // Soft vignette like an aged scroll.
    const v = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.05);
    v.addColorStop(0, 'rgba(120,100,70,0)'); v.addColorStop(1, 'rgba(120,100,70,0.16)');
    g.globalAlpha = 1; g.fillStyle = v; g.fillRect(0, 0, W, H);
    paperCache = c;
  }
  ctx.drawImage(paperCache, 0, 0);
}
