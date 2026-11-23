import React from 'react';
import {Composition} from 'remotion';
import {ModelExplainer, EXPLAINER_FRAMES} from './explainer/ModelExplainer';

export const RemotionRoot: React.FC = () => (
  <Composition
    id="ModelExplainer"
    component={ModelExplainer}
    durationInFrames={EXPLAINER_FRAMES}
    fps={30}
    width={1920}
    height={1080}
    defaultProps={{model: 'Qwen3.8-27B', ramGB: 32, vramGB: 8, gpuType: 'dedicated', gpuMake: 'NVIDIA', contextTokens: 8192}}
  />
);
