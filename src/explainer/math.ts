export type GpuType = 'dedicated' | 'cpu' | 'apple';

export type ExplainerProps = {
  model: string;
  ramGB: number;
  vramGB: number;
  gpuType: GpuType;
  gpuMake: string;
  contextTokens: number;
};

export const GIB = 2 ** 30;
export const OVERHEAD = 0.2;
export const RAM_USABLE = 0.85; // OS + apps keep some RAM busy
export const UNIFIED_USABLE = 0.75; // macOS lets the GPU use roughly 3/4 of unified memory

export const PRECISIONS = [
  {name: 'FP32', bits: 32},
  {name: 'BF16', bits: 16},
  {name: 'INT8', bits: 8},
  {name: 'INT4', bits: 4},
  {name: 'INT2', bits: 2},
] as const;
export type Precision = (typeof PRECISIONS)[number];

export function parseModel(name: string): {params: number; short: string} | null {
  const m = name.match(/(\d+(?:\.\d+)?)\s*([bBmMtT])(?![a-zA-Z])/);
  if (!m) return null;
  const mult = {b: 1e9, m: 1e6, t: 1e12}[m[2].toLowerCase() as 'b' | 'm' | 't'];
  return {params: parseFloat(m[1]) * mult, short: m[1] + m[2].toUpperCase()};
}

export const weightBytes = (params: number, bits: number) => (params * bits) / 8;

// Rough heuristic: ~0.125 MiB per token for a 7B grouped-query-attention model, growing gently with size.
export const kvGiB = (params: number, ctx: number) => (0.125 * Math.sqrt(params / 7e9) * ctx) / 1024;

export function need(params: number, bits: number, ctx: number) {
  const weights = weightBytes(params, bits) / GIB;
  const overhead = weights * OVERHEAD;
  const kv = kvGiB(params, ctx);
  return {weights, overhead, kv, total: weights + overhead + kv};
}

export type Verdict = {kind: 'gpu' | 'hybrid' | 'cpu' | 'unified' | 'tight' | 'no'; ok: boolean; text: string};

export function verdict(total: number, p: ExplainerProps): Verdict {
  const {ramGB: ram, vramGB: vram, gpuType} = p;
  if (gpuType === 'apple') {
    const usable = ram * UNIFIED_USABLE;
    if (total <= usable * 0.9) return {kind: 'unified', ok: true, text: 'Runs in unified memory — fast'};
    if (total <= usable) return {kind: 'tight', ok: true, text: 'Just fits — close other apps'};
    return {kind: 'no', ok: false, text: 'Too big for this memory'};
  }
  if (gpuType === 'dedicated' && total <= vram * 0.95) return {kind: 'gpu', ok: true, text: 'Fits in GPU VRAM — fast'};
  if (gpuType === 'dedicated' && total <= ram * RAM_USABLE + vram) return {kind: 'hybrid', ok: true, text: 'Hybrid GPU + RAM — works, slower'};
  if (total <= ram * RAM_USABLE) return {kind: 'cpu', ok: true, text: 'CPU + RAM only — works, slow'};
  return {kind: 'no', ok: false, text: 'Does not fit'};
}

export function analyse(p: ExplainerProps) {
  const parsed = parseModel(p.model) ?? {params: 7e9, short: '7B'};
  const rows = PRECISIONS.map(pr => {
    const n = need(parsed.params, pr.bits, p.contextTokens);
    return {precision: pr, need: n, verdict: verdict(n.total, p)};
  });
  const best = rows.find(r => r.verdict.ok) ?? null;
  return {...parsed, billions: parsed.params / 1e9, rows, best, bf16: rows[1]};
}

export const fmt = (x: number, d = 1) => {
  const s = x.toFixed(d);
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
};
