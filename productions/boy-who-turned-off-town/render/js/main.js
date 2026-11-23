import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildWorld, setObsRef } from './world.js';
import { makeSky } from './sky.js';
import { applyTime } from './shots.js';

const params = new URLSearchParams(location.search);
const W = +(params.get('w') || 1080), H = +(params.get('h') || 1920);

export async function init() {
  await document.fonts.load('100px Anton');
  await document.fonts.load('100px "Patrick Hand"');
  const tl = await (await fetch('/build/timeline.json')).json();
  const words = await (await fetch('/build/words.json')).json();

  const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(W, H);
  renderer.shadowMap.enabled = params.get('shadow') !== '0'; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.fog = new THREE.FogExp2(0x0b1030, 0.006);
  const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 2000);
  scene.add(camera);

  const { sky, uniforms: skyU } = makeSky(); scene.add(sky);
  const world = buildWorld(scene); setObsRef(world.obs);

  // lighting rig
  const hemi = new THREE.HemisphereLight(0x6f7fd0, 0x20183a, 0.6); scene.add(hemi);
  const key = new THREE.DirectionalLight(0x9db4ff, 1.0);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03;
  const sc = key.shadow.camera; sc.left = -30; sc.right = 30; sc.top = 30; sc.bottom = -30; sc.near = 1; sc.far = 300;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xbfd8ff, 0); scene.add(rim, rim.target); // comet light
  const fill = new THREE.PointLight(0xdfe6ff, 0, 30, 1.5); camera.add(fill); fill.position.set(0.6, 0.4, 0.5);
  const lights = { hemi, key, rim, fill };

  // post: bloom + grade
  const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: +(params.get('msaa') ?? 0) });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(1); composer.setSize(W, H);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), 0.6, 0.55, 0.85);
  if (params.get('bloom') !== '0') composer.addPass(bloom);
  const grade = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null }, uSat: { value: 1.1 }, uTint: { value: new THREE.Vector3(1, 1, 1) }, uVig: { value: 0.35 },
      uFade: { value: 0 }, uFlash: { value: 0 }, uTime: { value: 0 }, uWarm: { value: 0 }, uAspect: { value: W / H }, uExposure: { value: 1 },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: /* glsl */`
      uniform sampler2D tDiffuse; uniform float uSat,uVig,uFade,uFlash,uTime,uWarm,uAspect,uExposure; uniform vec3 uTint; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
      void main(){
        vec3 c = texture2D(tDiffuse,vUv).rgb * uExposure;
        // memory: soft glow + warm
        if(uWarm>0.0){
          vec3 b = vec3(0.0);
          for(int i=0;i<8;i++){ float a=float(i)*0.785; b += texture2D(tDiffuse, vUv+vec2(cos(a),sin(a)*uAspect)*0.006).rgb; }
          c = mix(c, b/8.0*1.05, uWarm*0.45);
          c *= mix(vec3(1.0), vec3(1.12,1.0,0.82), uWarm);
        }
        float l = dot(c, vec3(0.2126,0.7152,0.0722));
        c = mix(vec3(l), c, uSat) * uTint;
        vec2 q = (vUv-0.5)*vec2(1.0, 1.0/uAspect*0.56);
        c *= 1.0 - uVig*smoothstep(0.15,0.75,length((vUv-0.5)*vec2(1.0,1.15))*1.2);
        c += (h(vUv*vec2(1080.,1920.)+uTime*61.0)-0.5)*0.012*(1.0+l);
        c = mix(c, vec3(1.0,0.97,0.9)*1.6, uFlash);
        c *= 1.0-uFade;
        gl_FragColor = vec4(c,1.0);
      }`,
  });
  composer.addPass(grade);
  composer.addPass(new OutputPass());
  if (params.get('smaa') !== '0') composer.addPass(new SMAAPass(W, H));

  const ctx = { THREE, scene, camera, renderer, world, sky, skyU, lights, bloom, grade, tl, ev: tl.events, words };

  window.renderAt = (T) => {
    applyTime(ctx, T);
    sky.position.copy(camera.position);
    grade.uniforms.uTime.value = T;
    composer.render();
    return true;
  };
  window.grab = (q = 0.93) => renderer.domElement.toDataURL('image/jpeg', q);
  window.ready = true;
}
init().catch((e) => { window.initError = String(e && e.stack || e); console.error(e); });
