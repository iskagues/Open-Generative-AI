import * as THREE from 'three';
import { makeChar, CAST, citizen, electrician, rbox, mat, mesh } from './chars.js';
import * as TX from './textures.js';
import { rng } from './util.js';

// ---------------------------------------------------------------- terrain
export const HILL = { x: 62, z: -72, h: 22, s: 26 };
export function heightAt(x, z) {
  const dx = x - HILL.x, dz = z - HILL.z;
  return HILL.h * Math.exp(-(dx * dx + dz * dz) / (2 * HILL.s * HILL.s));
}
export const FLOOR = HILL.h + 0.6;              // observatory floor height
export const OBS = new THREE.Vector3(HILL.x, FLOOR, HILL.z);
const toTown = new THREE.Vector2(-HILL.x, -HILL.z).normalize();
export const OBS_ROT = Math.atan2(toTown.x, toTown.y); // local +z faces the town

// winding path: square -> playground -> trees -> hilltop
const PATH_XZ = [[20, 2], [27, -4], [33, -13], [38, -21], [43, -31], [47, -40], [49, -49], [51, -57], [54, -63], [57, -66.5]];
export const path = new THREE.CatmullRomCurve3(PATH_XZ.map(([x, z]) => new THREE.Vector3(x, 0, z)));
export function pathPoint(u) {
  const p = path.getPointAt(Math.min(1, Math.max(0, u)));
  p.y = heightAt(p.x, p.z);
  return p;
}
export function pathYaw(u) {
  const t = path.getTangentAt(Math.min(0.999, Math.max(0.001, u)));
  return Math.atan2(t.x, t.z);
}

// ---------------------------------------------------------------- power-controlled materials
export const P = {}; // registry of power groups
function powerMat(group, color, emissive, base = 1.6, extra = {}) {
  const m = new THREE.MeshStandardMaterial(Object.assign({ color, emissive, emissiveIntensity: base, roughness: 0.4 }, extra));
  (P[group] ||= { mats: [], lights: [], sprites: [], pools: [] }).mats.push([m, base]);
  return m;
}
function reg(group, kind, obj, base) { (P[group] ||= { mats: [], lights: [], sprites: [], pools: [] })[kind].push([obj, base]); }
export function setPower(levels) {
  for (const g in P) {
    const parent = /^lamp\d+$/.test(g) ? 'lamps' : /^up\d+$/.test(g) ? 'statue' : null;
    const v = levels[g] ?? (parent ? levels[parent] : undefined) ?? levels.all ?? 1;
    for (const [m, b] of P[g].mats) m.emissiveIntensity = b * v;
    for (const [l, b] of P[g].lights) { l.intensity = b * v; l.visible = v > 0.002; }
    for (const [s, b] of P[g].sprites) { s.material.opacity = b * v; s.visible = v > 0.002; }
    for (const [s, b] of P[g].pools) { s.material.opacity = b * v; s.visible = v > 0.002; }
  }
}

const glowTex = TX.radialGlow();
const glowTexCool = TX.radialGlow('rgba(170,210,255,1)', 'rgba(120,170,255,0)');
function glowSprite(group, x, y, z, size, base = 0.9, tex = glowTex, color = 0xffffff) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: base }));
  s.position.set(x, y, z); s.scale.set(size, size, 1);
  if (group) reg(group, 'sprites', s, base);
  return s;
}
function groundPool(group, x, y, z, size, base = 0.55, color = 0xffd9a0) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: glowTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: base, fog: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, y, z);
  reg(group, 'pools', m, base);
  return m;
}

