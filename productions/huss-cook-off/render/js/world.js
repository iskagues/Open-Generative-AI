// World: bright pastel blocky town + interiors + the Big Pull (tug of war) field.
import * as THREE from 'three';
import { rbox, mat, mesh, makeChar, CAST, citizen } from './chars.js';
import { textTexture, faceTexture } from './faces.js';
import { rng } from './util.js';
import { buildExtra } from './extra.js';

export const SETS = {
  town: new THREE.Vector3(0, 0, 0),
  kitchen: new THREE.Vector3(400, 0, 80),
  bedroom: new THREE.Vector3(400, 0, 160),
  garage: new THREE.Vector3(400, 0, 240),
  pull: new THREE.Vector3(0, 0, -500),
};
const box = (w, h, d, m, x, y, z, r = 0.04) => mesh(rbox(w, h, d, r, 2), m, x, y, z);
const P = (c, o) => mat(c, Object.assign({ roughness: 0.9 }, o));

// shared "glass" so night can light every window at once
export const GLASS = new THREE.MeshStandardMaterial({ color: '#bfe6ff', roughness: 0.25, metalness: 0.0, emissive: '#ffc86b', emissiveIntensity: 0 });
export const LAMPGLOW = new THREE.MeshStandardMaterial({ color: '#fff6d8', emissive: '#ffd27a', emissiveIntensity: 0 });

function windowAt(g, x, y, z, w = 1.3, h = 1.5, ry = 0) {
  const W = new THREE.Group(); W.position.set(x, y, z); W.rotation.y = ry;
  const fr = P('#ffffff');
  W.add(box(w + 0.24, h + 0.24, 0.16, fr, 0, 0, 0, 0.03));
  W.add(mesh(new THREE.BoxGeometry(w, h, 0.18), GLASS, 0, 0, 0.01, false));
  W.add(box(0.08, h, 0.22, fr, 0, 0, 0.02, 0.01)); W.add(box(w, 0.08, 0.22, fr, 0, 0, 0.02, 0.01));
  g.add(W); return W;
}

/** Pastel suburban house. Front faces +z (local). */
export function makeHouse({ wall = '#ffd36b', roof = '#5b6070', door = '#d6453d', w = 9, d = 8, h = 5.2, stories = 2, flat = false, porch = true, seed = 1 } = {}) {
  const g = new THREE.Group();
  const R = rng(seed);
  const wm = P(wall), trim = P('#ffffff');
  g.add(box(w, h, d, wm, 0, h / 2, 0, 0.06));
  g.add(box(w + 0.2, 0.3, d + 0.2, P('#e9e2d6'), 0, 0.15, 0)); // foundation
  // horizontal siding lines
  const sid = P(new THREE.Color(wall).multiplyScalar(0.9).getStyle());
  for (let y = 0.9; y < h - 0.2; y += 0.55) g.add(mesh(new THREE.BoxGeometry(w + 0.02, 0.05, d + 0.02), sid, 0, y, 0, false));
  // corners
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.26, h, 0.26, trim, sx * w / 2, h / 2, sz * d / 2, 0.03));
  const rm = P(roof);
  if (flat) {
    g.add(box(w + 0.5, 0.35, d + 0.5, rm, 0, h + 0.17, 0));
    // terrace railing
    const rail = P('#ffffff');
    for (const sx of [-1, 1]) g.add(box(0.12, 0.9, d, rail, sx * (w / 2), h + 0.8, 0, 0.03));
    g.add(box(w, 0.9, 0.12, rail, 0, h + 0.8, d / 2, 0.03)); g.add(box(w, 0.9, 0.12, rail, 0, h + 0.8, -d / 2, 0.03));
    g.userData.roofY = h + 0.35;
  } else {
    const rise = 2.6, half = d / 2 + 0.6, slope = Math.hypot(half, rise), ang = Math.atan2(rise, half);
    for (const s of [-1, 1]) {
      const r = box(w + 0.9, 0.3, slope, rm, 0, h + rise / 2, s * half / 2, 0.05);
      r.rotation.x = s * ang; g.add(r);
    }
    // gable ends
    const tri = new THREE.Shape(); tri.moveTo(-d / 2, 0); tri.lineTo(d / 2, 0); tri.lineTo(0, rise - 0.1); tri.lineTo(-d / 2, 0);
    const tg = new THREE.ExtrudeGeometry(tri, { depth: w - 0.02, bevelEnabled: false });
    const gm = mesh(tg, wm, -(w - 0.02) / 2, h, 0); gm.rotation.y = Math.PI / 2; gm.position.set(-(w - 0.02) / 2, h, 0); g.add(gm);
    // chimney
    g.add(box(0.9, 2.2, 0.9, P('#b8583f'), w * 0.28, h + 1.9, -d * 0.18));
    g.userData.roofY = h + rise;
  }
  // windows (front + back)
  const perRow = Math.max(2, Math.round(w / 3));
  for (let r = 0; r < stories; r++) {
    for (let i = 0; i < perRow; i++) {
      const x = -w / 2 + (i + 0.5) * (w / perRow);
      if (r === 0 && Math.abs(x) < 1.2 && porch) continue;
      windowAt(g, x, 1.5 + r * 2.4, d / 2 + 0.02);
      windowAt(g, x, 1.5 + r * 2.4, -d / 2 - 0.02, 1.3, 1.5, Math.PI);
    }
    windowAt(g, w / 2 + 0.02, 1.5 + r * 2.4, 0, 1.2, 1.4, Math.PI / 2);
    windowAt(g, -w / 2 - 0.02, 1.5 + r * 2.4, 0, 1.2, 1.4, -Math.PI / 2);
  }
  // door + porch
  if (porch) {
    g.add(box(1.4, 2.4, 0.2, P(door), 0, 1.5, d / 2 + 0.05, 0.04));
    g.add(mesh(new THREE.SphereGeometry(0.08, 8, 6), P('#ffd23f', { metalness: 0.6, roughness: 0.3 }), 0.45, 1.45, d / 2 + 0.2, false));
    g.add(box(3.2, 0.3, 1.6, P('#e9e2d6'), 0, 0.3, d / 2 + 0.8));
    g.add(box(3.4, 0.2, 1.8, trim, 0, 3.0, d / 2 + 0.85));
    for (const sx of [-1, 1]) g.add(box(0.18, 2.6, 0.18, trim, sx * 1.5, 1.7, d / 2 + 1.55, 0.03));
  }
  g.userData.w = w; g.userData.d = d; g.userData.h = h;
  return g;
}

