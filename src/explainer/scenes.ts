import {
  Ctx, Pt, W, H, INK, RED, PAPER,
  brush, line, curve, wash, dot, enso, inkText, seal, ridge, ss, hash,
} from './brush';
import {ExplainerProps, analyse, fmt, kvGiB, weightBytes, GIB, RAM_USABLE, UNIFIED_USABLE, PRECISIONS} from './math';

type Data = ReturnType<typeof analyse> & {props: ExplainerProps};
type Scene = {frames: number; draw: (ctx: Ctx, f: number, d: Data) => void};

const gb = (bytes: number) => bytes / 1e9;

/** A horizontal ink band with gently wobbling edges and an optional rounded right end. */
function band(xa: number, xb: number, y: number, h: number, seed: number, cap = true): Pt[] {
  const r = cap ? Math.min(h / 2, Math.max(0, xb - xa)) : 0, end = xb - r;
  const n = Math.max(2, Math.ceil((end - xa) / 40));
  const top: Pt[] = [], bot: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const x = xa + ((end - xa) * i) / n;
    top.push([x, y + (hash(seed + i) - 0.5) * 5]);
    bot.push([x, y + h + (hash(seed + 50 + i) - 0.5) * 5]);
  }
  const arc: Pt[] = [];
  for (let k = 0; k <= 12 && r > 0; k++) {
    const a = -Math.PI / 2 + (Math.PI * k) / 12;
    arc.push([end + Math.cos(a) * r, y + h / 2 + Math.sin(a) * (h / 2)]);
  }
  return [...top, ...arc, ...bot.reverse()];
}
const big = (n: number) => Math.round(n).toLocaleString('en-US');

function heading(ctx: Ctx, f: number, step: string, title: string) {
  inkText(ctx, step, 120, 108, 30, ss(0, 18, f), {color: RED, italic: true, alpha: 0.85});
  inkText(ctx, title, 120, 172, 60, ss(4, 40, f), {weight: 600});
  brush(ctx, curve([[118, 200], [400, 194], [700, 202], [880, 196]]), ss(20, 50, f), 7, {alpha: 0.7, seed: 41});
}

function caption(ctx: Ctx, f: number, s: string, start: number) {
  const p = ss(start, start + 40, f);
  if (!p) return;
  brush(ctx, curve([[W / 2 - 520, 1000], [W / 2, 996], [W / 2 + 520, 1002]]), p, 3, {alpha: 0.3, seed: 77});
  inkText(ctx, s, W / 2, 972, 36, p, {align: 'center', italic: true, alpha: 0.85});
}

/** End-of-scene: fresh paper sweeps across like a wet cloth. */
function wipe(ctx: Ctx, f: number, frames: number) {
  const p = ss(frames - 16, frames - 1, f);
  if (p > 0) wash(ctx, [[0, 0], [W, 0], [W, H], [0, H]], p, {color: PAPER, alpha: 1, seed: 999});
}

// ---------------------------------------------------------------- 1. Title
const title: Scene = {
  frames: 180,
  draw(ctx, f, d) {
    ridge(ctx, 1080, 200, ss(0, 110, f), 21, 0.08);
    ridge(ctx, 1080, 120, ss(15, 120, f), 33, 0.13);
    enso(ctx, W / 2, 430, 320, ss(0, 55, f), 40, {alpha: 0.88, seed: 8});
    dot(ctx, W / 2 + 360, 190, 34, ss(30, 60, f), {color: RED, alpha: 0.95});
    inkText(ctx, 'Can my computer run', W / 2, 380, 46, ss(30, 70, f), {align: 'center', italic: true, alpha: 0.75});
    inkText(ctx, d.props.model, W / 2, 490, d.props.model.length > 14 ? 64 : 84, ss(50, 100, f), {align: 'center', weight: 700});
    inkText(ctx, '— this AI? —', W / 2, 570, 40, ss(85, 115, f), {align: 'center', italic: true, alpha: 0.7});
    const p = d.props;
    const hw = p.gpuType === 'cpu' ? 'no dedicated GPU' : p.gpuType === 'apple' ? 'Apple unified memory' : `${p.gpuMake} GPU with ${p.vramGB} GB VRAM`;
    inkText(ctx, `Your machine:  ${p.ramGB} GB RAM,  ${hw}`, W / 2, 830, 38, ss(105, 145, f), {align: 'center'});
    seal(ctx, W / 2 + 300, 650, 90, 'AI', ss(150, 158, f));
  },
};

