import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { faceTexture, starEmblem } from './textures.js';
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
  if (S.emblem) {
    const e = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), new THREE.MeshStandardMaterial({ map: starEmblem(), transparent: true, roughness: 0.6 }));
    e.position.set(-0.22, 0.72, 0.265); torso.add(e);
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
export const CAST = {
  leo: { name: 'Leo', skin: '#f2c49b', top: '#1f4fd8', pants: '#16181d', shoes: '#ffffff', hair: '#3a2314', hairStyle: 'curly', emblem: true, seed: 11 },
  noah: { name: 'Noah', skin: '#eec09a', top: '#8fe6c4', topDark: '#6fcaa6', pants: '#2b3140', shoes: '#141414', hair: '#6b4326', hairStyle: 'messy', seed: 23 },
  maya: {
    name: 'Maya', skin: '#efc3a0', top: '#b79cf0', topDark: '#9d82dc', pants: '#5b4b8a', shoes: '#f5f0ff', hair: '#24170f', hairStyle: 'braids', scale: 0.74, hood: false, seed: 31,
    faceOpts: { lashes: true },
    extras: ({ torso, mat, mesh, rbox }) => {
      const sc = mat('#fbe9a0', { roughness: 0.9 });
      torso.add(mesh(rbox(1.08, 0.24, 0.62, 0.1), sc, 0, 1.0, 0));
      torso.add(mesh(rbox(0.22, 0.6, 0.1, 0.05), sc, 0.25, 0.68, 0.3));
      // jacket zip + buttons
      torso.add(mesh(rbox(0.04, 0.8, 0.02, 0.01), mat('#7a63c2'), 0, 0.45, 0.27, false));
    },
  },
  mayor: {
    name: 'Mayor', skin: '#f0c08f', top: '#1f2a5a', pants: '#1f2a5a', shoes: '#111', hair: '#b9b9b9', hairStyle: 'short', hood: false, seed: 41,
    faceOpts: { stache: '#c9c9c9', browColor: '#9a9a9a' },
    extras: ({ torso, head, mat, mesh, rbox }) => {
      const gold = mat('#ffcf3f', { metalness: 0.6, roughness: 0.3 });
      const sash = mesh(rbox(0.2, 1.3, 0.04, 0.02), gold, 0, 0.5, 0.27); sash.rotation.z = 0.7; torso.add(sash);
      torso.add(mesh(rbox(0.16, 0.42, 0.03, 0.02), mat('#c0262c'), 0, 0.72, 0.275, false));
      const hat = mat('#121212', { roughness: 0.4 });
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.06, 32), hat); brim.position.y = 0.9; brim.castShadow = true; head.add(brim);
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.44, 0.7, 32), hat); crown.position.y = 1.25; crown.castShadow = true; head.add(crown);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.445, 0.445, 0.1, 32), gold); band.position.y = 1.0; head.add(band);
    },
  },
  baker: {
    name: 'Baker', skin: '#d79b72', top: '#f4f4f4', pants: '#3c3f4a', shoes: '#222', hair: '#2c1c12', hood: false, seed: 51,
    extras: ({ torso, head, mat, mesh, rbox }) => {
      const white = mat('#ffffff', { roughness: 0.9 });
      torso.add(mesh(rbox(0.86, 0.95, 0.06, 0.03), mat('#fffaf0', { roughness: 0.95 }), 0, 0.42, 0.27));
      torso.add(mesh(rbox(0.3, 0.2, 0.03, 0.01), mat('#f2b3c4'), 0, 0.3, 0.31, false));
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.2, 24), white); band.position.y = 0.95; head.add(band);
      for (let i = 0; i < 5; i++) { const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 2), white); puff.position.set(Math.cos(i * 1.26) * 0.22, 1.25, Math.sin(i * 1.26) * 0.22); head.add(puff); }
    },
  },
};
export function electrician(seed, skin) {
  return {
    name: 'Electrician', skin, top: '#ff7a1a', pants: '#2c4a7a', shoes: '#3a2a1a', hair: '#2a1a10', hood: false, seed,
    extras: ({ torso, head, mat, mesh, rbox }) => {
      const strip = mat('#e9ff6b', { emissive: '#bcd23a', emissiveIntensity: 0.25 });
      torso.add(mesh(rbox(1.02, 0.08, 0.54, 0.02), strip, 0, 0.35, 0, false));
      torso.add(mesh(rbox(1.02, 0.08, 0.54, 0.02), strip, 0, 0.6, 0, false));
      const hat = new THREE.Mesh(new THREE.SphereGeometry(0.56, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat('#ffd400', { roughness: 0.35 }));
      hat.position.y = 0.82; hat.scale.set(1, 0.8, 1); hat.castShadow = true; head.add(hat);
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.05, 24), mat('#ffd400', { roughness: 0.35 })); brim.position.set(0, 0.84, 0.06); head.add(brim);
    },
  };
}
export function citizen(seed) {
  const R = rng(seed * 977 + 13);
  const tops = ['#ff5d73', '#ffb347', '#50c878', '#7b68ee', '#ff6fb5', '#2ec4b6', '#f9c74f', '#e76f51'];
  const skins = ['#f6d0b1', '#e0ac69', '#c68642', '#8d5524', '#f1c27d', '#ffdbac'];
  const hairs = ['#2b1b10', '#5a3a1e', '#d9a441', '#111111', '#8b3a1a', '#6d6d6d'];
  return {
    name: 'Citizen', seed, skin: skins[(R() * skins.length) | 0], top: tops[(R() * tops.length) | 0],
    pants: ['#2e3a59', '#3d3d3d', '#4a6fa5', '#6b4f3a'][(R() * 4) | 0], shoes: ['#fff', '#222', '#8b4513'][(R() * 3) | 0],
    hair: hairs[(R() * hairs.length) | 0], hairStyle: R() < 0.5 ? 'short' : 'messy', hood: R() < 0.4,
  };
}