export function makeTree(seed = 1, s = 1) {
  const R = rng(seed), g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.25 * s, 0.35 * s, 2.4 * s, 8), P('#8a5a35'), 0, 1.2 * s, 0));
  const leaf = P(['#58b947', '#4caf50', '#6cc551', '#3fa34d'][(R() * 4) | 0]);
  const n = 3 + ((R() * 2) | 0);
  for (let i = 0; i < n; i++) {
    const b = mesh(new THREE.IcosahedronGeometry((1.4 + R() * 0.6) * s, 1), leaf, (R() - 0.5) * 1.6 * s, (3 + R() * 1.4) * s, (R() - 0.5) * 1.6 * s);
    b.material = leaf; g.add(b);
  }
  return g;
}
export function makeFence(len, m = P('#ffffff')) {
  const g = new THREE.Group();
  for (let x = -len / 2; x <= len / 2 + 0.01; x += 0.6) g.add(box(0.18, 1.1, 0.1, m, x, 0.55, 0, 0.03));
  g.add(box(len, 0.12, 0.08, m, 0, 0.75, -0.06, 0.02)); g.add(box(len, 0.12, 0.08, m, 0, 0.35, -0.06, 0.02));
  return g;
}
export function makeMailbox(color = '#3b6fd1') {
  const g = new THREE.Group();
  g.add(box(0.18, 1.2, 0.18, P('#7a5a3a'), 0, 0.6, 0, 0.03));
  const b = box(0.62, 0.62, 1.05, P(color), 0, 1.45, 0, 0.18); g.add(b);
  const flag = box(0.06, 0.5, 0.18, P('#e23b3b'), 0.36, 1.6, -0.1, 0.02); g.add(flag);
  g.userData.box = b; g.userData.flag = flag;
  return g;
}
export function makeLamp() {
  const g = new THREE.Group();
  const pole = P('#3a3f4a', { roughness: 0.6 });
  g.add(mesh(new THREE.CylinderGeometry(0.1, 0.14, 5, 8), pole, 0, 2.5, 0));
  g.add(box(0.5, 0.35, 0.5, pole, 0, 5.1, 0, 0.06));
  g.add(mesh(new THREE.BoxGeometry(0.42, 0.3, 0.42), LAMPGLOW, 0, 4.85, 0, false));
  return g;
}
export function makeCloud(seed, s = 1) {
  const R = rng(seed), g = new THREE.Group();
  const m = new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#e9f3ff', emissiveIntensity: 0.55 });
  const n = 5 + ((R() * 4) | 0);
  for (let i = 0; i < n; i++) {
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), m);
    const r = (1.6 + R() * 1.6) * s; b.scale.set(r, r * 0.8, r);
    b.position.set((i - n / 2) * 1.9 * s + (R() - 0.5) * s, R() * 0.9 * s, (R() - 0.5) * 2 * s); g.add(b);
  }
  g.userData.cloud = true; return g;
}
export function makeTrampoline() {
  const g = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.16, 8, 32), P('#2f7de1')); rim.rotation.x = Math.PI / 2; rim.position.y = 1; g.add(rim);
  const pad = new THREE.Mesh(new THREE.CircleGeometry(2.3, 32), P('#1d1f24', { roughness: 0.7 })); pad.rotation.x = -Math.PI / 2; pad.position.y = 0.95; g.add(pad); g.userData.pad = pad;
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.add(box(0.12, 1, 0.12, P('#9aa3ad'), Math.cos(a) * 2.3, 0.5, Math.sin(a) * 2.3, 0.03)); }
  return g;
}
export function makeCat() {
  const g = new THREE.Group(), o = P('#ff9f43'), w = P('#fff3e0');
  const body = box(0.6, 0.5, 1.0, o, 0, 0.55, 0, 0.15); g.add(body);
  const head = new THREE.Group(); head.position.set(0, 0.95, 0.5); g.add(head);
  head.add(box(0.62, 0.55, 0.55, o, 0, 0, 0, 0.16));
  for (const s of [-1, 1]) { const e = box(0.16, 0.22, 0.1, o, s * 0.2, 0.36, 0, 0.03); e.rotation.z = s * -0.3; head.add(e); }
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.5), new THREE.MeshStandardMaterial({ map: faceTexture('smug'), transparent: true, polygonOffset: true, polygonOffsetFactor: -2 }));
  face.position.z = 0.28; head.add(face);
  g.add(box(0.3, 0.2, 0.1, w, 0, 0.5, 0.52, 0.04));
  for (const [x, z] of [[-0.2, 0.35], [0.2, 0.35], [-0.2, -0.35], [0.2, -0.35]]) g.add(box(0.16, 0.35, 0.16, o, x, 0.17, z, 0.05));
  const tail = box(0.12, 0.12, 0.8, o, 0, 0.9, -0.75, 0.05); tail.rotation.x = -0.8; g.add(tail);
  g.userData.face = face; return g;
}
export function makeBird() {
  const g = new THREE.Group(), wm = P('#ffffff'), y = P('#ffb02e');
  g.add(box(0.5, 0.45, 0.8, wm, 0, 0, 0, 0.14));
  g.add(box(0.42, 0.4, 0.42, wm, 0, 0.25, 0.42, 0.12));
  g.add(box(0.16, 0.1, 0.22, y, 0, 0.22, 0.72, 0.03));
  for (const s of [-1, 1]) { g.add(mesh(new THREE.SphereGeometry(0.05, 8, 6), P('#111'), s * 0.15, 0.32, 0.6, false)); }
  const wings = [];
  for (const s of [-1, 1]) { const piv = new THREE.Group(); piv.position.set(s * 0.25, 0.05, 0); const wg = box(0.8, 0.08, 0.5, wm, s * 0.4, 0, 0, 0.03); piv.add(wg); g.add(piv); wings.push(piv); }
  g.userData.wings = wings; return g;
}
export function makePlane() {
  const g = new THREE.Group(), w = P('#ffffff'), b = P('#2f7de1');
  const fus = mesh(new THREE.CapsuleGeometry(1.2, 9, 6, 12), w, 0, 0, 0); fus.rotation.z = Math.PI / 2; g.add(fus);
  g.add(box(3, 0.3, 14, w, 0, -0.2, 0, 0.1));
  g.add(box(2, 3, 0.3, b, -5, 1.8, 0, 0.1));
  g.add(box(1.6, 0.25, 5, w, -5, 0.5, 0, 0.1));
  for (let i = -3; i <= 3; i++) for (const s of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(0.4, 0.45, 0.05), P('#9ad4ff'), i * 1.1, 0.5, s * 1.18, false));
  g.add(box(10, 0.4, 0.05, b, 0, -0.1, 1.2, 0.02)); g.add(box(10, 0.4, 0.05, b, 0, -0.1, -1.2, 0.02));
  return g;
}