export function buildWorld(scene) {
  const W = { chars: {}, props: {} };
  const R = rng(99);

  // ------------------------------------------------ ground + hill
  const gGeo = new THREE.PlaneGeometry(700, 700, 175, 175); gGeo.rotateX(-Math.PI / 2);
  const pos = gGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)) - 0.02);
  gGeo.computeVertexNormals();
  const grassTex = TX.noiseTexture('#3f8f3a', ['#4fa646', '#367d33', '#5cb850', '#2f6e2c'], 3);
  grassTex.repeat.set(90, 90);
  const ground = new THREE.Mesh(gGeo, new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.95 }));
  ground.receiveShadow = true; scene.add(ground);

  // roads
  const asphalt = mat('#3a3d46', { roughness: 0.9 });
  const road = (x, z, w, d) => { const m = mesh(new THREE.BoxGeometry(w, 0.06, d), asphalt, x, 0.01, z, false); scene.add(m); };
  road(0, 0, 60, 60); // ring road under plaza
  road(0, 70, 10, 90); road(-70, 0, 90, 10); road(70, 18, 90, 10);
  // path ribbon
  {
    const N = 160, verts = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N, p = pathPoint(u), t = path.getTangentAt(u), n = new THREE.Vector3(-t.z, 0, t.x).normalize();
      for (const s of [-1, 1]) { const q = p.clone().addScaledVector(n, s * 1.3); verts.push(q.x, heightAt(q.x, q.z) + 0.06, q.z); }
      if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat('#c9a874', { roughness: 1, side: THREE.DoubleSide })); m.receiveShadow = true; scene.add(m);
    // little path lamps along the hill (part of the town grid)
    for (let i = 1; i < 9; i++) {
      const u = i / 9.5, p = pathPoint(u), t = path.getTangentAt(u), n = new THREE.Vector3(-t.z, 0, t.x).normalize();
      const q = p.clone().addScaledVector(n, 1.9); q.y = heightAt(q.x, q.z);
      scene.add(mesh(new THREE.CylinderGeometry(0.07, 0.09, 2.2, 8), mat('#2d3b33'), q.x, q.y + 1.1, q.z));
      scene.add(mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), powerMat('lamps', '#fff2c4', '#ffcc77', 2.2), q.x, q.y + 2.3, q.z, false));
      scene.add(glowSprite('lamps', q.x, q.y + 2.3, q.z, 3.2, 0.7));
      scene.add(groundPool('lamps', q.x, q.y + 0.1, q.z, 6, 0.35));
    }
  }

  // ------------------------------------------------ the town square
  const plaza = new THREE.Mesh(new THREE.PlaneGeometry(46, 46), new THREE.MeshStandardMaterial({ map: TX.plazaTexture(), roughness: 0.85 }));
  plaza.rotation.x = -Math.PI / 2; plaza.position.y = 0.05; plaza.receiveShadow = true; scene.add(plaza);
  // curb
  const curb = mat('#b7b0a6');
  for (const [x, z, w, d] of [[0, 23.2, 46.8, 0.6], [0, -23.2, 46.8, 0.6], [23.2, 0, 0.6, 46.8], [-23.2, 0, 0.6, 46.8]]) scene.add(mesh(new THREE.BoxGeometry(w, 0.25, d), curb, x, 0.12, z));

  // golden statue of the mayor
  {
    const ped = mat('#e8e1d4', { roughness: 0.7 });
    scene.add(mesh(rbox(5.2, 1.0, 5.2, 0.15), ped, 0, 0.5, 0));
    scene.add(mesh(rbox(3.8, 1.8, 3.8, 0.12), ped, 0, 1.9, 0));
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 0.7), new THREE.MeshStandardMaterial({ map: TX.plainText('OUR MAYOR', { fg: '#5a4510', bg: '#d8b74a', size: 150 }), roughness: 0.4, metalness: 0.4 }));
    plaque.position.set(0, 1.9, 1.92); scene.add(plaque);
    const goldM = powerMat('statue', '#d9a12c', '#ff9d00', 0.05, { metalness: 0.85, roughness: 0.22 });
    const st = makeChar(Object.assign({}, CAST.mayor, { material: goldM, scale: 2.3, extras: CAST.mayor.extras }));
    st.root.position.set(0, 2.8, 0);
    st.faceMat.color.set('#ffcf55'); st.faceMat.opacity = 0.7;
    st.root.traverse((o) => { if (o.isMesh && o !== st.face) o.material = goldM; });
    st.setExpr('smile');
    st.pose({ armR: [2.6, 0.25, 0], armL: [0.2, 0.25, 0], head: [-0.1, 0, 0], lean: -0.05 });
    scene.add(st.root); W.statue = st;
    // uplights
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2, x = Math.cos(a) * 2.35, z = Math.sin(a) * 2.35;
      scene.add(mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.12, 12), powerMat('up' + i, '#333', '#ffd27a', 3), x, 1.06, z, false));
      scene.add(glowSprite('up' + i, x, 1.2, z, 1.6, 0.8));
    }
    for (const [x, z] of [[9, 9], [-9, 9]]) {
      const sp = new THREE.SpotLight(0xffc870, 120, 40, 0.42, 0.6, 2);
      sp.position.set(x, 9, z); sp.target.position.set(0, 6, 0); scene.add(sp, sp.target);
      reg('statue', 'lights', sp, 120);
    }
    W.statueHalo = glowSprite('statue', 0, 7.5, 0, 16, 0.32, glowTex, 0xffd27a); scene.add(W.statueHalo);
  }

  // shops around the square
  const shopDefs = [
    ['BAKERY', '#ffb3c7', '#ff5d8f', '#f7d6b5'], ['TOYS', '#7ef9ff', '#20c7d8', '#6a8fe8'], ['PIZZA', '#ffd36b', '#ff8c1a', '#e86a5a'],
    ['BOOKS', '#d7b3ff', '#9b5cff', '#7ac6a0'], ['ARCADE', '#8cf5ff', '#4b7bff', '#9a6be0'], ['CAFE', '#ffe08a', '#ffb000', '#e8b46a'],
    ['FLOWERS', '#ffb3f0', '#ff4fd8', '#f2a1a1'], ['ICE CREAM', '#b3fff0', '#1fd1b2', '#ffd1e8'],
  ];
  W.shops = [];
  const shop = (x, z, ry, w, def, h = 7) => {
    const [label, fg, glow, wall] = def;
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
    g.add(mesh(rbox(w, h, 7, 0.2), mat(wall, { roughness: 0.8 }), 0, h / 2, 0));
    g.add(mesh(rbox(w + 0.4, 0.5, 7.4, 0.12), mat('#f4efe6'), 0, h + 0.2, 0));
    // shop window + door
    g.add(mesh(new THREE.BoxGeometry(w * 0.55, 2.6, 0.2), powerMat('shops', '#2a2030', '#ffcf8a', 0.9), -w * 0.12, 1.9, 3.52, false));
    g.add(mesh(new THREE.BoxGeometry(1.4, 2.8, 0.2), mat('#5a3a28'), w * 0.3, 1.4, 3.52, false));
    // upper windows
    for (const sx of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(1.4, 1.4, 0.2), powerMat('windows', '#202538', '#ffd59a', R() < 0.7 ? 1.1 : 0.0), sx * w * 0.25, h - 1.6, 3.52, false));
    // striped awning
    const aw = new THREE.Mesh(new THREE.BoxGeometry(w * 0.8, 0.18, 1.8), mat(glow, { roughness: 0.7 }));
    aw.position.set(0, 3.55, 4.3); aw.rotation.x = 0.35; aw.castShadow = true; g.add(aw);
    for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(w * 0.8 / 12, 0.2, 1.82), mat('#ffffff')); s.position.set(-w * 0.4 + (i * 2 + 0.5) * w * 0.8 / 12 + w * 0.8 / 24, 3.56, 4.3); s.rotation.x = 0.35; g.add(s); }
    // neon sign
    const sm = new THREE.MeshStandardMaterial({ map: TX.signTexture(label, fg, '#1a1430'), emissiveMap: TX.signTexture(label, fg, '#000000'), emissive: '#ffffff', emissiveIntensity: 2.4, roughness: 0.5 });
    reg('shops', 'mats', sm, 2.4);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.7, w * 0.175), sm); sign.position.set(0, 4.9, 3.62); g.add(sign);
    const gl = glowSprite('shops', 0, 4.9, 4.4, w * 0.9, 0.38, glowTex, new THREE.Color(glow)); g.add(gl);
    g.add(groundPool('shops', 0, 0.08, 6, w * 1.1, 0.4, new THREE.Color(glow).getHex()));
    W.shops.push({ g, label });
    return g;
  };
  // north row (facing +z), west row (facing +x), east row with gap for the road
  shop(-15, -28, 0, 9.5, shopDefs[0]); shop(-5, -28, 0, 9.5, shopDefs[1], 8); shop(5, -28, 0, 9.5, shopDefs[2]); shop(15, -28, 0, 9.5, shopDefs[3], 7.5);
  shop(-28, -12, Math.PI / 2, 9.5, shopDefs[4], 8); shop(-28, -2, Math.PI / 2, 9.5, shopDefs[5]); shop(-28, 8, Math.PI / 2, 9.5, shopDefs[6], 7.5); shop(-28, 18, Math.PI / 2, 9.5, shopDefs[7]);
  shop(28, -14, -Math.PI / 2, 9.5, shopDefs[5], 8.5); shop(28, 14, -Math.PI / 2, 9.5, shopDefs[0], 7);
  W.bakery = W.shops[0];

  // street lamps around the plaza
  const lampPost = mat('#22343a', { roughness: 0.5, metalness: 0.3 });
  W.lamps = [];
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2 + 0.26, x = Math.cos(a) * 18.5, z = Math.sin(a) * 18.5;
    const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
    g.add(mesh(new THREE.CylinderGeometry(0.16, 0.24, 5.2, 10), lampPost, 0, 2.6, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.3, 10), lampPost, 0, 0.15, 0));
    g.add(mesh(rbox(0.75, 0.9, 0.75, 0.1), powerMat('lamp' + i, '#3a3a40', '#ffcf7a', 3.0), 0, 5.55, 0, false));
    g.add(mesh(new THREE.ConeGeometry(0.62, 0.45, 4), lampPost, 0, 6.2, 0).rotateY(Math.PI / 4));
    g.add(glowSprite('lamp' + i, 0, 5.55, 0, 6.5, 0.85));
    g.add(groundPool('lamp' + i, 0, 0.09, 0, 13, 0.6));
    W.lamps.push(g);
  }
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2 + 0.26 + Math.PI / 12, l = new THREE.PointLight(0xffc27a, 60, 24, 2);
    l.position.set(Math.cos(a) * 18.5, 5.0, Math.sin(a) * 18.5); scene.add(l); reg('lamps', 'lights', l, 60);
  }
  // festive string lights across the square
  {
    const cols = ['#3fa9ff', '#2ee6d6', '#b46bff', '#ff9a3c', '#ffd34d'];
    const bulbs = [];
    const strings = [[[-23, 7, -23], [23, 7, 23]], [[-23, 7, 23], [23, 7, -23]], [[-23, 6.5, 0], [23, 6.5, 0]], [[0, 6.5, -23], [0, 6.5, 23]]];
    strings.forEach(([a, b]) => {
      for (let i = 0; i <= 34; i++) {
        const t = i / 34, x = a[0] + (b[0] - a[0]) * t, z = a[2] + (b[2] - a[2]) * t, y = a[1] - Math.sin(t * Math.PI) * 1.4;
        if (Math.hypot(x, z) < 4.5) continue;
        bulbs.push([x, y, z, cols[i % 5]]);
      }
    });
    const geo = new THREE.SphereGeometry(0.14, 8, 6);
    cols.forEach((c) => {
      const list = bulbs.filter((b) => b[3] === c);
      const im = new THREE.InstancedMesh(geo, powerMat('strings', '#1a1a22', c, 3.5), list.length);
      const m4 = new THREE.Matrix4();
      list.forEach((b, i) => { m4.makeTranslation(b[0], b[1], b[2]); im.setMatrixAt(i, m4); });
      scene.add(im);
      list.forEach((b, i) => { if (i % 3 === 0) scene.add(glowSprite('strings', b[0], b[1], b[2], 1.3, 0.55, glowTex, new THREE.Color(c))); });
    });
  }
  // benches + planters in the plaza
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4, x = Math.cos(a) * 11, z = Math.sin(a) * 11;
    const b = new THREE.Group(); b.position.set(x, 0, z); b.rotation.y = -a + Math.PI / 2; scene.add(b);
    b.add(mesh(rbox(3, 0.18, 0.9, 0.05), mat('#a0663a'), 0, 0.75, 0)); b.add(mesh(rbox(3, 0.8, 0.15, 0.05), mat('#a0663a'), 0, 1.25, -0.4));
    b.add(mesh(new THREE.BoxGeometry(0.15, 0.75, 0.8), lampPost, -1.3, 0.37, 0)); b.add(mesh(new THREE.BoxGeometry(0.15, 0.75, 0.8), lampPost, 1.3, 0.37, 0));
  }

  // houses beyond the shops + distant blocks with lit windows
  const houseCols = ['#f28b82', '#fbbc04', '#a7ffeb', '#aecbfa', '#d7aefb', '#fdcfe8', '#ccff90', '#ffd6a5'];
  const roofM = [mat('#8c3b3b'), mat('#3b4f8c'), mat('#5a3b8c'), mat('#3b7a5a')];
  const winM = powerMat('windows', '#262b40', '#ffcf86', 1.3);
  const placeHouse = (x, z, ry, s = 1, col) => {
    const g = new THREE.Group(); g.position.set(x, heightAt(x, z), z); g.rotation.y = ry; g.scale.setScalar(s); scene.add(g);
    g.add(mesh(rbox(6, 4.5, 6, 0.15), mat(col || houseCols[(R() * 8) | 0], { roughness: 0.8 }), 0, 2.25, 0));
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 4.8, 3, 4, 1), roofM[(R() * 4) | 0]); roof.rotation.y = Math.PI / 4; roof.position.y = 6; roof.castShadow = true; g.add(roof);
    for (const sx of [-1.5, 1.5]) g.add(mesh(new THREE.BoxGeometry(1.2, 1.2, 0.15), winM, sx, 2.8, 3.05, false));
    g.add(mesh(new THREE.BoxGeometry(1.2, 2.2, 0.15), mat('#6b4430'), 0, 1.1, 3.05, false));
    return g;
  };
  for (let i = 0; i < 26; i++) {
    const a = R() * Math.PI * 2, r = 42 + R() * 30, x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (x > 15 && z < 10 && z > -90) continue; // keep path + hill side clear
    if (Math.abs(x) < 8 && z > 30) continue; // keep south road clear for aerial shots
    placeHouse(x, z, -a - Math.PI / 2, 0.9 + R() * 0.3);
  }
  // distant skyline (instanced)
  {
    const [cm, em] = TX.windowTextures(5, 4, 8, '#2a3048', 0.55);
    const bm = new THREE.MeshStandardMaterial({ map: cm, emissiveMap: em, emissive: '#ffffff', emissiveIntensity: 1.0, roughness: 0.8 });
    reg('windows', 'mats', bm, 1.0);
    const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0);
    const N = 90, im = new THREE.InstancedMesh(geo, bm, N), m4 = new THREE.Matrix4(); let k = 0;
    for (let i = 0; i < 400 && k < N; i++) {
      const a = R() * Math.PI * 2, r = 150 + R() * 90, x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (Math.hypot(x - HILL.x, z - HILL.z) < 60) continue;
      if (z > 40 && Math.abs(x) < 45) continue;
      const w = 8 + R() * 9, h = 9 + R() * 22;
      m4.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, R() * 3, 0)), new THREE.Vector3(w, h, w));
      im.setMatrixAt(k++, m4);
    }
    im.count = k; scene.add(im);
  }

  // ------------------------------------------------ trees (instanced)
  {
    const pts = [];
    for (let i = 0; i < 140; i++) {
      const u = 0.25 + R() * 0.72, p = pathPoint(u), t = path.getTangentAt(u), n = new THREE.Vector3(-t.z, 0, t.x).normalize();
      const side = R() < 0.5 ? -1 : 1, off = 3.2 + R() * 9;
      const q = p.clone().addScaledVector(n, side * off);
      pts.push([q.x, q.z, 0.8 + R() * 0.6]);
    }
    for (let i = 0; i < 110; i++) {
      const a = R() * Math.PI * 2, r = 14 + R() * 34, x = HILL.x + Math.cos(a) * r, z = HILL.z + Math.sin(a) * r;
      if (Math.hypot(x - HILL.x, z - HILL.z) < 12) continue;
      pts.push([x, z, 0.8 + R() * 0.7]);
    }
    for (let i = 0; i < 40; i++) { const a = R() * Math.PI * 2, r = 30 + R() * 50; const x = Math.cos(a) * r, z = Math.sin(a) * r; if (Math.abs(x) < 30 && Math.abs(z) < 30) continue; if (Math.abs(x) < 9 && z > 25) continue; pts.push([x, z, 0.9 + R() * 0.5]); }
    const ok = pts.filter(([x, z]) => {
      for (let u = 0; u <= 1; u += 0.02) { const p = pathPoint(u); if (Math.hypot(p.x - x, p.z - z) < 2.8) return false; }
      return true;
    });
    const trunkGeo = rbox(0.7, 3, 0.7, 0.1); const leafGeo = rbox(1, 1, 1, 0.18);
    const trunk = new THREE.InstancedMesh(trunkGeo, mat('#6b4428', { roughness: 0.9 }), ok.length);
    const leaves = new THREE.InstancedMesh(leafGeo, mat('#ffffff', { roughness: 0.8 }), ok.length * 3);
    trunk.castShadow = leaves.castShadow = true; trunk.receiveShadow = leaves.receiveShadow = true;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    const greens = ['#2e8b3a', '#3fa34d', '#4cbb5a', '#2a7a40', '#58c46a'];
    ok.forEach(([x, z, s], i) => {
      const y = heightAt(x, z);
      m4.compose(new THREE.Vector3(x, y + 1.5 * s, z), q.identity(), new THREE.Vector3(s, s, s)); trunk.setMatrixAt(i, m4);
      for (let k = 0; k < 3; k++) {
        const w = (3.4 - k * 0.9) * s;
        q.setFromEuler(new THREE.Euler(0, R() * 1.5, 0));
        m4.compose(new THREE.Vector3(x, y + (3.2 + k * 1.25) * s, z), q, new THREE.Vector3(w, 1.5 * s, w)); leaves.setMatrixAt(i * 3 + k, m4);
        leaves.setColorAt(i * 3 + k, c.set(greens[(R() * greens.length) | 0]));
      }
    });
    scene.add(trunk, leaves); W.leaves = leaves;
  }

  // ------------------------------------------------ playground
  {
    const pg = new THREE.Group(); const px = 31, pz = -19; pg.position.set(px, heightAt(px, pz), pz); pg.rotation.y = 0.5; scene.add(pg); W.playground = pg;
    const red = mat('#ff4d4d'), yel = mat('#ffd23f'), blu = mat('#3d7bff'), grn = mat('#3fcf7a'), metal = mat('#c8ced8', { metalness: 0.5, roughness: 0.4 });
    pg.add(mesh(new THREE.CylinderGeometry(9, 9, 0.1, 40), mat('#d9b98a', { roughness: 1 }), 0, 0.05, 0));
    // slide tower
    for (const [x, z] of [[-3, -1], [-1, -1], [-3, 1], [-1, 1]]) pg.add(mesh(new THREE.CylinderGeometry(0.15, 0.15, 3.4, 8), blu, x, 1.7, z));
    pg.add(mesh(rbox(2.6, 0.25, 2.6, 0.06), yel, -2, 2.4, 0));
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.1, 1.4, 4), red); roof.position.set(-2, 4.1, 0); roof.rotation.y = Math.PI / 4; roof.castShadow = true; pg.add(roof);
    const slide = mesh(rbox(1.2, 0.15, 4.2, 0.06), red, 1.0, 1.25, 0); slide.rotation.z = 0.55; slide.rotation.y = Math.PI / 2; pg.add(slide);
    // swing set
    const sw = new THREE.Group(); sw.position.set(3.5, 0, -4); pg.add(sw);
    for (const x of [-2.2, 2.2]) for (const z of [-0.8, 0.8]) { const l = mesh(new THREE.CylinderGeometry(0.1, 0.1, 3.4, 8), metal, x, 1.6, z * 0.5); l.rotation.x = z > 0 ? -0.25 : 0.25; sw.add(l); }
    sw.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 4.6, 8).rotateZ(Math.PI / 2), metal, 0, 3.25, 0));
    W.swings = [];
    for (const x of [-1, 1]) {
      const s = new THREE.Group(); s.position.set(x, 3.2, 0); sw.add(s);
      for (const dx of [-0.35, 0.35]) s.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.4, 4), metal, dx, -1.2, 0));
      s.add(mesh(rbox(0.9, 0.1, 0.45, 0.03), x < 0 ? grn : yel, 0, -2.4, 0));
      W.swings.push(s);
    }
    // see-saw + spring rider
    const ss = mesh(rbox(4.5, 0.15, 0.5, 0.05), grn, 2.5, 0.6, 3.5); ss.rotation.z = 0.18; pg.add(ss); pg.add(mesh(rbox(0.5, 0.6, 0.5, 0.05), yel, 2.5, 0.3, 3.5));
    pg.add(mesh(rbox(0.8, 0.9, 1.4, 0.3), blu, -3.5, 0.9, 4)); pg.add(mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.5, 6), metal, -3.5, 0.25, 4));
    pg.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  }

  // ------------------------------------------------ the observatory
  buildObservatory(scene, W);
  // ------------------------------------------------ hospital memory set + welcome-home set
  buildHospital(scene, W);
  buildHome(scene, W, placeHouse);

  // ------------------------------------------------ cast
  W.chars.leo = makeChar(CAST.leo);
  W.chars.noah = makeChar(CAST.noah);
  W.chars.maya = makeChar(CAST.maya);
  W.chars.mayor = makeChar(CAST.mayor);
  W.chars.baker = makeChar(CAST.baker);
  W.chars.elec1 = makeChar(electrician(61, '#c68642'));
  W.chars.elec2 = makeChar(electrician(62, '#f1c27d'));
  W.crowd = [];
  for (let i = 0; i < 9; i++) { const c = makeChar(citizen(i + 3)); W.crowd.push(c); scene.add(c.root); }
  for (const k in W.chars) scene.add(W.chars[k].root);
  // Noah's switch prop (carried) + the mounted one inside
  W.props.carrySwitch = makeSwitch(); scene.add(W.props.carrySwitch.g);
  return W;
}

