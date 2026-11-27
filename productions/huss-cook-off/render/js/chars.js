import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { faceTexture, textTexture } from './faces.js';
import { rng } from './util.js';

const geoCache = new Map();
export function rbox(w, h, d, r = 0.08, seg = 3) {
  const k = [w, h, d, r, seg].join(',');
  if (!geoCache.has(k)) geoCache.set(k, new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2)));
  return geoCache.get(k);
}
const matCache = new Map();
export function mat(color, o = {}) {
  const k = color + JSON.stringify(o);
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.55, metalness: 0.0 }, o)));
  return matCache.get(k);
}
export function mesh(geo, material, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = shadow; m.receiveShadow = true;
  return m;
}
const sphereGeo = new THREE.IcosahedronGeometry(1, 2);

/**
 * Classic blocky avatar. Faces +Z. Origin at the feet.
 * spec: {skin, top, topDark, pants, shoes, hair, hairStyle, emblem, hood, scale, name, faceOpts, extras(fn)}
 */
export function makeChar(spec) {
  const S = Object.assign({ skin: '#f5c9a0', top: '#3366ff', pants: '#222831', shoes: '#ffffff', hair: '#3b2416', hairStyle: 'short', scale: 1, hood: true }, spec);
  const root = new THREE.Group(); root.name = S.name || 'char';
  const body = new THREE.Group(); root.add(body); body.scale.setScalar(S.scale);
  const skin = mat(S.skin, { roughness: 0.6 });
  const top = S.material || mat(S.top, { roughness: 0.75 });
  const topDark = S.material || mat(S.topDark || new THREE.Color(S.top).multiplyScalar(0.78).getStyle(), { roughness: 0.8 });
  const pants = S.material || mat(S.pants, { roughness: 0.8 });
  const shoes = S.material || mat(S.shoes, { roughness: 0.5 });
  const hairM = S.material || mat(S.hair, { roughness: 0.85 });

  const hips = new THREE.Group(); hips.position.y = 1.0; body.add(hips);
  const legs = [];
  for (const side of [1, -1]) { // +x = character's left
    const pivot = new THREE.Group(); pivot.position.set(0.25 * side, 0, 0); hips.add(pivot);
    pivot.add(mesh(rbox(0.49, 0.86, 0.5, 0.07), pants, 0, -0.43, 0));
    pivot.add(mesh(rbox(0.52, 0.2, 0.62, 0.07), shoes, 0, -0.9, 0.05));
    legs.push(pivot);
  }
  const torso = new THREE.Group(); hips.add(torso);
  torso.add(mesh(rbox(1.0, 1.02, 0.52, 0.1), top, 0, 0.5, 0));
  if (S.hood) {
    torso.add(mesh(rbox(0.78, 0.34, 0.26, 0.1), topDark, 0, 0.92, -0.3)); // hood resting on back
    torso.add(mesh(rbox(0.62, 0.3, 0.06, 0.03), topDark, 0, 0.24, 0.27)); // kangaroo pocket
    const cord = mat('#f2f2f2');
    torso.add(mesh(rbox(0.04, 0.26, 0.04, 0.015), cord, 0.12, 0.82, 0.28, false));
    torso.add(mesh(rbox(0.04, 0.22, 0.04, 0.015), cord, -0.12, 0.84, 0.28, false));
  }
  if (S.print) { // big chest print, e.g. BOING
    const e = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.46), new THREE.MeshStandardMaterial({ map: textTexture(S.print.text, { w: 512, h: 256, fg: S.print.fg, font: S.print.font || '900 150px Nunito', stroke: S.print.stroke, sw: 14 }), transparent: true, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2 }));
    e.position.set(0, S.print.y ?? 0.5, 0.266); torso.add(e);
  }
  const arms = [], hands = [];
  for (const side of [1, -1]) {
    const pivot = new THREE.Group(); pivot.position.set(0.75 * side, 0.92, 0); torso.add(pivot);
    pivot.add(mesh(rbox(0.48, 0.82, 0.48, 0.09), top, 0, -0.36, 0));
    const hand = mesh(rbox(0.42, 0.24, 0.44, 0.08), skin, 0, -0.86, 0);
    pivot.add(hand); hands.push(hand);
    arms.push(pivot);
  }
  // neck + head
  const neck = new THREE.Group(); neck.position.y = 1.02; torso.add(neck);
  const head = new THREE.Group(); head.position.y = 0.06; neck.add(head);
  head.add(mesh(rbox(0.95, 0.86, 0.86, 0.22, 4), skin, 0, 0.43, 0));
  const faceMat = new THREE.MeshStandardMaterial({ map: faceTexture('neutral', S.faceOpts), transparent: true, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.86), faceMat);
  face.position.set(0, 0.43, 0.432); head.add(face);
  buildHair(S, head, hairM);
  if (S.extras) S.extras({ root, body, torso, head, hips, arms, legs, mat, mesh, rbox });

  const ch = { root, body, hips, torso, neck, head, arms, legs, hands, face, faceMat, spec: S, expr: 'neutral', faceOpts: S.faceOpts || {} };
  ch.setExpr = (name, over) => {
    const key = name + (over ? JSON.stringify(over) : '');
    if (ch._ek === key) return;
    ch._ek = key; ch.expr = name;
    faceMat.map = faceTexture(name, Object.assign({}, ch.faceOpts, over ? { over } : {}));
    faceMat.needsUpdate = true;
  };
  ch.pose = (p = {}) => applyPose(ch, p);
  root.traverse((o) => { if (o.isMesh) o.userData.owner = ch; });
  return ch;
}