export function makeCar(color = '#ff9ec4') {
  const g = new THREE.Group(), body = P(color, { roughness: 0.45 }), glass = P('#bfe6ff', { roughness: 0.2 }), tire = P('#1d1f24');
  g.add(box(2.2, 0.9, 4.2, body, 0, 0.85, 0, 0.25));
  g.add(box(1.9, 0.8, 2.2, body, 0, 1.65, -0.3, 0.22));
  g.add(mesh(new THREE.BoxGeometry(1.92, 0.6, 2.0), glass, 0, 1.68, -0.3, false));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const w = mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.35, 16), tire, sx * 1.05, 0.45, sz * 1.35); w.rotation.z = Math.PI / 2; g.add(w); }
  for (const sx of [-1, 1]) { g.add(mesh(new THREE.BoxGeometry(0.4, 0.22, 0.05), P('#fff6c0', { emissive: '#fff2a0', emissiveIntensity: 0.6 }), sx * 0.7, 0.95, 2.11, false)); }
  g.add(box(2.24, 0.2, 0.2, P('#c0c6d0', { metalness: 0.6, roughness: 0.3 }), 0, 0.5, 2.12, 0.05));
  return g;
}
export function makeTruck() {
  const g = new THREE.Group(), w = P('#ffffff', { roughness: 0.5 }), pk = P('#ff8fb8', { roughness: 0.5 }), glass = P('#bfe6ff', { roughness: 0.2 }), tire = P('#1d1f24');
  g.add(box(2.8, 2.9, 6.2, w, 0, 2.05, -0.6, 0.25));
  // open cab so the sleeping driver can be seen
  g.add(box(2.6, 0.7, 1.8, w, 0, 0.95, 3.3, 0.15));
  g.add(box(2.7, 0.25, 1.9, pk, 0, 3.35, 3.3, 0.1));
  for (const sx of [-1.22, 1.22]) for (const sz of [2.5, 4.1]) g.add(box(0.16, 2.1, 0.16, w, sx, 2.25, sz, 0.04));
  g.add(mesh(new THREE.BoxGeometry(2.4, 1.6, 0.06), new THREE.MeshStandardMaterial({ color: '#bfe6ff', transparent: true, opacity: 0.25, depthWrite: false }), 0, 2.15, 4.15, false));
  g.add(box(1.4, 0.3, 0.7, P('#444a55'), 0, 1.4, 2.9, 0.08));
  g.add(box(2.84, 0.5, 6.24, pk, 0, 0.9, -0.6, 0.1));
  g.add(box(2.84, 0.3, 6.24, pk, 0, 3.4, -0.6, 0.1));
  // serving window (left side, +x) - open so the sleeping driver can be seen
  g.add(mesh(new THREE.BoxGeometry(0.06, 1.1, 2.4), new THREE.MeshStandardMaterial({ color: '#3a2a3a', transparent: true, opacity: 0.15, depthWrite: false }), 1.41, 2.25, -0.4, false));
  for (const y of [1.65, 2.85]) g.add(box(0.1, 0.12, 2.6, pk, 1.43, y, -0.4, 0.03));
  const sign = mesh(new THREE.PlaneGeometry(4.2, 0.7), new THREE.MeshStandardMaterial({ map: textTexture([{ t: 'ICE CREAM', fg: '#ffffff', font: '900 100px Nunito', stroke: '#e0407a', sw: 10 }], { w: 1024, h: 170, bg: '#ff8fb8' }) }), 1.43, 3.05, -0.6, false); sign.rotation.y = Math.PI / 2; g.add(sign);
  // giant cone on the roof
  const cone = mesh(new THREE.ConeGeometry(0.7, 1.8, 14), P('#e0a35a'), 0, 4.5, -0.6); cone.rotation.x = Math.PI; g.add(cone);
  g.add(mesh(new THREE.IcosahedronGeometry(0.85, 2), P('#ffc0dc'), 0, 5.55, -0.6));
  g.add(mesh(new THREE.IcosahedronGeometry(0.25, 1), P('#e23b3b'), 0, 6.45, -0.6));
  for (const sz of [-2.6, 1.4, 3.3]) for (const sx of [-1, 1]) { const t = mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.4, 16), tire, sx * 1.3, 0.55, sz); t.rotation.z = Math.PI / 2; g.add(t); }
  return g;
}
export function makeJar() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.42, 16), P('#f7a8c4', { roughness: 0.25, transparent: true, opacity: 0.9 }), 0, 0.21, 0));
  g.add(mesh(new THREE.PlaneGeometry(0.3, 0.18), new THREE.MeshStandardMaterial({ map: textTexture([{ t: 'JAM', fg: '#c2185b', font: '900 90px Nunito' }], { w: 256, h: 128, bg: '#ffffff' }) }), 0, 0.2, 0.205, false));
  const lid = mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.1, 16), P('#e23b3b', { metalness: 0.3, roughness: 0.4 }), 0, 0.47, 0);
  g.add(lid); g.userData.lid = lid; return g;
}
export function makeParcel(s = 1, color = '#c79a63') {
  const g = new THREE.Group();
  g.add(box(1.0 * s, 0.8 * s, 0.8 * s, P(color), 0, 0, 0, 0.04));
  g.add(mesh(new THREE.BoxGeometry(1.02 * s, 0.12 * s, 0.82 * s), P('#e8d6a8'), 0, 0, 0, false));
  return g;
}

