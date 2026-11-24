# maala-fit-check
Know your hardware before you run AI

## Can My Computer Run This AI? — ink-wash explainer

Enter a model and your hardware, then generate an ink-wash Remotion video. A detailed report (verdict, memory per precision, how the numbers are estimated) appears after the video finishes.

The MP4 is rendered entirely in your browser with `@remotion/web-renderer`, so there is no backend and the site is fully static (GitHub Pages). It needs a browser with WebCodecs support, such as recent Chrome or Edge.

### Run

```bash
npm install
npm start            # then open the URL Vite prints (http://localhost:5173)
```

### Build and deploy

```bash
npm run build        # static site in dist/
npm run preview      # serve dist/ locally
```

Pushing to `main` deploys `dist/` to GitHub Pages via `.github/workflows/deploy.yml`. In the repo, set **Settings → Pages → Source** to **GitHub Actions** once.

### Other commands

```bash
npm run studio       # Remotion Studio preview of the composition
npm run render -- --props='{"model":"Llama 3.1 8B","ramGB":16,"vramGB":8,"gpuType":"dedicated","gpuMake":"NVIDIA","contextTokens":8192}'
```

`gpuType` is `dedicated`, `cpu` or `apple`. Memory figures are planning estimates, not guarantees.