function buildHair(S, head, m) {
  const R = rng(S.seed || 5);
  const H = (x, y, z, s, sy = s, sz = s) => { const k = new THREE.Mesh(sphereGeo, m); k.position.set(x, y, z); k.scale.set(s, sy, sz); k.castShadow = true; head.add(k); return k; };
  if (S.hairStyle === 'curly') {
    head.add(mesh(rbox(1.0, 0.26, 0.92, 0.12), m, 0, 0.84, -0.02));
    for (let i = 0; i < 26; i++) {
      const a = R() * Math.PI * 2, rr = R() * 0.42;
      H(Math.cos(a) * rr, 0.95 + R() * 0.1, Math.sin(a) * rr * 0.95 - 0.02, 0.17 + R() * 0.06);
    }
    for (let i = 0; i < 9; i++) H(-0.4 + i * 0.1, 0.82 + R() * 0.05, 0.4, 0.12 + R() * 0.03); // fringe curls
    for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) H(sx * 0.48, 0.55 + i * 0.1, -0.15 - R() * 0.2, 0.12);
    for (let i = 0; i < 8; i++) H(-0.35 + i * 0.1, 0.55 + R() * 0.25, -0.44, 0.14);
  } else if (S.hairStyle === 'messy') {
    head.add(mesh(rbox(1.0, 0.3, 0.94, 0.12), m, 0, 0.83, -0.02));
    head.add(mesh(rbox(1.0, 0.5, 0.2, 0.08), m, 0, 0.62, -0.38));
    for (let i = 0; i < 7; i++) {
      const s = mesh(rbox(0.22, 0.34, 0.2, 0.06), m, -0.36 + i * 0.12, 0.8, 0.38 + R() * 0.03);
      s.rotation.z = (R() - 0.5) * 0.7; s.rotation.x = 0.4; head.add(s);
    }
    for (let i = 0; i < 6; i++) { const s = mesh(rbox(0.2, 0.3, 0.2, 0.06), m, -0.3 + R() * 0.6, 1.0, -0.2 + R() * 0.4); s.rotation.set(R() - 0.5, R(), R() - 0.5); head.add(s); }
  } else if (S.hairStyle === 'braids') {
    head.add(mesh(rbox(1.0, 0.3, 0.94, 0.14), m, 0, 0.84, -0.02));
    head.add(mesh(rbox(1.0, 0.55, 0.22, 0.1), m, 0, 0.6, -0.36));
    head.add(mesh(rbox(0.9, 0.14, 0.1, 0.05), m, 0, 0.8, 0.42)); // fringe
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 5; i++) H(sx * 0.5, 0.42 - i * 0.14, -0.1, 0.12 - i * 0.008);
      const band = new THREE.Mesh(sphereGeo, mat('#ffe38a')); band.scale.setScalar(0.07); band.position.set(sx * 0.5, -0.24, -0.1); head.add(band);
    }
  } else if (S.hairStyle === 'bald') {
    // nothing - hats cover
  } else {
    head.add(mesh(rbox(1.0, 0.24, 0.94, 0.1), m, 0, 0.84, -0.02));
    head.add(mesh(rbox(1.0, 0.4, 0.2, 0.08), m, 0, 0.66, -0.37));
  }
}