export function makeSwitch() {
  const g = new THREE.Group();
  const metal = mat('#4a515e', { metalness: 0.5, roughness: 0.45 });
  g.add(mesh(rbox(1.1, 1.4, 0.55, 0.08), metal, 0, 0, 0));
  g.add(mesh(rbox(0.9, 1.15, 0.1, 0.03), mat('#2c313a'), 0, 0, 0.28));
  const hz = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.2), new THREE.MeshStandardMaterial({ map: TX.hazardTexture(), roughness: 0.6 }));
  hz.position.set(0, -0.58, 0.281); g.add(hz);
  // hinge + lever
  g.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.7, 12).rotateZ(Math.PI / 2), mat('#9aa3b0', { metalness: 0.8, roughness: 0.3 }), 0, 0, 0.42));
  const lever = new THREE.Group(); lever.position.set(0, 0, 0.42); g.add(lever);
  const arm = mat('#b9c0cc', { metalness: 0.8, roughness: 0.3 });
  lever.add(mesh(rbox(0.08, 0.6, 0.08, 0.02), arm, -0.25, 0.3, 0.05)); lever.add(mesh(rbox(0.08, 0.6, 0.08, 0.02), arm, 0.25, 0.3, 0.05));
  const red = mat('#e3222a', { roughness: 0.35 });
  lever.add(mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.85, 16).rotateZ(Math.PI / 2), red, 0, 0.62, 0.05));
  // indicator lamp (green when power flows)
  const ind = new THREE.MeshStandardMaterial({ color: '#3a3', emissive: '#4f4', emissiveIntensity: 2 });
  g.add(mesh(new THREE.SphereGeometry(0.07, 12, 8), ind, 0.38, 0.5, 0.3, false));
  // ON / OFF labels
  const on = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.12), new THREE.MeshBasicMaterial({ map: TX.plainText('ON', { fg: '#ffffff', size: 180 }), transparent: true }));
  on.position.set(-0.18, 0.46, 0.335); g.add(on);
  const off = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.12), new THREE.MeshBasicMaterial({ map: TX.plainText('OFF', { fg: '#ffffff', size: 180 }), transparent: true }));
  off.position.set(-0.18, -0.4, 0.335); g.add(off);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { g, lever, ind, set(v) { lever.rotation.x = 2.55 - v * 2.2; } };
}