// ---------------------------------------------------------------- 2. Parameters
const params: Scene = {
  frames: 330,
  draw(ctx, f, d) {
    heading(ctx, f, 'Step 1', `What does “${d.short}” mean?`);
    // A small neural network, painted.
    const layers = [[0, 1, 2, 3], [0, 1, 2, 3, 4], [0, 1, 2]];
    const xs = [220, 440, 660];
    const pos = (l: number, i: number): Pt => [xs[l], 600 + (i - (layers[l].length - 1) / 2) * 105];
    let k = 0;
    for (let l = 0; l < 2; l++)
      layers[l].forEach(i => layers[l + 1].forEach(j => {
        const a = pos(l, i), b = pos(l + 1, j);
        const hi = l === 0 && i === 1 && j === 2;
        line(ctx, a, b, ss(30 + k * 1.3, 60 + k * 1.3, f), hi ? 5 : 2.2, {alpha: hi ? 0.95 : 0.35, color: hi ? RED : INK, seed: k, dry: 0});
        k++;
      }));
    layers.forEach((ls, l) => ls.forEach(i => { const [x, y] = pos(l, i); dot(ctx, x, y, 20, ss(10 + l * 12 + i * 3, 30 + l * 12 + i * 3, f), {seed: l * 10 + i}); }));
    const [ax, ay] = pos(0, 1), [bx, by] = pos(1, 2);
    const mx = (ax + bx) / 2, my = (ay + by) / 2;
    brush(ctx, curve([[mx + 10, my - 10], [mx + 60, my - 130], [mx + 140, my - 190]]), ss(95, 120, f), 3, {color: RED, seed: 3});
    inkText(ctx, 'one parameter', mx + 150, my - 205, 36, ss(110, 140, f), {color: RED, italic: true});
    inkText(ctx, '= one learned number', mx + 150, my - 160, 32, ss(120, 150, f), {color: RED, italic: true});

    // Mountains of model sizes — the user's model wears the red sun.
    const sizes = [...new Set([1, 7, 14, 70, +d.billions.toFixed(2)])].sort((a, b) => a - b);
    const maxB = Math.max(...sizes);
    const x0 = 860, span = 960, step = span / sizes.length;
    sizes.forEach((b, i) => {
      const p = ss(150 + i * 18, 215 + i * 18, f);
      const h = 60 + 440 * Math.sqrt(b / maxB);
      const cx = x0 + step * (i + 0.5), base = 860, hw = step * 0.62;
      const peak: Pt[] = curve([[cx - hw, base], [cx - hw * 0.45, base - h * 0.55], [cx - hw * 0.1, base - h * 0.95], [cx, base - h], [cx + hw * 0.2, base - h * 0.8], [cx + hw * 0.55, base - h * 0.4], [cx + hw, base]], 10);
      const mine = Math.abs(b - d.billions) < 1e-6;
      wash(ctx, peak, p, {alpha: mine ? 0.42 : 0.16 + i * 0.03, seed: 60 + i * 7, dir: 'up'});
      brush(ctx, peak, ss(0.2, 1, p), 2.4, {alpha: 0.6, seed: 90 + i});
      inkText(ctx, `${fmt(b, 2)}B`, cx, base + 50, mine ? 40 : 32, p, {align: 'center', color: mine ? RED : INK, weight: mine ? 700 : 500});
      if (mine) dot(ctx, cx, base - h - 70, 30, ss(220, 250, f), {color: RED});
    });
    brush(ctx, curve([[840, 862], [1300, 858], [1840, 864]]), ss(150, 220, f), 3, {alpha: 0.5, seed: 12});
    caption(ctx, f, `${d.short} ≈ ${big(d.params)} learned numbers — and every number needs memory.`, 240);
  },
};