function applyPose(ch, p) {
  const [L, Rr] = [ch.legs[0], ch.legs[1]];
  const [aL, aR] = [ch.arms[0], ch.arms[1]];
  const w = p.walk || 0, ph = p.phase || 0;
  const sw = Math.sin(ph) * 0.65 * w;
  L.rotation.set(sw, 0, 0); Rr.rotation.set(-sw, 0, 0);
  const bob = Math.abs(Math.cos(ph)) * 0.08 * w;
  ch.hips.position.y = 1.0 + bob + (p.bob || 0);
  ch.torso.rotation.set((p.lean || 0) + 0.06 * w, (p.twist || 0) + Math.sin(ph) * 0.08 * w, p.tilt || 0);
  // arms: [forward(+ = raise forward), spread(+ = outward), roll]
  const al = p.armL || [0, 0.06, 0], ar = p.armR || [0, 0.06, 0];
  aL.rotation.set(-al[0] - sw * 0.9, al[2] || 0, al[1]);
  aR.rotation.set(-ar[0] + sw * 0.9, -(ar[2] || 0), -ar[1]);
  const h = p.head || [0, 0, 0];
  ch.neck.rotation.set(h[0], h[1], h[2] || 0);
  ch.hands.forEach((hd, i) => {
    const f = i === 0 ? (p.fistL ?? p.fist ?? 0) : (p.fistR ?? p.fist ?? 0);
    hd.scale.set(1 - 0.1 * f, 1 - 0.22 * f, 1 - 0.1 * f);
  });
  if (p.legL) L.rotation.x = p.legL; if (p.legR) Rr.rotation.x = p.legR;
}

