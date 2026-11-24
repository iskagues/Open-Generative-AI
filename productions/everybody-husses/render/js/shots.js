// Shot list. Every cut starts on a narration word (timeline.json -> cuts).
// Each shot is a pure function of local time t (s since cut) and duration d.
import * as THREE from 'three';
import { clamp, lerp, inv, smooth, ease, easeOut, easeIn, sstep, keys, rng, noise1, backOut } from './util.js';
import { SETS, GLASS, LAMPGLOW } from './world.js';
import { faceTexture, textTexture } from './faces.js';

let C; // ctx
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const PULL = SETS.pull;
const PL = (x, y, z) => V(PULL.x + x, PULL.y + y, PULL.z + z);
const HEAD = 2.52; // head-centre height of a scale-1 avatar

// ---------------------------------------------------------------- helpers
function cam(pos, look, fov = 50, roll = 0) {
  const c = C.camera; c.position.copy(pos); c.up.set(0, 1, 0); c.lookAt(look);
  if (roll) c.rotateZ(roll);
  if (c.fov !== fov) { c.fov = fov; c.updateProjectionMatrix(); }
  C.focus = look.clone();
}
function shake(amount, t) { if (!amount) return; const c = C.camera; c.position.x += noise1(t * 23) * amount; c.position.y += noise1(t * 29 + 5) * amount; }
function put(ch, x, y, z, yaw = 0, pose = {}, expr) {
  ch.root.visible = true; ch.root.position.set(x, y, z); ch.root.rotation.set(0, yaw, 0); ch.root.scale.setScalar(1);
  ch.pose(pose); if (expr) ch.setExpr(expr.name || expr, expr.over);
  return ch;
}
const headOf = (ch) => V(ch.root.position.x, ch.root.position.y + (HEAD + (ch.hips.position.y - 1.0)) * ch.spec.scale * ch.root.scale.y, ch.root.position.z);
// close-up in front of a character's face
function faceCam(ch, dist = 2.6, { dy = 0.05, side = 0, fov = 42, lookDy = 0, roll = 0 } = {}) {
  const h = headOf(ch), yaw = ch.root.rotation.y;
  const f = V(Math.sin(yaw), 0, Math.cos(yaw)), r = V(Math.cos(yaw), 0, -Math.sin(yaw));
  cam(h.clone().addScaledVector(f, dist).addScaledVector(r, side).add(V(0, dy, 0)), h.clone().add(V(0, lookDy, 0)), fov, roll);
}
const arc = (u, h) => 4 * h * u * (1 - u); // jump height for 0..1
const AIR = { armL: [2.7, 0.35], armR: [2.7, 0.35], legL: -0.7, legR: 0.5 };
const CROUCH = (k) => ({ bob: -0.35 * k, lean: 0.35 * k, legL: -0.5 * k, legR: -0.5 * k, armL: [-0.5 * k, 0.15], armR: [-0.5 * k, 0.15], fist: k });
function hop(ch, base, t, period = 1.1, h = 6, phase = 0, yaw = 0, expr = 'grin') {
  const u = ((t + phase) % period) / period;
  const air = u < 0.8; const k = air ? u / 0.8 : 0;
  const y = air ? arc(k, h) : 0;
  const squash = air ? 1 : 1 - 0.25 * Math.sin((u - 0.8) / 0.2 * Math.PI);
  put(ch, base.x, base.y + y, base.z, yaw, air && k > 0.08 && k < 0.92 ? AIR : CROUCH((1 - squash) * 3), expr);
  ch.root.scale.set(1 + (1 - squash) * 0.5, squash, 1 + (1 - squash) * 0.5);
}
function hideAll() {
  const W = C.world;
  for (const k of ['leo', 'ava', 'grandma', 'mailman', 'driver', 'ref']) W.cast[k].root.visible = false;
  for (const a of ['mates', 'rivals', 'town']) W.cast[a].forEach((c) => (c.root.visible = false));
  for (const p of ['cat', 'jar', 'car', 'truck', 'waist', 'rope', 'ropeFlag']) { W[p].visible = false; }
  W.parcels.forEach((p) => (p.visible = false));
  for (const ch of [W.cast.leo, ...W.cast.rivals, ...W.cast.mates, W.cast.ava]) mudFace(ch, false);
  W.catFace.map = W.catTex.smug;
  W.jar.userData.lid.position.set(0, 0.47, 0); W.jar.userData.lid.rotation.set(0, 0, 0);
  W.cat.rotation.set(0, 0, 0); W.cat.scale.setScalar(1);
  W.pullTrees.forEach((t) => t.children.forEach((c, i) => { if (i) c.scale.setScalar(1); }));
  W.lapScreen.map = W.lapTex.tut; W.lamps.forEach((l) => (l.visible = true));
  if (W.fx) W.fx.forEach((m) => (m.visible = false));
}
function setEnv(mode) {
  const { hemi, sun, fill } = C.lights, W = C.world, s = C.scene;
  const u = W.skyU;
  if (mode === 'night') {
    u.uTop.value.set('#0c1238'); u.uHor.value.set('#2b3a78'); u.uBot.value.set('#1a2246'); u.uStars.value = 1;
    hemi.color.set('#6f86d8'); hemi.groundColor.set('#1d2a3a'); hemi.intensity = 0.65;
    sun.color.set('#a9c2ff'); sun.intensity = 0.55; s.fog.color.set('#1b2550'); s.fog.near = 90; s.fog.far = 420;
    GLASS.emissiveIntensity = 1.4; GLASS.color.set('#2a3550'); LAMPGLOW.emissiveIntensity = 3;
    fill.intensity = 0.6; s.environmentIntensity = 0.15;
  } else if (mode === 'dusk') {
    u.uTop.value.set('#3b4fb0'); u.uHor.value.set('#ff9f7a'); u.uBot.value.set('#ffc6a0'); u.uStars.value = 0.25;
    hemi.color.set('#ffc9b0'); hemi.groundColor.set('#5a4a6a'); hemi.intensity = 1.0;
    sun.color.set('#ffb07a'); sun.intensity = 1.5; s.fog.color.set('#e8a890'); s.fog.near = 120; s.fog.far = 480;
    GLASS.emissiveIntensity = 0.7; GLASS.color.set('#7a8fb0'); LAMPGLOW.emissiveIntensity = 1.5;
    fill.intensity = 0.4; s.environmentIntensity = 0.3;
  } else {
    u.uTop.value.set('#4fa3f7'); u.uHor.value.set('#bfe4ff'); u.uBot.value.set('#d8efff'); u.uStars.value = 0;
    hemi.color.set('#e3f2ff'); hemi.groundColor.set('#9cc77a'); hemi.intensity = mode === 'interior' ? 1.6 : 1.45;
    sun.color.set('#fff3df'); sun.intensity = mode === 'interior' ? 1.2 : 2.3; s.fog.color.set('#cfe9ff'); s.fog.near = 140; s.fog.far = 520;
    GLASS.emissiveIntensity = 0; GLASS.color.set('#bfe6ff'); LAMPGLOW.emissiveIntensity = 0;
    fill.intensity = mode === 'interior' ? 0.9 : 0.25; s.environmentIntensity = 0.35;
  }
  W.bulbLight.intensity = mode === 'garage' ? 40 : 0;
  sun.castShadow = !(mode === 'interior' || mode === 'garage');
  if (mode === 'garage') { hemi.intensity = 0.35; hemi.color.set('#8a9ad0'); sun.intensity = 0; fill.intensity = 0.3; }
}
function sunAt(focus, mode) {
  const { sun } = C.lights;
  sun.target.position.copy(focus);
  sun.position.copy(focus).add(mode === 'interior' ? V(4, 30, 18) : V(26, 46, 30));
}
// people bouncing around town (background life)
function townLife(t, center, n = 10, spread = 22, { h = 5, seed = 1, groundZ } = {}) {
  const R = rng(seed);
  C.world.cast.town.slice(0, n).forEach((c, i) => {
    const x = center.x + (R() - 0.5) * spread, z = groundZ != null ? groundZ + (R() - 0.5) * 3 : center.z + (R() - 0.5) * spread;
    hop(c, V(x, 0.25, z), t, 1.0 + R() * 0.6, h * (0.6 + R() * 0.8), R() * 2, R() * 6.28, ['grin', 'joy', 'smile'][i % 3]);
  });
}
// simple FX meshes (dust ring, burp ring, confetti, impact star) created lazily
function fx(name) {
  const W = C.world; W.fx = W.fx || []; W.fxm = W.fxm || {};
  if (!W.fxm[name]) {
    let m;
    if (name.startsWith('blast')) {
      m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.07, 6, 40), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, toneMapped: false, depthWrite: false }));
    } else if (name.startsWith('puff')) {
      m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshLambertMaterial({ color: '#cfcfd6', transparent: true, depthWrite: false }));
    } else if (name === 'leaves' || name === 'splash' || name === 'splash2') {
      m = new THREE.Group(); const R = rng(name.length * 7 + 3);
      const cols = name === 'leaves' ? ['#58b947', '#4caf50', '#6cc551', '#3fa34d', '#8bd35c'] : ['#6b4423', '#7f5530', '#5b3a1f'];
      const N = name === 'leaves' ? 260 : 90;
      for (let i = 0; i < N; i++) {
        const p = new THREE.Mesh(name === 'leaves' ? new THREE.PlaneGeometry(0.35, 0.22) : new THREE.IcosahedronGeometry(0.22 + R() * 0.25, 0), new THREE.MeshLambertMaterial({ color: cols[i % cols.length], side: THREE.DoubleSide }));
        p.userData = { x: (R() - 0.5), y: R(), z: (R() - 0.5), vx: (R() - 0.5), vy: R(), vz: R(), rot: R() * 6 }; m.add(p);
      }
    } else if (name === 'zzz') {
      m = new THREE.Group();
      for (let i = 0; i < 3; i++) { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), new THREE.MeshBasicMaterial({ map: textTexture('Z', { w: 128, h: 128, fg: '#ffffff', font: '900 110px Nunito', stroke: '#2b3a78', sw: 12 }), transparent: true, depthWrite: false, toneMapped: false })); m.add(p); }
    } else if (name === 'ring' || name === 'burp') {
      m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.08, 6, 40), new THREE.MeshBasicMaterial({ color: name === 'burp' ? '#d6f5ff' : '#ffffff', transparent: true, toneMapped: false }));
    } else if (name === 'dust') {
      m = new THREE.Group();
      for (let i = 0; i < 14; i++) { const p = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), new THREE.MeshLambertMaterial({ color: '#f1e6d4', transparent: true })); p.userData.a = i / 14 * Math.PI * 2; m.add(p); }
    } else if (name === 'confetti') {
      m = new THREE.Group(); const R = rng(5);
      for (let i = 0; i < 160; i++) { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.12), new THREE.MeshBasicMaterial({ color: ['#ff5c8a', '#ffd23f', '#58d68d', '#5dade2', '#ff7a2e', '#ffffff'][i % 6], side: THREE.DoubleSide, toneMapped: false })); p.userData = { x: (R() - 0.5) * 16, z: (R() - 0.5) * 10, y0: 9 + R() * 8, sp: 1.5 + R() * 2, rot: R() * 6 }; m.add(p); }
    } else if (name === 'speed') {
      m = new THREE.Group(); const R = rng(9);
      for (let i = 0; i < 40; i++) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.05, 6 + R() * 6, 0.05), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7, toneMapped: false })); const a = R() * 6.28, r = 3 + R() * 5; p.position.set(Math.cos(a) * r, (R() - 0.5) * 20, Math.sin(a) * r); p.userData.y0 = p.position.y; m.add(p); }
    } else if (name === 'flash') {
      m = new THREE.Mesh(new THREE.CircleGeometry(1, 32), new THREE.MeshBasicMaterial({ color: '#fffbe0', transparent: true, toneMapped: false, depthWrite: false }));
    }
    C.scene.add(m); W.fxm[name] = m; W.fx.push(m);
  }
  const m = W.fxm[name]; m.visible = true; return m;
}
function ring(name, pos, t, dur = 0.5, rMax = 4, flat = true) {
  if (t < 0 || t > dur) return;
  const m = fx(name), u = t / dur;
  m.position.copy(pos); m.rotation.set(flat ? Math.PI / 2 : 0, 0, 0);
  m.scale.setScalar(0.3 + u * rMax); m.material.opacity = 1 - u;
}
function dust(pos, t, dur = 0.8, r = 4) {
  if (t < 0 || t > dur) return;
  const m = fx('dust'), u = easeOut(t / dur); m.position.copy(pos);
  m.children.forEach((p) => { const a = p.userData.a; p.position.set(Math.cos(a) * r * u, 0.3 + u * 0.6, Math.sin(a) * r * u); p.scale.setScalar(0.5 + u * 1.2); p.material.opacity = 1 - t / dur; });
}
function confetti(center, t) {
  const m = fx('confetti'); m.position.copy(center);
  m.children.forEach((p) => { const d = p.userData; p.position.set(d.x + Math.sin(t * 2 + d.rot) * 0.6, d.y0 - t * d.sp, d.z); p.rotation.set(t * 3 + d.rot, t * 2, d.rot); });
}

