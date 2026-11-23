// Frame renderer: serves the project over localhost, drives headless Chromium,
// renders deterministic frames and pipes them to ffmpeg.
//   node driver.js preview 3.2 10.5 ...      -> build/preview/t_XX.png
//   node driver.js render <start> <end> <out.mp4>   (frame indices, end exclusive)
const http = require('http'), fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.ttf': 'font/ttf' };
function serve() {
  return new Promise((res) => {
    const s = http.createServer((q, r) => {
      let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/render/index.html';
      const f = path.join(ROOT, p);
      if (!f.startsWith(ROOT) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
      r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
    });
    s.listen(0, '127.0.0.1', () => res(s));
  });
}
async function open(port, w = 1080, h = 1920) {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const pg = await b.newPage({ viewport: { width: w, height: h } });
  pg.on('console', (m) => { if (m.type() === 'error') console.error('[page]', m.text()); });
  pg.on('pageerror', (e) => console.error('[pageerror]', e.message));
  await pg.goto(`http://127.0.0.1:${port}/render/index.html?w=${w}&h=${h}&${process.env.QS || ''}`);
  await pg.waitForFunction(() => window.ready || window.initError, null, { timeout: 300000 });
  const err = await pg.evaluate(() => window.initError);
  if (err) throw new Error(err);
  return { b, pg };
}
(async () => {
  const [mode, ...args] = process.argv.slice(2);
  const srv = await serve(); const port = srv.address().port;
  const tl = JSON.parse(fs.readFileSync(path.join(ROOT, 'build/timeline.json')));
  if (mode === 'preview') {
    const scale = +(process.env.PREVIEW_SCALE || 0.5);
    const { b, pg } = await open(port, Math.round(1080 * scale), Math.round(1920 * scale));
    fs.mkdirSync(path.join(ROOT, 'build/preview'), { recursive: true });
    for (const a of args) {
      const T = +a, t0 = Date.now();
      await pg.evaluate((T) => window.renderAt(T), T);
      const data = await pg.evaluate(() => window.grab(0.9));
      const f = path.join(ROOT, `build/preview/t_${T.toFixed(2)}.jpg`);
      fs.writeFileSync(f, Buffer.from(data.split(',')[1], 'base64'));
      console.log(f, Date.now() - t0, 'ms');
    }
    const ww = await pg.evaluate(() => window.walkWindows);
    fs.writeFileSync(path.join(ROOT, 'build/walks.json'), JSON.stringify(ww, null, 1));
    await b.close();
  } else if (mode === 'render') {
    const [s, e, out] = [+args[0], +args[1], args[2]];
    const { b, pg } = await open(port);
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(tl.fps), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const t0 = Date.now();
    for (let f = s; f < e; f++) {
      const T = f / tl.fps;
      await pg.evaluate((T) => window.renderAt(T), T);
      const data = await pg.evaluate(() => window.grab(0.95));
      const buf = Buffer.from(data.split(',')[1], 'base64');
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
      if ((f - s) % 30 === 0) console.log(`[${s}-${e}] frame ${f} ${((Date.now() - t0) / (f - s + 1) / 1000).toFixed(2)}s/f`);
    }
    ff.stdin.end(); await new Promise((r) => ff.on('close', r));
    const ww = await pg.evaluate(() => window.walkWindows);
    fs.writeFileSync(path.join(ROOT, 'build/walks.json'), JSON.stringify(ww, null, 1));
    await b.close();
  }
  srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