// ---------------------------------------------------------------- 3. Bits & bytes
const bits: Scene = {
  frames: 300,
  draw(ctx, f) {
    heading(ctx, f, 'Step 2', 'Bits and bytes');
    const pattern = [0, 1, 0, 0, 0, 0, 0, 1];
    pattern.forEach((b, i) => {
      const cx = 220 + i * 110, cy = 360, p = ss(20 + i * 9, 45 + i * 9, f);
      if (b) dot(ctx, cx, cy, 36, p, {seed: i});
      else enso(ctx, cx, cy, 34, p, 7, {seed: i + 20, alpha: 0.8});
      inkText(ctx, String(b), cx, cy - 62, 30, p, {align: 'center', alpha: 0.7});
    });
    brush(ctx, curve([[190, 430], [200, 455], [600, 460], [1000, 455], [1010, 430]]), ss(100, 130, f), 4, {seed: 4});
    inkText(ctx, '8 bits  =  1 byte', 615, 520, 52, ss(115, 150, f), {align: 'center', weight: 700});
    inkText(ctx, 'each stone is a bit: empty = 0, filled = 1', 1120, 370, 32, ss(80, 120, f), {italic: true, alpha: 0.7});

    inkText(ctx, 'How many bits we spend on each learned number:', 140, 620, 34, ss(150, 180, f), {italic: true, alpha: 0.75});
    PRECISIONS.slice(0, 4).forEach((pr, i) => {
      const y = 690 + i * 72, p = ss(160 + i * 16, 205 + i * 16, f);
      inkText(ctx, pr.name, 140, y + 14, 36, p, {weight: 700, color: i === 1 ? RED : INK});
      brush(ctx, curve([[320, y], [320 + pr.bits * 18, y + 3 - hash(i) * 6], [320 + pr.bits * 36, y]]), p, 26, {seed: 30 + i, alpha: 0.82, color: i === 1 ? RED : INK});
      inkText(ctx, `${pr.bits} bits = ${pr.bits / 8} byte${pr.bits === 8 ? '' : 's'}`, 360 + pr.bits * 36, y + 12, 32, p);
    });
    caption(ctx, f, 'Fewer bits per number → less memory, slightly less precision.', 225);
  },
};

// ---------------------------------------------------------------- 4. The maths
const maths: Scene = {
  frames: 360,
  draw(ctx, f, d) {
    heading(ctx, f, 'Step 3', 'The maths: parameters → gigabytes');
    inkText(ctx, 'Memory  =  Parameters × Bits per number ÷ 8', W / 2, 320, 60, ss(15, 75, f), {align: 'center', weight: 600});
    brush(ctx, curve([[1270, 335], [1310, 345], [1350, 335]]), ss(70, 85, f), 4, {color: RED, seed: 2});
    inkText(ctx, '(÷ 8 turns bits into bytes)', 1420, 380, 28, ss(80, 105, f), {color: RED, italic: true});
    inkText(ctx, `=  ${big(d.params)}  ×  16  ÷  8`, W / 2, 450, 52, ss(100, 150, f), {align: 'center', alpha: 0.75});
    inkText(ctx, `=  ${big(weightBytes(d.params, 16))}  bytes`, W / 2, 545, 52, ss(160, 205, f), {align: 'center', alpha: 0.75});
    const bytes = weightBytes(d.params, 16);
    enso(ctx, W / 2, 735, 150, ss(215, 260, f), 22, {color: RED, alpha: 0.85, seed: 33, start: -1.6});
    inkText(ctx, `${fmt(gb(bytes), gb(bytes) < 10 ? 2 : 1)} GB`, W / 2, 770, 110, ss(225, 270, f), {align: 'center', weight: 700});
    inkText(ctx, `≈ ${fmt(bytes / GIB, 1)} GiB of BF16 weights`, W / 2, 935, 34, ss(265, 300, f), {align: 'center', italic: true, alpha: 0.8});
    inkText(ctx, 'weights only —', 1250, 700, 34, ss(285, 315, f), {italic: true, color: RED});
    inkText(ctx, 'running needs more', 1250, 745, 34, ss(295, 325, f), {italic: true, color: RED});
  },
};

