import * as THREE from 'three';
import { rng } from './util.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
function tex(c, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// ---------------------------------------------------------------- faces
// Cartoon face drawn on a transparent plane in front of the head.
// p: {eye:[w,h], open, look:[x,y], brow:[angleL, angleR, y], mouth, mw, blush, tear, sparkle, stache, lashes}
const EXPR = {
  neutral:    { open: 1, brow: [0, 0, 0], mouth: 'smile', mw: 0.6 },
  smile:      { open: 1, brow: [-4, 4, -4], mouth: 'grin', mw: 0.9 },
  smirk:      { open: 0.8, brow: [8, -10, 0], mouth: 'smirk', mw: 0.8 },
  suspicious: { open: 0.45, brow: [14, 14, 10], mouth: 'smirk', mw: 0.7, look: [0.5, 0] },
  shocked:    { open: 1.25, eye: [1.05, 1.15], brow: [-14, 14, -22], mouth: 'o', mw: 0.55 },
  shout:      { open: 1.2, eye: [1.0, 1.1], brow: [26, -26, 6], mouth: 'yell', mw: 0.95 },
  angry:      { open: 0.8, brow: [24, -24, 10], mouth: 'frown', mw: 0.8 },
  furious:    { open: 0.7, brow: [28, -28, 14], mouth: 'teeth', mw: 0.95 },
  confused:   { open: 1, brow: [10, -18, -4], mouth: 'wavy', mw: 0.7 },
  amazed:     { open: 1.25, eye: [1.1, 1.15], brow: [-12, 12, -20], mouth: 'opensmile', mw: 0.6, sparkle: 1, look: [0, -0.6] },
  wonder:     { open: 1.15, eye: [1.05, 1.1], brow: [-8, 8, -16], mouth: 'opensmile', mw: 0.5, sparkle: 1, blush: 0.6, look: [0, -0.7] },
  soft:       { open: 0.85, brow: [-12, 12, -6], mouth: 'smile', mw: 0.55, blush: 0.4 },
  soft_up:    { open: 0.9, brow: [-12, 12, -8], mouth: 'smile', mw: 0.55, blush: 0.4, look: [0, -0.6] },
  sad:        { open: 0.85, brow: [-20, 20, -8], mouth: 'frown', mw: 0.55 },
  quiet:      { open: 0.85, brow: [-6, 6, 0], mouth: 'flat', mw: 0.4, look: [0, 0.35] },
  pleading:   { open: 1.05, brow: [-22, 22, -10], mouth: 'small', mw: 0.35, blush: 0.3 },
  determined: { open: 0.8, brow: [10, -10, 4], mouth: 'flat', mw: 0.45 },
  happy:      { open: 0.2, brow: [-6, 6, -8], mouth: 'grin', mw: 0.85, blush: 0.6 },
  blink:      { open: 0.06, brow: [0, 0, 0], mouth: 'smile', mw: 0.6 },
  look_side:  { open: 1, brow: [0, 0, 0], mouth: 'flat', mw: 0.5, look: [0.8, 0] },
  mayor_mad:  { open: 0.8, brow: [26, -26, 10], mouth: 'yell', mw: 0.8 },
  baker_wow:  { open: 1.25, eye: [1.05, 1.15], brow: [-16, 16, -20], mouth: 'o', mw: 0.5, look: [0, -0.5] },
  puzzled:    { open: 1, brow: [12, -16, -2], mouth: 'flat', mw: 0.5, look: [-0.5, -0.3] },
  up_calm:    { open: 1.05, brow: [-6, 6, -10], mouth: 'small', mw: 0.35, look: [0, -0.8] },
};

const faceCache = new Map();
export function faceTexture(name, opts = {}) {
  const key = name + JSON.stringify(opts);
  if (faceCache.has(key)) return faceCache.get(key);
  const p = Object.assign({ eye: [1, 1], open: 1, look: [0, 0], brow: [0, 0, 0], mouth: 'smile', mw: 0.6 }, EXPR[name] || EXPR.neutral, opts.over || {});
  const [c, g] = canvas(512, 512);
  const ink = '#17161d';
  const lx = p.look[0] * 18, ly = p.look[1] * 16;
  const eyes = [[176, 236], [336, 236]];
  // eyes
  eyes.forEach(([x, y], i) => {
    const rx = 36 * p.eye[0], ry = 50 * p.eye[1] * Math.max(0.06, p.open);
    g.fillStyle = ink;
    g.beginPath();
    g.ellipse(x + lx, y + ly + (1 - Math.min(1, p.open)) * 14, rx, ry, 0, 0, Math.PI * 2);
    g.fill();
    if (p.open > 0.3) {
      g.fillStyle = '#ffffff';
      g.beginPath(); g.ellipse(x + lx - rx * 0.32, y + ly - ry * 0.38, rx * 0.34, ry * 0.26, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(x + lx + rx * 0.3, y + ly + ry * 0.34, rx * 0.14, 0, Math.PI * 2); g.fill();
      if (p.sparkle) {
        g.fillStyle = 'rgba(160,210,255,0.9)';
        g.beginPath(); g.arc(x + lx + rx * 0.05, y + ly + ry * 0.05, rx * 0.12, 0, Math.PI * 2); g.fill();
      }
    }
    if (opts.lashes) {
      g.strokeStyle = ink; g.lineWidth = 9; g.lineCap = 'round';
      const s = i === 0 ? -1 : 1;
      g.beginPath(); g.moveTo(x + lx + s * rx * 0.8, y + ly - ry * 0.6); g.lineTo(x + lx + s * rx * 1.25, y + ly - ry * 0.95); g.stroke();
    }
  });
  // brows
  g.strokeStyle = opts.browColor || '#2a1c14'; g.lineCap = 'round'; g.lineWidth = 17;
  eyes.forEach(([x, y], i) => {
    const a = (i === 0 ? p.brow[0] : p.brow[1]) * Math.PI / 180;
    const by = y - 78 + p.brow[2] - (p.eye[1] - 1) * 40;
    const hw = 34;
    g.beginPath();
    g.moveTo(x - hw * Math.cos(a), by - hw * Math.sin(a));
    g.lineTo(x + hw * Math.cos(a), by + hw * Math.sin(a));
    g.stroke();
  });
  // blush
  if (p.blush) {
    g.fillStyle = `rgba(255,120,140,${0.35 * p.blush})`;
    g.beginPath(); g.ellipse(130, 318, 34, 18, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(382, 318, 34, 18, 0, 0, Math.PI * 2); g.fill();
  }
  // mustache (mayor)
  if (opts.stache) {
    g.fillStyle = opts.stache;
    g.beginPath();
    g.ellipse(222, 330, 46, 20, -0.25, 0, Math.PI * 2);
    g.ellipse(290, 330, 46, 20, 0.25, 0, Math.PI * 2);
    g.fill();
  }
  // mouth
  const mx = 256, my = 362, mw = 70 * p.mw;
  g.strokeStyle = ink; g.fillStyle = ink; g.lineWidth = 13; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath();
  switch (p.mouth) {
    case 'smile': g.arc(mx, my - mw * 0.9, mw, Math.PI * 0.28, Math.PI * 0.72); g.stroke(); break;
    case 'grin':
      g.moveTo(mx - mw, my - 14); g.quadraticCurveTo(mx, my + mw * 0.9, mx + mw, my - 14); g.closePath(); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.rect(mx - mw * 0.7, my - 12, mw * 1.4, 12); g.fill(); break;
    case 'smirk': g.moveTo(mx - mw * 0.7, my + 4); g.quadraticCurveTo(mx + mw * 0.2, my + 16, mx + mw * 0.9, my - 16); g.stroke(); break;
    case 'o': g.ellipse(mx, my + 8, mw * 0.55, mw * 0.75, 0, 0, Math.PI * 2); g.fill(); break;
    case 'yell': // angry shout: trapezoid opening wider at the bottom, top teeth, tongue
      g.moveTo(mx - mw * 0.55, my - 10); g.lineTo(mx + mw * 0.55, my - 10);
      g.quadraticCurveTo(mx + mw * 0.95, my + mw * 0.6, mx + mw * 0.8, my + mw * 1.2);
      g.quadraticCurveTo(mx, my + mw * 1.45, mx - mw * 0.8, my + mw * 1.2);
      g.quadraticCurveTo(mx - mw * 0.95, my + mw * 0.6, mx - mw * 0.55, my - 10); g.fill();
      g.fillStyle = '#fff'; g.fillRect(mx - mw * 0.5, my - 6, mw * 1.0, 16);
      g.fillStyle = '#e8546b'; g.beginPath(); g.ellipse(mx, my + mw * 1.08, mw * 0.5, mw * 0.2, 0, 0, Math.PI * 2); g.fill(); break;
    case 'frown': g.arc(mx, my + mw * 1.05, mw * 0.85, Math.PI * 1.25, Math.PI * 1.75); g.stroke(); break;
    case 'teeth':
      g.fillStyle = '#fff'; g.strokeStyle = ink; g.lineWidth = 10;
      g.beginPath(); g.roundRect(mx - mw, my - 18, mw * 2, 36, 12); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(mx - mw, my); g.lineTo(mx + mw, my); g.stroke(); break;
    case 'wavy':
      g.moveTo(mx - mw, my); g.bezierCurveTo(mx - mw * 0.4, my - 20, mx + mw * 0.1, my + 20, mx + mw, my - 6); g.stroke(); break;
    case 'opensmile':
      g.moveTo(mx - mw, my - 6); g.quadraticCurveTo(mx, my + mw * 1.3, mx + mw, my - 6); g.closePath(); g.fill();
      g.fillStyle = '#e8546b'; g.beginPath(); g.ellipse(mx, my + mw * 0.45, mw * 0.4, mw * 0.18, 0, 0, Math.PI * 2); g.fill(); break;
    case 'flat': g.moveTo(mx - mw * 0.8, my + 2); g.lineTo(mx + mw * 0.8, my + 2); g.stroke(); break;
    case 'small': g.ellipse(mx, my + 4, mw * 0.5, mw * 0.32, 0, 0, Math.PI * 2); g.fill(); break;
  }
  const t = tex(c);
  faceCache.set(key, t);
  return t;
}

// ---------------------------------------------------------------- emblems & labels
export function starEmblem() {
  const [c, g] = canvas(256, 256);
  g.translate(128, 128); g.fillStyle = '#ffffff';
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 46 : 110, a = -Math.PI / 2 + i * Math.PI / 5;
    g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  g.closePath(); g.fill();
  return tex(c);
}

export function signTexture(text, fg, bg, font = 'Anton') {
  const [c, g] = canvas(1024, 256);
  g.fillStyle = bg; g.beginPath(); g.roundRect(8, 8, 1008, 240, 40); g.fill();
  g.lineWidth = 14; g.strokeStyle = fg; g.beginPath(); g.roundRect(22, 22, 980, 212, 32); g.stroke();
  g.font = `150px ${font}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = fg; g.shadowColor = fg; g.shadowBlur = 24;
  g.fillText(text, 512, 138);
  return tex(c);
}

export function plainText(text, { w = 1024, h = 256, size = 120, fg = '#222', bg = null, font = 'Anton' } = {}) {
  const [c, g] = canvas(w, h);
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
  g.font = `${size}px ${font}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = fg;
  g.fillText(text, w / 2, h / 2 + size * 0.06);
  return tex(c);
}

// Windows grid: returns [colorMap, emissiveMap]
export function windowTextures(seed, cols = 4, rows = 6, wall = '#5a6378', litFrac = 0.65) {
  const R = rng(seed);
  const [c, g] = canvas(256, 384);
  const [e, ge] = canvas(256, 384);
  g.fillStyle = wall; g.fillRect(0, 0, 256, 384);
  ge.fillStyle = '#000'; ge.fillRect(0, 0, 256, 384);
  const cw = 256 / cols, rh = 384 / rows;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const x = i * cw + cw * 0.2, y = j * rh + rh * 0.2, w = cw * 0.6, h = rh * 0.55;
    g.fillStyle = '#1d2233'; g.fillRect(x, y, w, h);
    if (R() < litFrac) {
      const warm = R() < 0.75;
      ge.fillStyle = warm ? `hsl(${35 + R() * 15},95%,${55 + R() * 15}%)` : `hsl(${190 + R() * 30},80%,65%)`;
      ge.fillRect(x, y, w, h);
    }
  }
  return [tex(c), tex(e)];
}

export function radialGlow(inner = 'rgba(255,220,150,1)', outer = 'rgba(255,180,90,0)') {
  const [c, g] = canvas(256, 256);
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, inner); gr.addColorStop(0.35, inner.replace(/,1\)$/, ',0.45)')); gr.addColorStop(1, outer);
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  return tex(c);
}

