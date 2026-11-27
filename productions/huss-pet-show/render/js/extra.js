// Pet Show props: dogs, extra cats, Gary the rock (googly eyes + bow tie), more pet rocks,
// hoops, the golden bone, the stage, and the "NO PETS" sign.
import * as THREE from 'three';
import { rbox, mat, mesh } from './chars.js';
import { faceTexture, textTexture } from './faces.js';
import { rng } from './util.js';

const box = (w, h, d, m, x, y, z, r = 0.04) => mesh(rbox(w, h, d, r, 2), m, x, y, z);
const P = (c, o) => mat(c, Object.assign({ roughness: 0.9 }, o));
export const GOLD = new THREE.MeshStandardMaterial({ color: '#ffcc33', metalness: 0.85, roughness: 0.22, emissive: '#7a5200', emissiveIntensity: 0.35 });

export function makeDog(c = '#c98a4b', c2 = '#fff3e0', s = 1) {
  const g = new THREE.Group(), o = P(c), w = P(c2), dk = P(new THREE.Color(c).multiplyScalar(0.7).getStyle());
  const body = new THREE.Group(); g.add(body);
  body.add(box(0.72, 0.62, 1.25, o, 0, 0.72, 0, 0.18));
  body.add(box(0.5, 0.3, 0.6, w, 0, 0.56, 0.2, 0.1));
  const head = new THREE.Group(); head.position.set(0, 1.25, 0.62); body.add(head);
  head.add(box(0.72, 0.66, 0.62, o, 0, 0, 0, 0.18));
  head.add(mesh(new THREE.SphereGeometry(0.07, 10, 8), P('#1b1b1f'), 0, -0.02, 0.34, false));
  const ears = [];
  for (const sx of [-1, 1]) { const piv = new THREE.Group(); piv.position.set(sx * 0.36, 0.22, -0.02); const e = box(0.16, 0.5, 0.3, dk, 0, -0.22, 0, 0.06); piv.add(e); piv.rotation.z = sx * 0.25; head.add(piv); ears.push(piv); }
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.56), new THREE.MeshStandardMaterial({ map: faceTexture('grin'), transparent: true, polygonOffset: true, polygonOffsetFactor: -2 }));
  face.position.set(0, 0.04, 0.315); head.add(face);
  const legs = [];
  for (const [x, z] of [[-0.22, 0.42], [0.22, 0.42], [-0.22, -0.42], [0.22, -0.42]]) { const piv = new THREE.Group(); piv.position.set(x, 0.5, z); piv.add(box(0.2, 0.5, 0.2, o, 0, -0.25, 0, 0.06)); body.add(piv); legs.push(piv); }
  const tail = new THREE.Group(); tail.position.set(0, 0.95, -0.6); tail.add(box(0.12, 0.12, 0.55, o, 0, 0.1, -0.22, 0.05)); tail.rotation.x = -0.7; body.add(tail);
  g.scale.setScalar(s);
  g.userData = { face, head, ears, legs, tail, body };
  return g;
}
// shared "googly eye": white ball + loose black pupil
function googly(r = 0.12) {
  const e = new THREE.Group();
  e.add(mesh(new THREE.SphereGeometry(r, 16, 12), P('#ffffff', { roughness: 0.3 }), 0, 0, 0, false));
  const pu = mesh(new THREE.SphereGeometry(r * 0.55, 12, 10), P('#111111', { roughness: 0.3 }), 0, 0, r * 0.88, false); pu.scale.z = 0.5; e.add(pu);
  e.userData.pupil = pu; return e;
}
export function makeRock(seed = 1, s = 1, { bow = false, tint = '#9aa0a6' } = {}) {
  const g = new THREE.Group(); const R = rng(seed);
  const geo = new THREE.IcosahedronGeometry(0.5, 2); const pos = geo.attributes.position; const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); const n = 1 + 0.09 * Math.sin(v.x * 7 + seed) * Math.cos(v.z * 6 + seed * 2) + 0.05 * Math.sin(v.y * 9); v.multiplyScalar(n); pos.setXYZ(i, v.x, v.y, v.z); }
  geo.computeVertexNormals();
  const rock = new THREE.Mesh(geo, P(tint, { roughness: 0.95, flatShading: true })); rock.scale.set(1.15, 0.78, 0.95); rock.position.y = 0.36; rock.castShadow = true; rock.receiveShadow = true; g.add(rock);
  const eyes = [];
  for (const sx of [-1, 1]) { const e = googly(0.13); e.position.set(sx * 0.17, 0.55, 0.4); g.add(e); eyes.push(e); }
  if (bow) {
    const red = P('#e23b3b', { roughness: 0.6 });
    const b = new THREE.Group(); b.position.set(0, 0.2, 0.5);
    for (const sx of [-1, 1]) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.2, 4), red); c.rotation.z = sx * Math.PI / 2; c.position.x = sx * 0.1; b.add(c); }
    b.add(mesh(new THREE.SphereGeometry(0.05, 8, 6), red, 0, 0, 0, false)); g.add(b);
  }
  g.scale.setScalar(s);
  g.userData = { eyes, rock, wiggle: (t, k = 1) => eyes.forEach((e, i) => { const p = e.userData.pupil; p.position.x = Math.sin(t * 9 + i * 2) * 0.045 * k; p.position.y = Math.cos(t * 7 + i) * 0.045 * k - 0.03; }) };
  return g;
}
export function makeHoop(color = '#e23b3b') {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.1, 10, 40), P(color, { roughness: 0.5 })); ring.position.y = 2.2; ring.castShadow = true; g.add(ring);
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const st = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.105, 10, 6, Math.PI / 8), P('#ffffff', { roughness: 0.5 })); st.rotation.z = a; st.position.y = 2.2; g.add(st); }
  for (const sx of [-1, 1]) g.add(box(0.12, 1.3, 0.12, P('#dfe3ea'), sx * 1.0, 0.65, 0, 0.03));
  g.add(box(2.3, 0.1, 0.5, P('#dfe3ea'), 0, 0.05, 0, 0.03));
  return g;
}
export function makeBone(s = 1) {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.2, 16), GOLD); shaft.rotation.z = Math.PI / 2; g.add(shaft);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(mesh(new THREE.SphereGeometry(0.22, 16, 12), GOLD, sx * 0.62, sz * 0.15, 0, false));
  g.children.forEach((c) => (c.castShadow = true));
  g.scale.setScalar(s); return g;
}
export function buildExtra(W, root, { makeCat, SETS }) {
  W.dogs = [makeDog('#c98a4b'), makeDog('#3a3a40', '#ffffff', 0.85), makeDog('#f2d29b', '#ffffff', 0.9), makeDog('#8b5a2b', '#f5deb3', 1.05), makeDog('#ffffff', '#ffd6e0', 0.8), makeDog('#d9a441', '#fff3e0', 0.95)];
  W.dogs.forEach((d) => root.add(d));
  W.dogTex = { grin: faceTexture('grin'), laugh: faceTexture('laugh'), shock: faceTexture('shock'), dizzy: faceTexture('dizzy'), smug: faceTexture('smug'), huss: faceTexture('huss'), sad: faceTexture('sad') };
  W.cats = [W.cat, makeCat(), makeCat()];
  W.cats.slice(1).forEach((c) => root.add(c));
  W.cats.forEach((c) => (c.userData.face.material = c.userData.face.material.clone())); W.catFace = W.cat.userData.face.material;
  W.catTex = Object.assign(W.catTex, { grin: faceTexture('grin'), shock: faceTexture('shock'), dizzy: faceTexture('dizzy'), laugh: faceTexture('laugh'), sad: faceTexture('sad') });
  W.gary = makeRock(7, 1, { bow: true }); root.add(W.gary);
  W.rocks = Array.from({ length: 12 }, (_, i) => { const r = makeRock(20 + i, 0.7 + (i % 4) * 0.12, { tint: ['#9aa0a6', '#8c8f94', '#a8a196', '#7f868d'][i % 4] }); root.add(r); return r; });
  W.hoops = [makeHoop('#e23b3b'), makeHoop('#2f7de1'), makeHoop('#ffb02e')]; W.hoops.forEach((h) => root.add(h));
  W.bone = makeBone(1); root.add(W.bone);
  W.pedestal = new THREE.Group(); root.add(W.pedestal);
  W.pedestal.add(box(1.4, 1.2, 1.4, P('#ffffff'), 0, 0.6, 0, 0.06)); W.pedestal.add(box(1.6, 0.15, 1.6, P('#e23b3b'), 0, 1.25, 0, 0.04));
  // leashes: thin lines from a hand to a pet (updated per shot)
  W.leashes = Array.from({ length: 10 }, () => { const m = mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 6), P('#e23b3b'), 0, 0, 0, false); m.visible = false; root.add(m); return m; });
  W.setLeash = (i, a, b) => { const m = W.leashes[i], d = b.clone().sub(a); m.visible = true; m.position.copy(a).add(b).multiplyScalar(0.5); m.scale.set(1, d.length(), 1); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); };
  // the stage in front of the mud pit
  const st = new THREE.Group(); st.position.copy(SETS.pull).add(new THREE.Vector3(0, 0, 10)); root.add(st); W.stage = st;
  st.add(mesh(new THREE.CylinderGeometry(4.2, 4.4, 0.5, 40), P('#2f7de1', { roughness: 0.6 }), 0, 0.25, 0));
  st.add(mesh(new THREE.CylinderGeometry(4.25, 4.25, 0.06, 40), P('#ffd23f', { roughness: 0.6 }), 0, 0.5, 0, false));
  // bowl for Gary
  W.bowl = new THREE.Group(); root.add(W.bowl);
  W.bowl.add(mesh(new THREE.CylinderGeometry(0.42, 0.3, 0.22, 20), P('#e23b3b', { roughness: 0.5 }), 0, 0.11, 0));
  W.bowl.add(mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.04, 20), P('#a0522d'), 0, 0.2, 0, false));
  // "NO PETS" sign replaces the bedroom poster
  W.poster.material.map = textTexture([{ t: 'NO PETS!', font: '900 120px Nunito', fg: '#e23b3b' }, { t: 'TOO MUCH', font: '900 80px Nunito', fg: '#1b1b1f' }, { t: 'WORK', font: '900 80px Nunito', fg: '#1b1b1f' }, { t: '- MOM', font: '900 70px Nunito', fg: '#2f7de1' }], { w: 512, h: 700, bg: '#fff8e7' });
  W.hideExtra = () => {
    [...W.dogs, ...W.cats.slice(1), W.gary, ...W.rocks, ...W.hoops, W.bone, W.pedestal, ...W.leashes, W.bowl].forEach((o) => (o.visible = false));
    W.dogs.forEach((d) => { d.userData.face.material.map = W.dogTex.grin; d.rotation.set(0, 0, 0); d.userData.body.rotation.set(0, 0, 0); d.scale.setScalar(d.userData.s0 ??= d.scale.x); });
    W.cats.forEach((c, i) => { if (i) { c.userData.face.material.map = W.catTex.smug; c.rotation.set(0, 0, 0); c.scale.setScalar(1); } });
    W.gary.rotation.set(0, 0, 0); W.gary.scale.setScalar(1);
  };
}