// ---------------------------------------------------------------- huss toolkit
function mudFace(ch, on) {
  const want = !!on; if (!!ch.faceOpts.mud === want) return;
  ch.faceOpts = Object.assign({}, ch.spec.faceOpts || {}, want ? { mud: true } : {}); ch._ek = null; ch.setExpr(ch.expr);
}
const fwdOf = (yaw) => V(Math.sin(yaw), 0, Math.cos(yaw));
const mouthOf = (ch) => headOf(ch).addScaledVector(fwdOf(ch.root.rotation.y), 0.55 * ch.spec.scale).add(V(0, -0.22 * ch.spec.scale, 0));
// shock-wave rings out of a mouth (the visual HUSS)
function blast(key, pos, yaw, t, s = 1, n = 3, dur = 0.55) {
  for (let k = 0; k < n; k++) {
    const m = fx('blast' + key + '_' + k), tk = t - k * 0.09;
    if (tk < 0 || tk > dur) { m.visible = false; continue; }
    const u = tk / dur;
    m.position.copy(pos).addScaledVector(fwdOf(yaw), (0.2 + easeOut(u) * 3.2) * s);
    m.rotation.set(0, yaw, 0); m.scale.setScalar((0.25 + easeOut(u) * 1.6) * s); m.material.opacity = (1 - u) * 0.95;
  }
}
const HUSSP = { armL: [2.9, 0.35], armR: [2.9, 0.35], fist: 1, lean: -0.08, head: [-0.12, 0, 0] };
function hussing(ch, key, t, period = 1.4, phase = 0, s = 0.8) {
  const u = ((t + phase) % period + period) % period;
  const on = u < 0.6;
  const k = on ? Math.sin(Math.min(1, u / 0.12) * Math.PI / 2) : 0;
  ch.pose(on ? Object.assign({}, HUSSP, { armL: [2.9 * k, 0.35], armR: [2.9 * k, 0.35] }) : { armL: [0.2, 0.1], armR: [0.2, 0.1] });
  ch.setExpr(on ? 'huss' : 'grin');
  if (key != null) blast(key, mouthOf(ch), ch.root.rotation.y, u, s, 2);
}
function puffs(key, pos, t, n = 6, spread = 0.4, rise = 1.6) {
  const R = rng(key.length * 13 + 1);
  for (let i = 0; i < n; i++) {
    const m = fx('puff' + key + i), ph = ((t * 0.9 + i / n) % 1);
    m.position.set(pos.x + (R() - 0.5) * spread, pos.y + ph * rise, pos.z + (R() - 0.5) * spread);
    m.scale.setScalar(0.12 + ph * 0.35); m.material.opacity = 0.85 * (1 - ph);
  }
}
function burst(name, center, t, { spread = 6, up = 5, fwd = V(0, 0, 0), g = 9, size = 1, dur = 2 } = {}) {
  if (t < 0 || t > dur) return;
  const m = fx(name); m.position.copy(center);
  m.children.forEach((p) => {
    const d = p.userData;
    p.position.set(d.x * spread * 0.4 + (d.vx * spread + fwd.x) * t, d.y * 0.8 + (d.vy * up) * t - 0.5 * g * t * t, d.z * spread * 0.4 + (d.vz * 0.6 * spread + fwd.z) * t);
    p.rotation.set(d.rot + t * 5, t * 4, d.rot); p.scale.setScalar(size);
  });
}
function zzz(pos, t) {
  const m = fx('zzz'); m.position.copy(pos);
  m.children.forEach((p, i) => { const ph = (t * 0.6 + i / 3) % 1; p.position.set(ph * 0.6, ph * 1.4, 0); p.scale.setScalar(0.5 + ph); p.material.opacity = 1 - ph; p.quaternion.copy(C.camera.quaternion); });
}
function fallFwd(ch, a) { ch.root.rotation.x = (Math.abs(ch.root.rotation.y) > 1.5 ? -1 : 1) * a; }
const TUGP = (lean = -0.38) => ({ lean, legL: 0.55, legR: -0.35, armL: [1.35, 0.12], armR: [1.35, 0.12], fist: 1, bob: -0.08 });
// the tug line-up. shift moves everything along z (negative = Mudville winning)
function tug(t, shift, { leo = true, ours = 'grin', theirs = 'smug', rope = true, wob = 0.06, ourLean = -0.38, theirLean = -0.42 } = {}) {
  const W = C.world;
  const team = leo ? [W.cast.leo, W.cast.ava, W.cast.mates[0], W.cast.mates[1], W.cast.mates[2]] : [W.cast.mates[0], W.cast.mates[1], W.cast.mates[2], W.cast.mates[3], W.cast.mates[4]];
  team.forEach((c, i) => {
    const w = noise1(t * 3 + i) * wob;
    put(c, (i % 2 ? 0.32 : -0.32), 0.0, 6.2 + i * 1.3 + shift, Math.PI, TUGP(ourLean + w), ours);
    c.root.position.add(PULL);
  });
  W.cast.rivals.forEach((c, i) => {
    const w = noise1(t * 3 + i + 9) * wob;
    put(c, (i % 2 ? -0.34 : 0.34), 0.0, -6.2 - i * 1.4 + shift, 0, TUGP(theirLean + w), theirs);
    c.root.position.add(PULL);
  });
  if (rope) W.setRope(PL(0, 1.55, -14 + shift), PL(0, 1.55, 14 + shift), 0.5);
  return team;
}
function crowd(t, e = 1, mode = 0) { C.world.updateCrowd(t, e, mode); }
// ---------------------------------------------------------------- town coordinates
const HOUSE = V(0, 0, -14), WALK_Z = -5.1;
const GRANNY = V(13, 0.3, -8.7);