// ---------------------------------------------------------------- the cast
function beanie(color, letter, fg) {
  return ({ head, mat, mesh, rbox }) => {
    const m = mat(color, { roughness: 0.9 });
    head.add(mesh(rbox(1.04, 0.42, 0.98, 0.18, 4), m, 0, 0.98, -0.02));
    head.add(mesh(rbox(1.08, 0.2, 1.02, 0.09), mat(new THREE.Color(color).multiplyScalar(0.85).getStyle(), { roughness: 0.95 }), 0, 0.8, -0.02));
    const pom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 2), m); pom.position.set(0, 1.24, -0.02); head.add(pom);
    if (letter) {
      const l = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), new THREE.MeshStandardMaterial({ map: textTexture(letter, { w: 128, h: 128, fg, font: '900 110px Nunito' }), transparent: true, polygonOffset: true, polygonOffsetFactor: -2 }));
      l.position.set(0, 1.0, 0.475); head.add(l);
    }
  };
}
function cap(color, { brim = true } = {}) {
  return ({ head, mat, mesh, rbox }) => {
    const m = mat(color, { roughness: 0.8 });
    head.add(mesh(rbox(1.0, 0.3, 0.94, 0.14), m, 0, 0.92, -0.02));
    if (brim) head.add(mesh(rbox(0.9, 0.06, 0.4, 0.03), m, 0, 0.8, 0.58));
  };
}
export const CAST = {
  leo: {
    name: 'Leo', skin: '#f3c9a1', top: '#35c46a', topDark: '#28a455', pants: '#24345c', shoes: '#ffffff', hairStyle: 'bald', hair: '#5a3a1e', seed: 11,
    print: { text: 'HUSS', fg: '#ffffff', stroke: '#1f8a45' },
    extras: (k) => {
      beanie('#ffd23f', 'H', '#1f8a45')(k);
      const dots = k.mat('#ffffff');
      for (const [x, y] of [[-0.36, 0.88], [0.38, 0.84], [-0.4, 0.2], [0.4, 0.16], [0.18, 0.9], [-0.15, 0.12]]) k.torso.add(k.mesh(k.rbox(0.05, 0.05, 0.02, 0.01), dots, x, y, 0.268, false));
    },
  },
  ava: {
    name: 'Ava', skin: '#c98d62', top: '#35c46a', topDark: '#28a455', pants: '#ffffff', shoes: '#ff5c8a', hair: '#1d120b', hairStyle: 'braids', hood: false, seed: 31,
    faceOpts: { lashes: true }, scale: 0.97,
    print: { text: 'C', fg: '#ffd23f', font: '900 220px Nunito', stroke: '#1f8a45' },
    extras: ({ head, mat, mesh, rbox }) => { head.add(mesh(rbox(1.04, 0.14, 0.98, 0.06), mat('#ffd23f'), 0, 0.78, -0.02)); },
  },
  grandma: {
    name: 'Grandma', skin: '#f3cfb3', top: '#ff9ec4', topDark: '#f082ad', pants: '#7c6ab5', shoes: '#ffffff', hair: '#e8e8ef', hairStyle: 'short', hood: false, seed: 51, scale: 0.92,
    faceOpts: { glasses: true },
    extras: ({ head, mat }) => { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 2), mat('#e8e8ef', { roughness: 0.9 })); b.position.set(0, 1.0, -0.25); b.castShadow = true; head.add(b); },
  },
  mailman: {
    name: 'Mailman', skin: '#f0c08f', top: '#3b6fd1', topDark: '#2d5ab3', pants: '#24345c', shoes: '#1a1a1a', hair: '#3a2a1a', hairStyle: 'short', hood: false, seed: 61,
    faceOpts: { stache: '#4a2e1a' },
    extras: (k) => {
      cap('#24345c')(k);
      const bag = k.mesh(k.rbox(0.55, 0.5, 0.25, 0.06), k.mat('#8a5a2b'), 0.55, 0.15, 0.1); k.torso.add(bag);
      const strap = k.mesh(k.rbox(0.1, 1.3, 0.04, 0.02), k.mat('#6b431f'), 0.05, 0.55, 0.27); strap.rotation.z = -0.7; k.torso.add(strap);
    },
  },
  driver: {
    name: 'Driver', skin: '#e0ac69', top: '#ffffff', topDark: '#eaeaea', pants: '#ff8fb8', shoes: '#ffffff', hair: '#2b1b10', hairStyle: 'short', hood: false, seed: 66,
    faceOpts: { stache: '#2b1b10' },
    extras: (k) => { cap('#ff8fb8')(k); k.torso.add(k.mesh(k.rbox(0.62, 0.7, 0.05, 0.03), k.mat('#ff8fb8'), 0, 0.42, 0.27)); },
  },
  ref: {
    name: 'Ref', skin: '#d9a77c', top: '#ffffff', pants: '#1c1c1c', shoes: '#111', hair: '#1c1c1c', hairStyle: 'bald', hood: false, seed: 71,
    extras: (k) => {
      const b = k.mat('#151515');
      for (const x of [-0.36, -0.12, 0.12, 0.36]) k.torso.add(k.mesh(k.rbox(0.1, 1.0, 0.535, 0.02), b, x, 0.5, 0, false));
      for (const s of [1, -1]) for (const y of [-0.15, -0.45]) k.arms[s > 0 ? 0 : 1].add(k.mesh(k.rbox(0.5, 0.1, 0.5, 0.02), b, 0, y, 0, false));
    },
  },
  teammate: (i) => ({
    name: 'Mate', skin: ['#f3c9a1', '#8d5a3b', '#e0ac69', '#f1c27d', '#c68642'][i % 5], top: '#35c46a', topDark: '#28a455', pants: '#24345c', shoes: '#fff', hair: ['#2b1b10', '#111', '#d9a441', '#8b3a1a', '#111'][i % 5], hairStyle: i % 2 ? 'messy' : 'short', hood: false, seed: 80 + i,
    print: { text: String([7, 3, 9, 21, 5][i % 5]), fg: '#ffffff', font: '900 200px Nunito' },
  }),
  rival: (i) => ({
    name: 'Rival', skin: ['#f6d0b1', '#c68642', '#8d5524', '#f1c27d', '#e0ac69'][i % 5], top: '#8a5a2b', topDark: '#6e4520', pants: '#e0b04a', shoes: '#5a3a1e', hair: ['#111', '#5a3a1e', '#d9a441', '#2b1b10', '#8b3a1a'][i % 5], hairStyle: i % 2 ? 'short' : 'messy', hood: false, seed: 90 + i, scale: 1.12,
    print: { text: String([4, 10, 23, 8, 11][i % 5]), fg: '#ffd23f', font: '900 200px Nunito' },
  }),
};
export function citizen(seed) {
  const R = rng(seed * 977 + 13);
  const tops = ['#ff5d73', '#ffb347', '#50c878', '#7b68ee', '#ff6fb5', '#2ec4b6', '#f9c74f', '#4d96ff', '#e76f51'];
  const skins = ['#f6d0b1', '#e0ac69', '#c68642', '#8d5524', '#f1c27d', '#ffdbac'];
  const hairs = ['#2b1b10', '#5a3a1e', '#d9a441', '#111111', '#8b3a1a', '#6d6d6d'];
  return {
    name: 'Citizen', seed, skin: skins[(R() * skins.length) | 0], top: tops[(R() * tops.length) | 0],
    pants: ['#2e3a59', '#3d3d3d', '#4a6fa5', '#6b4f3a'][(R() * 4) | 0], shoes: ['#fff', '#222', '#8b4513'][(R() * 3) | 0],
    hair: hairs[(R() * hairs.length) | 0], hairStyle: R() < 0.5 ? 'short' : 'messy', hood: R() < 0.4,
  };
}