function makeSky() {
  const u = { uTop: { value: new THREE.Color('#4fa3f7') }, uHor: { value: new THREE.Color('#bfe4ff') }, uBot: { value: new THREE.Color('#d8efff') }, uStars: { value: 0 } };
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: u,
    vertexShader: 'varying vec3 vP; void main(){ vP=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `uniform vec3 uTop,uHor,uBot; uniform float uStars; varying vec3 vP;
      float h(vec3 p){ return fract(sin(dot(p,vec3(12.9898,78.233,45.164)))*43758.5453); }
      void main(){ float y=vP.y; vec3 c = y>0.0 ? mix(uHor,uTop,pow(clamp(y,0.0,1.0),0.6)) : mix(uHor,uBot,clamp(-y*3.0,0.0,1.0));
        if(uStars>0.0 && y>0.05){ vec3 q=floor(vP*260.0); float s=step(0.992,h(q)); float tw=0.6+0.4*h(q+1.0); c+=vec3(s*tw*uStars*smoothstep(0.05,0.3,y)); }
        gl_FragColor=vec4(c,1.0);
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), m); sky.renderOrder = -10; sky.frustumCulled = false;
  return { sky, u };
}

// ------------------------------------------------------------------ town
function buildTown(root, W) {
  const T = new THREE.Group(); root.add(T); W.town = T;
  const ground = mesh(new THREE.PlaneGeometry(700, 700), P('#7ccf5a'), 0, 0, 0); ground.rotation.x = -Math.PI / 2; T.add(ground);
  const asphalt = P('#565c66', { roughness: 0.95 }), walk = P('#d7d9dc'), line = P('#ffffff'), yel = P('#ffd23f');
  const road = (x, z, w, l, alongX) => {
    const r = mesh(new THREE.BoxGeometry(alongX ? l : w, 0.1, alongX ? w : l), asphalt, x, 0.05, z); T.add(r);
    for (let s = -l / 2 + 2; s < l / 2; s += 5) T.add(mesh(new THREE.BoxGeometry(alongX ? 2.4 : 0.22, 0.02, alongX ? 0.22 : 2.4), line, alongX ? x + s : x, 0.11, alongX ? z : z + s, false));
    for (const sd of [-1, 1]) T.add(mesh(new THREE.BoxGeometry(alongX ? l : 2.2, 0.25, alongX ? 2.2 : l), walk, alongX ? x : x + sd * (w / 2 + 1.1), 0.12, alongX ? z + sd * (w / 2 + 1.1) : z));
  };
  road(0, 0, 8, 240, true);
  road(0, 60, 8, 240, true);
  road(0, -60, 8, 240, true);
  for (const x of [-60, 60]) road(x, 0, 8, 180, false);
  const walls = ['#ffd36b', '#9ed2ff', '#ffb3c7', '#b8e6a1', '#f7f1e3', '#c9b3ff', '#ffc89e', '#a8e6e0'];
  const roofs = ['#5b6070', '#c0473a', '#6b4a3a', '#4a5a7a', '#5b6070', '#8a3b3b'];
  const doors = ['#d6453d', '#2f7de1', '#2e9e5b', '#7b3fe4', '#ffffff'];
  W.houses = []; W.fences = []; W.mailboxes = []; W.lamps = [];
  let k = 0;
  for (const rowZ of [-60, 0, 60]) for (const side of [-1, 1]) for (let x = -104; x <= 104; x += 13) {
    if (Math.abs(x - 60) < 6 || Math.abs(x + 60) < 6) continue;
    const z = rowZ + side * 14;
    const isMilo = rowZ === 0 && side === -1 && x === 0, isZoe = rowZ === 0 && side === -1 && x === 13;
    const R = rng(k * 31 + 7);
    const hs = makeHouse({
      wall: isMilo ? '#9ed2ff' : isZoe ? '#ffb3c7' : walls[k % walls.length], roof: isMilo ? '#5b6070' : roofs[(R() * roofs.length) | 0],
      door: doors[(R() * doors.length) | 0], flat: isZoe, seed: k, w: 9 + ((R() * 2) | 0), h: 5.2,
    });
    hs.position.set(x, 0, z); hs.rotation.y = side < 0 ? 0 : Math.PI; T.add(hs);
    W.houses.push(hs); if (isMilo) W.miloHouse = hs; if (isZoe) W.zoeHouse = hs;
    // front yard fence + mailbox
    const fz = rowZ + side * 7.6;
    const f1 = makeFence(4); f1.position.set(x - 3.4, 0, fz); f1.rotation.y = side < 0 ? 0 : Math.PI; T.add(f1);
    const f2 = makeFence(4); f2.position.set(x + 3.4, 0, fz); f2.rotation.y = side < 0 ? 0 : Math.PI; T.add(f2);
    W.fences.push(f1, f2);
    const mb = makeMailbox(['#3b6fd1', '#e23b3b', '#2e9e5b', '#333'][k % 4]); mb.position.set(x + 2, 0.25, rowZ + side * 6.8); mb.rotation.y = side < 0 ? 0 : Math.PI; T.add(mb); W.mailboxes.push(mb);
    if (isMilo) W.miloMailbox = mb;
    if (R() < 0.7) { const t = makeTree(k + 3, 0.9 + R() * 0.3); t.position.set(x + 5.8, 0, z + side * 5); T.add(t); }
    if (k % 2 === 0) { const l = makeLamp(); l.position.set(x - 6.5, 0.25, rowZ + side * 5.2); T.add(l); W.lamps.push(l); }
    k++;
  }
  // backyard of Milo: trampoline
  W.tramp = makeTrampoline(); W.tramp.position.set(-2, 0, -26); T.add(W.tramp);
  const bf = makeFence(22); bf.position.set(0, 0, -31); T.add(bf);
  // town park / extra trees around edge
  for (let i = 0; i < 60; i++) { const R = rng(500 + i); const a = R() * Math.PI * 2, r = 130 + R() * 90; const t = makeTree(600 + i, 1.2 + R()); t.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); T.add(t); }
  // roof party string lights on Zoe's roof
  W.partyLights = [];
  const zr = W.zoeHouse.userData.roofY;
  const bulbCols = ['#ff5c8a', '#ffd23f', '#58d68d', '#5dade2', '#c39bd3'];
  for (let i = 0; i < 16; i++) {
    const m = new THREE.MeshStandardMaterial({ color: bulbCols[i % 5], emissive: bulbCols[i % 5], emissiveIntensity: 0 });
    const b = mesh(new THREE.SphereGeometry(0.13, 8, 6), m, 13 - 4.5 + i * 0.6, zr + 1.35 + Math.sin(i / 15 * Math.PI) * -0.3, -14 + 4.1, false); T.add(b); W.partyLights.push(m);
  }
}

