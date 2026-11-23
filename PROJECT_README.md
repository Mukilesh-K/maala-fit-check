# Can My Computer Run This AI? — ink-wash explainer

Enter a model and your hardware, then generate an ink-wash Remotion video. A detailed report (verdict, memory per precision, how the numbers are estimated) appears after the video finishes.

## Run

```bash
cd ~/Downloads/model-explainer
npm install
npm start            # then open http://localhost:3123
```

Use another port with `PORT=3200 npm start` and open that port instead.

## Other commands

```bash
npm run studio       # Remotion Studio preview of the composition
npm run render -- --props='{"model":"Llama 3.1 8B","ramGB":16,"vramGB":8,"gpuType":"dedicated","gpuMake":"NVIDIA","contextTokens":8192}'
```

`gpuType` is `dedicated`, `cpu` or `apple`. Rendered videos are cached in `out/explainers/`. Memory figures are planning estimates, not guarantees.