function buildObservatory(scene, W) {
  const g = new THREE.Group(); g.position.copy(OBS); g.rotation.y = OBS_ROT; scene.add(g); W.obs = g;
  const stone = mat('#9a948c', { roughness: 0.95 });
  // platform (terrace)
  const plat = mesh(new THREE.CylinderGeometry(10.5, 11.5, 4, 48), stone, 0, -2.2, 0); g.add(plat);
  const tile = new THREE.Mesh(new THREE.CircleGeometry(10.4, 48), new THREE.MeshStandardMaterial({ map: TX.noiseTexture('#a49d93', ['#8f887e', '#b5aea4', '#7f786f'], 9), roughness: 0.95 }));
  tile.rotation.x = -Math.PI / 2; tile.position.y = -0.19; tile.receiveShadow = true; g.add(tile);
  // railing
  const rail = mat('#3c3f45', { metalness: 0.4, roughness: 0.5 });
  for (let i = 0; i < 40; i++) {
    const a = i / 40 * Math.PI * 2; if (Math.abs(Math.atan2(Math.sin(a - Math.PI / 2 - 0.0), Math.cos(a - Math.PI / 2))) < 0.18) continue;
    g.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 6), rail, Math.cos(a) * 10.1, 0.35, Math.sin(a) * 10.1));
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(10.1, 0.06, 6, 96), rail); ring.rotation.x = Math.PI / 2; ring.position.y = 0.9; g.add(ring);
  // walls (exterior + interior)
  const wallTex = TX.noiseTexture('#d9d4c9', ['#c4bdb0', '#b3ab9d', '#e6e1d8', '#9e9688'], 21);
  wallTex.repeat.set(6, 2);
  const ext = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 5.6, 64, 1, true), new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.95 }));
  ext.position.y = 2.6; ext.castShadow = true; ext.receiveShadow = true; g.add(ext);
  const intTex = TX.noiseTexture('#7d7468', ['#6b6257', '#8a8073', '#5c544a'], 22); intTex.repeat.set(5, 2);
  const inn = new THREE.Mesh(new THREE.CylinderGeometry(4.82, 4.82, 5.6, 64, 1, true), new THREE.MeshStandardMaterial({ map: intTex, roughness: 0.95, side: THREE.BackSide }));
  inn.position.y = 2.6; inn.receiveShadow = true; g.add(inn);
  // dome with a wide broken-open wedge facing the town (+z) and a missing crown
  const gap = 1.25;
  const domeM = new THREE.MeshStandardMaterial({ color: '#c9cdd3', metalness: 0.35, roughness: 0.55, side: THREE.DoubleSide });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(5.25, 64, 24, Math.PI / 2 + gap / 2, Math.PI * 2 - gap, 0.5, Math.PI / 2 - 0.5), domeM);
  dome.position.y = 5.4; dome.castShadow = true; dome.receiveShadow = true; g.add(dome);
  for (let i = 0; i < 10; i++) { // dome ribs
    const a = Math.PI / 2 + gap / 2 + i / 9 * (Math.PI * 2 - gap);
    const rib = new THREE.Mesh(new THREE.TorusGeometry(5.3, 0.07, 6, 24, Math.PI / 2 - 0.5), rail);
    rib.position.y = 5.4; rib.rotation.set(0, Math.PI + a, 0); g.add(rib);
  }
  g.add(mesh(new THREE.TorusGeometry(5.15, 0.18, 8, 64).rotateX(Math.PI / 2), mat('#8d8f94', { metalness: 0.4 }), 0, 5.42, 0));
  // door (facing town)
  const door = mesh(rbox(1.7, 2.9, 0.2, 0.05), mat('#4a3324', { roughness: 0.9 }), 0, 1.45, 4.98); g.add(door); W.obsDoor = door;
  door.geometry = door.geometry.clone(); door.geometry.translate(0.85, 0, 0); door.position.x = -0.85;
  for (const y of [0.9, 2.1]) { const b = mesh(rbox(2.2, 0.22, 0.1, 0.03), mat('#6e5038'), 0.1, y, 5.12); b.rotation.z = y > 1.5 ? 0.25 : -0.2; g.add(b); }
  // ivy blobs
  const ivy = mat('#2f6b34', { roughness: 0.9 });
  const R = rng(5);
  for (let i = 0; i < 26; i++) { const a = R() * Math.PI * 2, y = R() * 3.5; const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35 + R() * 0.3, 1), ivy); b.position.set(Math.cos(a) * 5.45, y + 0.2, Math.sin(a) * 5.45); g.add(b); }
  // exterior dark windows
  for (const a of [Math.PI * 0.75, Math.PI * 1.25, Math.PI * 0.2]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.1), mat('#1b2333', { roughness: 0.2, metalness: 0.3 }));
    w.position.set(Math.sin(a) * 5.02, 3.0, Math.cos(a) * 5.02); w.rotation.y = a; g.add(w);
  }

  // ---------- interior
  const floor = new THREE.Mesh(new THREE.CircleGeometry(4.8, 48), new THREE.MeshStandardMaterial({ map: TX.woodTexture(3), roughness: 0.85 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = 0.02; floor.receiveShadow = true; g.add(floor);
  // telescope (old, pointing out through the dome opening)
  const tg = new THREE.Group(); tg.position.set(2.1, 0, -2.4); g.add(tg);
  const brass = mat('#b08d57', { metalness: 0.7, roughness: 0.35 });
  tg.add(mesh(new THREE.CylinderGeometry(0.45, 0.7, 1.6, 16), mat('#2f3238'), 0, 0.8, 0));
  const tube = new THREE.Group(); tube.position.y = 1.9; tube.rotation.x = -0.85; tg.add(tube);
  tube.add(mesh(new THREE.CylinderGeometry(0.42, 0.5, 4.2, 20).rotateX(Math.PI / 2), mat('#e6e2da', { roughness: 0.5 }), 0, 0, 0.6));
  tube.add(mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.3, 20).rotateX(Math.PI / 2), brass, 0, 0, 2.6));
  tube.add(mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.4, 12).rotateX(Math.PI / 2), brass, 0, 0, -1.6));
  // desk with drawing, note, notebook, lantern
  const deskA = 1.95, deskR = 3.9;
  const desk = new THREE.Group(); desk.position.set(Math.sin(deskA) * deskR, 0, Math.cos(deskA) * deskR); desk.rotation.y = deskA + Math.PI; g.add(desk); W.desk = desk;
  const wood = new THREE.MeshStandardMaterial({ map: TX.woodTexture(8), roughness: 0.8 });
  desk.add(mesh(rbox(2.8, 0.14, 1.3, 0.04), wood, 0, 1.25, 0));
  for (const [x, z] of [[-1.25, -0.5], [1.25, -0.5], [-1.25, 0.5], [1.25, 0.5]]) desk.add(mesh(rbox(0.12, 1.22, 0.12, 0.03), wood, x, 0.61, z));
  const drawing = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.9), new THREE.MeshStandardMaterial({ map: TX.drawingTexture(), roughness: 0.9 }));
  drawing.rotation.x = -Math.PI / 2; drawing.rotation.z = 0.06; drawing.position.set(-0.2, 1.326, -0.12); desk.add(drawing); W.drawing = drawing;
  const note = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.33), new THREE.MeshStandardMaterial({ map: TX.noteTexture(), roughness: 0.9 }));
  note.rotation.x = -Math.PI / 2; note.rotation.z = -0.04; note.position.set(-0.18, 1.327, 0.47); desk.add(note); W.note = note;
  // crayons
  ['#e63946', '#ffd23f', '#3d7bff', '#2ec27e', '#9b5de5', '#ff8c42'].forEach((c, i) => { const cr = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.3, 8).rotateZ(Math.PI / 2), mat(c), 0.75 + (i % 3) * 0.02, 1.35, -0.3 + i * 0.07, false); cr.rotation.y = 0.2 * i; desk.add(cr); });
  // worn notebook
  desk.add(mesh(rbox(0.5, 0.06, 0.65, 0.02), mat('#7a4e2d', { roughness: 0.9 }), 0.95, 1.35, 0.25));
  // battery lantern (warm, keeps faces readable after the blackout)
  const lan = new THREE.Group(); lan.position.set(1.05, 1.32, -0.35); desk.add(lan);
  lan.add(mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.08, 12), mat('#333'), 0, 0.04, 0));
  lan.add(mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.3, 12), new THREE.MeshStandardMaterial({ color: '#fff3d0', emissive: '#ffbf6b', emissiveIntensity: 3 }), 0, 0.23, 0, false));
  lan.add(mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.05, 12), mat('#333'), 0, 0.4, 0));
  const ll = new THREE.PointLight(0xffb866, 9, 9, 1.6); ll.position.set(0, 0.35, 0); lan.add(ll); W.lanternLight = ll;
  lan.add(glowSprite(null, 0, 0.25, 0, 1.4, 0.7));
  // wall-mounted junction box + switch mount
  const swA = Math.PI * 1.12, swR = 4.45;
  const mount = new THREE.Group(); mount.position.set(Math.sin(swA) * swR, 0, Math.cos(swA) * swR); mount.rotation.y = swA + Math.PI; g.add(mount); W.switchMount = mount;
  mount.add(mesh(rbox(1.4, 1.1, 1.0, 0.05), mat('#7a5a3a', { roughness: 0.9 }), 0, 0.55, 0)); // crate
  const sw = makeSwitch(); sw.g.position.set(0, 1.85, 0.05); mount.add(sw.g); W.props.mountSwitch = sw;
  mount.add(mesh(rbox(0.9, 0.9, 0.3, 0.04), mat('#5d636e', { metalness: 0.5 }), 0, 3.3, -0.3)); // junction box on wall
  const hzs = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.5), new THREE.MeshBasicMaterial({ map: TX.plainText('⚡', { fg: '#ffcc00', size: 200, w: 256, h: 256 }), transparent: true })); hzs.position.set(0, 3.3, -0.14); mount.add(hzs);
  const cable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0.3, 2.3, 0), new THREE.Vector3(0.45, 2.8, -0.2), new THREE.Vector3(0.2, 3.0, -0.3)]), 12, 0.05, 6), mat('#111'));
  mount.add(cable);
  const cable2 = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-0.2, 3.0, -0.35), new THREE.Vector3(-0.4, 1.5, -0.42), new THREE.Vector3(-0.6, 0.05, -0.2), new THREE.Vector3(-1.5, 0.04, 0.6)]), 20, 0.06, 6), mat('#111'));
  mount.add(cable2);
  // junk: crates, broken chair, papers
  for (const [a, r, s] of [[0.9, 4.0, 0.9], [1.1, 4.1, 0.7], [4.6, 3.9, 1]]) { const c = mesh(rbox(s, s, s, 0.04), mat('#8a6a48', { roughness: 0.95 }), Math.sin(a) * r, s / 2, Math.cos(a) * r); c.rotation.y = a * 3; g.add(c); }
  for (let i = 0; i < 14; i++) { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.4), mat('#e8e0cc', { side: THREE.DoubleSide })); p.rotation.set(-Math.PI / 2, 0, R() * 3); p.position.set((R() - 0.5) * 7, 0.03 + i * 0.001, (R() - 0.5) * 7); if (p.position.length() < 4.5) g.add(p); }
  // interior windows (moonlit glass) + light beams + dust
  W.beams = [];
  for (const a of [Math.PI * 0.75, Math.PI * 1.25, Math.PI * 0.2]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.1), new THREE.MeshBasicMaterial({ color: '#7f9ccf' }));
    w.position.set(Math.sin(a) * 4.79, 3.0, Math.cos(a) * 4.79); w.rotation.y = a + Math.PI; g.add(w);
    for (const dx of [-0.25, 0.25]) { const bar = mesh(new THREE.BoxGeometry(0.05, 1.1, 0.05), mat('#222'), Math.sin(a) * 4.76 + Math.cos(a) * dx, 3.0, Math.cos(a) * 4.76 - Math.sin(a) * dx, false); g.add(bar); }
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 1.4, 5.5, 16, 1, true), new THREE.MeshBasicMaterial({ color: '#8fb0ff', transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.set(Math.sin(a) * 2.6, 1.7, Math.cos(a) * 2.6);
    beam.lookAt(g.localToWorld(new THREE.Vector3(Math.sin(a) * 5, 3, Math.cos(a) * 5)));
    beam.rotateX(Math.PI / 2);
    beam.visible = false; g.add(beam); W.beams.push(beam);
  }
  {
    const N = 260, pts = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { pts[i * 3] = (R() - 0.5) * 8; pts[i * 3 + 1] = R() * 4.5; pts[i * 3 + 2] = (R() - 0.5) * 8; }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    const dust = new THREE.Points(gg, new THREE.PointsMaterial({ color: '#c8d6ff', size: 0.035, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
    g.add(dust); W.dust = dust; W.dustBase = pts.slice();
  }
  const moonSpot = new THREE.SpotLight(0x9fb8ff, 30, 16, 0.5, 0.7, 1.2);
  moonSpot.position.set(Math.sin(Math.PI * 0.75) * 6, 4.5, Math.cos(Math.PI * 0.75) * 6); g.add(moonSpot);
  moonSpot.target.position.set(0, 0, 0); g.add(moonSpot.target); W.moonSpot = moonSpot;
  // terrace bench (where Maya waits)
  const bench = new THREE.Group(); bench.position.set(-3.2, 0, 7.6); bench.rotation.y = 0.25; g.add(bench); W.bench = bench;
  bench.add(mesh(rbox(2.6, 0.16, 0.8, 0.05), mat('#9a6238'), 0, 0.7, 0)); bench.add(mesh(rbox(2.6, 0.7, 0.14, 0.05), mat('#9a6238'), 0, 1.15, -0.36));
  for (const x of [-1.1, 1.1]) bench.add(mesh(new THREE.BoxGeometry(0.12, 0.7, 0.7), rail, x, 0.35, 0));
  // blanket on bench
  bench.add(mesh(rbox(0.9, 0.2, 0.7, 0.08), mat('#f2a6b8', { roughness: 1 }), 0.8, 0.86, 0.02));
}

export function obsLocal(x, y, z) { return W_obs.localToWorld(new THREE.Vector3(x, y, z)); }
let W_obs = null;
export function setObsRef(g) { W_obs = g; }

function buildHospital(scene, W) {
  const g = new THREE.Group(); g.position.set(400, 0, 400); scene.add(g); W.hospital = g;
  const wall = mat('#d9c6dc', { roughness: 0.9 });
  g.add(mesh(new THREE.BoxGeometry(14, 0.1, 12), mat('#d9e4ec', { roughness: 0.7 }), 0, 0, 0));
  g.add(mesh(new THREE.BoxGeometry(14, 7, 0.3), wall, 0, 3.5, -5));
  g.add(mesh(new THREE.BoxGeometry(0.3, 7, 12), wall, -7, 3.5, 1));
  g.add(mesh(new THREE.BoxGeometry(0.3, 7, 12), wall, 7, 3.5, 1));
  // window with evening view
  const win = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.6), new THREE.MeshBasicMaterial({ map: TX.radialGlow('rgba(255,190,140,1)', 'rgba(90,70,160,1)') }));
  win.position.set(2.8, 3.8, -4.84); g.add(win);
  const fr = mat('#ffffff');
  for (const [x, y, w, h] of [[2.8, 5.15, 3.6, 0.15], [2.8, 2.45, 3.6, 0.15], [1.05, 3.8, 0.15, 2.8], [4.55, 3.8, 0.15, 2.8], [2.8, 3.8, 0.1, 2.6]]) g.add(mesh(new THREE.BoxGeometry(w, h, 0.12), fr, x, y, -4.8, false));
  // curtains
  g.add(mesh(rbox(0.7, 3.4, 0.15, 0.06), mat('#b79cf0'), 0.6, 3.9, -4.7)); g.add(mesh(rbox(0.7, 3.4, 0.15, 0.06), mat('#b79cf0'), 5.0, 3.9, -4.7));
  // bed
  const bed = new THREE.Group(); bed.position.set(-1.2, 0, -1.2); g.add(bed); W.bed = bed;
  bed.add(mesh(rbox(3.0, 0.5, 5.4, 0.1), mat('#ffffff'), 0, 1.2, 0));
  bed.add(mesh(rbox(3.1, 0.3, 4.0, 0.12), mat('#c7b8f5', { roughness: 1 }), 0, 1.55, 0.6)); // blanket
  bed.add(mesh(rbox(2.0, 0.45, 1.0, 0.2), mat('#ffffff', { roughness: 1 }), 0, 1.75, -2.2)); // pillow
  bed.add(mesh(rbox(3.2, 2.2, 0.2, 0.08), mat('#e5eef5'), 0, 1.6, -2.75));
  for (const [x, z] of [[-1.3, -2.4], [1.3, -2.4], [-1.3, 2.4], [1.3, 2.4]]) bed.add(mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.0, 8), mat('#a8b3bd', { metalness: 0.5 }), x, 0.5, z));
  // tray table with paper + crayons
  const tray = new THREE.Group(); tray.position.set(-1.2, 0, 0.6); g.add(tray);
  tray.add(mesh(rbox(2.2, 0.1, 1.0, 0.03), mat('#e9dcc4'), 0, 2.15, 0));
  tray.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.1, 8), mat('#a8b3bd'), 1.15, 1.05, 0));
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.75), new THREE.MeshStandardMaterial({ map: TX.drawingTexture(), roughness: 0.9 }));
  paper.rotation.x = -Math.PI / 2; paper.position.set(-0.15, 2.21, 0); tray.add(paper); W.hospPaper = paper;
  ['#e63946', '#ffd23f', '#3d7bff', '#2ec27e', '#9b5de5'].forEach((c, i) => tray.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8).rotateZ(Math.PI / 2), mat(c), 0.65, 2.24, -0.3 + i * 0.12, false)));
  W.tray = tray;
  // bedside table: flowers + get-well card
  g.add(mesh(rbox(1.2, 1.3, 1.0, 0.06), mat('#d8c3a5'), 1.2, 0.65, -3.2));
  g.add(mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.5, 12), mat('#9ad1ff', { transparent: true, opacity: 0.7 }), 1.0, 1.55, -3.2));
  ['#ff6b8b', '#ffd23f', '#ff9a3c', '#c77dff'].forEach((c, i) => g.add(mesh(new THREE.IcosahedronGeometry(0.16, 1), mat(c), 0.85 + (i % 2) * 0.3, 2.0 + (i > 1 ? 0.12 : 0), -3.25 + (i % 3) * 0.08)));
  const card = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), new THREE.MeshStandardMaterial({ map: TX.hospitalArtTexture() })); card.position.set(1.55, 1.56, -3.0); card.rotation.y = -0.3; g.add(card);
  // a subtle IV stand in the background (soft, not clinical)
  g.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 4, 8), mat('#c5ced6', { metalness: 0.6 }), -3.6, 2, -3.5));
  g.add(mesh(rbox(0.35, 0.55, 0.12, 0.08), mat('#e8f4ff', { transparent: true, opacity: 0.8 }), -3.6, 3.7, -3.5));
  // balloons
  [['#ff6b8b', -4.5], ['#ffd23f', -4.0], ['#7ad1ff', -4.8]].forEach(([c, x], i) => { g.add(mesh(new THREE.SphereGeometry(0.42, 16, 12), mat(c, { roughness: 0.3 }), x, 4.5 + i * 0.3, -2.6 + i * 0.3)); });
  const warm = new THREE.PointLight(0xffc89a, 14, 18, 1.5); warm.position.set(1.5, 5.5, 2); g.add(warm); W.hospLight = warm;
  const fill = new THREE.PointLight(0xc8b4ff, 5, 18, 1.5); fill.position.set(-4, 4, 4); g.add(fill); W.hospFill = fill;
}

