// Flat, simple faces: dot eyes, thin brows, line mouths (classic blocky-avatar look).
import * as THREE from 'three';

const cache = new Map();
const INK = '#1b1b1f';

function eyeDots(g, o) {
  const y = 118 + (o.eyeY || 0), dx = 44, rx = 13 * (o.eyeS || 1), ry = 19 * (o.eyeS || 1);
  for (const s of [-1, 1]) {
    g.fillStyle = INK; g.beginPath(); g.ellipse(128 + s * dx + (o.look || 0), y, rx, ry, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.ellipse(128 + s * dx + (o.look || 0) - 4, y - 7, 4.5, 5.5, 0, 0, Math.PI * 2); g.fill();
  }
}
function bigEyes(g, o) {
  const y = 112;
  for (const s of [-1, 1]) {
    g.fillStyle = '#fff'; g.strokeStyle = INK; g.lineWidth = 7;
    g.beginPath(); g.ellipse(128 + s * 46, y, 28, 32, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = INK; g.beginPath(); g.ellipse(128 + s * 46 + (o.look || 0), y + 2, 12, 14, 0, 0, Math.PI * 2); g.fill();
  }
}
function arcs(g, up = true, y = 118) { // ^ ^ happy-closed or u u
  g.strokeStyle = INK; g.lineWidth = 8; g.lineCap = 'round';
  for (const s of [-1, 1]) { g.beginPath(); g.arc(128 + s * 44, y + (up ? 10 : -6), 16, up ? Math.PI * 1.1 : 0.1, up ? Math.PI * 1.9 : Math.PI - 0.1); g.stroke(); }
}
function squint(g) { // > <
  g.strokeStyle = INK; g.lineWidth = 8; g.lineCap = 'round';
  for (const s of [-1, 1]) {
    const x = 128 + s * 44;
    g.beginPath(); g.moveTo(x - s * 16, 104); g.lineTo(x + s * 12, 118); g.lineTo(x - s * 16, 132); g.stroke();
  }
}
function lids(g, y = 118) { // half-lidded: dots under a flat lid
  eyeDots(g, { eyeY: 4, eyeS: 0.85 });
  g.fillStyle = 'rgba(0,0,0,0)';
  g.strokeStyle = INK; g.lineWidth = 7; g.lineCap = 'round';
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(128 + s * 44 - 20, y - 2); g.lineTo(128 + s * 44 + 20, y - 2); g.stroke(); }
}
function brows(g, inner, outer = 0, y = 76) { // +inner = angry (inner down), -inner = worried
  g.strokeStyle = INK; g.lineWidth = 7; g.lineCap = 'round';
  for (const s of [-1, 1]) {
    g.beginPath(); g.moveTo(128 + s * 24, y + inner); g.lineTo(128 + s * 66, y - inner * 0.4 + outer); g.stroke();
  }
}
function mouth(g, kind) {
  g.strokeStyle = INK; g.lineWidth = 7; g.lineCap = 'round'; g.lineJoin = 'round';
  const y = 178;
  switch (kind) {
    case 'flat': g.beginPath(); g.moveTo(110, y); g.lineTo(146, y); g.stroke(); break;
    case 'smile': g.beginPath(); g.arc(128, y - 22, 26, 0.25 * Math.PI, 0.75 * Math.PI); g.stroke(); break;
    case 'small': g.beginPath(); g.arc(128, y - 12, 14, 0.25 * Math.PI, 0.75 * Math.PI); g.stroke(); break;
    case 'frown': g.beginPath(); g.arc(128, y + 18, 22, 1.2 * Math.PI, 1.8 * Math.PI); g.stroke(); break;
    case 'smirk': g.beginPath(); g.moveTo(108, y + 2); g.quadraticCurveTo(136, y + 6, 152, y - 10); g.stroke(); break;
    case 'grin': case 'laugh': {
      const h = kind === 'laugh' ? 40 : 28;
      g.fillStyle = '#7a1f2b'; g.beginPath(); g.moveTo(96, y - 14); g.lineTo(160, y - 14); g.quadraticCurveTo(158, y - 14 + h * 1.4, 128, y - 14 + h); g.quadraticCurveTo(98, y - 14 + h * 1.4, 96, y - 14); g.fill();
      g.fillStyle = '#fff'; g.fillRect(100, y - 14, 56, 9);
      g.fillStyle = '#ff7b8a'; g.beginPath(); g.ellipse(128, y - 14 + h * 0.82, 15, 7, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = INK; g.lineWidth = 6; g.beginPath(); g.moveTo(96, y - 14); g.lineTo(160, y - 14); g.quadraticCurveTo(158, y - 14 + h * 1.4, 128, y - 14 + h); g.quadraticCurveTo(98, y - 14 + h * 1.4, 96, y - 14); g.stroke();
      break;
    }
    case 'O': case 'o': {
      const r = kind === 'O' ? 20 : 11;
      g.fillStyle = '#e8243c'; g.beginPath(); g.ellipse(128, y - 2, r * 0.85, r, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = INK; g.lineWidth = 6; g.stroke(); break;
    }
    case 'teeth': { // gritted
      g.fillStyle = '#fff'; g.fillRect(100, y - 16, 56, 24); g.strokeStyle = INK; g.lineWidth = 6; g.strokeRect(100, y - 16, 56, 24);
      g.lineWidth = 3; g.beginPath(); g.moveTo(100, y - 4); g.lineTo(156, y - 4); for (let x = 114; x < 156; x += 14) { g.moveTo(x, y - 16); g.lineTo(x, y + 8); } g.stroke(); break;
    }
    case 'puff': { // cheeks puffed (burp)
      g.fillStyle = '#e8243c'; g.beginPath(); g.ellipse(128, y, 9, 7, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,120,120,0.35)'; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(128 + s * 62, y - 26, 20, 14, 0, 0, Math.PI * 2); g.fill(); }
      break;
    }
    case 'wavy': g.beginPath(); g.moveTo(104, y); for (let i = 0; i <= 6; i++) g.lineTo(104 + i * 8, y + (i % 2 ? -6 : 6)); g.stroke(); break;
  }
}
function blush(g, a = 0.3) { g.fillStyle = `rgba(255,110,120,${a})`; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(128 + s * 66, 150, 18, 10, 0, 0, Math.PI * 2); g.fill(); } }
function sweat(g) { g.fillStyle = '#7fd3ff'; g.strokeStyle = '#2a8fd0'; g.lineWidth = 3; g.beginPath(); g.moveTo(206, 60); g.quadraticCurveTo(222, 92, 206, 100); g.quadraticCurveTo(190, 92, 206, 60); g.fill(); g.stroke(); }
function redFace(g, a) { g.fillStyle = `rgba(230,40,40,${a})`; g.fillRect(0, 0, 256, 256); }

const EXPR = {
  neutral: (g, o) => { eyeDots(g, o); mouth(g, 'small'); },
  smile: (g, o) => { eyeDots(g, o); mouth(g, 'smile'); },
  grin: (g, o) => { eyeDots(g, o); brows(g, -4, 0, 70); mouth(g, 'grin'); },
  joy: (g) => { arcs(g); mouth(g, 'laugh'); blush(g); },
  laugh: (g) => { arcs(g); brows(g, -6, 0, 68); mouth(g, 'laugh'); },
  sad: (g, o) => { eyeDots(g, Object.assign({ eyeY: 4 }, o)); brows(g, -12, 0, 80); mouth(g, 'frown'); },
  bored: (g) => { lids(g); mouth(g, 'flat'); },
  smug: (g) => { lids(g); brows(g, 3, -6, 78); mouth(g, 'smirk'); },
  shock: (g, o) => { bigEyes(g, o); mouth(g, 'O'); },
  surprised: (g, o) => { eyeDots(g, Object.assign({ eyeS: 1.15 }, o)); brows(g, -8, -4, 66); mouth(g, 'o'); },
  worried: (g, o) => { eyeDots(g, o); brows(g, -12, 0, 74); mouth(g, 'wavy'); sweat(g); },
  determined: (g, o) => { eyeDots(g, Object.assign({ eyeS: 0.9 }, o)); brows(g, 12, 0, 82); mouth(g, 'flat'); },
  angry: (g, o) => { eyeDots(g, o); brows(g, 14, 0, 82); mouth(g, 'frown'); },
  strain: (g, o) => { redFace(g, (o.red ?? 0.35)); squint(g); brows(g, 14, 0, 80); mouth(g, 'teeth'); sweat(g); },
  burp: (g) => { lids(g); mouth(g, 'puff'); },
  calm: (g) => { arcs(g, false, 122); mouth(g, 'flat'); },
  yell: (g, o) => { eyeDots(g, o); brows(g, -6, -4, 66); mouth(g, 'O'); },
  serious: (g, o) => { eyeDots(g, Object.assign({ eyeS: 0.85 }, o)); brows(g, 6, 0, 80); mouth(g, 'flat'); },
  huss: (g, o) => { squint(g); brows(g, 16, 0, 80); g.fillStyle = INK; g.beginPath(); g.ellipse(128, 182, 34, 30, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#e8545a'; g.beginPath(); g.ellipse(128, 198, 20, 10, 0, 0, Math.PI * 2); g.fill(); },
  squeak: (g, o) => { eyeDots(g, Object.assign({ eyeS: 1.1 }, o)); brows(g, -10, 0, 72); g.fillStyle = INK; g.beginPath(); g.ellipse(128, 180, 6, 7, 0, 0, Math.PI * 2); g.fill(); blush(g); },
  sleep: (g) => { arcs(g, false, 124); mouth(g, 'small'); },
  cry: (g) => { arcs(g, false, 122); brows(g, -12, 0, 78); mouth(g, 'laugh'); g.fillStyle = 'rgba(90,180,255,0.9)'; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(128 + s * 52, 124); g.quadraticCurveTo(128 + s * 66, 190, 128 + s * 60, 250); g.lineTo(128 + s * 44, 250); g.quadraticCurveTo(128 + s * 50, 190, 128 + s * 36, 124); g.fill(); } },
  dizzy: (g) => { g.strokeStyle = INK; g.lineWidth = 6; for (const s of [-1, 1]) { g.beginPath(); for (let a = 0; a < 14; a += 0.2) g.lineTo(128 + s * 44 + Math.cos(a) * a * 1.4, 118 + Math.sin(a) * a * 1.4); g.stroke(); } mouth(g, 'wavy'); },
};

export function faceTexture(name = 'neutral', opts = {}) {
  const key = name + JSON.stringify(opts);
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  (EXPR[name] || EXPR.neutral)(g, opts.over || {});
  if (opts.glasses) {
    g.strokeStyle = INK; g.lineWidth = 6;
    for (const s of [-1, 1]) { g.beginPath(); g.ellipse(128 + s * 44, 118, 30, 28, 0, 0, Math.PI * 2); g.stroke(); }
    g.beginPath(); g.moveTo(114, 114); g.lineTo(142, 114); g.stroke();
  }
  if (opts.stache) { g.fillStyle = opts.stache; g.beginPath(); g.ellipse(112, 156, 22, 9, 0.2, 0, Math.PI * 2); g.ellipse(144, 156, 22, 9, -0.2, 0, Math.PI * 2); g.fill(); }
  if (opts.mud) { const R = (i) => (Math.sin(i * 91.7) * 43758.5) % 1; g.fillStyle = '#5b3a1f'; for (let i = 0; i < 9; i++) { g.beginPath(); g.ellipse(40 + Math.abs(R(i)) * 176, 40 + Math.abs(R(i + 9)) * 190, 16 + Math.abs(R(i + 3)) * 26, 12 + Math.abs(R(i + 5)) * 20, R(i + 7) * 3, 0, Math.PI * 2); g.fill(); } }
  if (opts.lashes) { g.strokeStyle = INK; g.lineWidth = 4; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(128 + s * 56, 102); g.lineTo(128 + s * 66, 94); g.stroke(); } }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  cache.set(key, t); return t;
}

// text label texture (hoodie print, signs, scoreboard)
export function textTexture(lines, { w = 512, h = 256, bg = null, fg = '#fff', font = '900 120px Nunito', stroke = null, sw = 0, align = 'center' } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
  const L = Array.isArray(lines) ? lines : [lines];
  L.forEach((ln, i) => {
    const o = typeof ln === 'string' ? { t: ln } : ln;
    g.font = o.font || font; g.textAlign = o.align || align; g.textBaseline = 'middle';
    const x = o.x ?? (align === 'center' ? w / 2 : 20), y = o.y ?? h * (i + 0.5) / L.length;
    if (o.stroke || stroke) { g.strokeStyle = o.stroke || stroke; g.lineWidth = o.sw || sw; g.lineJoin = 'round'; g.strokeText(o.t, x, y); }
    g.fillStyle = o.fg || fg; g.fillText(o.t, x, y);
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
