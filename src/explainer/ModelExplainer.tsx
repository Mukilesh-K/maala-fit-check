import React, {useLayoutEffect, useMemo, useRef} from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {W, H, PAPER, paper} from './brush';
import {ExplainerProps, analyse} from './math';
import {paintFrame} from './scenes';

export {TOTAL_FRAMES as EXPLAINER_FRAMES} from './scenes';

export const ModelExplainer: React.FC<ExplainerProps> = props => {
  const ref = useRef<HTMLCanvasElement>(null);
  const frame = useCurrentFrame();
  const data = useMemo(() => ({...analyse(props), props}), [props]);
  useLayoutEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (ctx) paintFrame(ctx, frame, data, paper);
  }, [frame, data]);
  return (
    <AbsoluteFill style={{backgroundColor: PAPER}}>
      <canvas ref={ref} width={W} height={H} style={{width: '100%', height: '100%', display: 'block'}} />
    </AbsoluteFill>
  );
};