// ------------------------------------------------------------------ interiors
function room(root, at, { w = 12, d = 10, h = 4.2, wall = '#d6f2ec', floor = '#e9e4da', ceiling = true } = {}) {
  const g = new THREE.Group(); g.position.copy(at); root.add(g);
  const fl = mesh(new THREE.BoxGeometry(w, 0.2, d), P(floor), 0, -0.1, 0); g.add(fl);
  const wm = P(wall);
  g.add(mesh(new THREE.BoxGeometry(w, h, 0.2), wm, 0, h / 2, -d / 2));
  g.add(mesh(new THREE.BoxGeometry(0.2, h, d), wm, -w / 2, h / 2, 0));
  g.add(mesh(new THREE.BoxGeometry(0.2, h, d), wm, w / 2, h / 2, 0));
  if (ceiling) g.add(mesh(new THREE.BoxGeometry(w, 0.2, d), P('#ffffff'), 0, h + 0.1, 0));
  g.add(mesh(new THREE.BoxGeometry(w, 0.25, 0.25), P('#ffffff'), 0, 0.12, -d / 2 + 0.15, false));
  return g;
}
function buildInteriors(root, W) {
  // kitchen
  const K = room(root, SETS.kitchen, { wall: '#fff1c9', floor: '#c9a27a' }); W.kitchen = K;
  K.add(box(10, 1.0, 1.4, P('#ffffff'), 0, 0.5, -4.2)); K.add(box(10, 0.15, 1.5, P('#7a8796'), 0, 1.07, -4.2));
  K.add(box(1.8, 3.4, 1.4, P('#eef3f7'), 4.6, 1.7, -4.2)); // fridge
  for (let i = 0; i < 4; i++) K.add(box(2, 1.0, 0.6, P('#ffffff'), -3.9 + i * 2.3, 3.0, -4.6));
  windowAt(K, -1.5, 2.4, -4.88, 2.6, 1.4);
  K.add(box(4.2, 0.18, 2.6, P('#f2a65a'), 0, 1.4, 0)); for (const [x, z] of [[-1.9, -1.1], [1.9, -1.1], [-1.9, 1.1], [1.9, 1.1]]) K.add(box(0.18, 1.4, 0.18, P('#c97b38'), x, 0.7, z));
  // grandpa's mega spicy chili
  const pot = new THREE.Group(); pot.position.set(0, 1.49, 0); K.add(pot); W.chili = pot;
  pot.add(mesh(new THREE.CylinderGeometry(0.62, 0.5, 0.42, 24), P('#ffffff', { roughness: 0.4 }), 0, 0.21, 0));
  const soup = W.soup = mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.04, 24), P('#d4281c', { roughness: 0.5, emissive: '#7a0c05', emissiveIntensity: 0.25 }), 0, 0.4, 0, false); pot.add(soup);
  for (let i = 0; i < 7; i++) { const R = rng(40 + i); const pep = mesh(new THREE.CapsuleGeometry(0.05, 0.22, 3, 8), P('#ff3b1f'), (R() - 0.5) * 0.7, 0.44, (R() - 0.5) * 0.7, false); pep.rotation.set(Math.PI / 2, 0, R() * 6); pot.add(pep); }
  const spoon = box(0.08, 0.04, 0.9, P('#c0c6d0', { metalness: 0.6, roughness: 0.3 }), 0.45, 0.5, 0.35, 0.02); spoon.rotation.y = 0.6; pot.add(spoon);
  const lbl = mesh(new THREE.PlaneGeometry(1.4, 0.7), new THREE.MeshStandardMaterial({ map: textTexture([{ t: 'MEGA', fg: '#ff3b1f', font: '900 80px Nunito' }, { t: 'SPICY', fg: '#111', font: '900 62px Nunito' }], { w: 256, h: 128, bg: '#ffe14d' }) }), -1.3, 1.75, -0.2); lbl.rotation.y = 0.5; K.add(lbl); W.chiliLabel = lbl;
  { const pp = box(0.12, 0.45, 0.12, P('#ff3b1f'), -1.3, 1.62, -0.25, 0.03); K.add(pp); W.chiliPepper = pp; }

  // bedroom
  const B = room(root, SETS.bedroom, { wall: '#ffd9b8', floor: '#b98a5e', h: 4.0 }); W.bedroom = B;
  B.add(box(2.6, 0.7, 4.4, P('#ffffff'), -3.9, 0.35, -2.4)); B.add(box(2.6, 0.3, 4.4, P('#ff7a2e'), -3.9, 0.85, -2.4)); B.add(box(2.4, 0.3, 0.9, P('#ffffff'), -3.9, 1.1, -4.1));
  B.add(box(0.3, 1.6, 2.8, P('#e8651c'), -5.3, 0.8, -2.4));
  const winB = windowAt(B, 2.6, 2.2, -4.88, 2.4, 1.8); W.bedWindow = winB;
  // sliding sash (to shut)
  W.sash = box(2.4, 0.9, 0.08, P('#ffffff'), 2.6, 2.6, -4.7, 0.02); B.add(W.sash);
  const poster = mesh(new THREE.PlaneGeometry(2.2, 3.0), new THREE.MeshStandardMaterial({ map: textTexture([{ t: 'THE BIG', font: '900 110px Nunito', fg: '#ffffff', stroke: '#5b3a1f', sw: 14 }, { t: 'PULL', font: '900 170px Nunito', fg: '#ffd23f', stroke: '#5b3a1f', sw: 16 }, { t: 'HUSSVILLE', font: '900 64px Nunito', fg: '#ffffff' }, { t: 'vs MUDVILLE', font: '900 64px Nunito', fg: '#5b3a1f' }], { w: 512, h: 700, bg: '#35c46a' }) }), -1.2, 2.3, -4.88); B.add(poster); W.poster = poster;
  B.add(box(1.4, 1.0, 0.8, P('#7b3fe4'), 5.0, 0.5, -3.8)); // dresser
  // laptop on the bed
  const lap = new THREE.Group(); lap.position.set(-3.9, 1.02, -1.2); lap.rotation.y = Math.PI; B.add(lap); W.laptop = lap;
  lap.add(box(1.1, 0.05, 0.75, P('#c9ced6', { metalness: 0.4, roughness: 0.35 }), 0, 0.03, 0, 0.02));
  const lid = new THREE.Group(); lid.position.set(0, 0.05, -0.37); lid.rotation.x = -0.28; lap.add(lid);
  lid.add(box(1.1, 0.75, 0.04, P('#c9ced6', { metalness: 0.4, roughness: 0.35 }), 0, 0.375, 0, 0.02));
  W.lapTex = {
    tut: textTexture([{ t: 'HOW TO HUSS', fg: '#ffffff', font: '900 64px Nunito' }, { t: '▶', fg: '#ff3b3b', font: '900 120px Nunito' }, { t: '10M views', fg: '#cfd6e0', font: '700 40px Nunito' }], { w: 512, h: 340, bg: '#1d2130' }),
    huss: textTexture([{ t: 'HUSS!', fg: '#ffd23f', font: '900 170px Nunito', stroke: '#1d2130', sw: 10 }], { w: 512, h: 340, bg: '#ff3b3b' }),
  };
  W.lapScreen = new THREE.MeshBasicMaterial({ map: W.lapTex.tut, toneMapped: false });
  lid.add(mesh(new THREE.PlaneGeometry(1.0, 0.66), W.lapScreen, 0, 0.375, 0.022, false));
  // view outside the bedroom window: Zoe's roof scene is shot in the real town, so just sky + houses card here
  // garage
  const G = room(root, SETS.garage, { wall: '#8d96a3', floor: '#9aa0a8', h: 4.4 }); W.garage = G;
  G.add(box(5, 0.2, 1.4, P('#7a5a3a'), -3.5, 1.4, -4.2)); for (let i = 0; i < 6; i++) G.add(box(0.5, 0.6, 0.4, P(['#e23b3b', '#2f7de1', '#ffd23f'][i % 3]), -5.4 + i * 0.75, 1.8, -4.2));
  G.add(box(3, 1.6, 1.6, P('#c9cdd3'), 4.2, 0.8, -3.6)); // boxes
  G.add(box(1.4, 1.4, 1.4, P('#c79a63'), 4.2, 2.3, -3.6));
  W.bulb = mesh(new THREE.SphereGeometry(0.22, 12, 8), new THREE.MeshStandardMaterial({ color: '#fff8e0', emissive: '#ffe2a0', emissiveIntensity: 2.5 }), 0, 3.7, 0, false); G.add(W.bulb);
  G.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 4), P('#222'), 0, 4.1, 0, false));
  W.bulbLight = new THREE.PointLight('#ffd9a0', 0, 18, 1.2); W.bulbLight.position.set(0, 3.5, 0.2); W.bulbLight.castShadow = false; G.add(W.bulbLight);
  const cal = mesh(new THREE.PlaneGeometry(1.4, 1.6), new THREE.MeshStandardMaterial({ map: textTexture([{ t: 'BIG PULL', fg: '#2e9e5b', font: '900 56px Nunito' }, { t: 'X X X X X X X', fg: '#111', font: '900 44px Nunito' }], { w: 256, h: 300, bg: '#ffffff' }) }), 2, 2.4, -4.88); G.add(cal);
}

