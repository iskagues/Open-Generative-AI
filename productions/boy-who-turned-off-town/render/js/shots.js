// Shot-by-shot direction. applyTime(ctx, T) poses the whole world for time T.
import * as THREE from 'three';
import { clamp, lerp, inv, ease, easeOut, easeIn, sstep, keys, backOut, noise1 } from './util.js';
import { heightAt, pathPoint, pathYaw, setPower, OBS, OBS_ROT, HILL, obsLocal, P } from './world.js';
import { rbox, mat, mesh } from './chars.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
let S = null; // per-session setup cache

function setup(ctx) {
  const { world: W, scene, ev } = ctx;
  scene.updateMatrixWorld(true);
  S = {};
  // comet geometry: over the town as seen from the hilltop
  const tw = V(-HILL.x, 0, -HILL.z).normalize();
  S.cometDir = (az = 0, elv = 30) => {
    const e = elv * Math.PI / 180;
    const h = tw.clone().applyAxisAngle(UP, az).multiplyScalar(Math.cos(e)).add(V(0, Math.sin(e), 0)).normalize();
    const right = new THREE.Vector3().crossVectors(h, UP).normalize();
    const upP = UP.clone().addScaledVector(h, -UP.dot(h)).normalize();
    const tail = upP.multiplyScalar(0.62).addScaledVector(right, -0.78).normalize();
    return { h, tail };
  };
  ctx.skyU.uMoonDir.value.set(0.55, 0.5, -0.67).normalize();
  ctx.skyU.uGlowDir.value.copy(tw.clone().negate()); // from town the glow is everywhere; from hill it is toward town
  // Noah carries the switch in front of his chest
  const cs = W.props.carrySwitch;
  W.chars.noah.torso.add(cs.g); cs.g.position.set(0, 0.42, 0.72); cs.g.scale.setScalar(0.9); cs.set(1);
  // Noah's notebook (day scene)
  S.notebook = mesh(rbox(0.42, 0.55, 0.08, 0.02), mat('#7a4e2d', { roughness: 0.9 }), 0, 0.55, 0.42);
  W.chars.noah.torso.add(S.notebook);
  // hero tree Leo hides behind (S05b) + extra trees for parallax (S06c)
  S.heroTrees = [];
  const addTree = (x, z, s = 1) => {
    const g = new THREE.Group(); g.position.set(x, heightAt(x, z), z); g.scale.setScalar(s);
    g.add(mesh(rbox(0.8, 3.2, 0.8, 0.1), mat('#6b4428', { roughness: 0.9 }), 0, 1.6, 0));
    [['#2e8b3a', 3.6, 3.4], ['#3fa34d', 2.7, 4.7], ['#4cbb5a', 1.8, 5.9]].forEach(([c, w, y]) => g.add(mesh(rbox(w, 1.5, w, 0.2), mat(c, { roughness: 0.8 }), 0, y, 0)));
    scene.add(g); S.heroTrees.push(g); return g;
  };
  {
    const u = 0.56, p = pathPoint(u), t = pathTangent(u), n = V(-t.z, 0, t.x);
    S.hideTree = p.clone().addScaledVector(n, -2.8);
    addTree(S.hideTree.x, S.hideTree.z, 1.0);
  }
  // Noah's hand + sleeve on the lever for the switch close-up
  {
    const h = new THREE.Group();
    h.add(mesh(rbox(0.42, 0.24, 0.44, 0.08), mat(W.chars.noah.spec.skin, { roughness: 0.6 }), 0.12, 0.74, 0.12));
    const sl = mesh(rbox(0.46, 0.9, 0.46, 0.09), mat(W.chars.noah.spec.top, { roughness: 0.75 }), 0.2, 1.2, 0.45); sl.rotation.x = -0.6; h.add(sl);
    W.props.mountSwitch.lever.add(h); h.visible = false; S.hand = h;
  }
  // spark sprites for the switch click
  S.sparks = [];
  const sparkTex = makeSparkTex();
  for (let i = 0; i < 14; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkTex, color: 0xffd27a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.visible = false; scene.add(s); S.sparks.push(s);
  }
  // a chair for Noah in the hospital
  const hc = new THREE.Group(); hc.position.copy(W.hospital.position).add(V(1.1, 0, 0.5)); hc.rotation.y = -Math.PI / 2; scene.add(hc);
  hc.add(mesh(rbox(1.3, 0.15, 1.2, 0.04), mat('#8fa6c9'), 0, 0.95, 0)); hc.add(mesh(rbox(1.3, 1.3, 0.15, 0.04), mat('#8fa6c9'), 0, 1.6, -0.55));
  for (const [x, z] of [[-0.55, -0.5], [0.55, -0.5], [-0.55, 0.5], [0.55, 0.5]]) hc.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.95, 6), mat('#999'), x, 0.47, z));
  S.walks = {
    noahHill: [ev.s05, ev.s06, 1.9], leoFriday: [ev.s06 + 0.35, ev.playground, 2.2], leoSneak: [ev.playground, ev.trees, 2.3],
    leoTrees: [ev.trees, ev.obs_ext, 2.7], noahDoor: [ev.obs_ext, ev.obs_ext + 0.75, 2.0], home: [ev.home, ev.s13 - 0.25, 1.9],
  };
  window.walkWindows = S.walks;
  // clear instanced trees that would block any camera (sampled over the whole film)
  {
    const trunk = ctx.scene.children.find((o) => o.isInstancedMesh && o.count && o.geometry === W.leaves.geometry ? false : o.isInstancedMesh && o.material && o.material.color && o.material.color.getHexString() === '6b4428');
    const segs = [];
    for (let T = 0; T < tl_end(ctx); T += 0.1) {
      const sh = ctx.tl.shots.find((x) => T >= x.start && T < x.end); if (!sh) continue;
      hideAll(W); SHOTS[sh.id](ctx, T, T - sh.start, sh.end - sh.start);
      const p = ctx.camera.position.clone(), f = V(0, 0, -1).applyQuaternion(ctx.camera.quaternion);
      segs.push([p, f]);
    }
    const m4 = new THREE.Matrix4(), pos = V(), q = new THREE.Quaternion(), sc = V(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
    let hidden = 0;
    for (let i = 0; i < trunk.count; i++) {
      trunk.getMatrixAt(i, m4); m4.decompose(pos, q, sc);
      const s0 = sc.x, canopy = pos.clone().add(V(0, 2.7 * s0, 0));
      let block = false;
      for (const [p, f] of segs) {
        for (const c of [pos, canopy]) {
          const d = c.clone().sub(p), along = d.dot(f);
          if (d.length() < 5.5 * s0) { block = true; break; }
          if (along > 0 && along < 14) { const perp = d.clone().addScaledVector(f, -along).length(); if (perp < 2.6 * s0 + along * 0.08) { block = true; break; } }
        }
        if (block) break;
      }
      if (block) { trunk.setMatrixAt(i, zero); for (let k = 0; k < 3; k++) W.leaves.setMatrixAt(i * 3 + k, zero); hidden++; }
    }
    trunk.instanceMatrix.needsUpdate = true; W.leaves.instanceMatrix.needsUpdate = true;
    console.log('trees cleared', hidden);
  }
  // leaves sway base
  if (W.leaves) { S.leafBase = []; const m4 = new THREE.Matrix4(); for (let i = 0; i < W.leaves.count; i++) { W.leaves.getMatrixAt(i, m4); S.leafBase.push(m4.clone()); } }
}

function tl_end(ctx) { return ctx.tl.duration; }
function pathTangent(u) { return ctxPath.getTangentAt(clamp(u, 0.001, 0.999)); }
import { path as ctxPath } from './world.js';

function makeSparkTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,230,1)'); gr.addColorStop(0.3, 'rgba(255,200,90,0.8)'); gr.addColorStop(1, 'rgba(255,120,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---------------------------------------------------------------- helpers
function O(x, y, z) { return obsLocal(x, y, z); }
const OY = (y) => OBS_ROT + y;
function Hp(ctx, x, y, z) { return ctx.world.hospital.position.clone().add(V(x, y, z)); }
function Hm(ctx, x, y, z) { return ctx.world.home.position.clone().add(V(x, y, z)); }
function yawTo(a, b) { return Math.atan2(b.x - a.x, b.z - a.z); }
function blinking(T, seed) { const p = 2.9 + (seed % 7) * 0.37; const ph = (T + seed * 1.37) % p; return ph < 0.11; }

function place(ch, p, yaw) { ch.root.visible = true; ch.root.position.copy(p); ch.root.rotation.set(0, yaw, 0); ch.pose({}); }
function face(ch, T, name, over, noBlink) {
  const seed = ch.spec.seed || 1;
  const b = !noBlink && blinking(T, seed) && !['blink', 'happy', 'suspicious'].includes(name);
  ch.setExpr(name, b ? Object.assign({}, over, { open: 0.07 }) : over);
}
function walkPhase(win, T) { return (T - win[0]) * win[2] * Math.PI; }

function headPos(ch) { ch.root.updateMatrixWorld(true); return ch.head.localToWorld(V(0, 0.45, 0)); }
function headDir(ch) { const q = new THREE.Quaternion(); ch.head.getWorldQuaternion(q); const f = V(0, 0, 1).applyQuaternion(q); f.y = 0; return f.normalize(); }
// frame a face: dist along where the face points, side>0 = to the character's left (screen right),
// drop = how far below the eyes to aim (keeps faces in the upper-middle, clear of captions)
function faceCam(ctx, ch, dist, o = {}) {
  const h = headPos(ch), f = o.useBody ? V(Math.sin(ch.root.rotation.y), 0, Math.cos(ch.root.rotation.y)) : headDir(ch);
  const left = V(f.z, 0, -f.x);
  const pos = h.clone().addScaledVector(f, dist).addScaledVector(left, o.side || 0).add(V(0, o.up || 0, 0));
  const tgt = h.clone().add(V(0, -(o.drop ?? 0.35), 0)).addScaledVector(left, o.tside || 0);
  if (o.shake) pos.add(o.shake);
  cam(ctx, pos, tgt, o.fov || 40, o.roll || 0);
}
// orbit around a character's body: ang 0 = in front, +pi/2 = character's left
function orbit(ctx, ch, ang, dist, h, ty, fov = 45, extra) {
  const y = ch.root.rotation.y + ang, b = ch.root.position;
  const pos = V(b.x + Math.sin(y) * dist, b.y + h, b.z + Math.cos(y) * dist);
  if (extra) pos.add(extra);
  cam(ctx, pos, V(b.x, b.y + ty, b.z), fov);
}
function cam(ctx, pos, target, fov = 50, roll = 0) {
  const c = ctx.camera;
  c.position.copy(pos); c.up.set(0, 1, 0); c.lookAt(target);
  if (roll) c.rotateZ(roll);
  if (c.fov !== fov) { c.fov = fov; c.updateProjectionMatrix(); }
}
function shake(T, amp, f = 9) { return V(noise1(T * f) * amp, noise1(T * f + 31.7) * amp, noise1(T * f + 77.1) * amp * 0.5); }
function handheld(T, a = 0.04) { return V(noise1(T * 0.7) * a, noise1(T * 0.6 + 9) * a, noise1(T * 0.5 + 3) * a); }

function env(ctx, mode, o = {}) {
  const { lights: L, scene, skyU, grade, bloom } = ctx;
  const focus = o.focus || V(0, 0, 0);
  let dir;
  scene.fog.density = o.fog ?? 0.006;
  if (mode === 'day') {
    L.hemi.color.set(0xcfe3ff); L.hemi.groundColor.set(0x6a8a4a); L.hemi.intensity = 1.25;
    L.key.color.set(0xfff0d8); L.key.intensity = 2.2; dir = V(0.45, 0.75, 0.5).normalize();
    scene.fog.color.set(0xb4d2f2); scene.fog.density = o.fog ?? 0.0032; scene.environmentIntensity = 0.9;
    skyU.uDay.value = 1; skyU.uDusk.value = 0; skyU.uSunDir.value.copy(dir);
    bloom.strength = 0.25; bloom.threshold = 0.95; grade.uniforms.uSat.value = 1.12; grade.uniforms.uTint.value.set(1.0, 1.0, 0.98);
    ctx.renderer.toneMappingExposure = 1.0;
  } else if (mode === 'dusk') {
    L.hemi.color.set(0xffb894); L.hemi.groundColor.set(0x3a2a50); L.hemi.intensity = 0.55;
    L.key.color.set(0xffa766); L.key.intensity = 1.3; dir = V(-0.2, 0.22, 0.95).normalize();
    scene.fog.color.set(0x7a5a8a); scene.fog.density = o.fog ?? 0.0015; scene.environmentIntensity = 0.5;
    skyU.uDay.value = 0; skyU.uDusk.value = 1; skyU.uSunDir.value.copy(dir);
    bloom.strength = 0.4; bloom.threshold = 0.9; grade.uniforms.uSat.value = 1.1; grade.uniforms.uTint.value.set(1.04, 0.98, 0.95);
    ctx.renderer.toneMappingExposure = 0.9;
  } else if (mode === 'memory') {
    L.hemi.color.set(0xffe2c8); L.hemi.groundColor.set(0x8a6a7a); L.hemi.intensity = 0.5;
    L.key.color.set(0xffc58a); L.key.intensity = 0.9; dir = V(0.3, 0.6, -0.75).normalize();
    scene.fog.density = 0; scene.environmentIntensity = 0.6;
    skyU.uDay.value = 0; skyU.uDusk.value = 1;
    bloom.strength = 0.35; bloom.threshold = 0.9; grade.uniforms.uSat.value = 1.05; grade.uniforms.uTint.value.set(1.0, 1.0, 1.0);
    ctx.renderer.toneMappingExposure = 0.85;
  } else { // night
    const dark = o.dark ?? 0; // 0 = town lit, 1 = blackout (stars bright)
    L.hemi.color.set(0x6c7ee0); L.hemi.groundColor.set(0x1c1636); L.hemi.intensity = (o.hemi ?? lerp(0.5, 0.42, dark)) * 0.75;
    L.key.color.set(0xa8bdff); L.key.intensity = o.moon ?? lerp(0.55, 0.75, dark); dir = ctx.skyU.uMoonDir.value.clone();
    scene.fog.color.set(dark > 0.5 ? 0x070b22 : 0x0d1233); scene.environmentIntensity = 0.12;
    skyU.uDay.value = 0; skyU.uDusk.value = 0;
    bloom.strength = o.bloom ?? 0.75; bloom.threshold = o.thresh ?? 0.72; grade.uniforms.uSat.value = 1.15; grade.uniforms.uTint.value.set(0.97, 0.99, 1.06);
    ctx.renderer.toneMappingExposure = (o.exposure ?? 1.0) * 0.92;
  }
  const s = o.shadow || 30;
  const sc = L.key.shadow.camera;
  if (sc.right !== s) { sc.left = -s; sc.right = s; sc.top = s; sc.bottom = -s; sc.updateProjectionMatrix(); }
  L.key.target.position.copy(focus); L.key.position.copy(focus).addScaledVector(dir, 120);
  L.fill.intensity = o.fill ?? 0;
  L.rim.intensity = o.rim ?? 0;
  grade.uniforms.uVig.value = o.vig ?? 0.38; grade.uniforms.uWarm.value = o.warm ?? 0; grade.uniforms.uFlash.value = o.flash ?? 0; grade.uniforms.uFade.value = o.fade ?? 0;
  grade.uniforms.uExposure.value = 1;
}

function hideAll(W) {
  for (const k in W.chars) W.chars[k].root.visible = false;
  W.crowd.forEach((c) => (c.root.visible = false));
  W.props.carrySwitch.g.visible = false; S.notebook.visible = false; if (S.hand) S.hand.visible = false;
  S.sparks.forEach((s) => (s.visible = false));
}

// power helper with flicker
function flick(T, t0, dur = 0.12) {
  if (T < t0) return 1;
  const k = T - t0;
  if (k < dur * 0.3) return 0.25;
  if (k < dur * 0.55) return 0.85;
  if (k < dur) return 0.1;
  return 0;
}

// crowd walking in loops around the plaza
function crowdStroll(ctx, T, n, opts = {}) {
  const W = ctx.world;
  for (let i = 0; i < n; i++) {
    const c = W.crowd[i % W.crowd.length];
    const r = 8 + (i * 3.1) % 9, sp = (0.08 + (i % 3) * 0.03) * (i % 2 ? 1 : -1), a0 = i * 1.7;
    const stop = opts.stopAt != null && T > opts.stopAt;
    const tt = stop ? opts.stopAt : T;
    const a = a0 + tt * sp;
    const p = V(Math.cos(a) * r, 0, Math.sin(a) * r);
    place(c, p, Math.atan2(-Math.sin(a) * Math.sign(sp), Math.cos(a) * Math.sign(sp)));
    if (stop) {
      const k = T - opts.stopAt;
      c.pose({ head: [-0.25 * sstep(0, 0.4, k), Math.sin(k * 3 + i) * 0.6 * sstep(0, 0.4, k), 0], armL: [0.3 * sstep(0, 0.4, k), 0.4, 0], armR: [0.3 * sstep(0, 0.4, k), 0.4, 0] });
      face(c, T, i % 2 ? 'shocked' : 'confused');
    } else {
      c.pose({ walk: 1, phase: T * 2.0 * Math.PI + i, head: [0, Math.sin(T * 0.8 + i) * 0.3, 0] });
      face(c, T, i % 3 ? 'smile' : 'neutral');
    }
  }
}

function swayLeaves(ctx, T) {
  const W = ctx.world; if (!S.leafBase) return;
  const m4 = new THREE.Matrix4(), r = new THREE.Matrix4();
  for (let i = 0; i < S.leafBase.length; i++) {
    const a = Math.sin(T * 1.6 + i * 0.37) * 0.035 + Math.sin(T * 2.7 + i) * 0.015;
    r.makeRotationZ(a); m4.copy(S.leafBase[i]).multiply(r);
    W.leaves.setMatrixAt(i, m4);
  }
  W.leaves.instanceMatrix.needsUpdate = true;
}

const SHOTS = {};

// ================================================================ S01 THE IMPOSSIBLE EVENT
SHOTS.S01 = (ctx, T, t, d) => {
  const { ev, skyU } = ctx;
  const b = ev.blackout1;
  let pw = 1;
  if (T >= ev.flicker && T < ev.flicker + 0.22) pw = (T - ev.flicker) < 0.07 ? 0.2 : (T - ev.flicker) < 0.13 ? 1 : 0.45;
  if (T >= b) pw = flick(T, b, 0.14);
  setPower({ all: pw });
  const dark = sstep(b, b + 0.8, T);
  skyU.uPollution.value = lerp(1, 0.18, dark);
  env(ctx, 'night', { dark, focus: V(0, 0, 0), shadow: 45, exposure: lerp(1.0, 1.15, dark) });
  crowdStroll(ctx, T, 8, { stopAt: b });
  const u = easeOut(clamp(t / d));
  const pos = V(lerp(6, 2, u), lerp(62, 13, u), lerp(100, 33, u));
  const tgt = V(0, lerp(-2, 4.0, u), lerp(-12, 0, u));
  const k = T - b;
  if (k > 0) pos.add(shake(T, 0.35 * Math.exp(-k * 4), 14));
  cam(ctx, pos, tgt, 50);
};

// ================================================================ S02 THE BLACKOUT MONTAGE
SHOTS.S02 = (ctx, T, t, d) => {
  const { ev, skyU, world: W } = ctx;
  if (T < ev.shops_off - 0.3) {
    // streetlamps, one after another
    const lo = ev.lamps_off;
    setPower({ all: 1, lamps: flick(T, lo + 0.5, 0.12), lamp4: flick(T, lo, 0.14), lamp5: flick(T, lo + 0.17, 0.12), lamp6: flick(T, lo + 0.33, 0.12) });
    skyU.uPollution.value = 1;
    env(ctx, 'night', { focus: V(-14, 0, 8), shadow: 22, bloom: 0.8 });
    crowdStroll(ctx, T, 6);
    const k = inv(ev.lamps_off - 0.6, ev.shops_off - 0.3, T);
    cam(ctx, V(-9 + k * 0.4, 1.2, 22.5), V(-17, lerp(4.4, 4.7, k), 2), 46, 0.05);
  } else if (T < ev.statue_cut) {
    // the shops
    setPower({ all: 1, lamps: 0, shops: flick(T, ev.shops_off, 0.16), windows: flick(T, ev.shops_off + 0.08, 0.14) });
    skyU.uPollution.value = 0.9;
    env(ctx, 'night', { focus: V(-15, 0, -24), shadow: 20, bloom: 0.9 });
    const k = inv(ev.shops_off - 0.3, ev.statue_cut, T);
    cam(ctx, V(lerp(-14.2, -13.4, k), 2.0, lerp(-10.5, -11.5, k)), V(-15, 4.2, -24.5), 48, -0.03);
  } else if (T < ev.morning) {
    // even the mayor's ridiculous golden statue: the uplights pop off one by one, then the spotlights
    const so = ev.statue_off;
    const lv = { all: 0, statue: T < so + 0.5 ? 1 : flick(T, so + 0.5, 0.1) };
    for (let i = 0; i < 8; i++) lv['up' + i] = flick(T, so + i * 0.055, 0.05);
    setPower(lv);
    skyU.uPollution.value = lerp(0.55, 0.2, sstep(so, so + 0.8, T));
    env(ctx, 'night', { focus: V(0, 0, 0), shadow: 18, dark: sstep(so + 0.4, so + 0.8, T), bloom: 0.7, thresh: 0.85 });
    const k = inv(ev.statue_cut, ev.morning, T);
    const pos = V(lerp(5.0, 4.2, k), lerp(1.2, 1.5, k), lerp(13.0, 11.5, k));
    if (T > so + 0.5) pos.add(shake(T, 0.05 * Math.exp(-(T - so - 0.5) * 5), 12));
    cam(ctx, pos, V(0, lerp(6.4, 7.0, k), 0), 52);
  } else {
    // next morning: everything works again
    setPower({ all: 1, lamps: 0, windows: 0.35, strings: 0.3, statue: 0.2 });
    skyU.uPollution.value = 1;
    env(ctx, 'day', { focus: V(0, 0, -5), shadow: 40 });
    crowdStroll(ctx, T, 9);
    const k = ease(inv(ev.morning, ev.s03, T));
    cam(ctx, V(lerp(-20, -12, k), lerp(26, 9, k), lerp(34, 22, k)), V(0, lerp(2, 3.2, k), -6), 50);
  }
};

// ================================================================ S03 THE TOWN IS CONFUSED
SHOTS.S03 = (ctx, T, t, d) => {
  const { ev, skyU, world: W } = ctx;
  const { mayor, baker, elec1, elec2 } = W.chars;
  setPower({ all: 1, lamps: 0, windows: 0.35, strings: 0.3, statue: 0.2 });
  skyU.uPollution.value = 1;
  if (T < ev.baker) {
    env(ctx, 'day', { focus: V(7, 0, 4), shadow: 16 });
    const mp = V(3.6, 0, 0.6), e1 = V(1.5, 0, 4.6), e2 = V(5.5, 0, 5.1);
    place(mayor, mp, yawTo(mp, V(3.5, 0, 4.9)));
    const g = Math.sin(t * 9);
    mayor.pose({ armR: [1.5 + 0.35 * g, 0.2, 0], armL: [0.6 - 0.3 * g, 0.5, 0], head: [0.05, Math.sin(t * 6) * 0.15, 0], lean: 0.08, bob: Math.abs(g) * 0.04 });
    face(mayor, T, 'mayor_mad', null, true);
    place(elec1, e1, yawTo(e1, mp)); place(elec2, e2, yawTo(e2, mp));
    const sh = sstep(0.4, 0.9, t);
    elec1.pose({ armL: [0.5 * sh, 0.9 * sh, 0], armR: [0.5 * sh, 0.9 * sh, 0], head: [0, 0.3, 0.18 * sh] });
    elec2.pose({ armL: [0.45 * sh, 0.8 * sh, 0], armR: [0.45 * sh, 0.8 * sh, 0], head: [0, -0.3, -0.15 * sh], bob: -0.03 * sh });
    face(elec1, T, sh > 0.5 ? 'confused' : 'shocked'); face(elec2, T, sh > 0.5 ? 'puzzled' : 'shocked');
    const k = ease(clamp(t / (ev.baker - ev.s03)));
    cam(ctx, V(lerp(3.0, 3.6, k), 2.5, lerp(13.6, 12.8, k)).add(handheld(T, 0.05)), V(3.5, 2.2, 2.2), 50);
  } else {
    env(ctx, 'day', { focus: V(-15, 0, -20), shadow: 16 });
    const bp = V(-15, 0, -20.8);
    place(baker, bp, 0.12);
    const k0 = T - ev.baker;
    const up = backOut(clamp(k0 / 0.35));
    baker.pose({ armR: [2.95 * up, 0.12, 0], armL: [0.4 * up, 0.9 * up, 0], head: [-0.38 * up, 0, 0], lean: -0.1 * up, bob: 0.06 * Math.sin(k0 * 14) * (1 - clamp(k0)) });
    face(baker, T, 'baker_wow', null, true);
    const ps = [V(-12.4, 0, -18.6), V(-17.6, 0, -19.4), V(-13.0, 0, -22.6)];
    ps.forEach((p, i) => {
      const c = W.crowd[i + 3]; place(c, p, yawTo(p, bp) + (i === 2 ? 0.6 : 0));
      const lk = sstep(0.15 + i * 0.12, 0.5 + i * 0.12, k0);
      c.pose({ head: [-0.45 * lk, 0, (i - 1) * 0.12 * lk], armR: i === 1 ? [2.6 * lk, -0.35, 0] : [0, 0.06, 0] });
      face(c, T, i === 1 ? 'confused' : 'puzzled', { look: [0, -0.7] });
    });
    const k = ease(clamp(k0 / (ev.s04 - ev.baker)));
    const punch = 1 - 0.12 * easeOut(clamp(k0 / 0.25));
    cam(ctx, V(-14.0, 1.25, lerp(-12.6, -13.6, k)), V(-15, lerp(3.5, 4.1, k), -21), 52 * punch);
  }
};

// ================================================================ S04 THE SUSPECT
SHOTS.S04 = (ctx, T, t, d) => {
  const { ev, skyU, world: W } = ctx;
  const { leo, noah } = W.chars;
  setPower({ all: 1, lamps: 0, windows: 0.35, strings: 0.3, statue: 0.2 });
  skyU.uPollution.value = 1;
  env(ctx, 'day', { focus: V(5, 0, 0), shadow: 30 });
  const lp = V(-4, 0, 6.5), np = V(16.6, 0, -6.2);
  const toN = yawTo(lp, np);
  place(leo, lp, toN);
  place(noah, np, yawTo(np, lp) + 0.6);
  S.notebook.visible = true;
  noah.pose({ armL: [0.95, -0.28, 0], armR: [0.95, -0.28, 0], head: [0.32, -0.25, 0] });
  face(noah, T, 'quiet');
  // noisy, animated townsfolk - kept beside (not between) Leo and Noah
  const dir = np.clone().sub(lp).normalize(), lat = V(dir.z, 0, -dir.x);
  for (let i = 0; i < 6; i++) {
    const c = W.crowd[i];
    const along = 6 + i * 2.4, off = (i % 2 ? 1 : -1) * (3.2 + (i % 3) * 1.3);
    const p = lp.clone().addScaledVector(dir, along).addScaledVector(lat, off).add(V(Math.sin(T * 0.5 + i) * 0.4, 0, 0));
    place(c, p, yawTo(p, lp.clone().addScaledVector(dir, along + (i % 2 ? -2 : 2))));
    const g = Math.sin(T * 7 + i * 2);
    c.pose({ armR: [0.8 + 0.5 * g, 0.3, 0], armL: [0.3 - 0.3 * g, 0.3, 0], head: [0, Math.sin(T * 3 + i) * 0.35, 0], bob: Math.abs(g) * 0.04 });
    face(c, T, i % 3 === 0 ? 'smile' : i % 3 === 1 ? 'happy' : 'confused');
  }
  if (T < ev.noah_push) {
    const k = clamp(t / (ev.noah_push - ev.s04));
    leo.pose({ armL: [0.15, 0.5, 0.2], armR: [0.15, 0.5, 0.2], head: [0.04, lerp(0.35, 0.15, k), lerp(0, 0.08, k)] });
    face(leo, T, k < 0.32 ? 'smirk' : 'suspicious', k < 0.32 ? null : { look: [-0.6, 0] }, true);
    faceCam(ctx, leo, lerp(3.1, 2.7, ease(k)), { side: -0.5, drop: 0.45, fov: 40, shake: handheld(T, 0.02) });
  } else {
    const k = ease(clamp((T - ev.noah_push) / (ev.s05 - ev.noah_push)));
    leo.pose({ armL: [0.15, 0.5, 0.2], armR: [0.15, 0.5, 0.2], head: [0.04, 0, 0.06] });
    face(leo, T, 'suspicious');
    const h = headPos(leo), back = dir.clone().negate();
    const pos = h.clone().addScaledVector(back, 1.5).addScaledVector(lat, -0.75).add(V(0, 0.15, 0));
    cam(ctx, pos, headPos(noah).add(V(0, lerp(-0.6, -0.5, k), 0)), lerp(26, 9.0, k));
  }
};

// ================================================================ S05 THE MYSTERIOUS WALK
SHOTS.S05 = (ctx, T, t, d) => {
  const { ev, skyU, world: W } = ctx;
  const { noah, leo } = W.chars;
  setPower({ all: 1 }); skyU.uPollution.value = 1;
  swayLeaves(ctx, T);
  S.heroTrees[0].visible = true;
  const win = S.walks.noahHill;
  const u = lerp(0.6, 0.705, clamp((T - win[0]) / (win[1] - win[0])));
  const np = pathPoint(u);
  place(noah, np, pathYaw(u));
  W.props.carrySwitch.g.visible = true;
  noah.pose({ walk: 0.75, phase: walkPhase(win, T), armL: [1.05, -0.12, 0], armR: [1.05, -0.12, 0], head: [-0.08, 0, 0], lean: 0.12 });
  face(noah, T, 'determined');
  const split = ev.s05 + d * 0.58;
  env(ctx, 'night', { focus: np, shadow: 18, fill: 1.5, bloom: 0.8 });
  if (T < split) {
    // low angle, tracking ahead of him: sky above, observatory up the hill
    const ua = u + 0.05, pa = pathPoint(ua), tg = pathTangent(ua), n = V(-tg.z, 0, tg.x);
    const pos = pa.clone().addScaledVector(n, 1.8); pos.y = heightAt(pos.x, pos.z) + 0.7;
    cam(ctx, pos.add(handheld(T, 0.03)), np.clone().add(V(0, 2.4, 0)), 54, 0.04);
  } else {
    // Leo hides behind a tree, watching from a distance
    const toNoah = yawTo(S.hideTree, np);
    const side = V(Math.cos(toNoah), 0, -Math.sin(toNoah)), back = V(-Math.sin(toNoah), 0, -Math.cos(toNoah));
    const lpos = S.hideTree.clone().addScaledVector(side, 0.95).addScaledVector(back, 0.55); lpos.y = heightAt(lpos.x, lpos.z);
    place(leo, lpos, toNoah);
    const lean = sstep(split, split + 0.5, T);
    leo.pose({ tilt: -0.25 * lean, armR: [0.7, 0.3, 0], armL: [0.2, 0.1, 0], head: [-0.08, 0, -0.15 * lean] });
    face(leo, T, 'suspicious', { look: [0.2, -0.3] });
    const pos = lpos.clone().addScaledVector(back, 3.2).addScaledVector(side, 2.3); pos.y = heightAt(pos.x, pos.z) + 2.2;
    const k = inv(split, ev.s06, T);
    cam(ctx, pos.add(V(0, k * 0.12, 0)), headPos(leo).lerp(np.clone().add(V(0, 2.0, 0)), 0.55).add(V(0, -0.3, 0)), 44);
  }
};

// ================================================================ S06 THE PURSUIT
SHOTS.S06 = (ctx, T, t, d) => {
  const { ev, skyU, world: W } = ctx;
  const { noah, leo } = W.chars;
  setPower({ all: 1 }); skyU.uPollution.value = 1;
  swayLeaves(ctx, T);
  const carry = (u, ph) => { const p = pathPoint(u); place(noah, p, pathYaw(u)); W.props.carrySwitch.g.visible = true; noah.pose({ walk: 0.75, phase: ph, armL: [1.05, -0.12, 0], armR: [1.05, -0.12, 0] }); face(noah, T, 'determined'); return p; };
  if (T < ev.playground) {
    // Friday: Leo leaves the lit square and follows
    const win = S.walks.leoFriday;
    const u = lerp(0.0, 0.05, clamp((T - win[0]) / (win[1] - win[0])));
    const lp = pathPoint(u); place(leo, lp, pathYaw(u));
    const w = T > win[0] ? 1 : 0;
    leo.pose({ walk: w, phase: walkPhase(win, T), lean: 0.08, head: [0.05, 0, 0] });
    face(leo, T, 'determined');
    carry(0.15 + 0.03 * clamp(t / 2), T * 6);
    env(ctx, 'night', { focus: lp, shadow: 22, fill: 2.5, bloom: 0.85 });
    const fwd = pathTangent(u + 0.02), n = V(-fwd.z, 0, fwd.x);
    const pos = lp.clone().addScaledVector(fwd, 3.6).addScaledVector(n, -1.1).setY(2.5);
    cam(ctx, pos.add(handheld(T, 0.04)), lp.clone().setY(2.0).addScaledVector(fwd, -0.5), 46);
  } else if (T < ev.trees) {
    // through the playground: Leo ducks between the slide and the swings, Noah passes ahead
    const win = S.walks.leoSneak;
    const k = clamp((T - win[0]) / (win[1] - win[0]));
    const u = lerp(0.205, 0.245, k), lp = pathPoint(u), tg = pathTangent(u), n = V(-tg.z, 0, tg.x);
    const lpos = lp.clone().addScaledVector(n, 2.2); lpos.y = heightAt(lpos.x, lpos.z);
    place(leo, lpos, pathYaw(u));
    leo.pose({ walk: 0.7, phase: walkPhase(win, T), bob: -0.25, lean: 0.42, head: [-0.3, 0, 0], armL: [0.6, 0.2, 0], armR: [0.6, 0.2, 0] });
    face(leo, T, 'suspicious', { look: [0, -0.2] });
    const nP = carry(lerp(0.29, 0.32, k), T * 6);
    W.swings.forEach((s, i) => (s.rotation.x = Math.sin(T * 2.2 + i) * 0.14));
    env(ctx, 'night', { focus: lpos, shadow: 22, fill: 2.2, bloom: 0.8 });
    const pos = lpos.clone().addScaledVector(n, -4.6).addScaledVector(tg, 6.2); pos.y = heightAt(pos.x, pos.z) + 1.6;
    cam(ctx, pos, lpos.clone().add(V(0, 1.6, 0)).lerp(nP.clone().add(V(0, 2.0, 0)), 0.25), 50);
  } else if (T < ev.obs_ext) {
    // through the trees: low tracking from the side, trees streaming past behind him
    const win = S.walks.leoTrees;
    const k = clamp((T - win[0]) / (win[1] - win[0]));
    const u = lerp(0.47, 0.53, k), lp = pathPoint(u);
    place(leo, lp, pathYaw(u));
    leo.pose({ walk: 1, phase: walkPhase(win, T), lean: 0.16, head: [-0.05, 0, 0] });
    face(leo, T, 'determined');
    const tg = pathTangent(u), n = V(-tg.z, 0, tg.x);
    const pos = lp.clone().addScaledVector(n, -5.6).addScaledVector(tg, 1.6); pos.y = heightAt(pos.x, pos.z) + 1.9;
    env(ctx, 'night', { focus: lp, shadow: 20, fill: 2.0, bloom: 0.8 });
    cam(ctx, pos, lp.clone().add(V(0, 1.8, 0)), 46);
  } else {
    // the abandoned observatory: Noah slips inside, Leo arrives
    const k = T - ev.obs_ext;
    ctx.world.obsDoor.rotation.y = -1.6 * sstep(0.05, 0.55, k);
    const win = S.walks.noahDoor;
    const np = O(0.2, 0, lerp(7.2, 4.4, clamp(k / 0.75)));
    if (k < 0.8) {
      place(noah, np, OY(Math.PI)); W.props.carrySwitch.g.visible = true;
      noah.pose({ walk: 0.7, phase: walkPhase(win, T), armL: [1.05, -0.12, 0], armR: [1.05, -0.12, 0] });
      face(noah, T, 'determined');
    }
    const lp = O(lerp(5.4, 3.8, sstep(0.3, 1.4, k)), 0, 9.2);
    place(leo, lp, OY(Math.PI) - 0.6);
    leo.pose({ walk: 0.5 * (k > 0.3 && k < 1.4), phase: T * 7, bob: -0.25, lean: 0.4, head: [-0.3, 0.3, 0] });
    face(leo, T, 'suspicious', { look: [0.4, -0.4] });
    env(ctx, 'night', { focus: OBS, shadow: 18, fill: 1.5, bloom: 0.85 });
    cam(ctx, O(lerp(5.0, 4.4, clamp(k / 1.5)), 1.4, 16.5), O(1.2, 4.0, 4), 52);
  }
};

// ================================================================ S07 THE CONFRONTATION
function interiorBase(ctx, T, o = {}) {
  const { world: W } = ctx;
  W.obsDoor.rotation.y = -1.6;
  const dp = W.dust.geometry.attributes.position, base = W.dustBase;
  for (let i = 0; i < dp.count; i++) { dp.setXYZ(i, base[i * 3] + Math.sin(T * 0.3 + i) * 0.15, (base[i * 3 + 1] + T * 0.05 * (1 + (i % 3))) % 4.5, base[i * 3 + 2] + Math.cos(T * 0.25 + i) * 0.15); }
  dp.needsUpdate = true;
  W.moonSpot.intensity = o.moonSpot ?? 30;
  W.lanternLight.intensity = o.lantern ?? 9;
}
const NOAH_SW = () => [-1.22, -3.05]; // Noah's spot in front of the mounted switch (local)
const SW_YAW = Math.PI * 1.12;

SHOTS.S07 = (ctx, T, t, d) => {
  const { ev, skyU, world: W } = ctx;
  const { noah, leo } = W.chars;
  setPower({ all: 1 }); skyU.uPollution.value = 1;
  interiorBase(ctx, T);
  W.props.mountSwitch.set(1); W.props.mountSwitch.ind.emissive.set('#4f4');
  const [nx, nz] = NOAH_SW();
  const np = O(nx, 0, nz), lp = O(0.25, 0, 3.4);
  place(noah, np, OY(SW_YAW));
  place(leo, lp, yawTo(lp, np));
  env(ctx, 'night', { focus: OBS, shadow: 14, fill: 3.0, bloom: 0.8, exposure: 1.1 });
  if (T < ev.leo_shout) {
    const k = clamp(t / (ev.leo_shout - ev.s07));
    const r = ease(k);
    noah.pose({ armL: [lerp(0.2, 1.5, r), -0.18, 0], armR: [lerp(0.2, 1.5, r), -0.18, 0], head: [lerp(0.1, -0.1, r), 0, 0], lean: 0.05 * r });
    face(noah, T, 'determined');
    leo.root.visible = false;
    cam(ctx, O(lerp(0.15, 0.0, k), 2.1, lerp(-4.0, -4.1, k)), O(-1.45, 1.95, -3.55), 50);
  } else if (T < ev.noah_cu) {
    noah.pose({ armL: [1.5, -0.18, 0], armR: [1.5, -0.18, 0] });
    face(noah, T, 'determined');
    const st = T - ev.stop;
    const raise = st > 0 ? backOut(clamp(st / 0.22)) : 0;
    leo.pose({ armR: [1.65 * raise, 0.1, 0], armL: [0.3 * raise, 0.35, 0], lean: -0.12 * raise + 0.08 * (1 - raise), head: [-0.05 * raise, 0, 0], bob: 0.05 * raise });
    face(leo, T, st > 0 ? (st < 0.65 ? 'shout' : 'angry') : 'shocked', null, true);
    const push = st > 0 ? easeOut(clamp(st / 0.18)) : 0;
    faceCam(ctx, leo, lerp(4.0, 3.4, push), { useBody: true, side: 0.5, drop: 0.6, fov: 42, shake: st > 0 ? shake(T, 0.06 * Math.exp(-st * 6), 18) : null });
  } else {
    // Noah, quietly: "Please... just one minute."
    noah.pose({ armL: [1.45, -0.18, 0], armR: [1.45, -0.18, 0], head: [0.06, -1.0, 0], twist: -0.35 });
    const words = ctx.words.filter((w) => w.phrase === 'p13');
    const speaking = words.some((w) => T >= w.start && T < w.end - 0.04);
    const mouthOpen = speaking && (Math.sin(T * 26) > -0.2);
    face(noah, T, 'pleading', mouthOpen ? { mouth: 'small', mw: 0.42 } : { mouth: 'flat', mw: 0.3 });
    const k = clamp((T - ev.noah_cu) / (ev.s08 - ev.noah_cu));
    faceCam(ctx, noah, lerp(2.7, 2.35, ease(k)), { side: -0.35, up: 0.2, drop: 0.45, fov: 40 });
  }
};

// ================================================================ S08 THE SWITCH
SHOTS.S08 = (ctx, T, t, d) => {
  const { ev, skyU, world: W } = ctx;
  const sw = W.props.mountSwitch;
  if (T < ev.aerial_dark_cut) {
    setPower({ all: 1 }); skyU.uPollution.value = 1;
    interiorBase(ctx, T);
    const k = T - ev.click;
    const v = k < 0 ? 1 - 0.06 * sstep(-0.3, 0, k) : Math.max(0, 1 - backOut(clamp(k / 0.07)));
    sw.set(v);
    sw.ind.emissive.set(k < 0 ? '#4f4' : '#f22'); sw.ind.emissiveIntensity = k < 0 ? 0.8 : 0.7;
    S.hand.visible = true;
    const sp = sw.g.localToWorld(V(0, 0.15, 0.5));
    S.sparks.forEach((s, i) => {
      const a = k;
      if (a < 0 || a > 0.35) { s.visible = false; return; }
      const ang = i * 2.39, sp2 = 1.4 + (i % 4) * 0.5;
      s.visible = true; s.position.copy(sp).add(V(Math.cos(ang) * a * sp2, Math.sin(ang * 1.3) * a * sp2 - a * a * 6, Math.sin(ang) * a * sp2 * 0.5));
      s.scale.setScalar(0.12 * (1 - a / 0.35)); s.material.opacity = 1 - a / 0.35;
    });
    env(ctx, 'night', { focus: OBS, shadow: 12, fill: 2.0, bloom: 0.95, exposure: 1.05 });
    const c = sw.g.localToWorld(V(0, 0.3, 0.45));
    const p = sw.g.localToWorld(V(1.0, 0.6, 1.5));
    if (k > 0) p.add(shake(T, 0.035 * Math.exp(-k * 10), 22));
    cam(ctx, p, c, 44);
  } else {
    // the whole square disappears into darkness (rippling out from the centre)
    const td = ev.town_dark;
    setPower({ statue: flick(T, td, 0.1), lamps: flick(T, td + 0.07, 0.12), shops: flick(T, td + 0.14, 0.12), strings: flick(T, td + 0.2, 0.1), windows: flick(T, td + 0.3, 0.14) });
    const dark = sstep(td, td + 1.6, T);
    skyU.uPollution.value = lerp(1, 0.08, dark);
    env(ctx, 'night', { dark, focus: V(0, 0, 0), shadow: 45, exposure: lerp(1.0, 1.15, dark), bloom: 0.8 });
    crowdStroll(ctx, T, 8, { stopAt: td });
    const k = clamp((T - ev.aerial_dark_cut) / (ev.s09 - ev.aerial_dark_cut));
    cam(ctx, V(lerp(32, 26, k), lerp(42, 36, k), lerp(46, 41, k)), V(0, 0, -3), 50);
  }
};

// ================================================================ S09 THE MOMENT OF SILENCE
SHOTS.S09 = (ctx, T, t, d) => {
  const { ev, skyU, world: W } = ctx;
  const { noah, leo } = W.chars;
  setPower({ all: 0 }); skyU.uPollution.value = 0.06;
  interiorBase(ctx, T, { moonSpot: 45, lantern: 10 });
  W.props.mountSwitch.set(0); W.props.mountSwitch.ind.emissive.set('#f22');
  const [nx, nz] = NOAH_SW();
  const np = O(nx + 0.2, 0, nz + 0.5), lp = O(0.25, 0, 3.0);
  env(ctx, 'night', { dark: 1, focus: OBS, shadow: 14, fill: 3.0, bloom: 0.8, exposure: 1.1 });
  if (T < ev.point) {
    place(leo, lp, yawTo(lp, np));
    const k = T - ev.s09;
    const f = sstep(0.1, 0.45, k), tr = Math.sin(T * 60) * 0.015 * f;
    leo.pose({ fist: f, armL: [0.3 + tr, 0.35, 0], armR: [0.3 - tr, 0.35, 0], bob: 0.04 * f, lean: 0.1 * f, head: [0.08, 0, 0] });
    face(leo, T, 'furious', null, true);
    const r = ease(clamp((k - 0.35) / 0.7));
    orbit(ctx, leo, 0.3, lerp(2.8, 3.8, r), lerp(1.2, 2.2, r), lerp(1.0, 2.05, r), 46);
  } else {
    place(noah, np, yawTo(np, lp));
    const k = T - ev.point;
    const up = ease(clamp(k / 0.55));
    noah.pose({ armR: [2.75 * up, 0.15, 0], armL: [0.1, 0.06, 0], head: [-0.35 * sstep(0.3, 0.8, k), 0, 0] });
    face(noah, T, k < 0.45 ? 'soft' : 'soft_up');
    const tilt = easeIn(clamp((k - 0.55) / (ev.s10 - ev.point - 0.55)));
    const b = noah.root.position, y = noah.root.rotation.y + 0.45;
    const pos = V(b.x + Math.sin(y) * 3.6, b.y + 2.0 - 0.4 * tilt, b.z + Math.cos(y) * 3.6);
    cam(ctx, pos, V(b.x, b.y + lerp(2.0, 9.5, tilt), b.z), 50);
  }
};

// ================================================================ S10 THE SKY REVEAL
SHOTS.S10 = (ctx, T, t, d) => {
  const { ev, skyU, world: W } = ctx;
  setPower({ all: 0 }); skyU.uPollution.value = 0.04;
  const cm = S.cometDir(0, 30); skyU.uCometHead.value.copy(cm.h); skyU.uCometTail.value.copy(cm.tail);
  skyU.uStars.value = lerp(1, 1.7, sstep(ev.stars - 0.2, ev.stars + 0.8, T));
  skyU.uComet.value = sstep(ev.s10 + 0.4, ev.comet - 0.2, T);
  ctx.lights.rim.position.copy(cm.h).multiplyScalar(100); ctx.lights.rim.target.position.set(0, 0, 0);
  const split = ev.comet - 0.25;
  if (T < split) {
    interiorBase(ctx, T, { moonSpot: 45, lantern: 10 });
    env(ctx, 'night', { dark: 1, focus: OBS, shadow: 14, fill: 0, bloom: 1.0, thresh: 0.6, exposure: 1.15, rim: 0.4 });
    const k = clamp(t / (split - ev.s10));
    const el = lerp(0.95, 1.3, ease(k));
    const pos = O(-1.5, 1.6, 2.2);
    cam(ctx, pos, O(-1.5 + 0.0, 1.6 + Math.sin(el) * 10, 2.2 + Math.cos(el) * 10), 62);
  } else {
    env(ctx, 'night', { dark: 1, focus: OBS, shadow: 18, fill: 0, bloom: 1.1, thresh: 0.55, exposure: 1.15, rim: 0.7 });
    const k = clamp((T - split) / (ev.s11 - split));
    const pos = O(lerp(7.2, 6.8, k), lerp(0.5, 0.7, k), lerp(-1.2, -0.4, k));
    const look = pos.clone().addScaledVector(S.cometDir(0.18, lerp(36, 40, k)).h, 10);
    cam(ctx, pos, look, 64, -0.05);
  }
};

// ================================================================ S11 THE DRAWING
SHOTS.S11 = (ctx, T, t, d) => {
  const { ev, skyU, world: W } = ctx;
  setPower({ all: 0 }); skyU.uPollution.value = 0.04; skyU.uComet.value = 1; skyU.uStars.value = 1.6;
  interiorBase(ctx, T, { moonSpot: 40, lantern: 3.2 });
  env(ctx, 'night', { dark: 1, focus: OBS, shadow: 10, fill: 0.5, bloom: 0.25, thresh: 1.0, exposure: 1.0 });
  const D = (x, y, z) => W.desk.localToWorld(V(x, y, z));
  const k1 = ease(clamp((T - ev.s11) / (ev.note - ev.s11)));
  const k2 = ease(clamp((T - ev.note) / (ev.note_read - ev.note + 0.25)));
  const k3 = clamp((T - ev.note_read) / (ev.s12 - ev.note_read));
  const pos = V().lerpVectors(V(0.9, 2.9, 2.8), V(-0.2, 3.1, 0.9), k1);
  const tgt = V().lerpVectors(V(-0.05, 1.3, -0.05), V(-0.2, 1.33, 0.05), k1);
  pos.lerp(V(-0.18, 2.75, 1.1), k2); tgt.lerp(V(-0.18, 1.33, 0.66), k2);
  pos.lerp(V(-0.18, 2.6, 1.05), k3 * 0.7);
  cam(ctx, D(pos.x, pos.y, pos.z), D(tgt.x, tgt.y, tgt.z), 44);
};

// ================================================================ S12 THE HIDDEN REASON
SHOTS.S12 = (ctx, T, t, d) => {
  const { ev, world: W } = ctx;
  const { noah, maya } = W.chars;
  setPower({ all: 0 });
  if (T < ev.home) {
    // warm memory: Maya drawing the comet in her hospital bed, Noah beside her
    const k = T - ev.s12;
    env(ctx, 'memory', { focus: W.hospital.position, shadow: 10, warm: 0.8, vig: 0.5, flash: 0.6 * (1 - sstep(0, 0.35, k)) });
    const mp = Hp(ctx, -1.2, 0.96, -0.2);
    place(maya, mp, 0);
    const draw = Math.sin(T * 9) * 0.12, lookUp = sstep(1.5, 1.9, k);
    maya.pose({ legL: -1.5, legR: -1.5, armR: [1.05 + draw, -0.1 + draw, 0], armL: [0.75, -0.15, 0], head: [lerp(0.42, 0.02, lookUp), lerp(0, 0.9, lookUp), 0] });
    face(maya, T, lookUp > 0.5 ? 'happy' : 'soft', lookUp > 0.5 ? null : { look: [0, 0.6] });
    const np = Hp(ctx, 1.1, 0.05, 0.5);
    place(noah, np, -Math.PI / 2);
    noah.pose({ legL: -1.45, legR: -1.45, armL: [1.2, 0, 0], armR: [1.2, 0, 0], head: [0.15, 0, 0], lean: 0.12 });
    face(noah, T, 'soft');
    const kk = ease(clamp(k / (ev.home - ev.s12)));
    cam(ctx, Hp(ctx, lerp(-3.4, -2.9, kk), lerp(3.2, 3.0, kk), lerp(5.6, 4.9, kk)), Hp(ctx, -0.2, 2.2, 0.0), 44);
  } else {
    // tonight: her first night home
    const k = T - ev.home;
    env(ctx, 'dusk', { focus: W.home.position, shadow: 14, vig: 0.42, fade: sstep(ev.s13 - 0.22, ev.s13, T) });
    const win = S.walks.home;
    const z = lerp(8.5, 3.6, clamp((T - win[0]) / (win[1] - win[0])));
    const np = Hm(ctx, -0.6, 0, z), mp = Hm(ctx, 0.55, 0, z + 0.1);
    place(noah, np, Math.PI); place(maya, mp, Math.PI);
    const ph = walkPhase(win, T);
    noah.pose({ walk: 0.8, phase: ph, armR: [0.15, 0.38, 0], head: [0.1, 0.5, 0] });
    maya.pose({ walk: 0.8, phase: ph + 1.2, armL: [0.3, 0.55, 0], head: [-0.15, -0.4, 0] });
    face(noah, T, 'soft'); face(maya, T, 'happy');
    const kk = ease(clamp(k / 2));
    cam(ctx, Hm(ctx, lerp(1.6, 1.1, kk), 2.1, lerp(14.5, 13.2, kk)), Hm(ctx, 0, 3.6, 0), 50);
  }
};

// ================================================================ S13 THE REUNION
function terraceBase(ctx, T, azDrift = 0, elv = 30) {
  const { skyU, world: W } = ctx;
  setPower({ all: 0 }); skyU.uPollution.value = 0.04; skyU.uComet.value = 1; skyU.uStars.value = 1.6;
  const cm = S.cometDir(azDrift, elv); skyU.uCometHead.value.copy(cm.h); skyU.uCometTail.value.copy(cm.tail);
  ctx.lights.rim.position.copy(cm.h).multiplyScalar(100).add(OBS); ctx.lights.rim.target.position.copy(OBS);
  W.obsDoor.rotation.y = -1.6;
  W.lanternLight.intensity = 10; W.moonSpot.intensity = 30;
  return cm;
}
SHOTS.S13 = (ctx, T, t, d) => {
  const { ev, world: W } = ctx;
  const { noah, maya, leo } = W.chars;
  terraceBase(ctx, T);
  const np = O(-0.5, 0, 8.45), mp = O(0.45, 0, 8.6), lp = O(1.6, 0, 6.4);
  place(noah, np, OY(0.05)); place(maya, mp, OY(-0.05)); place(leo, lp, OY(0.05));
  const split1 = ev.s13 + 2.15, split2 = ev.s14a - 1.1;
  const hand = sstep(ev.s13 + 0.6, ev.s13 + 1.3, T);
  noah.pose({ head: [-0.42, 0.12 * hand, 0], armL: [lerp(0.06, 0.55, hand), lerp(0.06, 0.12, hand), lerp(0, 0.35, hand)] });
  maya.pose({ head: [-0.5, 0, 0], armL: [0.3, 0.1, 0], armR: [0.3, 0.1, 0] });
  face(noah, T, 'soft_up'); face(maya, T, 'wonder');
  if (T < split1) {
    env(ctx, 'night', { dark: 1, focus: OBS, shadow: 16, fill: 2.4, bloom: 0.85, thresh: 0.7, exposure: 1.15, rim: 1.2 });
    leo.pose({ head: [-0.05, 0, 0] }); face(leo, T, 'angry');
    const k = ease(clamp(t / (split1 - ev.s13)));
    cam(ctx, O(lerp(0.4, 0.1, k), lerp(1.6, 1.75, k), lerp(14.2, 13.4, k)), O(0.0, lerp(2.35, 2.3, k), 8.4), 40);
  } else if (T < split2) {
    env(ctx, 'night', { dark: 1, focus: OBS, shadow: 16, fill: 2.8, bloom: 0.85, thresh: 0.7, exposure: 1.15, rim: 1.2 });
    const ls = ev.leo_soften;
    const ex = T < ls - 0.1 ? 'angry' : T < ls + 0.65 ? 'puzzled' : (T < ls + 1.3 ? 'soft' : 'soft_up');
    leo.pose({ fist: 1 - sstep(ls, ls + 0.8, T), head: [lerp(0, -0.22, sstep(ls + 0.9, ls + 1.6, T)), 0, 0], armL: [0.15, 0.08, 0], armR: [0.15, 0.08, 0] });
    face(leo, T, ex, ex === 'puzzled' ? { look: [0, -0.2] } : null);
    const kk = ease(clamp((T - split1) / (split2 - split1)));
    faceCam(ctx, leo, lerp(3.3, 3.0, kk), { useBody: true, side: 1.35, up: 0.25, drop: 0.5, fov: 40 });
  } else {
    env(ctx, 'night', { dark: 1, focus: OBS, shadow: 16, fill: 0, bloom: 1.0, thresh: 0.6, exposure: 1.15, rim: 1.0 });
    leo.pose({ head: [-0.2, 0, 0] }); face(leo, T, 'soft_up');
    const k = ease(clamp((T - split2) / (ev.s14a - split2)));
    cam(ctx, O(0.3, 2.7, lerp(5.6, 5.5, k)), O(-0.2, 4.3, 18), 60);
  }
};

// ================================================================ S14 THE FINAL EMOTIONAL PAYOFF
SHOTS.S14 = (ctx, T, t, d) => {
  const { ev, skyU, world: W } = ctx;
  const { noah, maya, leo, mayor, baker, elec1, elec2 } = W.chars;
  if (T < ev.s14b) {
    // down in the dark square nobody complains: they look up
    setPower({ all: 0 }); skyU.uPollution.value = 0.05; skyU.uComet.value = 1; skyU.uStars.value = 1.6;
    const cm = S.cometDir(0, 30); skyU.uCometHead.value.copy(cm.h); skyU.uCometTail.value.copy(cm.tail);
    ctx.lights.rim.position.copy(cm.h).multiplyScalar(100); ctx.lights.rim.target.position.set(0, 0, 0);
    env(ctx, 'night', { dark: 1, focus: V(0, 0, 6), shadow: 20, fill: 1.8, bloom: 0.85, exposure: 1.2, rim: 0.8 });
    const toC = V(cm.h.x, 0, cm.h.z).normalize();
    const yaw = Math.atan2(toC.x, toC.z);
    const side = V(Math.cos(yaw), 0, -Math.sin(yaw));
    const group = [[mayor, -0.9, 5.4], [baker, 1.3, 5.8], [elec1, -2.8, 7.4], [elec2, 2.9, 7.6]];
    W.crowd.slice(0, 5).forEach((c, i) => group.push([c, -4.0 + i * 2.0, 9.6 + (i % 2) * 0.9]));
    group.forEach(([c, sx, f], i) => {
      const p = toC.clone().multiplyScalar(f - 3).addScaledVector(side, sx);
      place(c, p, yaw + (i % 3 - 1) * 0.12);
      c.pose({ head: [-0.5, (i % 3 - 1) * 0.08, 0], armL: c === mayor ? [1.2, -0.4, 0] : [0.05, 0.06, 0] });
      face(c, T, ['up_calm', 'baker_wow', 'wonder', 'up_calm'][i] || (i % 2 ? 'wonder' : 'soft_up'));
    });
    const k = ease(clamp(t / (ev.s14b - ev.s14a)));
    const camP = toC.clone().multiplyScalar(lerp(14.5, 13.6, k)).addScaledVector(side, 3.2); camP.y = 1.2;
    cam(ctx, camP, toC.clone().multiplyScalar(3.5).addScaledVector(side, 0.6).setY(lerp(3.2, 3.5, k)), 50);
  } else {
    // three kids beneath the comet, the town peacefully dark below
    const k = clamp((T - ev.s14b) / (ev.end - ev.s14b));
    terraceBase(ctx, T, 0.05 * k, 25 + 1.5 * k);
    env(ctx, 'night', { dark: 1, focus: OBS, shadow: 18, fill: 1.6, bloom: 1.05, thresh: 0.55, exposure: 1.15, rim: 1.2, fade: sstep(ev.end - 0.7, ev.end, T) });
    const np = O(-0.75, 0, 9.55), mp = O(0.3, 0, 9.7), lp = O(1.4, 0, 9.5);
    place(noah, np, OY(0)); place(maya, mp, OY(-0.05)); place(leo, lp, OY(-0.1));
    noah.pose({ head: [-0.42, 0.1, 0], armL: [0.55, 0.12, 0.35] });
    maya.pose({ head: [-0.5, -0.05, 0], armR: [0.3, 0.1, 0] });
    leo.pose({ head: [-0.45, -0.1, 0] });
    face(noah, T, 'soft_up'); face(maya, T, 'wonder'); face(leo, T, 'soft_up');
    const kk = ease(k);
    const camY = lerp(1.9, 2.6, kk);
    const pos = O(lerp(0.4, 0.32, kk), camY, 5.65);
    const pitch = lerp(0.17, 0.09, kk);
    cam(ctx, pos, O(0.32, camY + Math.tan(pitch) * 25, 30.65), lerp(64, 66, kk));
  }
};

// Only lights near the camera's set are evaluated (each enabled light costs every pixel).
function cullLights(ctx) {
  const { world: W, camera, lights: L } = ctx;
  const c = camera.position;
  const near = (p, r) => c.distanceTo(p) < r;
  const atHosp = near(W.hospital.position, 80), atHome = near(W.home.position, 80), atObs = near(OBS, 30);
  const atTown = !atHosp && !atHome && !atObs;
  W.hospLight.visible = W.hospFill.visible = atHosp;
  W.porch.visible = atHome;
  W.lanternLight.visible = W.moonSpot.visible = atObs;
  for (const g of ['lamps', 'statue']) for (const [l] of P[g].lights) l.visible = l.visible && atTown;
  L.fill.visible = L.fill.intensity > 0; L.rim.visible = L.rim.intensity > 0;
}

// ---------------------------------------------------------------- entry
export function applyTime(ctx, T) {
  if (!S) setup(ctx);
  const { tl, skyU, world: W } = ctx;
  hideAll(W);
  S.heroTrees.forEach((g, i) => (g.visible = i === 0));
  skyU.uTime.value = T; skyU.uComet.value = 0; skyU.uStars.value = 1;
  W.obsDoor.rotation.y = 0;
  W.props.mountSwitch.set(1); W.props.mountSwitch.ind.emissive.set('#4f4');
  const shot = tl.shots.find((s) => T >= s.start && T < s.end) || tl.shots[tl.shots.length - 1];
  SHOTS[shot.id](ctx, T, T - shot.start, shot.end - shot.start);
  cullLights(ctx);
  return shot.id;
}
