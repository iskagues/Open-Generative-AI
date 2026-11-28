// Cook-off props: pie, birds, pancakes + pan, smoke alarm, toast/cereal/ice cream, flames,
// tables on the stage, the pizza (raw/golden), slice, and the golden spoon.
import * as THREE from 'three';
import { rbox, mat, mesh } from './chars.js';
import { textTexture } from './faces.js';
import { rng } from './util.js';

const box = (w, h, d, m, x, y, z, r = 0.04) => mesh(rbox(w, h, d, r, 2), m, x, y, z);
const P = (c, o) => mat(c, Object.assign({ roughness: 0.9 }, o));
export const GOLD = new THREE.MeshStandardMaterial({ color: '#ffcc33', metalness: 0.85, roughness: 0.22, emissive: '#7a5200', emissiveIntensity: 0.35, side: THREE.DoubleSide });
const BURNT = P('#1e1a18', { roughness: 1 });
function canvasTex(draw, w = 512, h = 512) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
function pizzaTex(golden) {
  return canvasTex((g, w) => {
    const R = rng(golden ? 5 : 3), c = w / 2;
    g.fillStyle = golden ? '#c8792c' : '#f3dfb8'; g.beginPath(); g.arc(c, c, c, 0, 7); g.fill();
    g.fillStyle = golden ? '#c0301e' : '#e04b3a'; g.beginPath(); g.arc(c, c, c * 0.84, 0, 7); g.fill();
    for (let i = 0; i < 26; i++) { const a = R() * 7, r = R() * c * 0.72; g.fillStyle = golden ? '#ffd45c' : '#fffaf0'; g.beginPath(); g.ellipse(c + Math.cos(a) * r, c + Math.sin(a) * r, 26 + R() * 30, 20 + R() * 24, R() * 3, 0, 7); g.fill(); }
    if (golden) {
      for (let i = 0; i < 40; i++) { const a = R() * 7, r = R() * c * 0.75; g.fillStyle = 'rgba(200,110,30,0.6)'; g.beginPath(); g.arc(c + Math.cos(a) * r, c + Math.sin(a) * r, 6 + R() * 10, 0, 7); g.fill(); }
      for (let i = 0; i < 9; i++) { const a = i / 9 * 7 + 0.3, r = c * (0.3 + 0.35 * (i % 2)); g.fillStyle = '#a8261b'; g.beginPath(); g.arc(c + Math.cos(a) * r, c + Math.sin(a) * r, 28, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,0.25)'; g.beginPath(); g.arc(c + Math.cos(a) * r - 8, c + Math.sin(a) * r - 8, 8, 0, 7); g.fill(); }
    } else {
      for (let i = 0; i < 9; i++) { const a = i / 9 * 7 + 0.3, r = c * (0.3 + 0.35 * (i % 2)); g.fillStyle = '#e88a8a'; g.beginPath(); g.arc(c + Math.cos(a) * r, c + Math.sin(a) * r, 26, 0, 7); g.fill(); }
    }
  });
}
export function makePie() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.5, 0.42, 0.2, 28), P('#d9a35a'), 0, 0.1, 0));
  const top = mesh(new THREE.CircleGeometry(0.46, 28), new THREE.MeshStandardMaterial({ map: canvasTex((x, w) => { x.fillStyle = '#8b1d3a'; x.fillRect(0, 0, w, w); x.strokeStyle = '#e9b76a'; x.lineWidth = 34; for (let i = 1; i < 6; i++) { x.beginPath(); x.moveTo(i * w / 6, 0); x.lineTo(i * w / 6, w); x.stroke(); x.beginPath(); x.moveTo(0, i * w / 6); x.lineTo(w, i * w / 6); x.stroke(); } }, 256, 256), roughness: 0.8 }), 0, 0.205, 0, false);
  top.rotation.x = -Math.PI / 2; g.add(top);
  g.add(mesh(new THREE.TorusGeometry(0.46, 0.06, 8, 28), P('#e9b76a'), 0, 0.2, 0, false)); g.children[2].rotation.x = Math.PI / 2;
  return g;
}
export function makePan() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.48, 0.42, 0.1, 24), P('#2b2b30', { roughness: 0.5, metalness: 0.4 }), 0, 0.05, 0));
  g.add(box(0.12, 0.06, 0.8, P('#1b1b1f'), 0, 0.08, -0.82, 0.02));
  return g;
}
export function makePancake() { const g = new THREE.Group(); g.add(mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.08, 24), P('#e3a85c'), 0, 0, 0)); g.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.085, 24), P('#c98c43'), 0, 0.002, 0, false)); return g; }
export function makeStack(n = 8) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.55, 0.5, 0.05, 24), P('#ffffff', { roughness: 0.4 }), 0, 0.025, 0));
  for (let i = 0; i < n; i++) { const p = makePancake(); p.position.y = 0.09 + i * 0.085; p.rotation.y = i; g.add(p); }
  g.add(box(0.2, 0.12, 0.2, P('#ffe56b'), 0, 0.15 + n * 0.085, 0, 0.03));
  return g;
}
export function makeSpoon(s = 1) {
  const g = new THREE.Group();
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), GOLD); bowl.scale.set(1, 0.35, 1.4); bowl.rotation.x = Math.PI; bowl.position.set(0, 0.0, 0.35); g.add(bowl);
  g.add(box(0.1, 0.05, 1.0, GOLD, 0, 0.0, -0.4, 0.02));
  g.children.forEach((c) => (c.castShadow = true)); g.scale.setScalar(s); return g;
}
export function makeFlame() {
  const g = new THREE.Group();
  const cols = ['#ff3b1f', '#ff8a1f', '#ffd23f'];
  cols.forEach((c, i) => { const m = new THREE.Mesh(new THREE.ConeGeometry(0.28 - i * 0.07, 0.8 - i * 0.18, 10), new THREE.MeshBasicMaterial({ color: c, toneMapped: false, transparent: true, opacity: 0.92 })); m.position.y = 0.4 - i * 0.08; g.add(m); });
  g.userData.tick = (t) => g.children.forEach((m, i) => { m.scale.set(1 + 0.15 * Math.sin(t * 23 + i), 1 + 0.25 * Math.sin(t * 17 + i * 2), 1 + 0.15 * Math.cos(t * 19 + i)); });
  return g;
}
export function buildExtra(W, root, { makeBird, SETS }) {
  W.pie = makePie(); root.add(W.pie);
  W.pie2 = makePie(); root.add(W.pie2);
  W.birds = Array.from({ length: 7 }, () => { const b = makeBird(); root.add(b); return b; });
  W.pan = makePan(); root.add(W.pan);
  W.pancake = makePancake(); root.add(W.pancake);
  W.stack = makeStack(10); root.add(W.stack);
  W.toast = box(0.5, 0.12, 0.5, P('#e0b070'), 0, 0, 0, 0.05); root.add(W.toast);
  W.toaster = new THREE.Group(); W.toaster.add(box(0.8, 0.55, 0.5, P('#c0c6d0', { metalness: 0.5, roughness: 0.3 }), 0, 0.28, 0, 0.1)); root.add(W.toaster);
  W.cereal = new THREE.Group(); W.cereal.add(mesh(new THREE.CylinderGeometry(0.4, 0.28, 0.28, 20), P('#5aa0f0', { roughness: 0.5 }), 0, 0.14, 0));
  W.cerealBits = []; { const R = rng(4); for (let i = 0; i < 14; i++) { const b = mesh(new THREE.TorusGeometry(0.05, 0.025, 6, 10), P('#ffc24a'), (R() - 0.5) * 0.5, 0.28, (R() - 0.5) * 0.5, false); b.rotation.set(R() * 3, R() * 3, 0); W.cereal.add(b); W.cerealBits.push(b); } }
  root.add(W.cereal);
  W.cone = new THREE.Group(); const cn = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 14), P('#d9a35a')); cn.rotation.x = Math.PI; cn.position.y = 0.25; W.cone.add(cn);
  W.scoop = mesh(new THREE.SphereGeometry(0.2, 14, 10), P('#ff9ec4', { roughness: 0.6 }), 0, 0.55, 0, false); W.cone.add(W.scoop); root.add(W.cone);
  W.flame = makeFlame(); root.add(W.flame);
  W.burnt = BURNT;
  W.toastMat = W.toast.material; W.scoopMat = W.scoop.material; W.bitMat = W.cerealBits[0].material;
  W.setBurnt = (on) => { W.toast.material = on.toast ? BURNT : W.toastMat; W.scoop.material = on.cone ? BURNT : W.scoopMat; W.cerealBits.forEach((b) => (b.material = on.cereal ? BURNT : W.bitMat)); };
  // smoke alarm on the kitchen ceiling ("HI LEO!")
  const al = new THREE.Group(); al.position.copy(SETS.kitchen).add(new THREE.Vector3(1.2, 4.12, 0.5)); root.add(al); W.alarm = al;
  al.add(mesh(new THREE.CylinderGeometry(0.5, 0.55, 0.16, 28), P('#f4f4f4', { roughness: 0.5 }), 0, 0, 0));
  const scr = mesh(new THREE.PlaneGeometry(0.62, 0.24), new THREE.MeshBasicMaterial({ map: textTexture('HI LEO!', { w: 256, h: 96, bg: '#163a22', fg: '#5bff8a', font: '900 64px Nunito' }), toneMapped: false }), 0, -0.085, 0.05, false); scr.rotation.x = Math.PI / 2; al.add(scr);
  W.led = new THREE.MeshBasicMaterial({ color: '#ff2020', toneMapped: false }); const led = mesh(new THREE.SphereGeometry(0.06, 10, 8), W.led, 0.32, -0.08, -0.18, false); al.add(led);
  // pizza
  W.pizzaTex = { raw: pizzaTex(false), gold: pizzaTex(true) };
  W.pizzaTop = new THREE.MeshStandardMaterial({ map: W.pizzaTex.raw, roughness: 0.7 });
  W.pizza = new THREE.Group(); const pz = mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.07, 36), [P('#e8c48a'), W.pizzaTop, P('#e8c48a')], 0, 0, 0); W.pizza.add(pz); root.add(W.pizza);
  W.slice = new THREE.Group(); const sl = mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.07, 12, 1, false, 0, Math.PI / 4), [P('#c8792c'), new THREE.MeshStandardMaterial({ map: W.pizzaTex.gold, roughness: 0.7 }), P('#c8792c')], 0, 0, 0); W.slice.add(sl); root.add(W.slice);
  W.setPizza = (golden, glow = 0) => { W.pizzaTop.map = golden ? W.pizzaTex.gold : W.pizzaTex.raw; W.pizzaTop.emissive = new THREE.Color('#ff8a1f'); W.pizzaTop.emissiveIntensity = glow; };
  W.spoon = makeSpoon(1); root.add(W.spoon);
  W.pedestal = new THREE.Group(); root.add(W.pedestal);
  W.pedestal.add(box(1.4, 1.2, 1.4, P('#ffffff'), 0, 0.6, 0, 0.06)); W.pedestal.add(box(1.6, 0.15, 1.6, P('#e23b3b'), 0, 1.25, 0, 0.04));
  // the stage with three cooking tables
  const st = new THREE.Group(); st.position.copy(SETS.pull).add(new THREE.Vector3(0, 0, 10)); root.add(st); W.stage = st;
  st.add(mesh(new THREE.CylinderGeometry(4.2, 4.4, 0.5, 40), P('#ff7a2e', { roughness: 0.6 }), 0, 0.25, 0));
  st.add(mesh(new THREE.CylinderGeometry(4.25, 4.25, 0.06, 40), P('#ffd23f', { roughness: 0.6 }), 0, 0.5, 0, false));
  W.tables = [[-2.6, -0.6], [2.6, -0.6], [0, 1.9]].map(([x, z]) => {
    const t = new THREE.Group(); t.position.set(x, 0.5, z); st.add(t);
    t.add(box(2.0, 0.1, 1.0, P('#ffffff'), 0, 1.25, 0, 0.03)); t.add(box(2.02, 0.5, 1.02, P('#e23b3b'), 0, 1.0, 0, 0.02));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) t.add(box(0.1, 1.2, 0.1, P('#9aa3ad'), sx * 0.9, 0.6, sz * 0.4, 0.02));
    return t;
  });
  W.TABLE_Y = 0.5 + 1.3;
  W.hideExtra = () => {
    [W.pie, W.pie2, ...W.birds, W.pan, W.pancake, W.stack, W.toast, W.toaster, W.cereal, W.cone, W.flame, W.pizza, W.slice, W.spoon, W.pedestal, W.alarm].forEach((o) => (o.visible = false));
    W.setBurnt({}); W.setPizza(false, 0); W.pizza.rotation.set(0, 0, 0); W.pizza.scale.setScalar(1);
  };
}