// ------------------------------------------------------------------ the Big Pull field
function buildPull(root, W) {
  const V = new THREE.Group(); V.position.copy(SETS.pull); root.add(V); W.pull = V;
  const g1 = mesh(new THREE.PlaneGeometry(700, 700), P('#7ccf5a'), 0, -0.01, 0); g1.rotation.x = -Math.PI / 2; V.add(g1);
  // pitch stripes
  for (let i = -6; i <= 6; i++) { const st = mesh(new THREE.PlaneGeometry(24, 4), P(i % 2 ? '#86d864' : '#74c652'), 0, 0.005, i * 4, false); st.rotation.x = -Math.PI / 2; V.add(st); }
  // the mud pit (centre, z -3.5..3.5)
  const mud = P('#6b4423', { roughness: 0.35 }), mud2 = P('#7f5530', { roughness: 0.3 }), rim = P('#8a6a3f');
  V.add(mesh(new THREE.BoxGeometry(12, 0.3, 7), rim, 0, 0.0, 0, false));
  const m0 = mesh(new THREE.PlaneGeometry(11.4, 6.4), mud, 0, 0.16, 0, false); m0.rotation.x = -Math.PI / 2; V.add(m0);
  const Rm = rng(55);
  for (let i = 0; i < 26; i++) { const b = mesh(new THREE.SphereGeometry(0.4 + Rm() * 0.7, 10, 6), Rm() < 0.5 ? mud : mud2, (Rm() - 0.5) * 10.5, 0.12, (Rm() - 0.5) * 5.6, false); b.scale.y = 0.18; V.add(b); }
  W.mudCenter = new THREE.Vector3(0, 0.2, 0).add(SETS.pull);
  // white pulling lines
  for (const z of [5.5, -5.5]) V.add(mesh(new THREE.BoxGeometry(14, 0.03, 0.3), P('#ffffff'), 0, 0.02, z, false));
  // big banner between the stands at the Mudville end
  const ban = mesh(new THREE.PlaneGeometry(18, 3), new THREE.MeshStandardMaterial({ map: textTexture([{ t: 'HUSSVILLE COOK-OFF', font: '900 130px Nunito', fg: '#ffffff', stroke: '#b5480f', sw: 14 }], { w: 1400, h: 180, bg: '#ff7a2e' }) }), 0, 7.5, -34); V.add(ban);
  for (const s of [-1, 1]) V.add(box(0.5, 9, 0.5, P('#ffffff'), s * 9.2, 4.5, -34.2, 0.08));
  // trees behind Mudville (they lose their leaves) and behind Hussville
  W.pullTrees = [];
  for (let i = 0; i < 9; i++) { const t = makeTree(800 + i, 1.4); t.position.set(-24 + i * 6, 0, -42 - (i % 2) * 3); V.add(t); W.pullTrees.push(t); }
  for (let i = 0; i < 9; i++) { const t = makeTree(820 + i, 1.4); t.position.set(-24 + i * 6, 0, 42 + (i % 2) * 3); V.add(t); }
  // the rope: unit cylinder along Y, placed between two points with W.setRope
  const rope = mesh(new THREE.CylinderGeometry(0.09, 0.09, 1, 10), P('#d9b26f', { roughness: 0.95 }), 0, 0, 0); root.add(rope); W.rope = rope;
  const flag = box(0.12, 0.6, 0.35, P('#e23b3b'), 0, 0, 0, 0.03); root.add(flag); W.ropeFlag = flag;
  const up = new THREE.Vector3(0, 1, 0);
  W.setRope = (a, b, flagU = 0.5) => {
    rope.visible = true; const d = b.clone().sub(a); rope.position.copy(a).addScaledVector(d, 0.5);
    rope.scale.set(1, d.length(), 1); rope.quaternion.setFromUnitVectors(up, d.clone().normalize());
    flag.visible = true; flag.position.copy(a).addScaledVector(d, flagU).add(new THREE.Vector3(0, -0.35, 0));
  };
  // scoreboard (timer)
  const sbp = new THREE.Group(); sbp.position.set(17, 0, -16); sbp.rotation.y = -0.6; V.add(sbp); W.scorePivot = sbp;
  for (const s of [-1, 1]) sbp.add(box(0.6, 10, 0.6, P('#3a3f4a'), s * 4, 5, 0, 0.06));
  const sbc = document.createElement('canvas'); sbc.width = 1024; sbc.height = 560; W.scoreCanvas = sbc;
  const sbt = new THREE.CanvasTexture(sbc); sbt.colorSpace = THREE.SRGBColorSpace; sbt.anisotropy = 8; W.scoreTex = sbt;
  sbp.add(box(12, 6.6, 0.8, P('#1b1d22'), 0, 12.5, 0, 0.1));
  sbp.add(mesh(new THREE.PlaneGeometry(11.4, 6.2), new THREE.MeshBasicMaterial({ map: sbt, toneMapped: false }), 0, 12.5, 0.42, false));
  W.setScore = (time) => {
    if (W._sk === time) return; W._sk = time;
    const g = sbc.getContext('2d'); g.fillStyle = '#16181c'; g.fillRect(0, 0, 1024, 560);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '900 92px Nunito'; g.fillStyle = '#ffffff'; g.fillText(W.scoreTitle || 'COOK-OFF', 512, 78);
    g.font = '900 64px Nunito'; g.fillStyle = '#5be38a'; g.fillText(W.scoreSub || 'HUSSVILLE', 512, 470);
    g.font = (time.length > 5 ? '900 150px' : '900 230px') + ' Nunito'; g.fillStyle = W.scoreColor || '#ff3b3b'; g.fillText(time, 512, 280);
    sbt.needsUpdate = true;
  };
  W.setScore('0:10');
  // grandstands both sides with instanced crowd
  W.crowd = [];
  const seats = [];
  for (const side of [-1, 1]) {
    for (let r = 0; r < 7; r++) {
      const x = side * (13 + r * 1.6), y = 0.6 + r * 1.05;
      V.add(mesh(new THREE.BoxGeometry(1.6, 0.3, 70), P(r % 2 ? '#2f7de1' : '#5aa0f0'), x, y, -2, false));
      V.add(mesh(new THREE.BoxGeometry(1.6, y, 70), P('#c9ced6'), x, y / 2, -6, false));
      for (let z = -36; z <= 32; z += 1.05) {
        if (z > -1.5 && z < -19 + 0) {} // seats over the gap are fine (bridge-stand)
        seats.push([x, y + 0.15, z, side]);
      }
    }
  }
  const N = seats.length;
  const R = rng(99);
  const geoT = new THREE.BoxGeometry(0.62, 0.62, 0.34), geoH = new THREE.BoxGeometry(0.56, 0.52, 0.5), geoA = new THREE.BoxGeometry(0.2, 0.6, 0.2), geoF = new THREE.PlaneGeometry(0.5, 0.46);
  const iT = new THREE.InstancedMesh(geoT, new THREE.MeshStandardMaterial({ roughness: 0.9 }), N);
  const iH = new THREE.InstancedMesh(geoH, new THREE.MeshStandardMaterial({ roughness: 0.8 }), N);
  const iA = new THREE.InstancedMesh(geoA, new THREE.MeshStandardMaterial({ roughness: 0.9 }), N * 2);
  const faceM = [faceTexture('grin'), faceTexture('shock'), faceTexture('laugh')].map((t) => new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false, color: '#dddddd' }));
  const iF = faceM.map((m) => new THREE.InstancedMesh(geoF, m, N));
  const tops = ['#ff5d73', '#ffb347', '#50c878', '#7b68ee', '#ff6fb5', '#2ec4b6', '#f9c74f', '#4d96ff', '#ff7a2e', '#a66cff', '#ffffff'];
  const skins = ['#f6d0b1', '#e0ac69', '#c68642', '#8d5524', '#f1c27d', '#ffdbac'];
  const C = new THREE.Color();
  W.crowdData = seats.map((s, i) => ({ x: s[0], y: s[1], z: s[2], side: s[3], ph: R() * 6.28, sp: 0.8 + R() * 0.6, top: tops[(R() * tops.length) | 0], skin: skins[(R() * skins.length) | 0] }));
  W.crowdData.forEach((c, i) => {
    iT.setColorAt(i, C.set(c.top)); iH.setColorAt(i, C.set(c.skin)); iA.setColorAt(2 * i, C.set(c.top)); iA.setColorAt(2 * i + 1, C.set(c.top));
  });
  for (const im of [iT, iH, iA, ...iF]) { im.castShadow = false; im.receiveShadow = false; im.frustumCulled = false; V.add(im); }
  W.crowdMesh = { iT, iH, iA, iF };
  W.crowdExpr = 0;
  W.updateCrowd = (t, energy = 1, mode = 0) => {
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), S = new THREE.Vector3(1, 1, 1), Pp = new THREE.Vector3(), Z = new THREE.Vector3(0, 0, 0);
    const hide = new THREE.Matrix4().makeScale(0, 0, 0);
    W.crowdData.forEach((c, i) => {
      const yaw = c.side > 0 ? -Math.PI / 2 : Math.PI / 2;
      const bounce = Math.max(0, Math.sin(t * 7 * c.sp + c.ph)) * 0.35 * energy;
      E.set(0, yaw, 0); Q.setFromEuler(E);
      Pp.set(c.x, c.y + 0.31 + bounce, c.z); M.compose(Pp, Q, S); iT.setMatrixAt(i, M);
      Pp.set(c.x, c.y + 0.9 + bounce, c.z); M.compose(Pp, Q, S); iH.setMatrixAt(i, M);
      const fx = -Math.sign(c.side) * 0.26;
      Pp.set(c.x + fx, c.y + 0.9 + bounce, c.z); M.compose(Pp, Q, S);
      for (let k = 0; k < 3; k++) iF[k].setMatrixAt(i, k === (mode + (i % 7 === 0 ? 1 : 0)) % 3 ? M : hide);
      for (const s of [-1, 1]) {
        const up = energy > 0.3 ? 1 : 0;
        Pp.set(c.x, c.y + (up ? 1.05 : 0.3) + bounce, c.z + s * 0.42); E.set(up ? s * 0.4 * Math.sin(t * 8 + c.ph) * 0.3 : 0, yaw, 0); Q.setFromEuler(E);
        M.compose(Pp, Q, S); iA.setMatrixAt(2 * i + (s > 0 ? 1 : 0), M);
      }
    });
    for (const im of [iT, iH, iA, ...iF]) im.instanceMatrix.needsUpdate = true;
  };
  W.updateCrowd(0, 0.5);
  for (let i = 0; i < 14; i++) { const R2 = rng(700 + i); const h = mesh(new THREE.SphereGeometry(40 + R2() * 30, 16, 10), P(['#8fd36c', '#7cc85d', '#9bdc78'][i % 3]), (i - 7) * 60, -20, -260 - R2() * 60, false); h.scale.y = 0.6; V.add(h); }
}

