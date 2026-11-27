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
  W.hideExtra(); W.setScore('PET SHOW'); W.poster.visible = true;
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
// ---------------------------------------------------------------- pet toolkit
const wp = (o) => { o.updateMatrixWorld(true); return o.getWorldPosition(V(0, 0, 0)); };
function handOf(ch, i = 1) { ch.root.updateMatrixWorld(true); return ch.hands[i].getWorldPosition(V(0, 0, 0)); }
function dog(i, x, y, z, yaw, t, { walk = 0, wag = 1, expr = 'grin', sit = 0 } = {}) {
  const W = C.world, d = W.dogs[i], u = d.userData;
  d.visible = true; d.position.set(x, y, z); d.rotation.set(0, yaw, 0);
  u.legs.forEach((l, k) => (l.rotation.x = Math.sin(t * 11 + (k % 2 ? Math.PI : 0) + (k > 1 ? Math.PI : 0)) * 0.55 * walk));
  u.body.rotation.set(-0.35 * sit, 0, 0); u.body.position.y = Math.abs(Math.sin(t * 11)) * 0.06 * walk;
  u.tail.rotation.y = Math.sin(t * 16) * 0.7 * wag; u.ears.forEach((e, k) => (e.rotation.x = Math.sin(t * 11 + k) * 0.2 * walk));
  u.face.material.map = W.dogTex[expr] || W.dogTex.grin;
  return d;
}
function cat(i, x, y, z, yaw, expr = 'smug') {
  const W = C.world, c = W.cats[i]; c.visible = true; c.position.set(x, y, z); c.rotation.set(0, yaw, 0); c.scale.setScalar(1);
  c.userData.face.material.map = W.catTex[expr] || W.catTex.smug; return c;
}
function gary(x, y, z, yaw = 0, t = 0, k = 0.3) { const g = C.world.gary; g.visible = true; g.position.set(x, y, z); g.rotation.set(0, yaw, 0); g.userData.wiggle(t, k); return g; }
function rock(i, x, y, z, yaw = 0, t = 0) { const r = C.world.rocks[i]; r.visible = true; r.position.set(x, y, z); r.rotation.set(0, yaw, 0); r.userData.wiggle(t, 0.5); return r; }
const petHead = (p) => (p.userData.head ? wp(p.userData.head).add(V(0, -0.25, 0)) : p.position.clone().add(V(0, 0.55 * p.scale.y, 0)));
function leash(i, ch, pet) { C.world.setLeash(i, handOf(ch, 1), petHead(pet)); }
function holdRock(ch, r, fwd = 0.2, dy = -0.35) {
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
function petHuss(p, key, since, s = 0.5) {
  const on = since < 0.3, W = C.world;
  if (p.userData.head) p.userData.face.material.map = on ? W.dogTex.huss : W.dogTex.grin;
  else if (p.userData.face) p.userData.face.material.map = on ? W.catTex.huss : W.catTex.smug;
  if (on) blast(key, petHead(p).add(V(0, 0.1, 0)).addScaledVector(fwdOf(p.rotation.y), 0.5), p.rotation.y, since, s, 2, 0.4);
}
// a citizen walking a pet along the sidewalk
function walker(ch, pet, li, x, z, dir, t, petKind = 'dog', pi = 0) {
  const yaw = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  put(ch, x, 0.25, z, yaw, { walk: 0.8, phase: t * 7 + x, armR: [0.7, 0.15], armL: [0, 0.06] }, 'grin');
  let p;
  if (petKind === 'dog') p = dog(pi, x + dir * 2.0, 0.25, z + 0.3, yaw, t + x, { walk: 1 });
  else if (petKind === 'cat') { p = cat(pi, x + dir * 1.8, 0.25, z + 0.3, yaw); p.position.y += Math.abs(Math.sin(t * 9 + x)) * 0.08; }
  else { p = rock(pi, x + dir * 1.8, 0.25, z + 0.3, yaw, t); }
  leash(li, ch, p); return p;
}
const STG = () => PL(0, 0.5, 10);   // stage top centre
const ST = (x, z) => PL(x, 0.5, 10 + z);
const SR_ = SETS.bedroom;
const BR = (x, a, b) => (b === undefined ? V(SR_.x + x, 0, SR_.z + a) : V(SR_.x + x, a, SR_.z + b));

// p01 In this town, everybody has a pet.
function townPets(t, n = 6, sp = 1.3) {
  const W = C.world, tc = W.cast.town;
  const kinds = ['dog', 'cat', 'dog', 'dog', 'cat', 'dog'], idx = { dog: 0, cat: 1 };
  const plan = [[-20, -5.2, 1], [-6, -5.4, 1], [8, -5.2, 1], [14, 5.2, -1], [0, 5.4, -1], [-12, 5.2, -1]];
  plan.slice(0, n).forEach(([x0, z, dir], i) => {
    const k = kinds[i]; const pi = k === 'dog' ? Math.min(5, idx.dog++) : Math.min(2, idx.cat++);
    walker(tc[i], null, i, x0 + dir * t * sp, z, dir, t, k, pi);
  });
}
S.c01_aerial = (t, d) => {
  setEnv('day'); townPets(t);
  const a = 0.5 + t * 0.05;
  cam(V(Math.sin(a) * 36, 24 - t * 1.2, 22 + Math.cos(a) * 6), V(-2, 1, 0), 52);
};
S.c02_street = (t, d) => {
  setEnv('day'); townPets(t + 2);
  cam(V(-1 - t * 0.4, 1.6, -1.8), V(-8, 1.2, -5.2), 52);
};
// p02 HUSS x6: owners and pets huss together
S.c03_h1 = (t, d) => {
  setEnv('day'); const W = C.world, T = C.cut.start + t, s = sinceHit(C.ev.h6a, T);
  const g = put(W.cast.grandma, GRANNY.x, GRANNY.y, GRANNY.z, 0, {}); hussOn(g, 'g', s, 0.8);
  const c = cat(0, GRANNY.x + 1.1, GRANNY.y, GRANNY.z + 1.0, -0.3); petHuss(c, 'gc', s, 0.4);
  cam(V(GRANNY.x + 0.9, 2.0, GRANNY.z + 6.2), V(GRANNY.x + 0.4, 1.8, GRANNY.z), 46); shake(0.06 * Math.max(0, 1 - s * 4), t);
};
S.c03_h2 = (t, d) => {
  setEnv('day'); const W = C.world, T = C.cut.start + t, s = sinceHit(C.ev.h6a, T);
  const m = put(W.cast.mailman, -8, 0.25, WALK_Z, 0.2, {}); hussOn(m, 'm', s, 0.8);
  const dd = dog(0, -6.6, 0.25, WALK_Z + 0.9, -0.4, t); petHuss(dd, 'md', s, 0.5);
  cam(V(-7.0, 1.9, WALK_Z + 6.4), V(-7.2, 1.7, WALK_Z), 48); shake(0.06 * Math.max(0, 1 - s * 4), t);
};
S.c03_h3 = (t, d) => {
  setEnv('day'); const W = C.world, T = C.cut.start + t, s = sinceHit(C.ev.h6a, T);
  [[-6, -5.2], [-2, -5.4], [2, -5.2], [6, -5.4]].forEach(([x, z], i) => {
    const c = put(W.cast.town[i], x, 0.25, z, 0.1, {}); hussOn(c, i < 2 ? 'w' + i : null, s, 0.9);
    const p = i % 2 ? cat(1 + (i > 1 ? 1 : 0), x + 1.0, 0.25, z + 1.2, 0) : dog(i ? 2 : 1, x + 1.1, 0.25, z + 1.2, 0, t);
    petHuss(p, 'wp' + i, s, 0.45);
  });
  cam(V(0, 2.2, WALK_Z + 10.5 - t * 0.5), V(0, 1.7, WALK_Z), 50); shake(0.06 * Math.max(0, 1 - s * 4), t);
};
// p03 Grandma's cat can do a backflip.
S.c04_grandma_cat = (t, d) => {
  setEnv('day'); const W = C.world;
  put(W.cast.grandma, GRANNY.x - 0.6, GRANNY.y, GRANNY.z, 0.2, { armL: [0.6, 0.3], armR: [0.6, 0.3] }, 'smile');
  cat(0, GRANNY.x + 1.0, GRANNY.y, GRANNY.z + 1.3, -0.5, 'smug');
  cam(V(GRANNY.x + 2.4, 1.4, GRANNY.z + 5.0 - t * 0.3), V(GRANNY.x + 0.4, 1.4, GRANNY.z + 0.6), 44);
};
function backflip(c, base, u, n = 1, h = 1.6) {
  const k = clamp(u); c.position.set(base.x, base.y + arc(k, h), base.z); c.rotation.set(0, c.rotation.y, 0);
  c.rotateX(-k * Math.PI * 2 * n);
}
S.c05_backflip = (t, d) => {
  setEnv('day'); const W = C.world;
  put(W.cast.grandma, GRANNY.x - 0.6, GRANNY.y, GRANNY.z, 0.2, t > 0.7 ? { armL: [2.6, 0.5], armR: [2.6, 0.5] } : { armL: [0.6, 0.3], armR: [0.6, 0.3] }, t > 0.7 ? 'joy' : 'smile');
  const c = cat(0, 0, 0, 0, Math.PI / 2, t > 0.75 ? 'grin' : 'smug');
  backflip(c, V(GRANNY.x + 1.0, GRANNY.y, GRANNY.z + 1.3), (t - 0.1) / 0.65, 1, 1.8);
  cam(V(GRANNY.x + 1.6, 1.6, GRANNY.z + 6.2), V(GRANNY.x + 0.6, 1.9, GRANNY.z + 0.8), 46);
};
// p04 The mailman's dog can jump through a hoop.
const HOOPX = -9, HOOPZ = WALK_Z + 0.4;
S.c06_mailman_dog = (t, d) => {
  setEnv('day'); const W = C.world, h = W.hoops[0];
  h.visible = true; h.position.set(HOOPX, 0.25, HOOPZ); h.rotation.set(0, Math.PI / 2, 0);
  put(W.cast.mailman, HOOPX + 1.0, 0.25, HOOPZ - 1.6, -0.3, { armR: [1.5, 0.1], armL: [0.2, 0.1] }, 'grin');
  dog(0, HOOPX + 3.2, 0.25, HOOPZ, -Math.PI / 2, t, { sit: 0.6, expr: 'grin' });
  cam(V(HOOPX + 1.0, 1.4, HOOPZ + 6.5 - t * 0.3), V(HOOPX + 1.2, 1.4, HOOPZ), 48);
};
S.c07_dog_hoop = (t, d) => {
  setEnv('day'); const W = C.world, h = W.hoops[0];
  h.visible = true; h.position.set(HOOPX, 0.25, HOOPZ); h.rotation.set(0, Math.PI / 2, 0);
  put(W.cast.mailman, HOOPX + 1.0, 0.25, HOOPZ - 1.6, -0.3, t > 0.8 ? { armL: [2.7, 0.4], armR: [2.7, 0.4] } : { armR: [1.5, 0.1] }, t > 0.8 ? 'joy' : 'grin');
  const u = clamp((t - 0.1) / 0.75);
  const dd = dog(0, HOOPX + 3.2 - u * 6.4, 0.25 + arc(u, 2.0), HOOPZ, -Math.PI / 2, t, { walk: u > 0 && u < 1 ? 0.3 : 0, expr: u > 0.2 && u < 0.9 ? 'shock' : 'grin' });
  dd.rotation.z = (u - 0.5) * 0.6;
  cam(V(HOOPX + 0.3, 1.8, HOOPZ + 7.5), V(HOOPX, 2.0, HOOPZ), 50);
};
// p05 Except me. Mom said pets are too much work.
S.c08_except = (t, d) => {
  setEnv('day'); const W = C.world;
  put(W.cast.leo, 0, 0.25, WALK_Z, 0.1, { armL: [0, 0.05], armR: [0, 0.05], head: [0.15, 0, 0] }, 'sad');
  walker(W.cast.town[0], null, 0, -9 + t * 1.6, WALK_Z - 0.4, 1, t, 'dog', 1);
  walker(W.cast.town[1], null, 1, 9 - t * 1.6, WALK_Z + 0.6, -1, t, 'cat', 1);
  cam(V(0.3, 2.3, WALK_Z + 5.4 - t * 0.3), V(0, 2.1, WALK_Z), 46);
};
S.c09_nopets = (t, d) => {
  setEnv('interior'); const W = C.world; const p = BR(0.4, -1.6);
  put(W.cast.leo, p.x, 0, p.z, -2.3, { armL: [0, 0.05], armR: [0, 0.05], head: [-0.15, 0, 0] }, 'sad');
  cam(BR(3.4, 2.4, 0.5 - t * 0.2), BR(-1.2, 2.3, -4.2), 50);
};
// p06 So I got a rock. His name is Gary.
S.c10_rock = (t, d) => {
  setEnv('day'); const W = C.world, k = backOut(clamp(t / 0.4));
  const L = put(W.cast.leo, 0, 0.25, WALK_Z, 0.1, { armL: [1.25 + 1.45 * k, 0.28], armR: [1.25 + 1.45 * k, 0.28] }, 'joy');
  holdRock(L, W.gary, 0.1, k > 0.7 ? 0.05 : -0.35);
  cam(V(0.4, 2.4, WALK_Z + 6.0), V(0, 2.6, WALK_Z), 48);
};
S.c11_gary = (t, d) => {
  setEnv('day'); const g = gary(0, 0.25, WALK_Z + 1.0, 0, t, 0.6);
  cam(V(0.2, 0.95, WALK_Z + 3.3 - t * 0.3), V(0, 0.62, WALK_Z + 1.0), 38);
};
// p07 Gary doesn't bark / eat / do anything (bedroom)
const GB = () => BR(0.2, -1.6);
const LEOB = () => BR(1.8, -0.2);
function bedLeo(dx, dz, yaw, pose, expr) { const p = LEOB(); return put(C.world.cast.leo, p.x + dx, 0, p.z + dz, yaw, pose, expr); }
const LYAW = -2.29;
function bedGary(t, k = 0.15) { const g = GB(); return gary(g.x, 0, g.z, 0.3, t, k); }
S.c12_bark = (t, d) => {
  setEnv('interior'); bedGary(t, 0.15);
  bedLeo(0, 0, LYAW, Object.assign(CROUCH(0.6), { armR: [1.4, 0.1], armL: [0.3, 0.2] }), 'yell');
  cam(BR(-2.4, 2.3, 4.4), BR(1.0, 1.2, -0.9), 46);
};
S.c13_eat = (t, d) => {
  setEnv('interior'); const W = C.world; bedGary(t, 0.1);
  W.bowl.visible = true; W.bowl.position.copy(BR(1.0, -1.2));
  bedLeo(0, 0, LYAW, CROUCH(0.6), 'surprised');
  cam(BR(-1.2, 1.9, 2.6), BR(0.9, 0.8, -1.0), 46);
};
S.c14_nothing = (t, d) => {
  setEnv('interior'); bedGary(t, 0.05);
  const L = bedLeo(0, 0, LYAW, { legL: -1.45, legR: -1.45, armL: [1.2, 0.1], armR: [1.2, 0.1], head: [0.2, 0, 0] }, 'bored');
  L.root.position.y = -0.62;
  cam(BR(-2.2 + t * 0.2, 2.4, 4.4), BR(1.0, 0.8, -0.9), 46);
};
// p08 The Pet Show. First prize: the golden bone.
function bone(t, x, y, z, s = 1) { const W = C.world; W.pedestal.visible = true; W.pedestal.position.set(x, y, z); W.bone.visible = true; W.bone.scale.setScalar(s); W.bone.position.set(x, y + 1.85 + Math.sin(t * 3) * 0.08, z); W.bone.rotation.set(0.2, t * 1.6, 0.3); }
function lineup(t, opts = {}) {
  const W = C.world;
  put(W.cast.grandma, ST(-2.4, -1.2).x, ST(0, 0).y, ST(0, -1.2).z, 0, { armL: [0.3, 0.2], armR: [0.3, 0.2] }, opts.gexpr || 'smile');
  cat(0, ST(-1.4, 0).x, ST(0, 0).y, ST(0, -0.4).z, 0, opts.cexpr || 'smug');
  put(W.cast.mailman, ST(2.4, 0).x, ST(0, 0).y, ST(0, -1.2).z, 0, { armL: [0.3, 0.2], armR: [0.3, 0.2] }, opts.mexpr || 'grin');
  dog(0, ST(1.3, 0).x, ST(0, 0).y, ST(0, -0.4).z, 0, t, { expr: opts.dexpr || 'grin', sit: 0.5 });
}
S.c15_venue = (t, d) => {
  setEnv('day'); lineup(t); crowd(t, 1, 0); bone(t, PULL.x + 6, PULL.y + 0.5, PULL.z + 9);
  const a = -0.5 + t * 0.06;
  cam(PL(Math.sin(a) * 30, 18 - t, 10 + Math.cos(a) * 30), PL(0, 1, 4), 48);
};
S.c16_bone = (t, d) => {
  setEnv('day'); crowd(t, 1, 0); const p = PL(6, 0.5, 9); bone(t, p.x, p.y, p.z, 1.2);
  cam(p.clone().add(V(0.4, 3.0, 3.8 - t * 0.4)), p.clone().add(V(0, 2.3, 0)), 40);
};
// p09 triple backflip, three hoops
S.c17_cat_flip = (t, d) => {
  setEnv('day'); const W = C.world; crowd(t, 1 + t, 0);
  put(W.cast.grandma, ST(-2.4, 0).x, ST(0, 0).y, ST(0, -1.2).z, 0.3, t > d - 0.4 ? { armL: [2.6, 0.5], armR: [2.6, 0.5] } : { armR: [1.5, 0.1] }, t > d - 0.4 ? 'joy' : 'grin');
  const c = cat(0, 0, 0, 0, Math.PI / 2, 'grin');
  backflip(c, ST(0, 0.5), (t - 0.05) / (d - 0.25), 3, 3.0);
  cam(PL(4.5, 2.6, 18), PL(-0.5, 2.6, 10), 50);
};
S.c18_dog_hoops = (t, d) => {
  setEnv('day'); const W = C.world; crowd(t, 1.3, 0);
  W.hoops.forEach((h, i) => { h.visible = true; h.position.copy(ST(-2.4 + i * 2.4, 0.5)); h.rotation.set(0, Math.PI / 2, 0); });
  const u = clamp((t - 0.05) / (d - 0.1)), x = 4.2 - u * 8.4;
  const ph = ((x + 3.6) / 2.4) % 1, hop = Math.sin(clamp(ph) * Math.PI);
  const dd = dog(0, ST(x, 0).x, ST(0, 0).y + 1.0 * Math.abs(Math.sin((x + 1.2) / 2.4 * Math.PI)), ST(0, 0.5).z, -Math.PI / 2, t, { walk: 0.4, expr: 'grin' });
  cam(PL(5.5, 2.6, 17), PL(0, 1.6, 10.5), 50);
};
S.c19_cheer = (t, d) => { setEnv('day'); crowd(t, 2.0, 0); lineup(t, { gexpr: 'joy', mexpr: 'joy' }); cam(PL(-2, 2.2, 14), PL(14, 5, 2), 54); };
// p10 Gary's turn. Gary just sat there. For one whole minute.
S.c20_turn = (t, d) => {
  setEnv('day'); const W = C.world; crowd(t, 0.4, 0);
  const k = smooth(clamp(t / 0.8));
  const L = put(W.cast.leo, ST(0, 2.6).x, ST(0, 0).y, ST(0, 2.6).z, Math.PI, Object.assign(CROUCH(0.6 * k), { armL: [1.25 - 0.3 * k, 0.32], armR: [1.25 - 0.3 * k, 0.32] }), 'grin');
  if (k < 0.9) holdRock(L, W.gary, 0.25); else gary(ST(0, 1.4).x, ST(0, 0).y, ST(0, 1.4).z, 0, t, 0.1);
  cam(PL(3.4, 2.4, 6.6), PL(0, 1.4, 12), 48);
};
S.c21_sat = (t, d) => { setEnv('day'); crowd(t, 0.1, 0); gary(ST(0, 1.4).x, ST(0, 0).y, ST(0, 1.4).z, 0, t * 0.3, 0.1); cam(ST(0.2, 4.3 - t * 0.2).add(V(0, 0.55, 0)), ST(0, 1.4).add(V(0, 0.5, 0)), 40); };
S.c22_minute = (t, d) => {
  setEnv('day'); const W = C.world; crowd(t, 0.1, 0);
  const sec = Math.min(60, Math.floor(clamp(t / (d - 0.25)) * 60)); W.setScore(sec >= 60 ? '1:00' : '0:' + String(sec).padStart(2, '0'));
  gary(ST(0, 1.4).x, ST(0, 0).y, ST(0, 1.4).z, 0, 0, 0);
  const p = PL(17, 12.5, -16);
  cam(p.clone().add(V(-14 * Math.sin(0.6), -1.5, 14 * Math.cos(0.6))), p.clone().add(V(0, -1, 0)), 44);
};
// p11 Everybody laughed. Even the dog laughed.
S.c23_laugh = (t, d) => { setEnv('day'); crowd(t, 1.6, 2); gary(ST(0, 1.4).x, ST(0, 0).y, ST(0, 1.4).z, 0, 0, 0); cam(PL(-6, 3.2, 12), PL(16, 4.5, 4), 50); shake(0.02, t); };
S.c24_dog_laugh = (t, d) => {
  setEnv('day'); crowd(t, 1.6, 2);
  const dd = dog(0, ST(1.3, 0).x, ST(0, 0).y, ST(0, -0.4).z, 0.2, t, { expr: 'laugh', wag: 2 });
  dd.rotation.z = Math.sin(t * 18) * 0.12; dd.userData.body.rotation.x = -0.35 + Math.sin(t * 20) * 0.08;
  faceCamPet(dd, 2.6);
};
function faceCamPet(p, dist, side = 0.3) { const h = petHead(p).add(V(0, 0.2, 0)); cam(h.clone().add(V(side, 0.15, dist)), h, 40); }
// p12 So I trained Gary. Every single night.
S.c25_train = (t, d) => {
  setEnv('interior'); bedGary(t, 0.1);
  bedLeo(0, 0, LYAW, { armR: [1.7, 0.0], fistR: 1 }, 'determined');
  cam(BR(-2.6, 2.4, 4.6 - t * 0.3), BR(1.0, 1.3, -0.9), 46);
};
S.c26_night = (t, d) => { setEnv('night'); cam(V(-30 + t * 1.2, 26, 34), V(0, 0, -6), 50); };
// p13 Sit / stay / roll over
S.c27_sit = (t, d) => {
  setEnv('interior'); bedGary(t, 0.1);
  bedLeo(0, 0, LYAW, { armR: [0.9, 0.0], head: [0.25, 0, 0] }, 'serious');
  cam(BR(-0.9, 0.9, -2.6), BR(1.8, 1.9, -0.2), 50);
};
S.c28_sat = (t, d) => { setEnv('interior'); const g = GB(); bedGary(t * 0.3, 0.05); cam(g.clone().add(V(0.7, 0.65, 2.1 - t * 0.2)), g.clone().add(V(0, 0.45, 0)), 36); };
S.c29_stay = (t, d) => {
  setEnv('interior'); bedGary(t, 0.1);
  bedLeo(t * 0.7, t * 0.6, LYAW, { walk: 0.6, phase: -t * 6, armR: [1.5, 0.0], armL: [0.2, 0.1] }, 'serious');
  cam(BR(-0.9, 0.9, -2.6), BR(2.2, 1.7, 0.2), 54);
};
S.c30_stayed = (t, d) => { setEnv('interior'); const g = GB(); bedGary(0, 0); cam(g.clone().add(V(0.4, 0.6, 1.9 - t * 0.25)), g.clone().add(V(0, 0.45, 0)), 34); };
S.c31_roll = (t, d) => {
  setEnv('interior'); bedGary(t, 0.9);
  const L = bedLeo(0, 0.3, 0, { armL: [2.9, 0.1], armR: [2.9, 0.1] }, 'grin');
  L.root.rotation.set(0, 0, 0); L.root.position.y = 0.55; L.root.position.x += -Math.sin(t * 2) * 0.5; L.root.rotateZ(Math.PI / 2); L.root.rotateY(t * 7);
  cam(BR(-2.2, 2.2, 4.2), BR(1.0, 0.7, -0.6), 46);
};
S.c32_working = (t, d) => {
  setEnv('interior'); bedGary(t, 0.1);
  const L = bedLeo(-0.3, 0.2, 0, { armL: [2.9, 0.4], armR: [2.9, 0.4] }, 'bored');
  L.root.position.y = 0.35; L.root.rotation.set(-Math.PI / 2, 0, 0.3);
  cam(BR(0.4, 3.4, 2.4), BR(0.9, 0.3, -0.8), 50);
};
// p14 At the final, the judge said: show me your best trick.
function finalists(t, o = {}) {
  const W = C.world; lineup(t, o);
  const L = put(W.cast.leo, ST(0, 4.6).x, ST(0, 0).y, ST(0, 4.6).z, Math.PI, o.leoPose || {}, o.lexpr || 'determined');
  if (!o.noGary) gary(ST(0, 1.6).x, ST(0, 0).y, ST(0, 1.6).z, 0, t, 0.15);
  put(W.cast.ref, PL(5.6, 0, 14.6).x, PULL.y, PL(0, 0, 14.6).z, -1.0, o.refPose || { armR: [1.2, 0.1] }, o.rexpr || 'serious');
  return L;
}
S.c33_final = (t, d) => { setEnv('day'); finalists(t); crowd(t, 0.6, 0); const a = 0.9 + t * 0.05; cam(PL(Math.sin(a) * 16, 7.5, 10 + Math.cos(a) * 16), PL(0, 1.5, 10.5), 46); };
S.c34_judge = (t, d) => { setEnv('day'); const W = C.world; finalists(t, { refPose: { armR: [1.6, -0.2] }, rexpr: 'serious' }); crowd(t, 0.3, 0); faceCam(W.cast.ref, 2.6 - t * 0.2, { fov: 42, side: 0.4 }); };
// p15 I took the biggest breath of my life.
S.c35_breath = (t, d) => {
  setEnv('day'); const W = C.world; const k = smooth(clamp(t / d));
  const L = finalists(t, { lexpr: 'burp', leoPose: { lean: -0.15 * k, armL: [0.3, 0.3 + 0.3 * k], armR: [0.3, 0.3 + 0.3 * k] } }); crowd(t, 0.1, 0);
  L.torso.scale.set(1 + 0.12 * k, 1 + 0.05 * k, 1 + 0.15 * k);
  faceCam(L, 3.0 - k * 0.9, { fov: 40, dy: 0.1 });
};
// p16 HUSS!
S.c36_bighuss = (t, d) => {
  setEnv('day'); const W = C.world;
  const L = finalists(t, { lexpr: 'huss', leoPose: HUSSP, gexpr: 'shock', mexpr: 'shock', cexpr: 'shock', dexpr: 'shock', rexpr: 'shock' }); crowd(t, 1.5, 1);
  blast('B', mouthOf(L), Math.PI, t, 3.0, 3, 0.7); blast('B2', mouthOf(L), Math.PI, t - 0.3, 3.0, 3, 0.7);
  C.grade.uniforms.uFlash.value = Math.max(0, 0.7 - t * 2.5);
  cam(ST(2.8, 1.6).add(V(0, 2.3, 0)), ST(0, 4.6).add(V(0, 2.3, 0)), 56); shake(0.2 * Math.max(0.15, 1 - t * 1.2), t);
};
// p17 Every pet in the stadium flew into the mud. Gary didn't move one inch.
function blown(t, d, land = false) {
  const W = C.world;
  const items = [
    [W.cast.grandma, -2.4, -1.2], [W.cast.mailman, 2.4, -1.2], ['cat', -1.4, -0.4], ['dog', 1.3, -0.4],
    ['dog2', -3.6, 0.6], ['cat2', 3.6, 0.6], ['dog3', 0, -2.4],
  ];
  items.forEach(([o, x, z], i) => {
    const u = clamp((t + 0.15 - i * 0.04) / (d * 0.95));
    const p0 = ST(x, z), p1 = PL(x * 1.3, 0.25, -0.5 + (i % 3) * 1.2);
    const pos = V(lerp(p0.x, p1.x, u), lerp(p0.y, p1.y, u) + arc(u, 6 + i % 3), lerp(p0.z, p1.z, u));
    if (land) pos.set(p1.x, p1.y, p1.z);
    if (typeof o !== 'string') {
      put(o, pos.x, pos.y, pos.z, 0, land ? { armL: [3.0, 0.8], armR: [3.0, 0.8] } : { armL: [2.6, 0.9], armR: [2.6, 0.9], legL: -0.4, legR: 0.6 }, land ? 'sad' : 'shock');
      if (land) { fallFwd(o, -1.45); mudFace(o, true); } else o.root.rotation.x = -u * 4;
    } else if (o.startsWith('dog')) {
      const dd = dog(o === 'dog' ? 0 : o === 'dog2' ? 3 : 2, pos.x, pos.y, pos.z, 0, t * 3, { walk: land ? 0 : 1.5, expr: land ? 'dizzy' : 'shock' });
      if (!land) dd.rotation.x = -u * 5; else dd.rotation.z = 1.4;
    } else {
      const c = cat(o === 'cat' ? 0 : 1, pos.x, pos.y, pos.z, 0, land ? 'dizzy' : 'shock'); if (!land) c.rotation.x = -u * 6; else c.rotation.z = -1.4;
    }
  });
}
S.c37_fly = (t, d) => {
  setEnv('day'); const W = C.world; crowd(t, 1.6, 1); blown(t, d + 0.3);
  const L = put(W.cast.leo, ST(0, 4.6).x, ST(0, 0).y, ST(0, 4.6).z, Math.PI, HUSSP, 'huss'); blast('B', mouthOf(L), Math.PI, t + 0.5, 3.0, 3, 0.9);
  gary(ST(0, 1.6).x, ST(0, 0).y, ST(0, 1.6).z, 0, t, 0.2);
  cam(PL(15, 6.5, 12), PL(0, 3.5, 5), 54); shake(0.06, t);
};
S.c38_mud = (t, d) => {
  setEnv('day'); crowd(t, 1.8, 2); const W = C.world;
  if (t < 0.35) blown(t + d * 0.6, d * 0.95); else blown(0, d, true);
  burst('splash', PL(0, 0.2, 0.2), t - 0.35, { spread: 9, up: 7, size: 0.55 });
  cam(PL(9, 5.5, 11), PL(0, 0.8, 0.5), 48); if (t > 0.35) shake(0.06 * Math.max(0, 1 - (t - 0.35) * 3), t);
};
S.c39_gary_still = (t, d) => {
  setEnv('day'); crowd(t, 0.6, 1); blown(0, 1, true);
  gary(ST(0, 1.6).x, ST(0, 0).y, ST(0, 1.6).z, 0, t, t > d * 0.5 ? 0.6 : 0);
  const g = ST(0, 1.6);
  cam(g.clone().add(V(0.9, 0.55, 2.6 - t * 0.25)), g.clone().add(V(0, 0.45, -0.4)), 40);
};
// p18 Best behaved pet in town. Golden bone.
S.c40_judge_point = (t, d) => {
  setEnv('day'); const W = C.world; crowd(t, 0.8, 0); blown(0, 1, true);
  gary(ST(0, 1.6).x, ST(0, 0).y, ST(0, 1.6).z, 0, t, 0.2);
  const r = put(W.cast.ref, PL(3.4, 0, 13.4).x, PULL.y, PL(0, 0, 13.4).z, -2.3, { armR: [1.55, -0.1] }, t > 0.5 ? 'grin' : 'surprised');
  cam(ST(-0.6, 0.6).add(V(0, 1.4, 0)), PL(3.0, 2.2, 13.2), 50);
};
S.c41_award = (t, d) => {
  setEnv('day'); const W = C.world; crowd(t, 2.0, 0);
  const p = ST(0, 1.6); W.pedestal.visible = true; W.pedestal.position.set(p.x, p.y - 0.5, p.z);
  gary(p.x, p.y + 0.85, p.z, 0, t, 0.5);
  W.bone.visible = true; W.bone.scale.setScalar(0.7); W.bone.position.set(p.x, p.y + 0.75, p.z + 0.65); W.bone.rotation.set(0, 0, 0);
  const L = put(W.cast.leo, p.x + 1.8, ST(0, 0).y + Math.abs(Math.sin(t * 6)) * 0.6, p.z + 0.8, -0.3, { armL: [3.0, 0.4], armR: [3.0, 0.4] }, 'joy');
  confetti(p.clone().add(V(0, 0, 0)), t + 1);
  cam(p.clone().add(V(0.8, 2.0, 7.6 - t * 0.5)), p.clone().add(V(0.5, 1.6, 0)), 46);
};
// p19 Now everybody in this town has a rock.
function townRocks(t, n = 6) {
  const W = C.world, tc = W.cast.town;
  [[-14, -5.2, 1], [-4, -5.4, 1], [6, -5.2, 1], [12, 5.2, -1], [2, 5.4, -1], [-8, 5.2, -1]].slice(0, n).forEach(([x0, z, dir], i) => {
    const r = walker(tc[i], null, i, x0 + dir * t * 1.2, z, dir, t, 'rock', i);
    r.position.y = 0.25;
  });
}
S.c42_town_rocks = (t, d) => {
  setEnv('day'); townRocks(t);
  dog(1, -1, 0.25, -2, 0.5, t, { expr: 'shock' }); dog(2, 2.5, 0.25, -1.6, -0.6, t, { expr: 'sad' });
  cam(V(4 - t * 0.5, 7, 4), V(-4, 0.5, -5), 52);
};
S.c43_grandma_rock = (t, d) => {
  setEnv('day'); const W = C.world;
  const g = put(W.cast.grandma, GRANNY.x - 0.4, GRANNY.y, GRANNY.z, 0.15, { armL: [0.75, 0.3], armR: [0.75, 0.3] }, 'joy'); holdRock(g, W.rocks[0], 0.3, -0.5);
  cat(0, GRANNY.x + 1.2, GRANNY.y, GRANNY.z + 1.0, -0.6, 'sad');
  cam(V(GRANNY.x + 1.0, 1.8, GRANNY.z + 5.2 - t * 0.3), V(GRANNY.x + 0.4, 1.7, GRANNY.z), 44);
};
// p20 HUSS x6 finale: the whole town (and its rocks) husses
function finale(t, T) {
  const W = C.world, s = sinceHit(C.ev.h6b, T);
  const L = put(W.cast.leo, 0, 0.25, WALK_Z + 1.5, 0, {}); hussOn(L, 'L', s, 1.3);
  gary(0.9, 0.25, WALK_Z + 2.6, 0, t, 0.6);
  const crew = [W.cast.grandma, W.cast.mailman, W.cast.ref, W.cast.town[0], W.cast.town[1], W.cast.town[2], W.cast.town[3]];
  crew.forEach((c, i) => {
    const x = (i % 2 ? 1 : -1) * (1.9 + Math.floor(i / 2) * 1.8), z = WALK_Z + 0.5 - Math.floor(i / 2) * 0.7;
    put(c, x, 0.25, z, -x * 0.05, {}); hussOn(c, i < 3 ? 'f' + i : null, s, 0.9);
    rock(i, x + 0.7, 0.25, z + 1.1, 0, t);
  });
  const dd = dog(0, -1.2, 0.25, WALK_Z + 2.7, 0.2, t); petHuss(dd, 'fd', s, 0.5);
  const c = cat(0, 2.2, 0.25, WALK_Z + 2.9, -0.2); petHuss(c, 'fc', s, 0.4);
  return s;
}
S.c44_end1 = (t, d) => { setEnv('day'); const s = finale(t, C.cut.start + t); cam(V(0, 2.2, WALK_Z + 10 - t * 0.6), V(0, 2.2, WALK_Z), 54); shake(0.05 * Math.max(0, 1 - s * 4), t); };
S.c45_end2 = (t, d) => { setEnv('day'); const s = finale(t, C.cut.start + t); cam(V(5.5, 1.0, WALK_Z + 7.5), V(-0.5, 2.6, WALK_Z), 56); shake(0.05 * Math.max(0, 1 - s * 4), t); };
S.c46_end3 = (t, d) => {
  setEnv('day'); const s = finale(t, C.cut.start + t);
  const g = V(0.9, 0.25, WALK_Z + 2.6);
  cam(g.clone().add(V(0.2, 0.6 + t * 1.2, 2.6 + t * 2.2)), g.clone().add(V(0, 0.6 + t * 0.6, 0)), 44); shake(0.05 * Math.max(0, 1 - s * 4), t);
  C.grade.uniforms.uFade.value = sstep(d - 0.7, d, t);
};

// ---------------------------------------------------------------- driver
export function setup(ctx) {
  C = ctx;
  ctx.cuts = ctx.tl.cuts;
  ctx.world.setScore('PET SHOW');
}
const INTERIOR = /c09_|c12_|c13_|c14_|c25_|c27_|c28_|c29_|c30_|c31_|c32_/;
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