export function plazaTexture() {
  const [c, g] = canvas(1024, 1024);
  g.fillStyle = '#9a8f88'; g.fillRect(0, 0, 1024, 1024);
  const R = rng(7);
  for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) {
    const v = 140 + R() * 30;
    g.fillStyle = `rgb(${v + 10},${v},${v - 8})`;
    g.fillRect(i * 64 + 2, j * 64 + 2, 60, 60);
  }
  // decorative ring
  g.strokeStyle = '#c9a36a'; g.lineWidth = 26; g.beginPath(); g.arc(512, 512, 300, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = '#b08850'; g.lineWidth = 10; g.beginPath(); g.arc(512, 512, 360, 0, Math.PI * 2); g.stroke();
  const t = tex(c); return t;
}

export function noiseTexture(base, vary, seed = 1, size = 256) {
  const [c, g] = canvas(size, size);
  const R = rng(seed);
  g.fillStyle = base; g.fillRect(0, 0, size, size);
  for (let i = 0; i < size * size / 6; i++) {
    g.fillStyle = vary[(R() * vary.length) | 0];
    g.globalAlpha = 0.25 + R() * 0.35;
    g.fillRect(R() * size, R() * size, 2 + R() * 4, 2 + R() * 4);
  }
  g.globalAlpha = 1;
  const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

export function woodTexture(seed = 3) {
  const [c, g] = canvas(512, 512);
  const R = rng(seed);
  for (let i = 0; i < 8; i++) {
    const l = 32 + R() * 10;
    g.fillStyle = `hsl(28,${35 + R() * 10}%,${l}%)`; g.fillRect(0, i * 64, 512, 64);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, i * 64, 512, 3);
    for (let k = 0; k < 14; k++) { g.fillStyle = 'rgba(40,20,10,0.15)'; g.fillRect(R() * 512, i * 64 + R() * 60, 60 + R() * 120, 2); }
  }
  const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

// ---------------------------------------------------------------- the crayon drawing
function crayonStroke(g, pts, color, width, R, passes = 3) {
  g.strokeStyle = color; g.lineCap = 'round'; g.lineJoin = 'round';
  for (let p = 0; p < passes; p++) {
    g.globalAlpha = 0.55 + R() * 0.3;
    g.lineWidth = width * (0.7 + R() * 0.5);
    g.beginPath();
    pts.forEach(([x, y], i) => {
      const jx = x + (R() - 0.5) * width * 0.6, jy = y + (R() - 0.5) * width * 0.6;
      i ? g.lineTo(jx, jy) : g.moveTo(jx, jy);
    });
    g.stroke();
  }
  g.globalAlpha = 1;
}
function crayonFill(g, x0, y0, x1, y1, color, R, density = 1, angle = -0.5) {
  g.save(); g.beginPath(); g.rect(x0, y0, x1 - x0, y1 - y0); g.clip();
  g.strokeStyle = color; g.lineCap = 'round';
  const n = ((x1 - x0) + (y1 - y0)) * 0.55 * density;
  for (let i = 0; i < n; i++) {
    const x = x0 - 200 + R() * (x1 - x0 + 400), y = y0 + R() * (y1 - y0);
    const L = 40 + R() * 90;
    g.globalAlpha = 0.18 + R() * 0.25; g.lineWidth = 5 + R() * 6;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(angle) * L, y + Math.sin(angle) * L); g.stroke();
  }
  g.restore(); g.globalAlpha = 1;
}
function crayonStar(g, x, y, r, color, R) {
  const pts = [];
  for (let i = 0; i <= 10; i++) { const rr = i % 2 ? r * 0.45 : r, a = -Math.PI / 2 + i * Math.PI / 5; pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
  crayonStroke(g, pts, color, 7, R, 2);
}

export function drawingTexture() {
  const R = rng(42);
  const [c, g] = canvas(1024, 768);
  // paper
  g.fillStyle = '#fbf6e9'; g.fillRect(0, 0, 1024, 768);
  for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(120,100,70,${R() * 0.05})`; g.fillRect(R() * 1024, R() * 768, 2, 2); }
  // night sky scribble
  crayonFill(g, 40, 40, 984, 560, '#1b2a8a', R, 2.4, -0.4);
  crayonFill(g, 40, 40, 984, 560, '#3b2a9a', R, 0.8, 0.5);
  // hill
  g.save(); g.beginPath(); g.moveTo(40, 728); g.lineTo(40, 560); g.quadraticCurveTo(380, 430, 720, 580); g.quadraticCurveTo(860, 640, 984, 600); g.lineTo(984, 728); g.closePath(); g.clip();
  crayonFill(g, 40, 420, 984, 728, '#2f9d4a', R, 2.2, -0.2); g.restore();
  // stars
  for (let i = 0; i < 26; i++) crayonStar(g, 70 + R() * 880, 60 + R() * 380, 10 + R() * 14, i % 3 ? '#ffd83a' : '#ffffff', R);
  // comet - head + long tail to the upper-left
  for (let k = 0; k < 9; k++) {
    const sp = 14 + k * 8;
    crayonStroke(g, [[700, 250 + (k - 4) * sp * 0.18], [520, 190 + (k - 4) * sp * 0.6], [250, 110 + (k - 4) * sp]], k % 2 ? '#7fd6ff' : '#fff3a8', 12, R, 2);
  }
  g.fillStyle = '#fff6b0'; g.beginPath(); g.arc(712, 254, 34, 0, Math.PI * 2); g.fill();
  crayonStroke(g, Array.from({ length: 20 }, (_, i) => [712 + Math.cos(i / 19 * Math.PI * 2) * 38, 254 + Math.sin(i / 19 * Math.PI * 2) * 38]), '#ffb21e', 9, R, 3);
  // two kids on the hill: big brother (green) + little sister (purple)
  const kid = (x, y, s, body) => {
    crayonStroke(g, Array.from({ length: 16 }, (_, i) => [x + Math.cos(i / 15 * 6.283) * 20 * s, y + Math.sin(i / 15 * 6.283) * 20 * s]), '#8a5a2b', 6, R, 2);
    crayonFill(g, x - 22 * s, y + 22 * s, x + 22 * s, y + 80 * s, body, R, 3, 0.3);
    crayonStroke(g, [[x - 10 * s, y + 80 * s], [x - 12 * s, y + 118 * s]], '#333', 8, R, 2);
    crayonStroke(g, [[x + 10 * s, y + 80 * s], [x + 12 * s, y + 118 * s]], '#333', 8, R, 2);
    crayonStroke(g, [[x + 22 * s, y + 34 * s], [x + 44 * s, y - 2 * s]], body, 8, R, 2); // arm up
  };
  kid(300, 470, 1.15, '#3fcf9a');
  kid(380, 500, 0.85, '#a77bdc');
  // little house
  crayonStroke(g, [[820, 610], [820, 540], [870, 500], [920, 540], [920, 610], [820, 610]], '#d9433b', 8, R, 2);
  // signature
  g.font = '64px "Patrick Hand"'; g.fillStyle = '#c0397a'; g.globalAlpha = 0.9;
  g.save(); g.translate(840, 700); g.rotate(-0.06); g.fillText('Maya', 0, 0); g.restore();
  g.globalAlpha = 1;
  return tex(c);
}

export function noteTexture() {
  const R = rng(11);
  const [c, g] = canvas(1024, 400);
  g.fillStyle = '#fffdf4'; g.fillRect(0, 0, 1024, 400);
  // ruled lines
  g.strokeStyle = 'rgba(90,140,220,0.35)'; g.lineWidth = 3;
  for (let y = 90; y < 400; y += 78) { g.beginPath(); g.moveTo(0, y); g.lineTo(1024, y); g.stroke(); }
  g.strokeStyle = 'rgba(230,80,90,0.4)'; g.beginPath(); g.moveTo(90, 0); g.lineTo(90, 400); g.stroke();
  // handwriting in purple crayon-ish
  g.font = '104px "Patrick Hand"'; g.textBaseline = 'alphabetic';
  g.fillStyle = '#5b2bb5';
  const lines = ['I want to see', 'the sky sparkle.'];
  lines.forEach((ln, i) => {
    g.save(); g.translate(130, 158 + i * 150); g.rotate(-0.025 + i * 0.01);
    for (let p = 0; p < 2; p++) { g.globalAlpha = 0.85; g.fillText(ln, (R() - 0.5) * 2, (R() - 0.5) * 2); }
    g.restore();
  });
  g.globalAlpha = 1;
  // little heart + star doodles
  crayonStar(g, 930, 120, 32, '#f2b81c', R);
  g.fillStyle = '#e8496a'; g.font = '90px "Patrick Hand"'; g.fillText('♥', 900, 330);
  return tex(c);
}

export function bannerTexture() {
  const [c, g] = canvas(1024, 256);
  const cols = ['#ff6b6b', '#ffd93d', '#6bcB77', '#4d96ff', '#c77dff'];
  // bunting triangles
  for (let i = 0; i < 16; i++) { g.fillStyle = cols[i % 5]; g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64 + 64, 0); g.lineTo(i * 64 + 32, 50); g.fill(); }
  g.fillStyle = '#fff'; g.beginPath(); g.roundRect(60, 70, 904, 170, 30); g.fill();
  g.font = '120px "Patrick Hand"'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#c0397a';
  g.fillText('WELCOME HOME MAYA!', 512, 160);
  return tex(c);
}

export function hazardTexture() {
  const [c, g] = canvas(256, 64);
  g.fillStyle = '#ffcc00'; g.fillRect(0, 0, 256, 64);
  g.fillStyle = '#111';
  for (let i = -2; i < 10; i++) { g.beginPath(); g.moveTo(i * 32, 64); g.lineTo(i * 32 + 16, 64); g.lineTo(i * 32 + 48, 0); g.lineTo(i * 32 + 32, 0); g.fill(); }
  return tex(c);
}

export function hospitalArtTexture() {
  // heart-shaped "get well soon" card for the bedside, tasteful not clinical
  const [c, g] = canvas(512, 512);
  g.fillStyle = '#fff7fb'; g.fillRect(0, 0, 512, 512);
  g.fillStyle = '#ff8fab';
  g.beginPath(); g.moveTo(256, 400); g.bezierCurveTo(40, 260, 120, 60, 256, 170); g.bezierCurveTo(392, 60, 472, 260, 256, 400); g.fill();
  g.font = '64px "Patrick Hand"'; g.textAlign = 'center'; g.fillStyle = '#7a2d54'; g.fillText('Get well soon!', 256, 470);
  return tex(c);
}
