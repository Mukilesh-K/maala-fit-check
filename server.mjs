// Local web app: serves the form, renders the ModelExplainer composition with Remotion, streams back the MP4.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {bundle} from '@remotion/bundler';
import {renderMedia, selectComposition} from '@remotion/renderer';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, 'out', 'explainers');
const PAGE = path.join(ROOT, 'index.html');
const PORT = Number(process.env.PORT) || 3123;
fs.mkdirSync(OUT, {recursive: true});

console.log('Bundling Remotion project (first time takes a few seconds)…');
const serveUrl = await bundle({entryPoint: path.join(ROOT, 'src', 'index.ts')});
console.log('Bundle ready.');

const jobs = new Map();
let queue = Promise.resolve();

function sanitize(body) {
  const num = (v, lo, hi, d) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
  };
  const model = String(body.model ?? '').trim().slice(0, 60);
  if (!/(\d+(?:\.\d+)?)\s*[bBmMtT](?![a-zA-Z])/.test(model)) {
    throw new Error('Include the model size in the name, e.g. "Qwen3.8-27B" or "Llama 3.1 8B".');
  }
  const gpuType = ['dedicated', 'cpu', 'apple'].includes(body.gpuType) ? body.gpuType : 'dedicated';
  return {
    model,
    ramGB: num(body.ramGB, 1, 4096, 16),
    vramGB: gpuType === 'dedicated' ? num(body.vramGB, 0, 1024, 8) : 0,
    gpuType,
    gpuMake: ['NVIDIA', 'AMD', 'Intel', 'Other'].includes(body.gpuMake) ? body.gpuMake : 'Other',
    contextTokens: Math.round(num(body.contextTokens, 512, 1_048_576, 8192)),
  };
}

function startJob(props) {
  const id = crypto.createHash('sha1').update(JSON.stringify(props)).digest('hex').slice(0, 12);
  const file = path.join(OUT, `${id}.mp4`);
  const existing = jobs.get(id);
  if (existing && existing.status !== 'error') return id;
  if (fs.existsSync(file)) {
    jobs.set(id, {status: 'done', progress: 1, url: `/videos/${id}.mp4`});
    return id;
  }
  const job = {status: 'queued', progress: 0};
  jobs.set(id, job);
  queue = queue.then(async () => {
    try {
      job.status = 'rendering';
      const composition = await selectComposition({serveUrl, id: 'ModelExplainer', inputProps: props});
      const tmp = `${file}.part.mp4`;
      await renderMedia({
        composition, serveUrl, codec: 'h264', outputLocation: tmp, inputProps: props,
        onProgress: ({progress}) => { job.progress = progress; },
      });
      fs.renameSync(tmp, file);
      Object.assign(job, {status: 'done', progress: 1, url: `/videos/${id}.mp4`});
      console.log(`Rendered ${props.model} → ${file}`);
    } catch (e) {
      Object.assign(job, {status: 'error', error: String(e?.message ?? e)});
      console.error(e);
    }
  });
  return id;
}

function sendVideo(req, res, file) {
  const {size} = fs.statSync(file);
  const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? '');
  if (range) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    res.writeHead(206, {'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1});
    fs.createReadStream(file, {start, end}).pipe(res);
  } else {
    res.writeHead(200, {'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes', 'Content-Length': size});
    fs.createReadStream(file).pipe(res);
  }
}

const json = (res, code, obj) => { res.writeHead(code, {'Content-Type': 'application/json'}); res.end(JSON.stringify(obj)); };

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
    return fs.createReadStream(PAGE).pipe(res);
  }
  if (req.method === 'POST' && url.pathname === '/api/render') {
    let raw = '';
    req.on('data', c => { raw += c; if (raw.length > 1e4) req.destroy(); });
    req.on('end', () => {
      try { json(res, 200, {id: startJob(sanitize(JSON.parse(raw || '{}')))}); }
      catch (e) { json(res, 400, {error: e.message}); }
    });
    return;
  }
  const jm = url.pathname.match(/^\/api\/jobs\/([a-f0-9]{12})$/);
  if (jm) return jobs.has(jm[1]) ? json(res, 200, jobs.get(jm[1])) : json(res, 404, {error: 'Unknown job'});
  const vm = url.pathname.match(/^\/videos\/([a-f0-9]{12})\.mp4$/);
  if (vm && fs.existsSync(path.join(OUT, `${vm[1]}.mp4`))) return sendVideo(req, res, path.join(OUT, `${vm[1]}.mp4`));
  res.writeHead(404); res.end('Not found');
}).listen(PORT, () => console.log(`Open http://localhost:${PORT}`));