const S = {};
// p01 In this town, everybody husses.
S.c01_aerial = (t, d) => {
  setEnv('day'); const W = C.world, R = rng(3);
  W.cast.town.forEach((c, i) => {
    const x = -30 + (i % 7) * 10 + R() * 3, z = i < 7 ? -5.2 : 5.2;
    put(c, x, 0.25, z, i < 7 ? 0.3 : Math.PI - 0.3, {}); hussing(c, i < 8 ? 'a' + i : null, t, 1.2 + R() * 0.5, R() * 2, 1.2);
  });
  const a = 0.6 + t * 0.05;
  cam(V(Math.sin(a) * 40, 30 - t * 1.5, 26 + Math.cos(a) * 8), V(-2, 2, -1), 52);
};
S.c02_street = (t, d) => {
  setEnv('day'); const W = C.world;
  const spots = [[-6, -5.2, 0.4], [-11, -5.4, 0.2], [-16, -5.0, 0.5], [-9, 5.2, 2.7], [-14, 5.1, 2.9], [-20, 5.3, 2.6]];
  spots.forEach(([x, z, y], i) => { put(W.cast.town[i], x, 0.25, z, y, {}); hussing(W.cast.town[i], 's' + i, t, 1.1, i * 0.37, 1); });
  cam(V(2 - t * 0.5, 2.0, 2.5), V(-14, 3.0, -2), 50);
};
// p02 Grandma opens a jar
function granny(t, popped) {
  const W = C.world, g = W.cast.grandma;
  put(g, GRANNY.x, GRANNY.y, GRANNY.z, 0, popped ? { armL: [1.2, 0.1], armR: [2.9, 0.3], fist: 1, head: [-0.15, 0, 0] } : { armL: [1.25, 0.12], armR: [1.25, -0.05], twist: Math.sin(t * 18) * 0.06, lean: 0.05 }, popped ? 'huss' : { name: 'strain', over: { red: 0.25 } });
  W.jar.visible = true; W.jar.position.set(GRANNY.x + 0.05, GRANNY.y + 1.3, GRANNY.z + 1.0); W.jar.rotation.y = popped ? 0 : Math.sin(t * 18) * 0.15;
  return g;
}
S.c03_grandma = (t, d) => {
  setEnv('day'); granny(t, false);
  cam(V(GRANNY.x + 1.1, 2.0, GRANNY.z + 5.0 - t * 0.4), V(GRANNY.x, 1.7, GRANNY.z), 42);
};
S.c04_grandma_huss = (t, d) => {
  setEnv('day'); const W = C.world, g = granny(t, true);
  const lid = W.jar.userData.lid; lid.position.set(t * 1.2, 0.47 + t * 9 - 4.9 * t * t, t * 0.8); lid.rotation.set(t * 14, 0, t * 9);
  blast('g', mouthOf(g), 0, t, 0.9);
  cam(V(GRANNY.x + 0.6, 2.2, GRANNY.z + 4.6), V(GRANNY.x, 2.5, GRANNY.z), 48); shake(0.07 * Math.max(0, 1 - t * 2.5), t);
};
// p03 The mailman lifts a box
const MAIL = V(-8, 0.25, WALK_Z);
function parcels(y0, x, z) { C.world.parcels.forEach((p, i) => { p.visible = true; p.position.set(x, y0 + [0, 0.72, 1.3][i], z); p.rotation.y = [0, 0.2, -0.15][i]; }); }
S.c05_mailman = (t, d) => {
  setEnv('day'); const W = C.world, k = smooth(clamp(t / d));
  put(W.cast.mailman, MAIL.x, MAIL.y, MAIL.z, 0.25, Object.assign(CROUCH(0.8 - 0.3 * k), { armL: [1.0, 0.25], armR: [1.0, 0.25] }), { name: 'strain', over: { red: 0.2 } });
  parcels(0.25 + 0.4 + k * 0.4, MAIL.x + 0.3, MAIL.z + 1.0);
  cam(V(MAIL.x + 2.6, 1.5, MAIL.z + 5.2), V(MAIL.x + 0.3, 1.6, MAIL.z), 46);
};
S.c06_mailman_huss = (t, d) => {
  setEnv('day'); const W = C.world, k = easeOut(clamp(t / 0.25));
  const m = put(W.cast.mailman, MAIL.x, MAIL.y, MAIL.z, 0.25, { armL: [3.0 * k, 0.2], armR: [3.0 * k, 0.2], fist: 1, lean: -0.08 }, 'huss');
  parcels(0.25 + 1.2 + k * 3.0, MAIL.x + 0.1, MAIL.z + 0.05);
  blast('m', mouthOf(m), 0.25, t, 1.0);
  cam(V(MAIL.x + 1.8, 1.0, MAIL.z + 6.5), V(MAIL.x, 3.6, MAIL.z), 52); shake(0.08 * Math.max(0, 1 - t * 2.5), t);
};
// p04 Even the cat stretches
const CAT = V(-3.6, 1.12, -7.62);
S.c07_cat = (t, d) => {
  setEnv('day'); const W = C.world, k = smooth(clamp(t / d));
  W.cat.visible = true; W.cat.position.copy(CAT); W.cat.rotation.set(0, Math.PI / 2, 0); W.cat.scale.set(1, 1 - 0.15 * k, 1 + 0.45 * k);
  cam(V(CAT.x + 0.6, CAT.y + 1.0, CAT.z + 4.0), V(CAT.x, CAT.y + 0.5, CAT.z), 40);
};
S.c08_cat_huss = (t, d) => {
  setEnv('day'); const W = C.world;
  W.cat.visible = true; W.cat.position.copy(CAT); W.cat.rotation.set(0, 0.5, 0); W.cat.scale.set(1.08, 1.08, 1.08); W.catFace.map = W.catTex.huss;
  blast('c', CAT.clone().add(V(0.25, 0.95, 0.5)), 0.5, t, 0.45);
  cam(V(CAT.x + 1.3, CAT.y + 1.0, CAT.z + 2.8), V(CAT.x + 0.2, CAT.y + 0.7, CAT.z + 0.3), 40); shake(0.03 * Math.max(0, 1 - t * 3), t);
};
// p05 Except me.
S.c09_except = (t, d) => {
  setEnv('day'); const W = C.world;
  put(W.cast.leo, 0, 0.25, WALK_Z, 0.1, { armL: [0, 0.05], armR: [0, 0.05], head: [0.12, 0, 0] }, 'sad');
  [[-4.5, -1.5], [4.5, -2.0], [-7, -9.3], [6.5, -9.5]].forEach(([x, z], i) => { put(W.cast.town[i], x, 0.25, z, (i % 2 ? -0.5 : 0.5), {}); hussing(W.cast.town[i], 'e' + i, t, 1.0, i * 0.3, 0.9); });
  cam(V(0.3, 2.3, WALK_Z + 5.0 - t * 0.3), V(0, 2.1, WALK_Z), 46);
};
// p06 When I try to huss, I just... squeak.
S.c10_try = (t, d) => {
  setEnv('day'); const W = C.world, k = smooth(clamp(t / d));
  put(W.cast.leo, 0, 0.25, WALK_Z, 0.1, Object.assign(CROUCH(0.5 + 0.4 * k), { armL: [0.6, 0.5], armR: [0.6, 0.5] }), { name: 'strain', over: { red: 0.15 + 0.35 * k } });
  W.cast.leo.root.position.x += noise1(t * 30) * 0.03 * k;
  cam(V(0.3, 1.9, WALK_Z + 4.2 - k * 1.2), V(0, 1.9, WALK_Z), 44);
};
function squeakShot(t, d, where) {
  const W = C.world, L = W.cast.leo;
  const h = headOf(L);
  blast('q', mouthOf(L), L.root.rotation.y, t - 0.05, 0.18, 1, 0.4);
  faceCam(L, 2.6 - t * 0.2, { fov: 38, dy: 0.1, lookDy: -0.05 });
  return h;
}
S.c11_squeak = (t, d) => {
  setEnv('day'); put(C.world.cast.leo, 0, 0.25, WALK_Z, 0.1, { armL: [0.2, 0.2], armR: [0.2, 0.2] }, 'squeak'); squeakShot(t, d);
};
// p07 tug of war vs Mudville (last summer, no Leo)
S.c12_pull_wide = (t, d) => {
  setEnv('day'); tug(t, -0.6 - t * 0.5, { leo: false, ours: 'strain', theirs: 'smug' }); crowd(t, 0.8, 0);
  cam(PL(19, 9, 12 - t * 0.6), PL(0, 1.5, -1), 46);
};
S.c13_mudville = (t, d) => {
  setEnv('day'); const team = tug(t, -1.0 - t * 0.4, { leo: false, ours: 'strain', theirs: 'smug' }); crowd(t, 0.8, 0);
  const r = C.world.cast.rivals[0];
  cam(PL(2.6, 1.3, -2.2), PL(0, 2.6, -8), 46);
};
// p08 we lose. Face first. Into the mud.
S.c14_dragged = (t, d) => {
  setEnv('day'); tug(t, -1.6 - t * 1.6, { leo: false, ours: 'worried', theirs: 'grin', ourLean: -0.55 }); crowd(t, 1, 0);
  cam(PL(7.5, 2.0, 7.5 - t * 1.6), PL(0, 1.4, 3 - t * 1.6), 50);
};
S.c15_faceplant = (t, d) => {
  setEnv('day'); const W = C.world;
  const team = tug(t, -4.0, { leo: false, ours: 'shock', theirs: 'laugh', rope: false }); crowd(t, 1, 0);
  team.forEach((c, i) => { const u = clamp((t - i * 0.06) / 0.4); fallFwd(c, easeIn(u) * 1.45); c.root.position.y = PULL.y + 0.2 * u; c.root.position.z -= u * 1.6; });
  burst('splash', PL(0, 0.2, 1.4), t - 0.35, { spread: 5, up: 5, size: 0.5 });
  cam(PL(6.5, 3.2, 8), PL(0, 0.8, 1.5), 52);
};
S.c16_mudfaces = (t, d) => {
  setEnv('day'); const W = C.world;
  [0, 1, 2].forEach((i) => { const c = W.cast.mates[i]; put(c, PULL.x - 1.4 + i * 1.4, PULL.y + 0.15, PULL.z + 1.5, 0, { armL: [0.1, 0.25], armR: [0.1, 0.25], head: [0.1, 0, 0] }, 'sad'); mudFace(c, true); });
  cam(PL(0, 2.6, 7.8 - t * 0.3), PL(0, 2.2, 1.5), 44);
};
// p09 our captain was one player short
S.c17_captain = (t, d) => {
  setEnv('day'); const W = C.world;
  put(W.cast.ava, PULL.x, PULL.y, PULL.z + 9, Math.PI, { armR: [1.3 + 0.2 * Math.sin(t * 6), -0.1], armL: [0.3, 0.1] }, 'serious');
  [0, 1, 2, 3].forEach((i) => put(W.cast.mates[i], PULL.x - 3 + i * 1.5 + (i > 1 ? 1.5 : 0), PULL.y, PULL.z + 5.5, 0, {}, 'neutral'));
  crowd(t, 0.2, 2);
  cam(PL(6.5, 6.0, 2.4), PL(0, 1.8, 8.5), 46);
};
S.c18_gap = (t, d) => {
  setEnv('day'); const W = C.world;
  [0, 1, 2, 3].forEach((i) => put(W.cast.mates[i], PULL.x - 3 + i * 1.5 + (i > 1 ? 1.5 : 0), PULL.y, PULL.z + 5.5, 0, { head: [0, i < 2 ? -0.5 : 0.5, 0] }, 'worried'));
  put(W.cast.ava, PULL.x, PULL.y, PULL.z + 9, Math.PI, { armR: [1.2, 0.0], head: [0.1, 0, 0] }, 'worried');
  cam(PL(0.3 - t * 0.3, 1.6, 1.2), PL(0, 1.7, 5.5), 44);
};
// p10 Ava: You're in, Leo. Just... don't squeak.
S.c19_ava_point = (t, d) => {
  setEnv('day'); const W = C.world;
  put(W.cast.ava, PULL.x, PULL.y, PULL.z + 6, 0, { armR: [1.55, -0.05], fistR: 1 }, 'grin');
  put(W.cast.leo, PULL.x - 1.1, PULL.y, PULL.z + 9.5, Math.PI, {}, 'surprised');
  cam(PL(1.0, 2.7, 13.0), PL(0, 2.3, 6), 40);
};
S.c20_ava_smug = (t, d) => {
  setEnv('day'); const W = C.world;
  put(W.cast.ava, PULL.x, PULL.y, PULL.z + 6, 0.15, { armL: [0.2, 0.1], armR: [0.2, 0.1], head: [0, 0, 0.12] }, 'smug');
  faceCam(W.cast.ava, 2.2 - t * 0.2, { fov: 40, side: 0.2 });
};
// p11 So I tried everything.
const BED = SETS.bedroom;
S.c21_poster = (t, d) => {
  setEnv('interior'); const W = C.world;
  put(W.cast.leo, BED.x - 0.6, 0, BED.z - 2.6, 0.25, { armR: [2.4, -0.1], fistR: 1 }, 'determined');
  cam(V(BED.x + 1.0, 2.5, BED.z + 2.6 - t * 0.3), V(BED.x - 0.8, 2.5, BED.z - 3.0), 50);
};
// p12 chili
const KIT = SETS.kitchen;
function leoKitchen(pose, expr) { return put(C.world.cast.leo, KIT.x, 0, KIT.z + 2.0, Math.PI, pose, expr); }
S.c22_chili = (t, d) => {
  setEnv('interior'); leoKitchen({ armR: [1.0, 0.1] }, 'determined');
  puffs('st', V(KIT.x, 2.05, KIT.z), t, 5, 0.6, 1.2);
  cam(V(KIT.x + 1.6, 2.6, KIT.z - 2.0 + t * 0.2), V(KIT.x, 1.9, KIT.z + 0.6), 46);
};
S.c23_smoke = (t, d) => {
  setEnv('interior'); const L = leoKitchen({ armL: [0.4, 0.3], armR: [0.4, 0.3], fist: 1, bob: -0.05 }, { name: 'strain', over: { red: 0.55 } });
  const h = headOf(L);
  puffs('eL', h.clone().add(V(0.55, 0, 0)), t, 5, 0.15, 1.3); puffs('eR', h.clone().add(V(-0.55, 0, 0)), t + 0.3, 5, 0.15, 1.3);
  L.root.position.x += noise1(t * 40) * 0.03;
  faceCam(L, 3.6, { fov: 46, dy: 0.25, lookDy: 0.3 });
};
S.c24_squeak2 = (t, d) => {
  setEnv('interior'); const L = leoKitchen({ armL: [0.2, 0.2], armR: [0.2, 0.2] }, { name: 'squeak', over: {} });
  L.faceMat.color && 0;
  const h = headOf(L);
  puffs('eL', h.clone().add(V(0.55, 0, 0)), t + 0.5, 4, 0.15, 1.0); puffs('eR', h.clone().add(V(-0.55, 0, 0)), t + 0.8, 4, 0.15, 1.0);
  squeakShot(t, d);
};
// p13 huss tutorial
function leoBed(pose, expr) {
  return put(C.world.cast.leo, BED.x - 3.9, 0.25, BED.z - 1.1, Math.PI, Object.assign({ legL: -1.45, legR: -1.45, armL: [0.9, 0.1], armR: [0.9, 0.1] }, pose), expr);
}
S.c25_laptop = (t, d) => {
  setEnv('interior'); const W = C.world; W.laptop.position.set(-3.9, 1.02, -2.9); W.laptop.rotation.y = 0.7;
  leoBed({}, 'surprised');
  cam(V(BED.x + 1.2 - t * 0.2, 3.0, BED.z - 1.7), V(BED.x - 3.9, 1.9, BED.z - 2.0), 54);
};
S.c26_laptop_huss = (t, d) => {
  setEnv('interior'); const W = C.world;
  const te = C.ev.laptop_huss - C.cut.start, on = t >= te;
  if (on) W.lapScreen.map = W.lapTex.huss;
  const k = on ? easeOut(clamp((t - te) / 0.2)) : 0;
  const L = leoBed({ lean: -0.5 * k, armL: [0.9 - 0.3 * k, 0.1 + 1.1 * k], armR: [0.9 - 0.3 * k, 0.1 + 1.1 * k] }, on ? 'shock' : 'surprised');
  if (on) { const W2 = C.world; W2.laptop.position.set(-3.9, 1.02, -2.9); W2.laptop.rotation.y = 0.7; blast('l', V(BED.x - 3.7, 1.45, BED.z - 3.1), 0.7, t - te, 0.7); }
  cam(V(BED.x + 0.6, 2.8, BED.z - 1.9), V(BED.x - 3.9, 1.8, BED.z - 2.1), 54); if (on) shake(0.05 * Math.max(0, 1 - (t - te) * 3), t);
};
// p14 every night, I trained
S.c27_night_town = (t, d) => {
  setEnv('night');
  cam(V(-30 + t * 1.2, 26, 34), V(0, 0, -6), 50);
};
const GAR = SETS.garage;
S.c28_garage = (t, d) => {
  setEnv('garage'); const W = C.world;
  const L = put(W.cast.leo, GAR.x, 0, GAR.z, 0.3, { armL: [0.7, -0.1], armR: [0.7, -0.1], head: [0.4, 0, 0] }, 'determined');
  W.waist.visible = true; W.waist.position.set(GAR.x, 1.05, GAR.z); W.waist.scale.setScalar(1 - 0.08 * smooth(clamp(t / d)));
  cam(V(GAR.x + 1.7, 2.6, GAR.z + 4.0), V(GAR.x, 1.8, GAR.z), 46);
};
S.c29_rope = (t, d) => {
  setEnv('garage'); const W = C.world;
  const L = put(W.cast.leo, GAR.x, 0, GAR.z, 0.3, { armL: [0.3, 0.2], armR: [0.3, 0.2], fist: 1 }, 'determined');
  W.waist.visible = true; W.waist.position.set(GAR.x, 1.05, GAR.z); W.waist.scale.setScalar(0.92);
  W.setRope(V(GAR.x, 1.05, GAR.z - 0.5), V(GAR.x - 1, 0.1, GAR.z - 5), 2);
  cam(V(GAR.x + 0.9, 0.7, GAR.z + 2.6), V(GAR.x, 1.9, GAR.z), 52);
};
// p15 / p16 pulling vehicles at night
function pullThing(t, thing, len, expr = { name: 'strain', over: { red: 0.3 } }, sp = 0.35) {
  const W = C.world; const x = -6 + t * sp, z = -1.5; W.lamps.forEach((l) => (l.visible = false));
  const L = put(W.cast.leo, x, 0.12, z, Math.PI / 2, { walk: 0.6, phase: t * 5, lean: 0.55, armL: [0.4, 0.2], armR: [0.4, 0.2], fist: 1 }, expr);
  W.waist.visible = true; W.waist.position.set(x - 0.05, 1.08, z);
  thing.visible = true; thing.position.set(x - 3.2 - len / 2, 0.1, z); thing.rotation.set(0, Math.PI / 2, 0);
  W.setRope(V(x - 0.6, 1.0, z), V(x - 3.2, 0.7, z), 2);
  return { x, z, L };
}
S.c30_car = (t, d) => {
  setEnv('night'); const W = C.world; const { x, z } = pullThing(t, W.car, 4.2);
  cam(V(x - 1.8, 3.2, z + 10.2), V(x - 1.8, 1.3, z), 58);
};
S.c31_truck = (t, d) => {
  setEnv('night'); const W = C.world; const { x, z } = pullThing(t, W.truck, 8.0, { name: 'strain', over: { red: 0.45 } }, 0.25);
  put(W.cast.driver, x - 4.0, 0.45, z, Math.PI / 2, { legL: -1.4, legR: -1.4, head: [0.4, 0, 0.35], armL: [0.9, 0.1], armR: [0.9, 0.1] }, 'sleep'); W.cast.driver.root.scale.setScalar(0.85);
  cam(V(x - 3.4, 2.8, z + 9.0), V(x - 3.4, 1.8, z), 80);
};
S.c32_driver = (t, d) => {
  setEnv('night'); const W = C.world; const { x, z } = pullThing(t + 2, W.truck, 8.0, { name: 'strain', over: { red: 0.45 } }, 0.25);
  const dr = put(W.cast.driver, x - 4.0, 0.45, z, 0.9, { legL: -1.4, legR: -1.4, head: [0.2, 0, 0.3], armL: [0.9, 0.1], armR: [0.9, 0.1] }, 'sleep'); dr.root.scale.setScalar(0.85);
    dr.root.updateMatrixWorld(true); const hw = dr.head.getWorldPosition(V(0, 0, 0)).add(V(0, 0.4, 0)); zzz(hw.clone().add(V(0.3, 0.5, 0.6)), t);
  cam(hw.clone().add(V(1.4, 0.1, 4.6)), hw.clone().add(V(0, -0.3, 0)), 46);
};
// p17 Then came the big pull.
S.c33_venue = (t, d) => {
  setEnv('day'); tug(t, 0, { ours: 'determined', theirs: 'smug' }); crowd(t, 1, 0);
  const a = -0.4 + t * 0.06;
  cam(PL(Math.sin(a) * 34, 22 - t, Math.cos(a) * 34), PL(0, 1, 0), 48);
};
// p18 Mudville hussed so hard, the trees lost their leaves.
S.c34_mud_huss = (t, d) => {
  setEnv('day'); const W = C.world; tug(t, 0, { ours: 'shock', theirs: 'huss', rope: true }); crowd(t, 1, 1);
  W.cast.rivals.forEach((c, i) => { c.pose(HUSSP); blast('r' + i, mouthOf(c), 0, t - i * 0.05, 0.6, 2); });
  cam(PL(3.5, 1.4, 0.5), PL(0, 3.0, -9), 54); shake(0.06 * Math.max(0, 1 - t * 1.5), t);
};
S.c35_trees = (t, d) => {
  setEnv('day'); const W = C.world; tug(t, 0, { ours: 'shock', theirs: 'huss' }); crowd(t, 1, 1);
  W.cast.rivals.forEach((c) => c.pose(HUSSP));
  const k = smooth(clamp(t / 0.6));
  W.pullTrees.forEach((tr) => tr.children.forEach((c, i) => { if (i) c.scale.setScalar(1 - k); }));
  burst('leaves', PL(0, 4, -44), t, { spread: 34, up: 4, fwd: V(0, 0, 9), g: 3, size: 1.2, dur: 5 });
  cam(PL(-3, 4.0, -18), PL(0, 4.5, -42), 50);
};
// p19 HUSS! HUSS! HUSS!
function chant(t, k) {
  const W = C.world; tug(t, -0.3 * k, { ours: 'worried', theirs: 'huss' }); crowd(t, 1.3, 1);
  W.cast.rivals.forEach((c, i) => { c.pose(Object.assign({}, HUSSP, { armL: [2.9, 0.4], armR: [1.35, 0.1] })); blast('c' + i, mouthOf(c), 0, t - i * 0.03, 1.2); });
}
S.c36_chant = (t, d) => { setEnv('day'); chant(t, 1); cam(PL(-6, 2.2, -3), PL(0, 2.5, -9), 50); shake(0.05, t); };
S.c36b_chant = (t, d) => { setEnv('day'); chant(t, 2); cam(PL(14, 9, -6), PL(-8, 3, -8), 50); shake(0.05, t); };
S.c36c_chant = (t, d) => { setEnv('day'); chant(t, 3); cam(PL(0.5, 1.6, 2.5), PL(0, 2.6, -7), 58); shake(0.07, t); };
// p20 Ten seconds left...
S.c37_score10 = (t, d) => {
  setEnv('day'); const W = C.world; W.setScore('0:10'); tug(t, -1.2, { ours: 'strain', theirs: 'grin' }); crowd(t, 1, 0);
  const sb = W.scorePivot; const p = PL(17, 12.5, -16);
  cam(p.clone().add(V(-14 * Math.sin(0.6), -1.5, 14 * Math.cos(0.6))), p.clone().add(V(0, -1, 0)), 44);
};
S.c38_shoes = (t, d) => {
  setEnv('day'); const sh = -1.4 - t * 0.7; tug(t, sh, { ours: 'strain', theirs: 'grin', ourLean: -0.6 }); crowd(t, 1, 0);
  cam(PL(3.0, 1.1, 8.2 + sh), PL(0, 0.5, 5.0 + sh), 50);
};
S.c39_worried = (t, d) => {
  setEnv('day'); const W = C.world; tug(t, -2.2, { ours: 'worried', theirs: 'grin', ourLean: -0.6, wob: 0.1 }); crowd(t, 1, 0);
  W.cast.leo.setExpr('worried');
  faceCam(W.cast.leo, 2.4, { fov: 44, side: 0.5, dy: 0.1 });
};
// p21 I grabbed the rope. I opened my mouth...
S.c40_grab = (t, d) => {
  setEnv('day'); const W = C.world; tug(t, -2.3, { ours: 'determined', theirs: 'grin' }); crowd(t, 1, 0);
  const lp = W.cast.leo.root.position;
  cam(lp.clone().add(V(2.0, 1.9, -1.2)), lp.clone().add(V(0, 1.5, -0.8)), 50);
};
S.c41_mouth = (t, d) => {
  setEnv('day'); const W = C.world; tug(t, -2.35, { ours: 'determined', theirs: 'grin' }); crowd(t, 1, 0);
  W.cast.leo.setExpr(t > d * 0.5 ? 'yell' : 'strain', t > d * 0.5 ? null : { red: 0.4 });
  faceCam(W.cast.leo, 2.9 - t * 0.4, { fov: 42, dy: 0.08 });
};
S.c42_squeak3 = (t, d) => {
  setEnv('day'); const W = C.world; tug(t, -2.4, { ours: 'squeak', theirs: 'grin' }); crowd(t, 0.6, 0);
  W.cast.leo.setExpr('squeak'); squeakShot(t, d);
};
// p23 Mudville laughed
S.c43_laugh = (t, d) => {
  setEnv('day'); const W = C.world; tug(t, -2.4, { ours: 'worried', theirs: 'laugh', theirLean: 0.15, wob: 0.25 }); crowd(t, 1, 2);
  W.cast.rivals.forEach((c, i) => { c.pose(Object.assign(TUGP(0.2 + 0.15 * Math.sin(t * 14 + i)), { armL: [1.0, 0.2], armR: [0.4, 0.5] })); });
  cam(PL(3.5, 2.6, -1.5), PL(0, 2.3, -8), 50);
};
// p24 Five seconds. Seven nights...
S.c44_score5 = (t, d) => {
  setEnv('day'); const W = C.world; W.setScore('0:05'); tug(t, -2.4, { ours: 'strain', theirs: 'laugh' }); crowd(t, 1, 0);
  const p = PL(17, 12.5, -16);
  cam(p.clone().add(V(-12 * Math.sin(0.6), -1.2, 12 * Math.cos(0.6))), p.clone().add(V(0, -0.5, 0)), 40);
};
S.c45_flashback = (t, d) => {
  S.c31_truck(t + 1.2, d); C.grade.uniforms.uSat.value = 0.45;
};
S.c46_calm = (t, d) => {
  setEnv('day'); const W = C.world; tug(t, -2.4, { ours: 'calm', theirs: 'laugh' }); crowd(t, 0.4, 0);
  W.cast.leo.setExpr('calm'); faceCam(W.cast.leo, 3.0 - t * 0.25, { fov: 40, dy: 0.08 });
};
// p25 And then... it came out.
S.c47_eyes = (t, d) => {
  setEnv('day'); const W = C.world; tug(t, -2.4, { ours: 'determined', theirs: 'laugh' }); crowd(t, 0.3, 0);
  W.cast.leo.setExpr('determined', { eyeS: 0.8 });
  faceCam(W.cast.leo, 1.5 - t * 0.15, { fov: 34, dy: 0.12, lookDy: 0.12 });
};
// p26 HUSS!
S.c48_bighuss = (t, d) => {
  setEnv('day'); const W = C.world; tug(t, -2.4 + easeOut(clamp(t / d)) * 1.5, { ours: 'determined', theirs: 'shock' }); crowd(t, 1.5, 1);
  const L = W.cast.leo; L.setExpr('huss'); L.pose(Object.assign(TUGP(-0.7), { head: [-0.3, 0, 0] }));
  blast('B', mouthOf(L), Math.PI, t, 3.2, 3, 0.7); blast('B2', mouthOf(L), Math.PI, t - 0.3, 3.2, 3, 0.7);
  C.grade.uniforms.uFlash.value = Math.max(0, 0.75 - t * 2.5);
  faceCam(L, 3.4, { fov: 52, side: 1.2, dy: -0.6, lookDy: -0.2 }); shake(0.22 * Math.max(0.15, 1 - t * 1.2), t);
};
// p27 rope snapped tight, Mudville flew over our heads, loop, mud
S.c49_tight = (t, d) => {
  setEnv('day'); const W = C.world; const team = tug(t, -0.9 + t * 1.8, { ours: 'huss', theirs: 'shock', theirLean: 0.4 }); crowd(t, 1.4, 1);
  W.cast.rivals.forEach((c, i) => { c.root.position.y += easeIn(clamp(t / d)) * (0.6 + i * 0.1); });
  W.ropeFlag.position.y += noise1(t * 40) * 0.08;
  cam(PL(9, 2.6, 4.5), PL(0, 1.6, -4), 56); shake(0.06, t);
};
function flyer(c, i, pos, spin) { put(c, pos.x, pos.y, pos.z, 0, { armL: [2.6, 0.9], armR: [2.6, 0.9], legL: -0.4, legR: 0.6 }, 'shock'); c.root.rotation.x = spin + i * 0.3; }
S.c50_fly = (t, d) => {
  setEnv('day'); const W = C.world; tug(t, 0.8, { ours: 'shock', theirs: 'shock', rope: false }); crowd(t, 1.5, 1);
  W.cast.mates.slice(0, 3).forEach((c) => c.pose({ armL: [2.7, 0.3], armR: [2.7, 0.3], head: [-0.6, 0, 0] }));
  W.cast.leo.pose({ armL: [1.2, 0.1], armR: [1.2, 0.1], head: [-0.6, 0, 0] });
  W.cast.rivals.forEach((c, i) => { const u = clamp((t + 0.25 - i * 0.07) / (d + 0.3)); flyer(c, i, PL((i - 2) * 1.6, 2 + arc(u * 0.75, 14), -8 + u * 26), t * 5); c.root.position.add(V(0, 0, 0)); c.root.position.y += PULL.y; });
  cam(PL(2.5, 1.0, 13.0), PL(0, 8, 6), 66);
};
S.c51_loop = (t, d) => {
  setEnv('day'); const W = C.world; tug(t, 0.8, { ours: 'shock', theirs: 'shock', rope: false }); crowd(t, 1.5, 1);
  W.cast.rivals.forEach((c, i) => {
    const a = clamp(t / d) * Math.PI * 1.7 + 0.25 - i * 0.18;
    flyer(c, i, PL((i - 2) * 1.6, 13 + Math.cos(a) * 6, 14 - Math.sin(a) * 9), -a * 2);
  });
  cam(PL(21, 10, 8), PL(0, 12, 6), 56);
};
S.c52_splash = (t, d) => {
  setEnv('day'); const W = C.world; tug(t, 0.8, { ours: 'joy', theirs: 'shock', rope: false }); crowd(t, 1.6, 0);
  W.cast.rivals.forEach((c, i) => {
    const u = clamp((t + 0.1 - i * 0.05) / 0.5);
    if (u < 1) flyer(c, i, PL((i - 2) * 1.8, 0.4 + (1 - u) * 9, 3.5 - u * 3.0), 0);
    else { put(c, PULL.x + (i - 2) * 1.8, PULL.y + 0.2, PULL.z + 0.5 + (i % 2) * 0.8, Math.PI, { armL: [3.0, 0.8], armR: [3.0, 0.8] }, 'sad'); fallFwd(c, 1.5); mudFace(c, true); }
    if (u < 1) c.root.rotation.x = Math.PI * 0.45;
  });
  burst('splash', PL(0, 0.2, 0.5), t - 0.45, { spread: 8, up: 7, size: 0.55 });
  cam(PL(9, 5.0, 12), PL(0, 0.8, 0.5), 48); if (t > 0.45) shake(0.06 * Math.max(0, 1 - (t - 0.45) * 3), t);
};
// p28 We won!
S.c53_win = (t, d) => {
  setEnv('day'); const W = C.world; crowd(t, 1.8, 0);
  const L = W.cast.leo;
  [0, 1, 2].forEach((i) => put(W.cast.mates[i], PULL.x - 1.3 + i * 1.3, PULL.y, PULL.z + 7, 0, { armL: [3.0, 0.2], armR: [3.0, 0.2] }, 'joy'));
  put(W.cast.ava, PULL.x + 2.4, PULL.y, PULL.z + 7.6, -0.3, { armL: [2.8, 0.5], armR: [2.8, 0.5] }, 'joy');
  put(L, PULL.x, PULL.y + 2.9 + Math.abs(Math.sin(t * 6)) * 0.5, PULL.z + 7, 0, { armL: [3.0, 0.4], armR: [3.0, 0.4], legL: -0.3, legR: 0.3 }, 'joy');
  confetti(PL(0, 0, 7), t + 1);
  cam(PL(1.0, 3.4, 15.5 - t * 0.6), PL(0, 3.4, 7), 46);
};
// p29 Now everybody in this town husses. Even me.
S.c54_town_end = (t, d) => { S.c01_aerial(t + 3, d); const L = C.world.cast.leo; put(L, -2, 0.25, WALK_Z, 0.3, {}); hussing(L, 'L', t, 1.2, 0.1, 1.2); };
S.c55_leo_jar = (t, d) => {
  setEnv('day'); const W = C.world;
  const g = put(W.cast.grandma, GRANNY.x + 1.2, GRANNY.y, GRANNY.z, -0.5, { armL: [2.6, 0.4], armR: [2.6, 0.4] }, 'joy');
  const pop = t > 0.25;
  const L = put(W.cast.leo, GRANNY.x - 0.5, GRANNY.y, GRANNY.z + 0.6, 0.35, pop ? { armL: [1.2, 0.1], armR: [2.9, 0.3], fist: 1 } : { armL: [1.25, 0.12], armR: [1.25, -0.05] }, pop ? 'huss' : 'determined');
  W.jar.visible = true; W.jar.position.copy(L.root.position).add(V(0.33, 1.55, 0.78));
  if (pop) { const u = t - 0.25; W.jar.userData.lid.position.set(u * 1.0, 0.47 + u * 8 - 4.9 * u * u, u * 0.5); W.jar.userData.lid.rotation.set(u * 14, 0, u * 9); blast('j', mouthOf(L), 0.35, u, 1.0); }
  cam(V(GRANNY.x + 0.6, 2.4, GRANNY.z + 6.8), V(GRANNY.x + 0.2, 2.2, GRANNY.z), 46);
};
// p30 HUSS! HUSS! HUSS! - everyone together
function finale(t, seed) {
  const W = C.world;
  const L = put(W.cast.leo, 0, 0.25, WALK_Z + 1.5, 0, {}); hussing(L, 'L', t, 9, 0, 1.3);
  const crew = [W.cast.ava, W.cast.grandma, W.cast.mailman, W.cast.mates[0], W.cast.mates[1], W.cast.town[0], W.cast.town[1], W.cast.town[2]];
  crew.forEach((c, i) => { const x = (i % 2 ? 1 : -1) * (1.8 + Math.floor(i / 2) * 1.7), z = WALK_Z + 0.5 - Math.floor(i / 2) * 0.7; put(c, x, 0.25, z, -x * 0.05, {}); hussing(c, i < 4 ? 'f' + i : null, t, 9, 0, 0.9); });
  W.cat.visible = true; W.cat.position.set(0.9, 0.25, WALK_Z + 2.4); W.cat.rotation.set(0, -0.2, 0); W.catFace.map = W.catTex.huss;
}
S.c56_end1 = (t, d) => { setEnv('day'); finale(t, 1); cam(V(0, 2.2, WALK_Z + 9.5 - t * 0.6), V(0, 2.4, WALK_Z), 54); shake(0.05 * Math.max(0, 1 - t * 2), t); };
S.c57_end2 = (t, d) => { setEnv('day'); finale(t, 2); cam(V(5.5, 1.0, WALK_Z + 7.5), V(-0.5, 3.0, WALK_Z), 56); shake(0.05 * Math.max(0, 1 - t * 2), t); };
S.c58_end3 = (t, d) => {
  setEnv('day'); finale(t, 3);
  cam(V(0, 2.5 + t * 3.5, WALK_Z + 7 + t * 3.0), V(0, 2.4, WALK_Z), 54); shake(0.06 * Math.max(0, 1 - t * 2), t);
  C.grade.uniforms.uFade.value = sstep(d - 0.7, d, t);
};

// ---------------------------------------------------------------- driver
export function setup(ctx) {
  C = ctx;
  ctx.cuts = ctx.tl.cuts;
  ctx.world.setScore('0:10');
}
const INTERIOR = /poster|chili|smoke|squeak2|laptop|garage|rope/;
export function applyTime(ctx, T) {
  C = ctx;
  const cuts = ctx.cuts;
  let i = cuts.findIndex((c) => T >= c.start && T < c.end);
  if (i < 0) i = T < cuts[0].start ? 0 : cuts.length - 1;
  const cut = cuts[i]; ctx.cut = cut;
  hideAll();
  ctx.grade.uniforms.uFlash.value = 0; ctx.grade.uniforms.uFade.value = 0; ctx.grade.uniforms.uSat.value = 1.12;
  ctx.world.scorePivot.rotation.set(0, -0.6, 0);
  const fn = S[cut.name];
  if (!fn) throw new Error('missing shot ' + cut.name);
  fn(T - cut.start, cut.end - cut.start);
  sunAt(ctx.focus || ctx.camera.position, INTERIOR.test(cut.name) ? 'interior' : 'day');
}