export function buildWorld(scene) {
  const W = {};
  const { sky, u } = makeSky(); scene.add(sky); W.sky = sky; W.skyU = u;
  const root = new THREE.Group(); scene.add(root); W.root = root;
  buildTown(root, W); buildInteriors(root, W); buildPull(root, W);
  W.clouds = new THREE.Group(); scene.add(W.clouds);
  for (let i = 0; i < 22; i++) { const R = rng(900 + i); const c = makeCloud(900 + i, 2.2 + R() * 1.5); const a = (i / 22) * Math.PI * 2 + R() * 0.2, r = 180 + R() * 120; c.position.set(Math.cos(a) * r, 45 + R() * 50, Math.sin(a) * r); W.clouds.add(c); }
  // props reused across shots
  W.cat = makeCat(); root.add(W.cat); W.catFace = W.cat.userData.face.material; W.catTex = { smug: faceTexture('smug'), huss: faceTexture('huss') };
  W.jar = makeJar(); root.add(W.jar);
  W.parcels = [makeParcel(1, '#c79a63'), makeParcel(0.8, '#b88a55'), makeParcel(0.65, '#d4a86c')]; W.parcels.forEach((p) => root.add(p));
  W.car = makeCar('#ff9ec4'); root.add(W.car);
  W.truck = makeTruck(); root.add(W.truck);
  W.waist = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.08, 6, 20), P('#d9b26f', { roughness: 0.95 })); W.waist.rotation.x = Math.PI / 2; root.add(W.waist);
  const cast = {};
  for (const k of ['leo', 'ava', 'grandma', 'mailman', 'driver', 'ref']) { cast[k] = makeChar(CAST[k]); root.add(cast[k].root); }
  cast.mates = [0, 1, 2, 3, 4].map((i) => { const c = makeChar(CAST.teammate(i)); root.add(c.root); return c; });
  cast.rivals = [0, 1, 2, 3, 4].map((i) => { const c = makeChar(CAST.rival(i)); root.add(c.root); return c; });
  cast.town = Array.from({ length: 14 }, (_, i) => { const c = makeChar(citizen(i + 3)); root.add(c.root); return c; });
  W.cast = cast;
  buildExtra(W, root, { makeBird, SETS });
  return W;
}
