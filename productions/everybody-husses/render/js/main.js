import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildWorld } from './world.js';
import { applyTime, setup } from './shots.js';

const params = new URLSearchParams(location.search);
const W = +(params.get('w') || 1080), H = +(params.get('h') || 1920);

export async function init() {
  await document.fonts.load('900 100px Nunito');
  const tl = await (await fetch('/build/timeline.json')).json();

  const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(W, H);
  renderer.shadowMap.enabled = params.get('shadow') !== '0'; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.35;
  scene.fog = new THREE.Fog(0xcfe9ff, 140, 520);
  const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 2500);
  scene.add(camera);

  const world = buildWorld(scene);
  const hemi = new THREE.HemisphereLight(0xe3f2ff, 0x9cc77a, 1.45); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff3df, 2.3);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.04; sun.shadow.radius = 4;
  const sc = sun.shadow.camera; sc.left = -28; sc.right = 28; sc.top = 28; sc.bottom = -28; sc.near = 1; sc.far = 260;
  scene.add(sun, sun.target);
  const fill = new THREE.PointLight(0xffffff, 0, 25, 1.5); camera.add(fill); fill.position.set(0.5, 0.6, 0.4);
  const lights = { hemi, sun, fill };

  const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: +(params.get('msaa') ?? 0) });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(1); composer.setSize(W, H);
  composer.addPass(new RenderPass(scene, camera));
  const grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uSat: { value: 1.12 }, uFade: { value: 0 }, uFlash: { value: 0 }, uShake: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uSat,uFade,uFlash; varying vec2 vUv;
      void main(){ vec3 c=texture2D(tDiffuse,vUv).rgb; float l=dot(c,vec3(0.2126,0.7152,0.0722)); c=mix(vec3(l),c,uSat);
        c=mix(c,vec3(1.0),uFlash); c*=1.0-uFade; gl_FragColor=vec4(c,1.0); }`,
  });
  composer.addPass(grade);
  composer.addPass(new OutputPass());
  if (params.get('smaa') !== '0') composer.addPass(new SMAAPass(W, H));

  const ctx = { THREE, scene, camera, renderer, world, lights, grade, tl, ev: tl.events };
  setup(ctx);
  window.renderAt = (T) => {
    applyTime(ctx, T);
    world.sky.position.copy(camera.position);
    world.clouds.position.set(camera.position.x, 0, camera.position.z);
    composer.render();
    return true;
  };
  window.grab = (q = 0.93) => renderer.domElement.toDataURL('image/jpeg', q);
  window.ready = true;
}
init().catch((e) => { window.initError = String(e && e.stack || e); console.error(e); });