// ---------------------------------------------------------------- 5. Quantization
const quant: Scene = {
  frames: 300,
  draw(ctx, f, d) {
    heading(ctx, f, 'Step 4', 'Same model, smaller sizes — quantization');
    const max = gb(weightBytes(d.params, 32));
    PRECISIONS.forEach((pr, i) => {
      const y = 270 + i * 128, p = ss(25 + i * 32, 95 + i * 32, f);
      const v = gb(weightBytes(d.params, pr.bits)), w = 1100 * (v / max);
      inkText(ctx, pr.name, 140, y + 62, 42, ss(15 + i * 32, 45 + i * 32, f), {weight: 700, color: pr.bits === 16 ? RED : INK});
      wash(ctx, band(330, 330 + w, y + 12, 76, 210 + i), p, {alpha: 0.14 + (4 - i) * 0.07, seed: 200 + i * 9, color: pr.bits === 16 ? RED : INK});
      inkText(ctx, `${fmt(v, v < 10 ? 2 : 1)} GB`, 360 + Math.max(w, 30), y + 62, 40, ss(70 + i * 32, 100 + i * 32, f), {weight: 600});
    });
    caption(ctx, f, 'Fewer bits per number is like a looser sketch of the same painting: smaller, a little less exact.', 210);
  },
};

// ---------------------------------------------------------------- 6. Hardware
function chip(ctx: Ctx, x: number, y: number, s: number, p: number, seed: number) {
  const sq: Pt[] = [[x, y], [x + s, y], [x + s, y + s], [x, y + s], [x, y + 2]];
  brush(ctx, resample5(sq), p, 6, {seed});
  for (let i = 1; i < 4; i++) {
    const o = (s * i) / 4, q = ss(0.5, 1, p);
    line(ctx, [x + o, y - 18], [x + o, y], q, 3, {seed: seed + i, dry: 0});
    line(ctx, [x + o, y + s], [x + o, y + s + 18], q, 3, {seed: seed + i + 9, dry: 0});
    line(ctx, [x - 18, y + o], [x, y + o], q, 3, {seed: seed + i + 19, dry: 0});
    line(ctx, [x + s, y + o], [x + s + 18, y + o], q, 3, {seed: seed + i + 29, dry: 0});
  }
}
const resample5 = (pts: Pt[]) => {
  const out: Pt[] = [];
  for (let i = 1; i < pts.length; i++) for (let k = 0; k < 20; k++) out.push([pts[i - 1][0] + ((pts[i][0] - pts[i - 1][0]) * k) / 20, pts[i - 1][1] + ((pts[i][1] - pts[i - 1][1]) * k) / 20]);
  out.push(pts[pts.length - 1]);
  return out;
};

