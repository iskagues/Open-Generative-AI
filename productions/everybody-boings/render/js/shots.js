// Shot list. Every cut starts on a narration word (timeline.json -> cuts).
// Each shot is a pure function of local time t (s since cut) and duration d.
import * as THREE from 'three';
import { clamp, lerp, inv, smooth, ease, easeOut, easeIn, sstep, keys, rng, noise1, backOut } from './util.js';
import { SETS, GLASS, LAMPGLOW } from './world.js';

let C; // ctx
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const RACE = SETS.race;
const R3 = (x, y, z) => V(RACE.x + x, RACE.y + y, RACE.z + z);
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
  for (const k of ['milo', 'zoe', 'doctor', 'grandma', 'mailman', 'ref']) W.cast[k].root.visible = false;
  for (const a of ['mates', 'rivals', 'town', 'party']) W.cast[a].forEach((c) => (c.root.visible = false));
  for (const p of ['cat', 'bird', 'plane', 'refHat']) { W[p].visible = false; W[p].rotation.set(0, 0, 0); W[p].scale.setScalar(1); }
  W.springs.forEach((s) => (s.visible = false));
  W.nearClouds.visible = false;
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
    W.partyLights.forEach((m) => (m.emissiveIntensity = 2.5)); fill.intensity = 0.6; s.environmentIntensity = 0.15;
  } else if (mode === 'dusk') {
    u.uTop.value.set('#3b4fb0'); u.uHor.value.set('#ff9f7a'); u.uBot.value.set('#ffc6a0'); u.uStars.value = 0.25;
    hemi.color.set('#ffc9b0'); hemi.groundColor.set('#5a4a6a'); hemi.intensity = 1.0;
    sun.color.set('#ffb07a'); sun.intensity = 1.5; s.fog.color.set('#e8a890'); s.fog.near = 120; s.fog.far = 480;
    GLASS.emissiveIntensity = 0.7; GLASS.color.set('#7a8fb0'); LAMPGLOW.emissiveIntensity = 1.5;
    W.partyLights.forEach((m) => (m.emissiveIntensity = 1.6)); fill.intensity = 0.4; s.environmentIntensity = 0.3;
  } else {
    u.uTop.value.set('#4fa3f7'); u.uHor.value.set('#bfe4ff'); u.uBot.value.set('#d8efff'); u.uStars.value = 0;
    hemi.color.set('#e3f2ff'); hemi.groundColor.set('#9cc77a'); hemi.intensity = mode === 'interior' ? 1.6 : 1.45;
    sun.color.set('#fff3df'); sun.intensity = mode === 'interior' ? 1.2 : 2.3; s.fog.color.set('#cfe9ff'); s.fog.near = 140; s.fog.far = 520;
    GLASS.emissiveIntensity = 0; GLASS.color.set('#bfe6ff'); LAMPGLOW.emissiveIntensity = 0;
    W.partyLights.forEach((m) => (m.emissiveIntensity = 0)); fill.intensity = mode === 'interior' ? 0.9 : 0.25; s.environmentIntensity = 0.35;
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
    if (name === 'ring' || name === 'burp') {
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

// ---------------------------------------------------------------- town coordinates
const MILO_HOUSE = V(0, 0, -14), ZOE_HOUSE = V(13, 0, -14);
const WALK_Z = -5.2; // north sidewalk
const MAILBOX = V(2, 0.25, -6.8);

// ---------------------------------------------------------------- shots
const S = {};
// p01 aerial: whole town boinging
S.c01_aerial = (t, d) => {
  setEnv('day');
  const R = rng(3);
  C.world.cast.town.forEach((c, i) => {
    const x = -30 + (i % 7) * 10 + R() * 3, z = i < 7 ? -5 : 5.5;
    hop(c, V(x, 0.25, z), t, 1.1 + R() * 0.4, 7 + R() * 6, R() * 2, R() * 6.28, 'joy');
  });
  hop(C.world.cast.grandma, V(8, 0.25, 9), t, 1.3, 8, 0.4, 3.2, 'joy');
  hop(C.world.cast.mailman, V(-14, 0.25, 6), t, 1.2, 6, 0.8, 1.5, 'grin');
  const a = 0.6 + t * 0.05;
  cam(V(Math.sin(a) * 46, 38 - t * 1.5, 30 + Math.cos(a) * 8), V(-2, 2, -2), 52);
};
S.c02_street = (t, d) => {
  setEnv('day');
  // neighbours boinging over their fences
  const W = C.world;
  hop(W.cast.town[0], V(-13, 0.25, -7.6), t, 1.0, 5, 0.2, 0, 'joy');
  hop(W.cast.town[1], V(-26, 0.25, -7.6), t, 1.0, 6, 0.65, 0.3, 'grin');
  hop(W.cast.grandma, V(-6, 0.25, -5), t, 1.2, 5, 0.1, 1.2, 'joy');
  hop(W.cast.town[2], V(-19, 0.25, -3), t, 0.9, 7, 0.4, -1, 'grin');
  hop(W.cast.town[3], V(-9, 0.25, 6), t, 1.1, 6, 0.9, 2.6, 'joy');
  hop(W.cast.town[4], V(-30, 0.25, 6), t, 1.0, 8, 0.3, 2, 'smile');
  cam(V(2 - t * 0.6, 2.2, 3), V(-18, 4.5, -4), 50);
};
// p02 Except me: Milo flat on the sidewalk, everyone bouncing behind
S.c03_milo_flat = (t, d) => {
  setEnv('day');
  const W = C.world;
  put(W.cast.milo, 0, 0.25, WALK_Z, 0.15, { armL: [0, 0.05], armR: [0, 0.05] }, 'bored');
  hop(W.cast.town[5], V(-4, 0.25, -1.5), t, 1.0, 6, 0.1, 0.8, 'joy');
  hop(W.cast.town[6], V(4.5, 0.25, -2.5), t, 1.2, 7, 0.6, -0.8, 'grin');
  hop(W.cast.town[7], V(-7, 0.25, -9), t, 1.0, 5, 0.3, 0, 'joy');
  hop(W.cast.town[8], V(6, 0.25, -9.5), t, 1.1, 8, 0.8, 0, 'smile');
  const mc = W.cast.milo.root.position;
  cam(V(mc.x + 0.4, 2.4, mc.z + 5.2 - t * 0.25), V(mc.x, 2.0, mc.z), 46);
};
// p03 I used to boing the highest: flashback - Milo way above the roofs
S.c04_milo_high = (t, d) => {
  setEnv('day');
  const W = C.world, u = clamp(t / d);
  const y = arc(clamp(0.25 + u * 0.5), 15);
  put(W.cast.milo, -6, 0.25 + y, -4, 0.4, AIR, 'joy');
  townLife(t, V(-12, 0, -8), 3, 10, { h: 3, seed: 4 });
  cam(V(4, 1.4, 5.5), V(-6, 0.25 + y * 0.6 + 1, -5), 62);
};
// p04 over the fence
S.c05_fence = (t, d) => {
  setEnv('day');
  const W = C.world, u = clamp(t / Math.min(d, 1.1));
  const x = lerp(-3.4 - 3, -3.4 + 3, u); const y = arc(u, 3.2);
  put(W.cast.milo, x, 0.25 + y, -7.6, Math.PI / 2, u > 0.1 && u < 0.9 ? { armL: [2.4, 0.4], armR: [2.4, 0.4], legL: -1.1, legR: 0.9, lean: 0.2 } : { walk: 1, phase: t * 12 }, 'grin');
  cam(V(-3.4, 2.2, 2.0), V(-3.4, 2.6 + y * 0.4, -7.6), 54);
};
S.c06_mailman = (t, d) => {
  setEnv('day');
  const W = C.world, u = clamp(t / Math.min(d, 1.0));
  put(W.cast.mailman, 6, 0.25, WALK_Z, -Math.PI / 2, { walk: u < 0.3 ? 0.6 : 0, phase: t * 8, head: [-0.5 * sstep(0.3, 0.6, u), 0, 0], armL: [0.4, 0.3], armR: [0.4, 0.3] }, u > 0.3 ? 'shock' : 'neutral');
  const x = lerp(10, 2, u), y = arc(u, 4.6);
  put(W.cast.milo, x, 0.25 + y, WALK_Z, -Math.PI / 2, AIR, 'joy');
  cam(V(4.5, 1.0, WALK_Z + 10), V(6, 3.4, WALK_Z), 56);
};
S.c07_morning = (t, d) => {
  setEnv('day');
  const W = C.world;
  const x = -20 + t * 7, ph = t / 0.9;
  hop(W.cast.milo, V(x, 0.25, WALK_Z + 2), t, 0.9, 7, 0, Math.PI / 2, 'joy');
  townLife(t, V(x, 0, 0), 5, 26, { h: 3, seed: 7 });
  cam(V(x - 7, 3.5, WALK_Z + 13), V(x, 4.5, WALK_Z + 2), 52);
};
// p05 my boing was gone: Milo pushes, nothing happens
S.c08_try = (t, d) => {
  setEnv('day');
  const W = C.world;
  const k = 0.5 + 0.5 * Math.sin(t * 9);
  put(W.cast.milo, 0, 0.25, WALK_Z, 0.2, CROUCH(0.35 + 0.65 * k), 'strain');
  W.cast.milo.setExpr('strain', { red: 0.15 });
  shake(0.03, t);
  cam(V(2.4, 1.3, WALK_Z + 5.4), V(0, 1.4, WALK_Z), 46);
};
S.c09_gone_face = (t, d) => {
  setEnv('day');
  const W = C.world;
  put(W.cast.milo, 0, 0.25, WALK_Z, 0.2, { head: [-0.25, 0, 0] }, 'shock');
  faceCam(W.cast.milo, 3.0 - t * 0.3, { dy: 0.4, lookDy: -0.35, fov: 42 });
};
// p06 doctor
const DOC = SETS.doctor;
function doctorScene(t, hammerHit = -1) {
  const W = C.world;
  put(W.cast.milo, DOC.x - 1.0, DOC.y + 0.15, DOC.z - 2.4, 0, { bob: 0.05, legL: -1.4, legR: -1.4, armL: [0.2, 0.15], armR: [0.2, 0.15] });
  W.cast.milo.root.position.y = DOC.y + 0.95 - 1.0 + 0.15;
  put(W.cast.doctor, DOC.x + 1.2, DOC.y, DOC.z + 0.4, -0.7, { armR: [1.2, 0.1], armL: [0.4, 0.1], head: [0.35, 0, 0] }, 'serious');
}
S.c10_doctor_wide = (t, d) => {
  setEnv('interior');
  doctorScene(t);
  C.world.cast.milo.setExpr('neutral');
  const W = C.world; W.hammer.visible = true; W.hammer.position.set(1.95, 1.9, 0.9 + 0.4);
  cam(V(DOC.x - 4.6, DOC.y + 2.4, DOC.z + 4.4), V(DOC.x + 0.2, DOC.y + 1.6, DOC.z - 1.2), 52);
};
S.c11_knee = (t, d) => {
  setEnv('interior');
  doctorScene(t);
  const W = C.world, ch = W.cast.milo;
  ch.setExpr('neutral');
  // knee is at roughly hips + forward
  const knee = V(DOC.x - 1.0 + 0.25, DOC.y + 1.15, DOC.z - 2.4 + 0.86);
  const hit = 0.25, sw = t < hit ? sstep(0, hit, t) : 1 - sstep(hit, hit + 0.25, t) * 0.6;
  W.hammer.position.set(knee.x + 0.15 - DOC.x, knee.y + 0.55 - 0.5 * sw - DOC.y, knee.z + 0.35 - DOC.z); W.hammer.rotation.set(0, 0, 1.2 - 1.0 * sw);
  ring('ring', knee.clone().add(V(0, 0.1, 0.3)), t - hit, 0.35, 0.8, false);
  cam(V(DOC.x - 1.0, DOC.y + 2.2, DOC.z + 1.6), knee.clone().add(V(0.2, 0.1, 0)), 46);
};
S.c12_nothing = (t, d) => {
  setEnv('interior');
  doctorScene(t);
  C.world.cast.milo.setExpr('bored');
  faceCam(C.world.cast.milo, 2.4, { dy: 0, fov: 40, side: 0.2 });
};
// p07 too much boinging
S.c13_doctor_serious = (t, d) => {
  setEnv('interior');
  doctorScene(t);
  const W = C.world; const dc = W.cast.doctor; dc.root.rotation.y = -2.3; dc.pose({ armL: [1.4, 0.0], armR: [0.3, 0.1], head: [0.1, 0, 0] }); dc.setExpr('serious');
  faceCam(dc, 2.8, { dy: 0.3, side: -0.4, fov: 42, lookDy: -0.2 });
};
S.c14_milo_shock = (t, d) => {
  setEnv('interior');
  doctorScene(t);
  C.world.cast.milo.setExpr('shock');
  faceCam(C.world.cast.milo, 2.9 - t * 0.4, { dy: 0.1, fov: 42, lookDy: -0.2 });
};
S.c15_clip = (t, d) => {
  setEnv('interior');
  doctorScene(t);
  const W = C.world; W.clip.visible = true;
  const p = V(DOC.x + 1.5, DOC.y + 2.1, DOC.z + 1.4); W.clip.position.copy(p).sub(DOC); W.clip.rotation.set(-0.1, 0.3, 0.05);
  cam(p.clone().add(V(0.4, 0.1, 1.4 - t * 0.2)), p, 38);
};
// p08 Sky Race poster / determined
const BED = SETS.bedroom;
S.c16_poster = (t, d) => {
  setEnv('interior');
  const p = V(BED.x - 1.2, BED.y + 2.3, BED.z - 4.88);
  cam(p.clone().add(V(0.2, -0.2, 4.6 - t * 0.6)), p, 44);
};
S.c17_determined = (t, d) => {
  setEnv('interior');
  const W = C.world;
  put(W.cast.milo, BED.x + 0.5, BED.y, BED.z - 0.5, -0.4, { armR: [0.2, 0.2], armL: [0.2, 0.2], fist: 1, lean: -0.05 }, 'determined');
  const h = headOf(W.cast.milo);
  cam(h.clone().add(V(-1.6, -1.6, 3.0)), h.clone().add(V(0, -0.3, 0)), 50);
};
// p09 sodas + burp
const KIT = SETS.kitchen;
S.c18_cans = (t, d) => {
  setEnv('interior');
  const W = C.world;
  put(W.cast.milo, KIT.x, KIT.y, KIT.z + 2.4, Math.PI, { armR: [2.2, 0.1], head: [-0.5, 0, 0], armL: [0.6, 0.2] }, 'calm');
  const ch = W.cast.milo;
  W.cans.forEach((c, i) => { c.rotation.set(0, 0, 0); c.visible = true; });
  // he drinks the last one
  cam(V(KIT.x + 1.6, KIT.y + 2.6, KIT.z - 2.4), V(KIT.x, KIT.y + 1.8, KIT.z + 0.4), 50);
};
S.c19_burp = (t, d) => {
  setEnv('interior');
  const W = C.world;
  put(W.cast.milo, KIT.x, KIT.y, KIT.z + 2.4, Math.PI, { armL: [0.2, 0.2], armR: [0.2, 0.2], head: [0.05, 0, 0] }, 'burp');
  const h = headOf(W.cast.milo);
  const mouth = h.clone().add(V(0, -0.25, -0.5));
  ring('burp', mouth, t - 0.15, 0.6, 1.6, false); if (W.fxm && W.fxm.burp) W.fxm.burp.rotation.set(0, 0, 0);
  faceCam(W.cast.milo, 3.0, { dy: 0.0, fov: 44, lookDy: -0.25 });
  shake(0.02 * (t < 0.4 ? 1 : 0), t);
};
// p10 springs + ceiling
S.c20_springs = (t, d) => {
  setEnv('interior');
  const W = C.world;
  const y = arc(((t % 0.6) / 0.6), 0.6);
  put(W.cast.milo, BED.x + 1, BED.y + y + 0.6, BED.z - 1, 0.3, { armL: [0.6, 0.4], armR: [0.6, 0.4] }, 'grin');
  W.springs.forEach((s) => (s.visible = true));
  const f = V(BED.x + 1, BED.y + 0.6 + y, BED.z - 1);
  cam(f.clone().add(V(1.2, 0.0, 2.6)), f.clone().add(V(0, 0.1, 0)), 40);
};
S.c21_ceiling = (t, d) => {
  setEnv('interior');
  const W = C.world;
  // head + torso inside the ceiling, legs dangling and kicking
  put(W.cast.milo, BED.x + 1, BED.y + 3.0, BED.z - 1, 0.3, { legL: Math.sin(t * 9) * 0.5, legR: -Math.sin(t * 9) * 0.5, armL: [3.0, 0.2], armR: [3.0, 0.2] }, 'shock');
  W.springs.forEach((s) => (s.visible = true));
  W.cat.visible = true; W.cat.position.set(BED.x - 1.2 - 400 + 400, BED.y, BED.z + 0.6); W.cat.rotation.y = 0.9;
  W.cat.position.set(BED.x - 1.4, BED.y, BED.z + 0.4);
  cam(V(BED.x + 1.6, BED.y + 1.2, BED.z + 2.8), V(BED.x + 1, BED.y + 3.2, BED.z - 1), 62);
};
// p11 trampoline
const TRAMP = V(-2, 0, -26);
S.c22_tramp = (t, d) => {
  setEnv('day');
  const W = C.world;
  const u = (t % 0.8) / 0.8, y = arc(u, 2.2);
  put(W.cast.milo, TRAMP.x, 0.95 + y, TRAMP.z, 0.6, y > 0.2 ? AIR : CROUCH(0.4), 'grin');
  put(W.cast.grandma, TRAMP.x + 3.4, 0, TRAMP.z + 2.6, -0.9, { armL: [1.2, 0.5], armR: [1.2, 0.5] }, 'joy');
  W.tramp.userData.pad.position.y = 0.95 - (y < 0.2 ? 0.25 : 0);
  cam(V(TRAMP.x + 6, 2.6, TRAMP.z + 8), V(TRAMP.x, 2.4, TRAMP.z), 50);
};
S.c23_launch = (t, d) => {
  setEnv('day');
  const W = C.world, u = clamp(t / d);
  const z = lerp(TRAMP.z, MAILBOX.z, u), y = 0.95 + arc(u, 14);
  put(W.cast.milo, lerp(TRAMP.x, MAILBOX.x, u), y, z, 0, { armL: [2.6, 0.9], armR: [2.6, 0.9], legL: -0.3, legR: 0.3, lean: 0.8 }, 'shock');
  W.cast.milo.root.rotation.x = u * 3.0;
  cam(V(9, 4, -12), V(lerp(TRAMP.x, MAILBOX.x, u), y, z), 58);
};
S.c24_mailbox = (t, d) => {
  setEnv('day');
  const W = C.world, mb = W.miloMailbox;
  mb.rotation.z = Math.sin(t * 30) * 0.06 * Math.exp(-t * 3);
  // legs only: place Milo upside down with upper body inside the box
  const ch = put(W.cast.milo, MAILBOX.x, 0.25 + 1.76 + 1.0, MAILBOX.z + 0.1, 0, { legL: Math.sin(t * 10) * 0.45, legR: -Math.sin(t * 10) * 0.45 }, 'shock');
  ch.root.rotation.set(Math.PI, 0, 0);
  ch.torso.visible = false;
  cam(V(MAILBOX.x + 3.2, 2.2, MAILBOX.z + 4.2), V(MAILBOX.x, 2.6, MAILBOX.z), 46);
};
// p12 cat
S.c25_cat = (t, d) => {
  setEnv('day');
  const W = C.world, u = clamp(t / Math.min(d, 1.0));
  const roof = W.miloHouse.userData.h;
  W.cat.visible = true;
  const y = u < 1 ? lerp(0.25, roof + 0.2, easeOut(u)) + arc(u, 3) : roof + 0.2;
  W.cat.position.set(-3.5, y, lerp(-7.0, -10.6, u)); W.cat.rotation.set(-0.3 * Math.sin(u * Math.PI), Math.PI, 0); W.cat.scale.setScalar(1.6);
  cam(V(-2.0, 2.4, -1.5), V(-3.5, 4.4, -9.5), 54);
};
S.c26_milo_sad = (t, d) => {
  setEnv('day');
  const W = C.world;
  put(W.cast.milo, -1.5, 0.25, -5.4, 0.25, { head: [0.1, 0, 0], armL: [0.1, 0.05], armR: [0.1, 0.05] }, 'sad');
  W.cat.visible = true; W.cat.position.set(-3.5, W.miloHouse.userData.h + 0.2, -10.4); W.cat.rotation.set(0, 0.4, 0);
  const h = headOf(W.cast.milo);
  W.cat.scale.setScalar(1.3); cam(V(-0.2, 1.6, 0.6), V(-2.4, 3.6, -8), 52);
};
// p13-14 Zoe on her roof (dusk)
const ZROOF = () => C.world.zoeHouse.userData.roofY;
function zoeRoof(t, expr, pose) {
  const W = C.world;
  put(W.cast.zoe, ZOE_HOUSE.x, ZROOF(), ZOE_HOUSE.z + 2.6, -0.5, pose, expr);
  W.cast.party.forEach((c, i) => hop(c, V(ZOE_HOUSE.x - 3 + i * 1.6, ZROOF(), ZOE_HOUSE.z - 1.5 + (i % 2) * 1.2), t, 0.9, 1.6, i * 0.3, 0.3 * i, ['joy', 'laugh', 'grin'][i % 3]));
}
S.c27_zoe_roof = (t, d) => {
  setEnv('dusk');
  zoeRoof(t, 'yell', { armL: [2.0, -0.4], armR: [2.0, -0.4], head: [-0.1, 0, 0] });
  put(C.world.cast.milo, 3, 0.25, -6.0, 2.5, { head: [-0.6, 0, 0] }, 'neutral');
  cam(V(4.5, 1.3, -1.0), V(12, ZROOF() + 2.0, -12), 50);
};
S.c28_zoe_close = (t, d) => {
  setEnv('dusk');
  zoeRoof(t, 'joy', { armL: [2.6, 0.5], armR: [2.6, 0.5], bob: Math.abs(Math.sin(t * 7)) * 0.15 });
  faceCam(C.world.cast.zoe, 3.4, { dy: -0.4, side: 0.6, fov: 46, lookDy: -0.3 });
};
S.c29_zoe_smug = (t, d) => {
  setEnv('dusk');
  zoeRoof(t, 'smug', { armL: [0.2, 0.1], armR: [1.6, -0.6], head: [0.15, 0, -0.12] });
  faceCam(C.world.cast.zoe, 2.6, { dy: -0.6, side: 0.3, fov: 42, lookDy: -0.1 });
};
// p15 shut the window
S.c30_window = (t, d) => {
  setEnv('dusk');
  const W = C.world, u = sstep(0.15, 0.5, t);
  put(W.cast.milo, BED.x + 2.6, BED.y, BED.z - 3.3, Math.PI - 0.35, { armL: [2.0 - u * 0.6, 0.2], armR: [2.0 - u * 0.6, 0.2] }, 'angry');
  W.sash.position.y = lerp(3.9, 2.6, u) - 0;
  W.sash.position.set(2.6, lerp(3.9, 1.95, u), -4.7);
  shake(u > 0.95 && t < 0.7 ? 0.03 : 0, t);
  cam(V(BED.x + 5.4, BED.y + 2.6, BED.z - 4.55), V(BED.x + 2.5, BED.y + 2.5, BED.z - 3.4), 60);
};
// p16 roof party (night) / garage
S.c31_roofparty = (t, d) => {
  setEnv('night');
  zoeRoof(t, 'laugh', { armL: [2.8, 0.4], armR: [2.8, 0.4], bob: Math.abs(Math.sin(t * 8)) * 0.3 });
  townLife(t, V(30, 0, -14), 6, 20, { h: 2.5, seed: 12, groundZ: -14 });
  C.world.cast.town.slice(0, 6).forEach((c) => (c.root.position.y += 7.8));
  cam(V(-6, 9, 8), V(16, 6, -14), 48);
};
const GAR = SETS.garage;
function garageMilo(t, rate = 2.2, expr = 'determined') {
  const k = 0.5 - 0.5 * Math.cos(t * rate * Math.PI * 2);
  put(C.world.cast.milo, GAR.x, GAR.y, GAR.z, 0.3, Object.assign(CROUCH(k), { armL: [1.5, 0.1], armR: [1.5, 0.1] }), expr);
  return k;
}
S.c32_garage = (t, d) => {
  setEnv('garage');
  garageMilo(t, 0.6);
  cam(V(GAR.x - 3, GAR.y + 3.2, GAR.z + 6), V(GAR.x, GAR.y + 1.6, GAR.z), 50);
};
S.c33_squat_close = (t, d) => {
  setEnv('garage');
  garageMilo(t, 1.3);
  cam(V(GAR.x + 2.0, GAR.y + 0.9, GAR.z + 2.6), V(GAR.x, GAR.y + 1.0, GAR.z), 44);
};
S.c34_squat_wide = (t, d) => {
  setEnv('garage');
  garageMilo(t, 1.5, 'strain');
  C.world.cast.milo.setExpr('strain', { red: 0.1 });
  faceCam(C.world.cast.milo, 2.6, { dy: 0.3, side: -0.5, fov: 44 });
};
S.c35_moon = (t, d) => {
  setEnv('night');
  townLife(t, V(0, 0, 0), 0);
  cam(V(-4 + t * 0.4, 1.6, 8), V(0, 9, -20), 54);
};
// p18 mailman finished his route
S.c36_mailman_walk = (t, d) => {
  setEnv('day');
  const W = C.world;
  put(W.cast.mailman, -10 + t * 2.4, 0.25, WALK_Z, Math.PI / 2, { walk: 1, phase: t * 9 }, 'smile');
  cam(V(-4 + t * 2.4, 2.0, WALK_Z + 6), V(-10 + t * 2.4 + 1, 2.0, WALK_Z), 46);
};
S.c37_mailman_happy = (t, d) => {
  setEnv('day');
  const W = C.world;
  const up = sstep(0.1, 0.4, t);
  put(W.cast.mailman, 30, 0.25, WALK_Z, 0.2, { armL: [2.8 * up, 0.5], armR: [2.8 * up, 0.5], bob: Math.abs(Math.sin(t * 6)) * 0.1 * up }, 'joy');
  faceCam(W.cast.mailman, 4.2, { dy: -0.4, fov: 46, lookDy: -0.5 });
};
// p19 the race venue
S.c38_venue = (t, d) => {
  setEnv('day');
  C.world.updateCrowd(t, 0.8);
  C.world.setScore('0:30', 2, 3);
  cam(R3(36 - t * 2, 34, 46), R3(0, 0, -14), 50);
};
// p20 rivals boing so high
function rivalsAt(t, base, h = 9, expr = 'joy') {
  C.world.cast.rivals.forEach((c, i) => hop(c, R3(base.x + (i - 2) * 1.8, base.y, base.z + (i % 2) * 1.2), t, 1.2, h, i * 0.17, Math.PI, expr));
}
S.c39_rivals_jump = (t, d) => {
  setEnv('day');
  C.world.updateCrowd(t, 1);
  rivalsAt(t, V(4.5, 0.12, 6), 14);
  cam(R3(-2, 0.6, 12), R3(4.5, 7, 4), 60);
};
S.c40_airplane = (t, d) => {
  setEnv('day');
  const W = C.world;
  const alt = 120;
  put(W.cast.rivals[1], RACE.x + 2, RACE.y + alt, RACE.z - 6, -Math.PI / 2, { armR: [3.0, 0.3 + Math.sin(t * 14) * 0.3], armL: [2.0, 0.6], legL: -0.6, legR: 0.4 }, 'joy');
  W.plane.visible = true; W.plane.position.set(RACE.x - 14 + t * 9, RACE.y + alt + 3.5, RACE.z - 16); W.plane.rotation.set(0, 0, 0);
  W.nearClouds.visible = true; W.nearClouds.position.set(RACE.x, RACE.y + alt - 14, RACE.z);
  cam(V(RACE.x + 8, RACE.y + alt + 1.5, RACE.z + 8), V(RACE.x - 2, RACE.y + alt + 1.0, RACE.z - 8), 56);
};
// p21 BOING BOING BOING chant
S.c41_chant = (t, d) => {
  setEnv('day');
  C.world.updateCrowd(t, 1.3);
  const W = C.world;
  W.cast.rivals.forEach((c, i) => hop(c, R3((i - 2) * 2.0, 0.12, -24 - (i % 2)), t, 0.48, 2.6, 0, 0, 'yell'));
  cam(R3(0.5, 0.8, -15.5), R3(0, 2.6, -24), 56);
};
// p22 10 seconds left / gap / worried
S.c42_score10 = (t, d) => {
  setEnv('day');
  C.world.setScore('0:10', 2, 3); C.world.updateCrowd(t, 0.6);
  const sb = C.world.scorePivot; sb.rotation.set(0, -0.35, 0);
  const p = R3(18, 12.5, -38);
  cam(p.clone().add(V(-7, -3, 19 - t)), p.clone().add(V(0, -0.5, 0)), 44);
};
function miloEdge(expr, pose = {}) {
  put(C.world.cast.milo, RACE.x, RACE.y + 0.12, RACE.z + 2.4, Math.PI, pose, expr);
  C.world.cast.mates.forEach((c, i) => put(c, RACE.x + (i - 1) * 2.6, RACE.y + 0.12, RACE.z + 7 + (i % 2), Math.PI, { armL: [0.8, 0.3], armR: [0.8, 0.3] }, 'worried'));
}
S.c43_gap = (t, d) => {
  setEnv('day');
  C.world.updateCrowd(t, 0.6);
  miloEdge('worried');
  cam(R3(1.6, 3.0, 6.5 - t * 0.4), R3(0, -6, -13), 58);
};
S.c44_worried = (t, d) => {
  setEnv('day');
  C.world.updateCrowd(t, 0.6);
  miloEdge('worried', { head: [0.1, 0, 0] });
  C.world.cast.rivals.forEach((c, i) => put(c, RACE.x + (i - 2) * 2, RACE.y + 0.12, RACE.z - 25, 0, {}, 'smug'));
  faceCam(C.world.cast.milo, 2.4, { dy: 0.2, fov: 40 });
};
// p23 bent knees, pushed
S.c45_knees = (t, d) => {
  setEnv('day');
  C.world.updateCrowd(t, 0.5);
  miloEdge('determined', CROUCH(sstep(0, 0.5, t)));
  cam(R3(1.4, 0.7, 0.4), R3(0, 1.0, 2.4), 50);
};
S.c46_push = (t, d) => {
  setEnv('day');
  C.world.updateCrowd(t, 0.5);
  miloEdge('strain', CROUCH(1));
  C.world.cast.milo.setExpr('strain', { red: 0.2 });
  shake(0.04, t);
  cam(R3(-3, 1.6, -2.2), R3(0, 1.6, 2.4), 48);
};
S.c47_strain = (t, d) => {
  setEnv('day');
  C.world.updateCrowd(t, 0.4);
  const k = 0.5 + 0.5 * Math.sin(t * 10);
  miloEdge('strain', Object.assign(CROUCH(0.7 + 0.3 * k), { bob: -0.25 + 0.12 * Math.max(0, Math.sin(t * 5.5)) }));
  C.world.cast.milo.setExpr('strain', { red: clamp(0.2 + t * 0.12, 0, 0.6) });
  faceCam(C.world.cast.milo, 2.4 - t * 0.12, { dy: -0.1, fov: 42 });
  shake(0.05, t);
};
// p25 rivals laughing
S.c48_laugh = (t, d) => {
  setEnv('day');
  C.world.updateCrowd(t, 0.7, 0);
  C.world.cast.rivals.forEach((c, i) => put(c, RACE.x + (i - 2) * 1.9, RACE.y + 0.12, RACE.z - 24 - (i % 2) * 0.8, 0.12 * (i - 2), { armR: [1.6, -0.2], armL: [0.6, 0.6], lean: -0.15 + Math.sin(t * 14 + i) * 0.08, bob: Math.abs(Math.sin(t * 12 + i)) * 0.08 }, 'laugh'));
  cam(R3(0, 2.6, -13), R3(0, 2.2, -24), 46);
};
// p26 five seconds / calm
S.c49_score5 = (t, d) => {
  setEnv('day');
  C.world.setScore('0:05', 2, 3); C.world.updateCrowd(t, 0.5);
  const p = R3(18, 12.5, -38);
  cam(p.clone().add(V(-6, -2.4, 16 - t * 1.2)), p.clone().add(V(0, -0.5, 0)), 44);
};
S.c50_calm = (t, d) => {
  setEnv('day');
  C.world.updateCrowd(t, 0.3);
  miloEdge('calm', CROUCH(0.8));
  faceCam(C.world.cast.milo, 2.8 - t * 0.35, { dy: 0.1, fov: 40 });
};
// p27 it came back
S.c51_eyes = (t, d) => {
  setEnv('day');
  C.world.updateCrowd(t, 0.3);
  miloEdge('determined', CROUCH(1));
  const W = C.world;
  dust(R3(0, 0.15, 2.4), (t % 0.8), 0.8, 2.2);
  const h = headOf(W.cast.milo);
  cam(h.clone().add(V(0.4, -1.9, -2.2)), h.clone().add(V(0, 0.1, 0)), 46);
};
// p28 BOING!
S.c52_launch = (t, d) => {
  setEnv('day');
  const W = C.world;
  W.updateCrowd(t, 1.4, 1);
  const y = t < 0.08 ? 0 : (t - 0.08) * 70;
  miloEdge('grin', y > 0 ? AIR : CROUCH(1));
  W.cast.milo.root.position.y = RACE.y + 0.12 + y;
  W.cast.milo.setExpr('joy');
  ring('ring', R3(0, 0.3, 2.4), t - 0.05, 0.5, 8, true);
  dust(R3(0, 0.12, 2.4), t, 0.9, 6);
  shake(0.12 * (1 - clamp(t / 0.6)), t);
  cam(R3(8, 1.2, 9), R3(0, 3 + Math.min(y, 14) * 0.6, 2), 62);
  C.grade.uniforms.uFlash.value = 0.35 * Math.exp(-t * 10);
};
// p29 sky + bird high-five
const SKYP = () => R3(0, 240, -14);
S.c53_sky = (t, d) => {
  setEnv('day');
  const W = C.world, P = SKYP();
  W.nearClouds.visible = true; W.nearClouds.position.copy(P).add(V(0, -20 - t * 22, 0));
  put(W.cast.milo, P.x, P.y + t * 3, P.z, Math.PI, AIR, 'joy');
  const sp = fx('speed'); sp.position.copy(P); sp.children.forEach((s) => { s.position.y = ((s.userData.y0 - t * 60) % 20 + 20) % 20 - 10; });
  cam(P.clone().add(V(2.5, -3.5 + t * 3, 5.5)), P.clone().add(V(0, 2.5 + t * 3, 0)), 60);
};
S.c54_bird = (t, d) => {
  setEnv('day');
  const W = C.world, P = SKYP().add(V(0, 6, 0));
  W.nearClouds.visible = true; W.nearClouds.position.copy(P).add(V(0, -32, 0));
  put(W.cast.milo, P.x, P.y, P.z, Math.PI + 0.9, { armR: [3.0, 0.5], armL: [1.2, 0.6], legL: -0.5, legR: 0.4 }, 'joy');
  W.bird.visible = true; W.bird.position.set(P.x - 2.1, P.y + 3.3, P.z - 0.4); W.bird.rotation.set(0, Math.PI / 2 + 0.3, 0);
  W.bird.userData.wings.forEach((w, i) => (w.rotation.z = (i ? -1 : 1) * Math.sin(t * 22) * 0.7));
  const hit = 0.28;
  ring('ring', V(P.x - 1.2, P.y + 3.4, P.z), t - hit, 0.35, 1.5, false);
  if (W.fxm && W.fxm.ring) W.fxm.ring.lookAt(C.camera.position);
  cam(P.clone().add(V(-1.4, 2.4, 6.2)), P.clone().add(V(-0.9, 2.8, 0)), 48);
};
// p30 landing / scoreboard / ref hat
S.c55_land = (t, d) => {
  setEnv('day');
  const W = C.world; W.updateCrowd(t, 1.5, 1);
  const land = 0.35, z = W.finishZ;
  const y = t < land ? (land - t) * 45 : 0;
  put(W.cast.milo, RACE.x, RACE.y + 0.15 + y, RACE.z + z, 0, t < land ? AIR : CROUCH(Math.exp(-(t - land) * 5)), 'joy');
  if (t >= land) { const s = 1 - 0.35 * Math.exp(-(t - land) * 9) * Math.cos((t - land) * 20); W.cast.milo.root.scale.set(2 - s, s, 2 - s); }
  put(W.cast.ref, RACE.x + 4, RACE.y + 0.15, RACE.z + z - 1.5, -0.6, { armL: [0.3, 0.3], armR: [0.3, 0.3] }, t > land ? 'shock' : 'neutral');
  W.refHat.visible = true; W.refHat.position.copy(headOf(W.cast.ref)).add(V(0, 0.42, 0)).sub(V(0, 0, 0)); W.refHat.rotation.y = -0.6;
  ring('ring', R3(0, 0.3, z), t - land, 0.55, 10, true);
  dust(R3(0, 0.15, z), t - land, 1.0, 7);
  shake(0.25 * (t > land ? Math.exp(-(t - land) * 5) : 0), t);
  cam(R3(7, 5.5, z + 11), R3(0, 1.5, z), 52);
  C.grade.uniforms.uFlash.value = t > land ? 0.4 * Math.exp(-(t - land) * 10) : 0;
};
S.c56_scoreboard = (t, d) => {
  setEnv('day');
  const W = C.world; W.updateCrowd(t, 1.4, 1);
  W.setScore('0:00', 3, 3);
  const sb = W.scorePivot; const u = easeIn(clamp(t / 0.9));
  sb.rotation.set(0, -0.35, 0); sb.rotateX(-u * 1.45);
  if (t > 0.9) dust(R3(18, 0.15, -46), t - 0.9, 0.9, 6);
  shake(t > 0.9 ? 0.15 * Math.exp(-(t - 0.9) * 5) : 0, t);
  cam(R3(2, 3, -18), R3(16, 6, -40), 56);
};
S.c57_hat = (t, d) => {
  setEnv('day');
  const W = C.world; W.updateCrowd(t, 1.3, 1);
  const z = W.finishZ;
  put(W.cast.ref, RACE.x + 4, RACE.y + 0.15, RACE.z + z - 1.5, -0.6, { armL: [1.8, 0.4], armR: [1.8, 0.4], lean: -0.2 }, 'shock');
  const h = headOf(W.cast.ref);
  W.refHat.visible = true;
  W.refHat.position.copy(h).add(V(-t * 3, 0.42 + t * 5, -t * 2)); W.refHat.rotation.set(t * 9, t * 4, t * 6);
  faceCam(W.cast.ref, 5.0, { dy: 0.2, fov: 54, lookDy: 1.6, side: 0.6 });
};
S.c58_hat_town = (t, d) => {
  setEnv('day');
  const W = C.world;
  W.refHat.visible = true; W.refHat.scale.setScalar(4);
  W.refHat.position.set(26 - t * 12, 26 - t * 3, -12 + t * 6); W.refHat.rotation.set(t * 6, t * 3, t * 5);
  townLife(t, V(0, 0, 0), 8, 40, { h: 4, seed: 21 });
  cam(V(30, 30, 14), V(18 - t * 10, 20, -8), 52);
};
// p31 we won
S.c59_win = (t, d) => {
  setEnv('day');
  const W = C.world; W.updateCrowd(t, 1.6, 1);
  const z = W.finishZ;
  const lift = 1.3 + Math.abs(Math.sin(t * 6)) * 0.4;
  put(W.cast.milo, RACE.x, RACE.y + 0.15 + lift + 1.6, RACE.z + z, 0, { armL: [2.9, 0.4], armR: [2.9, 0.4], legL: -0.3, legR: 0.3 }, 'joy');
  W.cast.mates.forEach((c, i) => put(c, RACE.x + (i - 1) * 1.15, RACE.y + 0.15 + Math.abs(Math.sin(t * 6 + i)) * 0.3, RACE.z + z + (i === 1 ? -0.4 : 0.2), 0, { armL: [2.8, 0.3], armR: [2.8, 0.3] }, 'joy'));
  confetti(R3(0, 0, z), t);
  cam(R3(0.5, 2.6, z + 8.5), R3(0, 3.2, z), 54);
};
// p32 night town boinging again
S.c60_night_town = (t, d) => {
  setEnv('night');
  const R = rng(31);
  C.world.cast.town.forEach((c, i) => hop(c, V(-30 + (i % 7) * 10 + R() * 3, 0.25, i < 7 ? -5 : 5.5), t, 1.1 + R() * 0.4, 7 + R() * 6, R() * 2, R() * 6.28, 'joy'));
  cam(V(-40 + t * 3, 30, 36), V(0, 3, -4), 50);
};
S.c61_rooftop = (t, d) => {
  setEnv('night');
  const W = C.world;
  zoeRoof(t, 'joy', { armL: [2.6, 0.4], armR: [2.6, 0.4] });
  hop(W.cast.zoe, V(ZOE_HOUSE.x + 1, ZROOF(), ZOE_HOUSE.z + 2.2), t, 0.9, 3, 0.45, 0.3, 'joy');
  hop(W.cast.milo, V(ZOE_HOUSE.x - 1.4, ZROOF(), ZOE_HOUSE.z + 2.2), t, 0.9, 6, 0, -0.3, 'joy');
  cam(V(ZOE_HOUSE.x - 2, ZROOF() + 2.5, ZOE_HOUSE.z + 11), V(ZOE_HOUSE.x - 0.5, ZROOF() + 3.6, ZOE_HOUSE.z + 1), 50);
};
// p33-34 the ref
S.c62_ref_curb = (t, d) => {
  setEnv('night');
  const W = C.world;
  put(W.cast.ref, 20, 0.25 - 0.5, WALK_Z + 0.6, 0.2, { legL: -1.4, legR: -1.4, armL: [0.9, 0.1], armR: [0.9, 0.1], head: [0.3, 0, 0] }, 'sad');
  W.cast.ref.root.position.y = 0.25 + 0.0 - 0.45;
  const h = headOf(W.cast.ref);
  cam(h.clone().add(V(1.0, 0.2, 4.4 - t * 0.3)), h.clone().add(V(0, -0.5, 0)), 44);
};
S.c63_ref_search = (t, d) => {
  setEnv('night');
  const W = C.world;
  put(W.cast.ref, 24 + Math.sin(t * 1.5) * 0.4, 0.25, -8.2, Math.PI + 0.5 + Math.sin(t * 2) * 0.4, { armR: [1.4, 0.1], armL: [0.6, 0.3], lean: 0.35, head: [0.35, 0, 0] }, 'worried');
  cam(V(26.5, 2.0, -2.5), V(24, 1.4, -8.2), 48);
  C.grade.uniforms.uFade.value = sstep(d - 0.6, d, t);
};

// ---------------------------------------------------------------- driver
export function setup(ctx) {
  C = ctx;
  ctx.cuts = ctx.tl.cuts;
  // scoreboard needs the font loaded
  ctx.world.setScore('0:10', 2, 3);
}
export function applyTime(ctx, T) {
  C = ctx;
  const cuts = ctx.cuts;
  let i = cuts.findIndex((c) => T >= c.start && T < c.end);
  if (i < 0) i = T < cuts[0].start ? 0 : cuts.length - 1;
  const cut = cuts[i];
  hideAll();
  ctx.grade.uniforms.uFlash.value = 0; ctx.grade.uniforms.uFade.value = 0;
  ctx.world.scorePivot.rotation.set(0, -0.35, 0);
  ctx.world.sash.position.set(2.6, 3.9, -4.7);
  ctx.world.miloMailbox.rotation.set(0, 0, 0);
  ctx.world.hammer.visible = false; ctx.world.clip.visible = false;
  ctx.world.cast.milo.root.rotation.set(0, 0, 0);
  ctx.world.cast.milo.torso.visible = true;
  ctx.world.tramp.userData.pad.position.y = 0.95;
  const fn = S[cut.name];
  if (!fn) throw new Error('missing shot ' + cut.name);
  const mode = fn(T - cut.start, cut.end - cut.start);
  sunAt(ctx.focus || ctx.camera.position, cut.name.match(/doctor|knee|nothing|serious|shock|clip|poster|determined|cans|burp|springs|ceiling|window|garage|squat/) ? 'interior' : 'day');
}
