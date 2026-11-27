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
  for (const ch of [W.cast.grandma, W.cast.mailman, W.cast.ref, ...W.cast.town]) mudFace(ch, false);
  W.hideExtra(); W.pancake.scale.setScalar(1); W.setScore('GO!'); W.chiliLabel.visible = false; W.chiliPepper.visible = false; W.chili.visible = true; W.soup.material.color.set('#d4281c');
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
    } else if (name.startsWith('dpuff')) {
      m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshLambertMaterial({ color: '#2a2a2e', transparent: true, depthWrite: false }));
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
// ---------------------------------------------------------------- toolkit
const wp = (o) => { o.updateMatrixWorld(true); return o.getWorldPosition(V(0, 0, 0)); };
function handOf(ch, i = 1) { ch.root.updateMatrixWorld(true); return ch.hands[i].getWorldPosition(V(0, 0, 0)); }
function holdItem(ch, r, fwd = 0.2, dy = -0.35) {
  const a = handOf(ch, 0), b = handOf(ch, 1), m = a.add(b).multiplyScalar(0.5).addScaledVector(fwdOf(ch.root.rotation.y), fwd);
  r.visible = true; r.position.copy(m).add(V(0, dy * r.scale.y, 0)); r.rotation.set(0, ch.root.rotation.y, 0);
}
const HOLD = { armL: [1.25, 0.32], armR: [1.25, 0.32] };
const HOLDUP = { armL: [2.7, 0.28], armR: [2.7, 0.28] };
// time since the most recent h6 hit (refrain sync)
function sinceHit(evs, T) { let best = 9; for (const e of evs) if (T >= e - 0.02) best = T - e; return best; }
function hussOn(ch, key, since, s = 0.8) {
  const on = since < 0.3, k = on ? Math.sin(Math.min(1, since / 0.08) * Math.PI / 2) : 0;
  ch.pose(on ? Object.assign({}, HUSSP, { armL: [2.9 * k, 0.35], armR: [2.9 * k, 0.35] }) : { armL: [0.2, 0.1], armR: [0.2, 0.1] });
  ch.setExpr(on ? 'huss' : 'grin');
  if (key != null) blast(key, mouthOf(ch), ch.root.rotation.y, since, s, 2, 0.4);
}
function dpuffs(key, pos, t, n = 7, spread = 0.5, rise = 2.2, sc = 1) {
  const R = rng(key.length * 17 + 3);
  for (let i = 0; i < n; i++) {
    const m = fx('dpuff' + key + i), ph = ((t * 0.8 + i / n) % 1);
    m.position.set(pos.x + (R() - 0.5) * spread + ph * 0.3, pos.y + ph * rise, pos.z + (R() - 0.5) * spread);
    m.scale.setScalar((0.18 + ph * 0.55) * sc); m.material.opacity = 0.9 * (1 - ph);
  }
}
const STG = () => PL(0, 0.5, 10);
const ST = (x, z) => PL(x, 0.5, 10 + z);
const TY = () => C.world.TABLE_Y;
const KIT = SETS.kitchen;
const KV = (x, y, z) => V(KIT.x + x, y, KIT.z + z);
const POT = () => KV(0, 1.95, 0);
function leoK(pose, expr, dx = 0) { return put(C.world.cast.leo, KIT.x + dx, 0, KIT.z + 2.0, Math.PI, pose, expr); }
// p01 In this town, everybody can cook.
function townCooks(t, hit = null) {
  const W = C.world;
  [[-6, -5.2], [-2, -5.4], [2, -5.2], [6, -5.4], [-4, 5.2], [4, 5.3]].forEach(([x, z], i) => {
    const c = put(W.cast.town[i], x, 0.25, z, z > 0 ? Math.PI : 0, { armR: [1.2, 0.1], armL: [0.3, 0.1] }, 'grin');
    if (hit != null) hussOn(c, i < 3 ? 'w' + i : null, hit, 0.8);
  });
}
S.c01_aerial = (t, d) => {
  setEnv('day'); townCooks(t);
  const W = C.world; W.stack.visible = true; W.stack.position.set(-4, 0.25, -5.2 + 1.2);
  const a = 0.5 + t * 0.05; cam(V(Math.sin(a) * 36, 24 - t * 1.2, 22 + Math.cos(a) * 6), V(-2, 1, 0), 52);
};
S.c02_street = (t, d) => {
  setEnv('day'); const W = C.world;
  const g = put(W.cast.grandma, -6, 0.25, WALK_Z, 0.3, HOLD, 'smile'); holdItem(g, W.pie, 0.25, -0.15);
  const m = put(W.cast.mailman, -2.5, 0.25, WALK_Z - 0.3, 0.2, HOLD, 'grin'); holdItem(m, W.pan, 0.45, -0.05);
  W.pancake.visible = true; W.pancake.position.copy(W.pan.position).add(V(0, 0.3 + Math.abs(Math.sin(t * 5)) * 1.0, 0)); W.pancake.rotation.set(t * 8, 0, 0);
  cam(V(-4.0 - t * 0.3, 2.3, WALK_Z + 10.5), V(-4.3, 2.0, WALK_Z), 50);
};
// p02 HUSS x6 - every huss cooks something
S.c03_h1 = (t, d) => {
  setEnv('day'); const W = C.world, s = sinceHit(C.ev.h6a, C.cut.start + t);
  const g = put(W.cast.grandma, GRANNY.x, GRANNY.y, GRANNY.z, 0, {}); hussOn(g, 'g', s, 0.8);
  W.pie.visible = true; W.pie.position.set(GRANNY.x + 0.9, GRANNY.y + 1.0, GRANNY.z + 1.3); W.pie.scale.setScalar(1 + 0.25 * Math.max(0, 1 - s * 4));
  W.pedestal.visible = true; W.pedestal.position.set(GRANNY.x + 0.9, GRANNY.y - 0.3, GRANNY.z + 1.3); W.pedestal.scale.set(0.6, 0.85, 0.6);
  cam(V(GRANNY.x + 0.9, 2.0, GRANNY.z + 6.2), V(GRANNY.x + 0.4, 1.8, GRANNY.z), 46); shake(0.06 * Math.max(0, 1 - s * 4), t);
};
S.c03_h2 = (t, d) => {
  setEnv('day'); const W = C.world, s = sinceHit(C.ev.h6a, C.cut.start + t);
  const m = put(W.cast.mailman, -8, 0.25, WALK_Z, 0.2, {}); hussOn(m, 'm', s, 0.8);
  W.pan.visible = true; W.pan.position.set(-7.2, 1.4, WALK_Z + 1.2); W.pan.rotation.set(0, 0.2, 0);
  W.pancake.visible = true; W.pancake.position.set(-7.2, 1.55 + arc(clamp(s / 0.4), 1.6), WALK_Z + 1.2); W.pancake.rotation.set(-clamp(s / 0.4) * Math.PI, 0, 0);
  cam(V(-7.0, 1.9, WALK_Z + 6.4), V(-7.4, 1.8, WALK_Z), 48); shake(0.06 * Math.max(0, 1 - s * 4), t);
};
S.c03_h3 = (t, d) => { setEnv('day'); const s = sinceHit(C.ev.h6a, C.cut.start + t); townCooks(t, s); cam(V(0, 2.2, WALK_Z + 10.5 - t * 0.5), V(0, 1.8, WALK_Z), 50); shake(0.06 * Math.max(0, 1 - s * 4), t); };
// p03 Grandma bakes pies so good, the birds line up outside.
const SILL = () => V(GRANNY.x + 1.0, GRANNY.y + 1.0, GRANNY.z + 1.3);
function piePorch(t) {
  const W = C.world; W.pie.visible = true; W.pie.position.copy(SILL()); W.pie.scale.setScalar(1);
  W.pedestal.visible = true; W.pedestal.position.set(SILL().x, GRANNY.y - 0.3, SILL().z); W.pedestal.scale.set(0.6, 0.85, 0.6);
  puffs('pie', SILL().add(V(0, 0.3, 0)), t, 5, 0.4, 1.0);
}
S.c04_pie = (t, d) => {
  setEnv('day'); const W = C.world; piePorch(t);
  put(W.cast.grandma, GRANNY.x - 0.5, GRANNY.y, GRANNY.z, 0.25, { armL: [0.6, 0.3], armR: [0.9, 0.2] }, 'smile');
  cam(V(GRANNY.x + 2.2, 1.9, GRANNY.z + 4.8 - t * 0.3), V(GRANNY.x + 0.5, 1.5, GRANNY.z + 0.8), 44);
};
S.c05_birds = (t, d) => {
  setEnv('day'); const W = C.world; piePorch(t);
  W.birds.forEach((b, i) => { b.visible = true; if (!b.userData.col) { b.userData.col = 1; const m = new THREE.MeshStandardMaterial({ color: ['#4d96ff', '#ffd23f', '#ff5d73', '#2ec4b6', '#a66cff', '#ff7a2e', '#58d68d'][i], roughness: 0.8 }); b.children[0].material = m; b.children[1].material = m; b.userData.wings.forEach((w) => (w.children[0].material = m)); } b.scale.setScalar(0.7); b.position.set(SILL().x + 1.0 + i * 0.75, 0.45 + Math.abs(Math.sin(t * 8 + i)) * 0.08, SILL().z + 1.4); b.rotation.set(0, -Math.PI / 2, 0); b.userData.wings.forEach((w, k) => (w.rotation.z = (k ? -1 : 1) * Math.sin(t * 20 + i) * 0.2)); });
  cam(V(SILL().x + 7.5, 2.4, SILL().z + 7.5), V(SILL().x + 2.0, 0.9, SILL().z + 1.0), 46);
};
// p04 The mailman flips pancakes over his own house.
const MAIL = V(-8, 0.25, WALK_Z);
function mailPan(pose = HOLD) { const W = C.world; const m = put(W.cast.mailman, MAIL.x, MAIL.y, MAIL.z, 0.15, pose, 'grin'); holdItem(m, W.pan, 0.45, -0.05); return m; }
S.c06_pan = (t, d) => {
  setEnv('day'); const W = C.world; const k = clamp((t - 0.25) / 0.15);
  const m = mailPan({ armL: [1.25 + 1.2 * k, 0.32], armR: [1.25 + 1.2 * k, 0.32] });
  W.pancake.visible = true; const u = clamp((t - 0.3) / 1.2); W.pancake.position.copy(W.pan.position).add(V(0, 0.1 + arc(Math.min(u, 0.5), 3), -u * 2)); W.pancake.rotation.set(-u * 8, 0, 0);
  cam(V(MAIL.x + 1.2, 1.6, MAIL.z + 5.2), V(MAIL.x + 0.3, 2.4, MAIL.z), 50);
};
S.c07_over = (t, d) => {
  setEnv('day'); const W = C.world; mailPan(HOLDUP);
  const u = clamp(t / d), z0 = MAIL.z, z1 = -22;
  W.pancake.visible = true; W.pancake.position.set(MAIL.x + 0.3, 3 + arc(u, 13), lerp(z0, z1, Math.sin(u * Math.PI))); W.pancake.rotation.set(-t * 9, 0, t * 2);
  W.pancake.scale.setScalar(3.2);
  cam(V(MAIL.x + 17, 8, MAIL.z + 24), V(MAIL.x, 8, MAIL.z - 7), 54);
};
// p05 Except me. I burned water. Twice.
S.c08_except = (t, d) => {
  setEnv('day'); const W = C.world;
  put(W.cast.leo, 0, 0.25, WALK_Z, 0.1, { armL: [0, 0.05], armR: [0, 0.05], head: [0.15, 0, 0] }, 'sad');
  [[-4.5, -1.5], [4.5, -2.0]].forEach(([x, z], i) => { put(W.cast.town[i], x, 0.25, z, i ? -0.5 : 0.5, { armR: [1.2, 0.1] }, 'grin'); });
  W.stack.visible = true; W.stack.position.set(-3.8, 1.2, -0.8); W.pie2.visible = true; W.pie2.position.set(3.8, 1.25, -1.2);
  W.pedestal.visible = true; W.pedestal.scale.set(0.6, 0.85, 0.6); W.pedestal.position.set(-3.8, 0.1, -0.8);
  cam(V(0.3, 2.3, WALK_Z + 5.4 - t * 0.3), V(0, 2.1, WALK_Z), 46);
};
function water(t, burnt) {
  const W = C.world; W.soup.material.color.set(burnt ? '#2a2420' : '#6fc3ff');
  if (burnt) { dpuffs('w', POT(), t, 8, 0.6, 2.4, 1.3); W.flame.visible = true; W.flame.position.copy(POT()).add(V(0, -0.1, 0)); W.flame.scale.setScalar(0.7); W.flame.userData.tick(t); }
}
S.c09_water = (t, d) => {
  setEnv('interior'); water(t, true);
  const L = leoK({ armL: [0.6, 0.6], armR: [0.6, 0.6] }, 'shock');
  cam(KV(1.8, 2.7, -2.0 + t * 0.2), KV(0, 2.0, 0.8), 46);
};
S.c10_twice = (t, d) => {
  setEnv('interior'); const W = C.world; water(t, true);
  C.world.soup.material.color.set('#2a2420'); const L = leoK({ armL: [0.1, 0.2], armR: [0.1, 0.2] }, 'bored'); mudFace(L, true);
  dpuffs('w2', headOf(L).add(V(0.3, 0.9, 0)), t, 4, 0.3, 1.0, 0.4);
  faceCam(L, 2.6, { fov: 42, dy: 0.2, lookDy: 0.2 });
};
// p06 The smoke alarm knows my name.
S.c11_alarm = (t, d) => {
  setEnv('interior'); const W = C.world; W.alarm.visible = true; W.led.color.set(Math.sin(t * 18) > 0 ? '#ff2020' : '#400000');
  dpuffs('al', KV(0.2, 2.6, 0.2), t, 5, 1.2, 1.0, 0.6);
  const a = W.alarm.position;
  cam(a.clone().add(V(0.4, -1.3, 1.1)), a.clone().add(V(0, -0.05, 0)), 44); shake(0.015, t);
};
// p07 Then came the town cook-off. First prize: the golden spoon.
function contest(t, o = {}) {
  const W = C.world;
  W.pie2.visible = true; W.pie2.position.copy(ST(-2.6, -0.6)).add(V(0, 1.3, 0));
  W.stack.visible = true; W.stack.position.copy(ST(2.6, -0.6)).add(V(0, 1.3, 0));
  put(W.cast.grandma, ST(-2.6, -1.6).x, ST(0, 0).y, ST(0, -1.6).z, o.gyaw || 0, o.gpose || {}, o.gexpr || 'smile');
  put(W.cast.mailman, ST(2.6, -1.6).x, ST(0, 0).y, ST(0, -1.6).z, o.myaw || 0, o.mpose || {}, o.mexpr || 'grin');
  const L = put(W.cast.leo, ST(0, 1.0).x, ST(0, 0).y, ST(0, 1.0).z, 0, o.lpose || {}, o.lexpr || 'determined');
  if (!o.noPizza) { W.pizza.visible = true; W.pizza.position.copy(ST(0, 1.9)).add(V(0, 1.34, 0)); }
  if (!o.noJudge) put(W.cast.ref, PL(1.4, 0, 15.6).x, PULL.y, PL(0, 0, 15.6).z, Math.PI + (o.ryaw || 0), o.rpose || {}, o.rexpr || 'serious');
  return L;
}
function spoon(t, p, s = 1.2) { const W = C.world; W.pedestal.visible = true; W.pedestal.scale.setScalar(1); W.pedestal.position.copy(p); W.spoon.visible = true; W.spoon.scale.setScalar(s); W.spoon.position.copy(p).add(V(0, 2.2 + Math.sin(t * 3) * 0.08, 0)); W.spoon.rotation.set(0, t * 1.6, 0); W.spoon.rotateX(-1.25); }
S.c12_venue = (t, d) => { setEnv('day'); contest(t, { noPizza: true }); crowd(t, 1, 0); spoon(t, PL(6.5, 0.5, 13)); const a = -0.5 + t * 0.06; cam(PL(Math.sin(a) * 30, 18 - t, 10 + Math.cos(a) * 30), PL(0, 1, 6), 48); };
S.c13_spoon = (t, d) => { setEnv('day'); crowd(t, 1, 0); const p = PL(6.5, 0.5, 13); spoon(t, p, 1.8); cam(p.clone().add(V(0.4, 3.0, 3.6 - t * 0.4)), p.clone().add(V(0, 2.3, 0)), 40); };
// p08 Everybody looked at me: Leo, please. Remember the water.
S.c14_look = (t, d) => {
  setEnv('day'); const W = C.world; const k = smooth(clamp(t / 0.4));
  contest(t, { noPizza: true, gyaw: 0.9 * k, myaw: -0.9 * k, gexpr: 'worried', mexpr: 'worried', lexpr: 'surprised' }); crowd(t, 0.4, 1);
  cam(ST(0, 6.0).add(V(0, 2.6, 0)), ST(0, -0.6).add(V(0, 1.8, 0)), 50);
};
S.c15_please = (t, d) => {
  setEnv('day'); const W = C.world;
  contest(t, { noPizza: true, gyaw: 0.9, myaw: -0.9, gpose: { armL: [1.4, -0.2], armR: [1.4, -0.2] }, mpose: { armL: [1.4, -0.2], armR: [1.4, -0.2] }, gexpr: 'worried', mexpr: 'worried', lexpr: 'surprised' }); crowd(t, 0.3, 1);
  faceCam(W.cast.grandma, 3.2 - t * 0.3, { fov: 44, side: 0.8 });
};
S.c16_remember = (t, d) => { S.c09_water(t + 0.6, d); C.grade.uniforms.uSat.value = 0.4; };
// p09 training montage: toast, cereal, ice cream - all burned
function kTable(item, t, burnt, pose, expr) {
  const W = C.world; W.chili.visible = false;
  const L = leoK(pose || { armL: [0.5, 0.2], armR: [0.5, 0.2] }, expr);
  const p = KV(0, 1.49, 0.3);
  if (item === 'toast') { W.toaster.visible = true; W.toaster.position.copy(p); W.toast.visible = true; const u = burnt ? 1 : clamp((t - 0.2) / 0.3); W.toast.rotation.set(Math.PI / 2, 0, 0); W.toast.position.copy(p).add(V(0, 0.5 + arc(Math.min(u, 0.5), 2.0) + (burnt ? 0.6 : 0), 0)); }
  if (item === 'cereal') { W.cereal.visible = true; W.cereal.position.copy(p); }
  if (item === 'cone') { W.cone.visible = true; W.cone.position.copy(p).add(V(0, 0.1, 0)); }
  W.setBurnt({ toast: burnt && item === 'toast', cereal: burnt && item === 'cereal', cone: burnt && item === 'cone' });
  if (burnt) { dpuffs('b' + item, p.clone().add(V(0, 0.5, 0)), t, 7, 0.5, 2.0, 1.0); W.flame.visible = true; W.flame.position.copy(p).add(V(0.0, item === 'toast' ? 0.4 : 0.25, 0)); W.flame.scale.setScalar(0.8); W.flame.userData.tick(t); mudFace(L, true); }
  return L;
}
const KCAM = (t) => cam(KV(1.7, 2.9, -3.1 + t * 0.2), KV(0, 1.9, 1.0), 50);
S.c17_train = (t, d) => { setEnv('night'); setEnv('interior'); C.world.chili.visible = false; leoK({ armL: [0.6, 0.6], armR: [1.4, -0.1], fist: 1 }, 'determined'); cam(KV(1.8, 2.7, -2.2), KV(0, 2.0, 1.2), 46); };
S.c18_toast = (t, d) => { setEnv('interior'); kTable('toast', t, false, null, 'grin'); KCAM(t); };
S.c19_toast_b = (t, d) => { setEnv('interior'); kTable('toast', t, true, null, 'shock'); KCAM(t); shake(0.02, t); };
S.c20_cereal = (t, d) => { setEnv('interior'); kTable('cereal', t, false, null, 'grin'); KCAM(t); };
S.c21_cereal_b = (t, d) => { setEnv('interior'); kTable('cereal', t, true, null, 'shock'); KCAM(t); shake(0.02, t); };
S.c22_ice = (t, d) => { setEnv('interior'); kTable('cone', t, false, null, 'grin'); KCAM(t); };
S.c23_ice_b = (t, d) => { setEnv('interior'); const L = kTable('cone', t, true, { armL: [0.2, 0.6], armR: [0.2, 0.6], head: [0, 0, 0.25] }, 'surprised'); KCAM(t); };
// p10 Then Grandma told me her secret.
S.c24_secret = (t, d) => {
  setEnv('interior'); const W = C.world;
  const L = leoK({ armL: [0.2, 0.1], armR: [0.2, 0.1] }, 'surprised', 0.6); L.root.rotation.y = Math.PI - 0.9;
  const g = put(W.cast.grandma, KIT.x - 0.5, 0, KIT.z + 2.6, 2.0, { lean: 0.25, armR: [1.3, -0.3] }, 'smug');
  cam(KV(0.6, 2.5, -2.4 + t * 0.2), KV(0.05, 2.1, 2.3), 46);
};
// p11 You don't cook with your hands, Leo. You cook with your huss.
S.c25_hands = (t, d) => {
  setEnv('interior'); const W = C.world;
  const g = put(W.cast.grandma, KIT.x - 0.5, 0, KIT.z + 2.6, 2.0, { armL: [1.5 + Math.sin(t * 14) * 0.2, 0.3], armR: [1.5 + Math.cos(t * 14) * 0.2, 0.3] }, 'serious');
  faceCam(g, 3.0, { fov: 44, side: -0.3, dy: -0.1, lookDy: -0.25 });
};
S.c26_gran_huss = (t, d) => {
  setEnv('interior'); const W = C.world; W.chili.visible = false;
  const te = C.ev.gran_huss - C.cut.start, s = t - te, on = s >= 0;
  const g = put(W.cast.grandma, KIT.x - 0.4, 0, KIT.z + 2.1, Math.PI, on ? HUSSP : {}, on ? 'huss' : 'determined');
  W.pie.visible = true; W.pie.position.copy(KV(-0.4, 1.49, 0.6)); W.pie.scale.setScalar(on ? 1 + 0.3 * Math.max(0, 1 - s * 3) : 1);
  if (on) { blast('gh', mouthOf(g), Math.PI, s, 0.5); puffs('gp', KV(-0.4, 1.8, 0.6), t, 6, 0.4, 1.2); }
  cam(KV(1.4, 2.6, -2.0), KV(-0.4, 2.0, 1.2), 46); if (on) shake(0.05 * Math.max(0, 1 - s * 3), t);
};
// p12 Cook-off day. I had one raw pizza. And no oven.
S.c27_day = (t, d) => { setEnv('day'); contest(t); crowd(t, 1, 0); const a = 0.9 + t * 0.05; cam(PL(Math.sin(a) * 18, 8.5, 10 + Math.cos(a) * 18), PL(0, 1.5, 10.5), 46); };
S.c28_pizza = (t, d) => {
  setEnv('day'); contest(t, { lexpr: 'grin', lpose: { armL: [1.3, 0.3], armR: [1.3, 0.3] } }); crowd(t, 0.4, 0);
  const p = ST(0, 1.9).add(V(0, 1.34, 0));
  cam(p.clone().add(V(0.6, 1.3, 2.3 - t * 0.2)), p.clone().add(V(0, 0.6, -0.6)), 46);
};
S.c29_nooven = (t, d) => {
  setEnv('day'); contest(t, { lexpr: 'worried', lpose: { armL: [0.6, 1.0], armR: [0.6, 1.0] } }); crowd(t, 0.3, 0);
  cam(ST(4.5, 7.0).add(V(0, 2.4, 0)), ST(0, 1.2).add(V(0, 1.6, 0)), 46);
};
// p13 The judge sighed. Everybody laughed.
S.c30_sigh = (t, d) => { setEnv('day'); const W = C.world; contest(t, { rexpr: 'bored', rpose: { head: [0.25, 0, 0], armL: [0.2, 0.3], armR: [0.2, 0.3] } }); crowd(t, 0.2, 0); faceCam(W.cast.ref, 3.4 - t * 0.2, { fov: 42, side: 0.3 }); };
S.c31_laugh = (t, d) => { setEnv('day'); contest(t, { gexpr: 'laugh', mexpr: 'laugh', lexpr: 'sad' }); crowd(t, 1.6, 2); cam(PL(-6, 3.2, 14), PL(16, 4.5, 4), 50); shake(0.02, t); };
// p14 breath
S.c32_breath = (t, d) => {
  setEnv('day'); const k = smooth(clamp(t / d));
  const L = contest(t, { lexpr: 'burp', lpose: { lean: -0.15 * k, armL: [0.3, 0.3 + 0.3 * k], armR: [0.3, 0.3 + 0.3 * k] } }); crowd(t, 0.1, 0);
  L.torso.scale.set(1 + 0.12 * k, 1 + 0.05 * k, 1 + 0.15 * k);
  faceCam(L, 3.0 - k * 0.9, { fov: 40, dy: 0.1 });
};
// p15 HUSS!
S.c33_bighuss = (t, d) => {
  setEnv('day'); const W = C.world;
  const L = contest(t, { lexpr: 'huss', lpose: Object.assign({}, HUSSP, { lean: 0.25, head: [0.3, 0, 0] }), gexpr: 'shock', mexpr: 'shock', rexpr: 'shock' }); crowd(t, 1.5, 1);
  const mp = mouthOf(L); blast('B', mp, 0, t, 2.2, 3, 0.7); blast('B2', mp, 0, t - 0.3, 2.2, 3, 0.7);
  W.pizza.position.y += easeOut(clamp(t / d)) * 0.8; W.pizza.rotation.y = t * t * 20;
  C.grade.uniforms.uFlash.value = Math.max(0, 0.7 - t * 2.5);
  cam(ST(2.6, 5.0).add(V(0, 2.6, 0)), ST(0, 1.3).add(V(0, 2.0, 0)), 52); shake(0.2 * Math.max(0.15, 1 - t * 1.2), t);
};
// p16 The pizza spun so fast, it cooked itself. Perfectly golden.
function spinPizza(t, glow, golden) {
  const W = C.world; const p = ST(0, 1.9).add(V(0, 2.6, 0));
  W.pizza.visible = true; W.pizza.position.copy(p).add(V(0, Math.sin(t * 3) * 0.1, 0)); W.pizza.rotation.set(0.35, t * 40, 0);
  W.setPizza(golden, glow); return p;
}
S.c34_spin = (t, d) => {
  setEnv('day'); const W = C.world; contest(t, { noPizza: true, lexpr: 'shock', gexpr: 'shock', mexpr: 'shock', rexpr: 'shock' }); crowd(t, 1.4, 1);
  const p = spinPizza(t, 0.2 * t, false); const m = fx('speed'); m.position.copy(p); m.children.forEach((c) => { c.position.y = c.userData.y0 * 0.15 + ((t * 30 + c.userData.y0) % 3) - 1.5; c.scale.set(1, 0.2, 1); });
  ring('ring', p, (t % 0.4), 0.4, 3, true);
  cam(p.clone().add(V(2.6, 0.4, 4.4)), p.clone().add(V(0, -0.3, 0)), 50); shake(0.04, t);
};
S.c35_cook = (t, d) => {
  setEnv('day'); contest(t, { noPizza: true, lexpr: 'shock', gexpr: 'shock', mexpr: 'shock', rexpr: 'shock' }); crowd(t, 1.4, 1);
  const k = clamp(t / d); const p = spinPizza(t + 1, 0.3 + 1.2 * k, k > 0.5);
  puffs('ck', p.clone().add(V(0, 0.2, 0)), t, 6, 0.8, 1.6);
  cam(p.clone().add(V(0.6, 1.4, 2.2)), p, 44); shake(0.03, t);
};
S.c36_golden = (t, d) => {
  setEnv('day'); const W = C.world; contest(t, { noPizza: true, lexpr: 'joy', gexpr: 'surprised', mexpr: 'surprised', rexpr: 'surprised' }); crowd(t, 1.2, 1);
  const p = ST(0, 1.9).add(V(0, 1.34, 0)); W.pizza.visible = true; W.pizza.position.copy(p).add(V(0, Math.max(0, 0.5 - t * 2) , 0)); W.pizza.rotation.set(0, t * 0.5, 0); W.setPizza(true, Math.max(0, 0.6 - t));
  confetti(p.clone().add(V(0, -6, 0)), t + 1);
  cam(p.clone().add(V(0.3, 1.5, 1.7 - t * 0.2)), p, 42);
};
// p17 The judge took one bite, and cried.
function judgeSlice(t, expr) {
  const W = C.world; contest(t, { noPizza: true, lexpr: 'worried', rexpr: expr, rpose: { armR: [1.9, 0.0], armL: [0.3, 0.1] } }); W.pizza.visible = true; W.pizza.position.copy(ST(0, 1.9)).add(V(0, 1.34, 0)); W.setPizza(true);
  const r = W.cast.ref; const h = handOf(r, 1);
  W.slice.visible = true; W.slice.scale.setScalar(1.3); W.slice.position.copy(mouthOf(r)).addScaledVector(fwdOf(r.root.rotation.y), 0.25).add(V(0.15, -0.25, 0)); W.slice.rotation.set(0, r.root.rotation.y + Math.PI * 0.62, 0);
  return r;
}
S.c37_bite = (t, d) => { setEnv('day'); const r = judgeSlice(t, t > d * 0.5 ? 'burp' : 'serious'); crowd(t, 0.2, 0); faceCam(r, 3.2 - t * 0.3, { fov: 42, side: 0.6, dy: -0.2, lookDy: -0.3 }); };
S.c38_cry = (t, d) => { setEnv('day'); const r = judgeSlice(t, 'cry'); crowd(t, 0.8, 0); r.root.position.y += Math.abs(Math.sin(t * 9)) * 0.05; faceCam(r, 2.5 - t * 0.2, { fov: 42, side: 0.3 }); };
// p18 Golden spoon.
S.c39_award = (t, d) => {
  setEnv('day'); const W = C.world; crowd(t, 2.0, 0);
  const L = put(W.cast.leo, ST(0, 1.0).x, ST(0, 0).y + Math.abs(Math.sin(t * 6)) * 0.6, ST(0, 1.0).z, 0, { armL: [3.0, 0.2], armR: [3.0, 0.2] }, 'joy');
  W.spoon.visible = true; W.spoon.scale.setScalar(1.1); const a = handOf(L, 0), b = handOf(L, 1); W.spoon.position.copy(a.add(b).multiplyScalar(0.5)).add(V(0, 0.4, 0)); W.spoon.rotation.set(-Math.PI / 2, 0, 0);
  put(W.cast.grandma, ST(-2.0, 0.2).x, ST(0, 0).y, ST(0, 0.2).z, 0.4, { armL: [2.6, 0.4], armR: [2.6, 0.4] }, 'joy');
  put(W.cast.ref, ST(2.0, 0.6).x, ST(0, 0).y, ST(0, 0.6).z, -0.4, { armL: [2.6, 0.4], armR: [2.6, 0.4] }, 'cry');
  confetti(ST(0, 1), t + 1);
  cam(ST(0.4, 9.0 - t * 0.5).add(V(0, 3.0, 0)), ST(0, 1.0).add(V(0, 2.9, 0)), 46);
};
// p19 Now everybody in this town cooks with a huss.
S.c40_town = (t, d) => {
  setEnv('day'); const W = C.world; const s = (t % 0.9);
  [[-6, -5.2], [-2, -5.4], [2, -5.2], [6, -5.4]].forEach(([x, z], i) => {
    const c = put(W.cast.town[i], x, 0.25, z, 0, {}); hussOn(c, i < 3 ? 'w' + i : null, (t + i * 0.3) % 0.9, 0.7);
  });
  W.pizza.visible = true; W.pizza.position.set(-2, 1.4 + Math.sin(t * 4) * 0.1, -4.0); W.pizza.rotation.set(0.3, t * 30, 0); W.setPizza(true, 0.3);
  W.pancake.visible = true; W.pancake.position.set(2, 1.6 + arc((t % 0.9) / 0.9, 1.5), -3.9); W.pancake.rotation.set(-t * 7, 0, 0);
  cam(V(0, 2.2, WALK_Z + 9.5 - t * 0.5), V(0, 1.8, WALK_Z), 50);
};
S.c41_grandma = (t, d) => {
  setEnv('day'); const W = C.world; const s = t - 0.2;
  const g = put(W.cast.grandma, GRANNY.x - 0.8, GRANNY.y, GRANNY.z + 0.2, 0.4, s > 0 ? HUSSP : {}, s > 0 ? 'huss' : 'grin');
  const L = put(W.cast.leo, GRANNY.x + 1.7, GRANNY.y, GRANNY.z + 0.4, -0.4, s > 0 ? HUSSP : {}, s > 0 ? 'huss' : 'grin');
  W.pie.visible = true; W.pie.position.copy(SILL()).add(V(-0.1, 0, 0.4)); W.pedestal.visible = true; W.pedestal.position.set(SILL().x - 0.1, GRANNY.y - 0.3, SILL().z + 0.4); W.pedestal.scale.set(0.6, 0.85, 0.6);
  if (s > 0) { blast('gg', mouthOf(g), 0.4, s, 0.45); blast('gl', mouthOf(L), -0.4, s, 0.45); puffs('gp', SILL().add(V(-0.1, 0.4, 0.4)), t, 6, 0.4, 1.2); }
  cam(V(GRANNY.x + 0.5, 2.2, GRANNY.z + 6.6), V(GRANNY.x + 0.4, 1.9, GRANNY.z), 46);
};
// p20 HUSS x6 finale
function finale(t, T) {
  const W = C.world, s = sinceHit(C.ev.h6b, T);
  const L = put(W.cast.leo, 0, 0.25, WALK_Z + 1.5, 0, {}); hussOn(L, 'L', s, 1.3);
  W.spoon.visible = true; W.spoon.scale.setScalar(0.8); W.spoon.position.copy(handOf(L, 1)).add(V(0, 0.3, 0)); W.spoon.rotation.set(-Math.PI / 2, 0, 0);
  const crew = [W.cast.grandma, W.cast.mailman, W.cast.ref, W.cast.town[0], W.cast.town[1], W.cast.town[2], W.cast.town[3]];
  crew.forEach((c, i) => { const x = (i % 2 ? 1 : -1) * (1.9 + Math.floor(i / 2) * 1.8), z = WALK_Z + 0.5 - Math.floor(i / 2) * 0.7; put(c, x, 0.25, z, -x * 0.05, {}); hussOn(c, i < 3 ? 'f' + i : null, s, 0.9); });
  W.pizza.visible = true; W.pizza.position.set(0, 4.2, WALK_Z + 1.5); W.pizza.rotation.set(0.4, t * 20, 0); W.setPizza(true, 0.4 * Math.max(0, 1 - s * 3));
  W.pancake.visible = true; W.pancake.position.set(2.0, 2.6 + arc(clamp(s / 0.4), 1.5), WALK_Z + 1.3); W.pancake.rotation.set(-clamp(s / 0.4) * Math.PI, 0, 0);
  return s;
}
S.c42_end1 = (t, d) => { setEnv('day'); const s = finale(t, C.cut.start + t); cam(V(0, 2.4, WALK_Z + 10.5 - t * 0.6), V(0, 2.5, WALK_Z), 54); shake(0.05 * Math.max(0, 1 - s * 4), t); };
S.c42_end2 = (t, d) => { setEnv('day'); const s = finale(t, C.cut.start + t); cam(V(5.5, 1.0, WALK_Z + 7.5), V(-0.5, 2.8, WALK_Z), 56); shake(0.05 * Math.max(0, 1 - s * 4), t); };
S.c42_end3 = (t, d) => {
  setEnv('day'); const s = finale(t, C.cut.start + t);
  cam(V(0, 2.6 + t * 3.5, WALK_Z + 8 + t * 3.0), V(0, 2.6, WALK_Z), 54); shake(0.05 * Math.max(0, 1 - s * 4), t);
  C.grade.uniforms.uFade.value = sstep(d - 0.7, d, t);
};

// ---------------------------------------------------------------- driver
export function setup(ctx) {
  C = ctx;
  ctx.cuts = ctx.tl.cuts;
  ctx.world.setScore('GO!');
}
const INTERIOR = /c09_|c10_|c11_|c16_|c17_|c18_|c19_|c20_|c21_|c22_|c23_|c24_|c25_|c26_/;
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