const hardware: Scene = {
  frames: 360,
  draw(ctx, f) {
    heading(ctx, f, 'Step 5', 'Where does the model live?');
    // CPU
    let p = ss(15, 60, f);
    chip(ctx, 190, 280, 130, p, 1);
    inkText(ctx, 'CPU', 255, 360, 38, p, {align: 'center', weight: 700});
    inkText(ctx, 'the thinker', 255, 490, 30, p, {align: 'center', italic: true, alpha: 0.75});
    // RAM stick
    p = ss(40, 90, f);
    brush(ctx, resample5([[520, 300], [880, 300], [880, 400], [520, 400], [520, 302]]), p, 6, {seed: 2});
    for (let i = 0; i < 5; i++) wash(ctx, [[540 + i * 68, 320], [590 + i * 68, 320], [590 + i * 68, 370], [540 + i * 68, 370]], ss(0.3, 1, p), {alpha: 0.5, seed: 300 + i});
    for (let i = 0; i < 14; i++) line(ctx, [535 + i * 25, 400], [535 + i * 25, 418], ss(0.6, 1, p), 3, {seed: 50 + i, dry: 0});
    inkText(ctx, 'RAM', 700, 470, 38, p, {align: 'center', weight: 700, color: INK});
    inkText(ctx, 'the big main desk', 700, 510, 30, p, {align: 'center', italic: true, alpha: 0.75});
    // GPU card
    p = ss(70, 120, f);
    brush(ctx, resample5([[1000, 270], [1400, 270], [1400, 420], [1000, 420], [1000, 272]]), p, 6, {seed: 3});
    enso(ctx, 1110, 345, 52, ss(0.3, 1, p), 6, {seed: 4});
    for (let a = 0; a < 5; a++) {
      const t = (a / 5) * Math.PI * 2;
      brush(ctx, curve([[1110, 345], [1110 + Math.cos(t) * 26 - Math.sin(t) * 12, 345 + Math.sin(t) * 26 + Math.cos(t) * 12], [1110 + Math.cos(t + 0.5) * 46, 345 + Math.sin(t + 0.5) * 46]]), ss(0.5, 1, p), 4, {seed: 60 + a});
    }
    for (let i = 0; i < 4; i++) wash(ctx, [[1210 + i * 45, 300], [1245 + i * 45, 300], [1245 + i * 45, 390], [1210 + i * 45, 390]], ss(0.5, 1, p), {alpha: 0.55, seed: 400 + i, color: RED});
    inkText(ctx, 'GPU + VRAM', 1200, 470, 38, p, {align: 'center', weight: 700, color: RED});
    inkText(ctx, 'fast helper with its own small desk', 1200, 510, 30, p, {align: 'center', italic: true, alpha: 0.75});
    inkText(ctx, '(red = VRAM)', 1520, 350, 28, p, {italic: true, color: RED});

    // Three ways to run
    const ways: [string, string, number][] = [
      ['A — CPU only', 'all in RAM — works, slow', 0],
      ['B — GPU', 'all in VRAM — fastest, must fit', 1],
      ['C — Hybrid', 'split VRAM + RAM — in between', 0.45],
    ];
    ways.forEach(([n, s, v], i) => {
      const x = 150 + i * 570, q = ss(150 + i * 45, 210 + i * 45, f);
      inkText(ctx, n, x, 650, 44, q, {weight: 700, color: i === 1 ? RED : INK});
      inkText(ctx, s, x, 700, 30, q, {italic: true, alpha: 0.8});
      const bw = 460;
      if (v > 0) wash(ctx, band(x + 4, x + bw * v, 750, 70, 500 + i, v === 1), q, {color: RED, alpha: 0.5, seed: 500 + i});
      if (v < 1) wash(ctx, band(x + 4 + bw * v, x + bw, 750, 70, 520 + i), ss(0.3, 1, q), {alpha: 0.32, seed: 520 + i});
      brush(ctx, resample5([[x - 4, 742], [x + bw + 4, 742], [x + bw + 4, 828], [x - 4, 828], [x - 4, 744]]), q, 3, {alpha: 0.5, seed: 540 + i, dry: 0.4});
    });
    caption(ctx, f, 'A GPU is not required — it just makes things much faster when the model fits.', 290);
  },
};