function buildHome(scene, W, placeHouse) {
  const g = new THREE.Group(); g.position.set(-400, 0, 400); scene.add(g); W.home = g;
  g.add(mesh(new THREE.BoxGeometry(40, 0.1, 40), mat('#4a9a44'), 0, 0, 0, false));
  g.add(mesh(new THREE.BoxGeometry(2.4, 0.12, 12), mat('#c9a874'), 0, 0.06, 6, false));
  const house = new THREE.Group(); g.add(house);
  house.add(mesh(rbox(12, 7, 8, 0.2), mat('#9ec5ff', { roughness: 0.8 }), 0, 3.5, -4));
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 8.8, 4, 4, 1), mat('#5a3b8c')); roof.rotation.y = Math.PI / 4; roof.scale.set(1.05, 1, 0.75); roof.position.set(0, 9, -4); house.add(roof);
  house.add(mesh(rbox(1.8, 3.2, 0.2, 0.05), mat('#ffffff'), 0, 1.6, 0.05));
  for (const x of [-3.5, 3.5]) house.add(mesh(new THREE.BoxGeometry(2, 1.8, 0.15), new THREE.MeshStandardMaterial({ color: '#2a2a40', emissive: '#ffcf86', emissiveIntensity: 1.4 }), x, 3.2, 0.05, false));
  const porch = new THREE.PointLight(0xffc27a, 7, 14, 1.6); porch.position.set(0, 4.2, 1.2); house.add(porch); W.porch = porch;
  house.add(glowSprite(null, 0, 3.8, 0.4, 1.6, 0.35));
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 1.55), new THREE.MeshStandardMaterial({ map: TX.bannerTexture(), roughness: 0.8, side: THREE.DoubleSide }));
  banner.position.set(0, 5.6, 0.2); house.add(banner);
  [['#ff6b8b', -4.8], ['#ffd23f', -5.4], ['#7ad1ff', 4.9], ['#c77dff', 5.5]].forEach(([c, x], i) => {
    house.add(mesh(new THREE.SphereGeometry(0.5, 16, 12), mat(c, { roughness: 0.3 }), x, 4.6 + (i % 2) * 0.5, 0.6));
    house.add(mesh(new THREE.CylinderGeometry(0.01, 0.01, 3, 4), mat('#eee'), x, 2.9 + (i % 2) * 0.5, 0.6, false));
  });
  // little garden
  ['#ff6b8b', '#ffd23f', '#ffffff', '#c77dff'].forEach((c, i) => { for (let k = 0; k < 4; k++) g.add(mesh(new THREE.IcosahedronGeometry(0.22, 1), mat(c), (i < 2 ? -1 : 1) * (2 + k * 0.9), 0.3, 2 + (i % 2) * 1.2, false)); });
  for (let i = 0; i < 6; i++) placeHouse(-418 + i * 7.5 - (i > 2 ? -22 : 0), -12 + 400, 0, 0.8);
}
