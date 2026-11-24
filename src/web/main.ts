import {canRenderMediaOnWeb, renderMediaOnWeb} from '@remotion/web-renderer';
import {ModelExplainer, EXPLAINER_FRAMES} from '../explainer/ModelExplainer';
import type {ExplainerProps} from '../explainer/math';

const num = (v: unknown, lo: number, hi: number, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};

export function sanitize(body: Record<string, unknown>): ExplainerProps {
  const model = String(body.model ?? '').trim().slice(0, 60);
  if (!/(\d+(?:\.\d+)?)\s*[bBmMtT](?![a-zA-Z])/.test(model)) {
    throw new Error('Include the model size in the name, e.g. "Qwen3.8-27B" or "Llama 3.1 8B".');
  }
  const gpuType = ['dedicated', 'cpu', 'apple'].includes(body.gpuType as string) ? (body.gpuType as ExplainerProps['gpuType']) : 'dedicated';
  return {
    model,
    ramGB: num(body.ramGB, 1, 4096, 16),
    vramGB: gpuType === 'dedicated' ? num(body.vramGB, 0, 1024, 8) : 0,
    gpuType,
    gpuMake: ['NVIDIA', 'AMD', 'Intel', 'Other'].includes(body.gpuMake as string) ? (body.gpuMake as string) : 'Other',
    contextTokens: Math.round(num(body.contextTokens, 512, 1_048_576, 8192)),
  };
}

const composition = {
  id: 'ModelExplainer',
  component: ModelExplainer,
  durationInFrames: EXPLAINER_FRAMES,
  fps: 30,
  width: 1920,
  height: 1080,
};

export async function renderExplainer(body: Record<string, unknown>, onProgress: (p: number) => void): Promise<Blob> {
  const inputProps = sanitize(body);
  const support = await canRenderMediaOnWeb({...composition, container: 'mp4', videoCodec: 'h264'});
  if (!support.canRender) {
    const reason = support.issues.map(i => i.message).join(' ');
    throw new Error(`This browser cannot render MP4 video. Try a recent Chrome or Edge. ${reason}`.trim());
  }
  const {getBlob} = await renderMediaOnWeb({
    composition: {...composition, defaultProps: inputProps},
    inputProps,
    container: 'mp4',
    videoCodec: 'h264',
    onProgress: ({progress}) => onProgress(progress),
  });
  return getBlob();
}

(window as unknown as {renderExplainer: typeof renderExplainer}).renderExplainer = renderExplainer;