// ---------------------------------------------------------------- 7. KV cache
const kv: Scene = {
  frames: 300,
  draw(ctx, f, d) {
    heading(ctx, f, 'Step 6', 'Memory while chatting: the KV cache');
    // Open book.
    const p = ss(10, 70, f);
    brush(ctx, curve([[520, 380], [400, 350], [260, 360], [180, 390]]), p, 6, {seed: 1});
    brush(ctx, curve([[520, 380], [640, 350], [780, 360], [860, 390]]), p, 6, {seed: 2});
    brush(ctx, curve([[180, 390], [180, 560], [180, 640]]), p, 5, {seed: 3});
    brush(ctx, curve([[860, 390], [860, 560], [860, 640]]), p, 5, {seed: 4});
    brush(ctx, curve([[180, 640], [300, 615], [440, 625], [520, 660]]), p, 6, {seed: 5});
    brush(ctx, curve([[860, 640], [740, 615], [600, 625], [520, 660]]), p, 6, {seed: 6});
    brush(ctx, curve([[520, 380], [520, 520], [520, 660]]), p, 4, {seed: 7});
    for (let i = 0; i < 6; i++) {
      line(ctx, [220, 420 + i * 36], [470 - hash(i) * 60, 420 + i * 36], ss(40 + i * 4, 70 + i * 4, f), 3, {alpha: 0.4, seed: 70 + i, dry: 0.3});
      line(ctx, [570, 420 + i * 36], [820 - hash(i + 9) * 60, 420 + i * 36], ss(44 + i * 4, 74 + i * 4, f), 3, {alpha: 0.4, seed: 90 + i, dry: 0.3});
    }
    // Notes scribbled in red.
    brush(ctx, curve([[860, 470], [910, 455], [960, 480], [1000, 460]]), ss(100, 130, f), 4, {color: RED, seed: 9});
    brush(ctx, curve([[860, 520], [920, 505], [980, 530]]), ss(110, 140, f), 4, {color: RED, seed: 10});

    const items: [string, string, string][] = [
      ['Model weights', 'the book itself', INK],
      ['Context length', 'how many pages are open', INK],
      ['KV cache', 'your working notes', RED],
    ];
    items.forEach(([a, b, col], i) => {
      const q = ss(80 + i * 30, 120 + i * 30, f), y = 760 + i * 62;
      dot(ctx, 200, y - 12, 9, q, {color: col});
      inkText(ctx, a, 230, y, 38, q, {weight: 700, color: col});
      inkText(ctx, `= ${b}`, 540, y, 34, q, {italic: true});
    });

    // Unrolling scrolls: your context and 4× context.
    const ctxs = [d.props.contextTokens, d.props.contextTokens * 4];
    const kvs = ctxs.map(c => kvGiB(d.params, c));
    ctxs.forEach((c, i) => {
      const x = 1180 + i * 330, q = ss(150 + i * 40, 230 + i * 40, f);
      const len = 120 + 460 * Math.min(1, kvs[i] / kvs[1]);
      line(ctx, [x - 20, 290], [x + 200, 290], ss(0, 0.2, q), 12, {seed: 600 + i});
      wash(ctx, [[x, 296], [x + 180, 296], [x + 180, 296 + len * q], [x, 296 + len * q]], 1, {alpha: 0.1, seed: 610 + i, dir: 'up'});
      brush(ctx, resample5([[x, 296], [x, 296 + len * q]]), 1, 2.5, {alpha: 0.6, seed: 620 + i});
      brush(ctx, resample5([[x + 180, 296], [x + 180, 296 + len * q]]), 1, 2.5, {alpha: 0.6, seed: 630 + i});
      for (let k = 0; k < Math.floor((len * q - 30) / 34); k++)
        line(ctx, [x + 24, 330 + k * 34], [x + 150 - hash(k + i * 50) * 50, 330 + k * 34], 1, 3, {color: RED, alpha: 0.55, seed: 700 + k + i * 50, dry: 0.3});
      line(ctx, [x - 20, 300 + len * q], [x + 200, 300 + len * q], ss(0, 0.2, q), 12, {seed: 640 + i});
      inkText(ctx, `${big(c)} tokens`, x + 90, 250, 30, q, {align: 'center', weight: 600});
      inkText(ctx, `≈ ${fmt(kvs[i], 2)} GiB`, x + 90, 340 + len, 34, ss(0.7, 1, q), {align: 'center', color: RED, weight: 700});
    });
    caption(ctx, f, 'Longer conversations keep more pages open — and need more notes (memory).', 240);
  },
};

// ---------------------------------------------------------------- 8. Your computer
function vessel(ctx: Ctx, x: number, w: number, h: number, base: number, p: number, seed: number) {
  const pts = curve([[x - 12, base - h - 18], [x, base - h], [x + 2, base - h * 0.5], [x + 10, base - 8], [x + w / 2, base + 6], [x + w - 10, base - 8], [x + w - 2, base - h * 0.5], [x + w, base - h], [x + w + 12, base - h - 18]], 8);
  brush(ctx, pts, p, 8, {seed, dry: 0.3});
}
function fill(ctx: Ctx, x: number, w: number, level: number, base: number, color: string, alpha: number, seed: number, t: number) {
  if (level <= 1) return;
  const top: Pt[] = [];
  for (let i = 0; i <= 12; i++) top.push([x + 6 + ((w - 12) * i) / 12, base - level + Math.sin(i * 1.3 + t * 0.15) * 4 * (hash(seed + i) + 0.3)]);
  wash(ctx, [...top, [x + w - 10, base - 6], [x + w / 2, base + 2], [x + 10, base - 6]], 1, {color, alpha, seed});
}

const yours: Scene = {
  frames: 420,
  draw(ctx, f, d) {
    heading(ctx, f, 'Step 7', 'Will it fit on your computer?');
    const P = d.props;
    const base = 860, maxH = 460;
    const caps: {label: string; cap: number; color: string}[] = [];
    if (P.gpuType === 'dedicated') caps.push({label: `VRAM ${P.vramGB} GB`, cap: P.vramGB, color: RED});
    if (P.gpuType === 'apple') caps.push({label: `Unified ${P.ramGB} GB`, cap: P.ramGB * UNIFIED_USABLE, color: INK});
    else caps.push({label: `RAM ${P.ramGB} GB`, cap: P.ramGB * RAM_USABLE, color: INK});
    const scaleCap = Math.max(...caps.map(c => c.cap));
    const bf = d.bf16.need.total, target = d.best ? d.best.need.total : d.rows[d.rows.length - 1].need.total;
    // Pour BF16, then let it settle to the recommended precision.
    const pour = ss(40, 170, f), settle = ss(220, 290, f);
    let amount = bf * pour + (target - bf) * settle;
    const showing = settle > 0.5 ? (d.best ?? d.rows[d.rows.length - 1]).precision.name : 'BF16';

    let x = (1150 - (caps.length * 400 - 100)) / 2 + 60;
    caps.forEach((c, i) => {
      const w = 300, h = Math.max(70, (maxH * c.cap) / scaleCap);
      const take = Math.min(amount, c.cap);
      amount -= take;
      fill(ctx, x, w, (h * take) / c.cap, base, c.color, c.color === RED ? 0.5 : 0.38, 800 + i, f);
      vessel(ctx, x, w, h, base, ss(10 + i * 15, 50 + i * 15, f), 810 + i);
      inkText(ctx, c.label, x + w / 2, base + 60, 36, ss(20 + i * 15, 60 + i * 15, f), {align: 'center', weight: 700, color: c.color});
      inkText(ctx, `${fmt(take, 1)} GiB used`, x + w / 2, base + 102, 28, ss(60, 100, f), {align: 'center', italic: true, alpha: 0.75});
      x += 400;
    });
    // Pouring stream from the brush-tip at top.
    if (pour > 0 && pour < 1) brush(ctx, resample5([[290, 230], [290, 240 + 300 * pour]]), 1, 10, {alpha: 0.6, seed: 870, dry: 0.5});
    // Overflow puddle.
    if (amount > 0.05) {
      const s = Math.min(1, amount / bf + 0.3);
      wash(ctx, curve([[x - 60, base - 10], [x + 80, base - 40 * s], [x + 260 * s + 60, base - 20], [x + 300 * s + 80, base + 10], [x, base + 20]], 10), ss(80, 170, f), {color: RED, alpha: 0.45, seed: 880});
      inkText(ctx, `overflows by ${fmt(amount, 1)} GiB`, x + 40, base - 90, 34, ss(130, 160, f), {color: RED, italic: true, weight: 700});
    }
    inkText(ctx, `${d.short} in ${showing} needs ≈ ${fmt(bf * (1 - settle) + target * settle, 1)} GiB`, 200, 290, 40, ss(40, 80, f), {weight: 600});
    inkText(ctx, '(weights + 20% runtime + KV cache)', 200, 335, 28, ss(60, 100, f), {italic: true, alpha: 0.7});

    // Verdict list on the right.
    const lx = 1260;
    inkText(ctx, 'Every precision:', lx, 430, 36, ss(250, 280, f), {italic: true, alpha: 0.8});
    d.rows.forEach((r, i) => {
      const q = ss(270 + i * 20, 310 + i * 20, f), y = 500 + i * 82;
      inkText(ctx, r.precision.name, lx, y, 36, q, {weight: 700});
      inkText(ctx, `${fmt(r.need.total, 1)} GiB`, lx + 130, y, 32, q);
      if (r.verdict.ok) brush(ctx, curve([[lx + 330, y - 14], [lx + 345, y], [lx + 380, y - 36]]), q, 6, {seed: 900 + i});
      else {
        line(ctx, [lx + 330, y - 36], [lx + 370, y], q, 6, {color: RED, seed: 920 + i});
        line(ctx, [lx + 370, y - 36], [lx + 330, y], ss(0.4, 1, q), 6, {color: RED, seed: 940 + i});
      }
      inkText(ctx, r.verdict.text, lx + 130, y + 32, 22, q, {italic: true, alpha: 0.7, color: r.verdict.ok ? INK : RED});
    });
  },
};

// ---------------------------------------------------------------- 9. Recommendation
const verdictScene: Scene = {
  frames: 300,
  draw(ctx, f, d) {
    ridge(ctx, 1080, 190, ss(100, 230, f), 51, 0.08);
    ridge(ctx, 1080, 100, ss(120, 240, f), 63, 0.13);
    dot(ctx, 1640, 250, 46, ss(140, 180, f), {color: RED});
    // Hanging scroll unrolls.
    const u = ss(0, 55, f), top = 110, h = 700 * u, x = W / 2 - 430, w = 860;
    line(ctx, [x - 40, top], [x + w + 40, top], ss(0, 15, f), 16, {seed: 1});
    wash(ctx, [[x, top + 6], [x + w, top + 6], [x + w, top + 6 + h], [x, top + 6 + h]], 1, {color: '#f7f3ea', alpha: 0.95, seed: 2});
    line(ctx, [x - 40, top + 10 + h], [x + w + 40, top + 10 + h], ss(0, 15, f), 16, {seed: 3});
    inkText(ctx, 'Recommendation', W / 2, 220, 40, ss(55, 80, f), {align: 'center', italic: true, color: RED});
    const b = d.best;
    if (b) {
      inkText(ctx, d.props.model, W / 2, 320, 64, ss(65, 110, f), {align: 'center', weight: 700});
      inkText(ctx, `in ${b.precision.name}`, W / 2, 395, 52, ss(90, 125, f), {align: 'center', weight: 600, color: RED});
      inkText(ctx, `needs about ${fmt(b.need.total, 1)} GiB`, W / 2, 490, 42, ss(115, 150, f), {align: 'center'});
      inkText(ctx, b.verdict.text, W / 2, 560, 40, ss(140, 175, f), {align: 'center', italic: true});
      const i = d.rows.indexOf(b);
      const msg = i === 0 ? 'Even full precision fits — enjoy!' : `${d.rows.slice(0, i).map(r => r.precision.name).join(', ')} would be too large here.`;
      inkText(ctx, msg, W / 2, 640, 30, ss(165, 200, f), {align: 'center', alpha: 0.7});
      if (i >= 3) inkText(ctx, 'Very low bits can reduce answer quality — a smaller model may do better.', W / 2, 690, 26, ss(185, 215, f), {align: 'center', italic: true, alpha: 0.65});
      seal(ctx, x + w - 80, top + 640, 100, 'FITS', ss(210, 218, f));
    } else {
      inkText(ctx, d.props.model, W / 2, 330, 64, ss(65, 110, f), {align: 'center', weight: 700});
      inkText(ctx, 'is too large for this computer', W / 2, 420, 46, ss(100, 140, f), {align: 'center', color: RED});
      inkText(ctx, 'Try a smaller model, add memory,', W / 2, 530, 38, ss(140, 175, f), {align: 'center', italic: true});
      inkText(ctx, 'or use a hosted (cloud) version.', W / 2, 585, 38, ss(155, 190, f), {align: 'center', italic: true});
      seal(ctx, x + w - 80, top + 640, 100, 'NO', ss(210, 218, f));
    }
    inkText(ctx, 'Parameters × bits ÷ 8  +  runtime  +  KV cache   vs.   your RAM / VRAM', W / 2, 960, 32, ss(230, 270, f), {align: 'center', italic: true, alpha: 0.8});
    inkText(ctx, 'estimates for planning, not guarantees', W / 2, 1010, 24, ss(250, 280, f), {align: 'center', alpha: 0.55});
  },
};

export const SCENES: Scene[] = [title, params, bits, maths, quant, hardware, kv, yours, verdictScene];
export const TOTAL_FRAMES = SCENES.reduce((s, x) => s + x.frames, 0);

export function paintFrame(ctx: Ctx, frame: number, d: Data, paperFn: (c: Ctx) => void) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  paperFn(ctx);
  let f = frame, i = 0;
  while (i < SCENES.length - 1 && f >= SCENES[i].frames) { f -= SCENES[i].frames; i++; }
  const s = SCENES[i];
  s.draw(ctx, f, d);
  if (i < SCENES.length - 1) wipe(ctx, f, s.frames);
}
