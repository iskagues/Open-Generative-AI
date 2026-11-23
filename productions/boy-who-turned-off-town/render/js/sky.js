import * as THREE from 'three';

// Procedural sky dome: day/dusk/night gradient, city light pollution glow,
// three layers of anti-aliased twinkling stars, a faint milky band, the moon,
// and a two-tailed comet drawn in gnomonic coordinates around its head.
export function makeSky() {
  const uniforms = {
    uTime: { value: 0 },
    uDay: { value: 0 },          // 0 night .. 1 day
    uDusk: { value: 0 },         // dusk tint amount
    uPollution: { value: 1 },    // 1 = town lit (stars washed out), 0 = blackout
    uStars: { value: 1 },        // extra star gain
    uComet: { value: 0 },
    uCometHead: { value: new THREE.Vector3(-0.5, 0.62, 0.6).normalize() },
    uCometTail: { value: new THREE.Vector3(1, 0, 0) },
    uMoonDir: { value: new THREE.Vector3(0.55, 0.62, 0.55).normalize() },
    uSunDir: { value: new THREE.Vector3(0.4, 0.6, 0.5).normalize() },
    uGlowDir: { value: new THREE.Vector3(0, 0, 1) }, // direction of the town glow on horizon
    uMemory: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main(){ vDir = normalize(position); vec4 p = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*p; gl_Position.z = gl_Position.w*0.99999; }`,
    fragmentShader: /* glsl */`
      precision highp float;
      varying vec3 vDir;
      uniform float uTime,uDay,uDusk,uPollution,uStars,uComet,uMemory;
      uniform vec3 uCometHead,uCometTail,uMoonDir,uSunDir,uGlowDir;
      float h13(vec3 p){ p=fract(p*0.1031); p+=dot(p,p.yzx+33.33); return fract((p.x+p.y)*p.z); }
      vec3 h33(vec3 p){ p=fract(p*vec3(.1031,.1030,.0973)); p+=dot(p,p.yxz+33.33); return fract((p.xxy+p.yxx)*p.zyx); }
      float vnoise(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(mix(h13(i),h13(i+vec3(1,0,0)),f.x),mix(h13(i+vec3(0,1,0)),h13(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(h13(i+vec3(0,0,1)),h13(i+vec3(1,0,1)),f.x),mix(h13(i+vec3(0,1,1)),h13(i+vec3(1,1,1)),f.x),f.y),f.z); }
      float fbm(vec3 p){ float a=.5,s=0.; for(int i=0;i<5;i++){ s+=a*vnoise(p); p*=2.03; a*=.5;} return s; }
      vec3 starLayer(vec3 d, float N, float prob, float size, float tw){
        vec3 p = d*N; vec3 c = floor(p); vec3 r = h33(c);
        if(r.x > prob) return vec3(0.);
        vec3 sp = c + 0.25 + 0.5*h33(c+17.1);
        float dist = length(p-sp);
        float aa = length(fwidth(p))*0.75;
        float s = max(size, aa);
        float b = exp(-dist*dist/(s*s)) * (size*size)/(s*s);
        float twk = 0.72 + 0.28*sin(uTime*(1.5+3.0*r.y)*tw + r.z*40.0);
        vec3 col = mix(vec3(0.75,0.85,1.0), vec3(1.0,0.92,0.78), r.y);
        return col * b * twk * (0.5+0.9*r.z);
      }
      void main(){
        vec3 d = normalize(vDir);
        float el = d.y;
        // --- base gradient
        vec3 nightTop = vec3(0.008,0.014,0.055), nightHor = vec3(0.035,0.045,0.14);
        vec3 col = mix(nightHor, nightTop, smoothstep(-0.05,0.65,el));
        // city glow on the horizon: purple -> orange, strongest toward town
        float tg = pow(max(dot(normalize(vec3(d.x,0.,d.z)), uGlowDir),0.)*0.5+0.5, 2.0);
        float hor = exp(-max(el,0.)*7.0);
        col += uPollution * hor * mix(vec3(0.12,0.05,0.2), vec3(0.32,0.15,0.1), hor) * (0.35+0.65*tg);
        col += (1.0-uPollution) * hor * vec3(0.02,0.03,0.08);
        // --- milky band (only when dark)
        float band = exp(-pow(dot(d, normalize(vec3(0.3,0.25,-0.9)))*3.2,2.0));
        float mw = band * fbm(d*4.0) * (1.0-uPollution*0.9);
        col += mw * vec3(0.12,0.11,0.24) * 0.9;
        // --- stars
        float sv = (1.0 - 0.88*uPollution) * uStars * smoothstep(-0.02,0.12,el) * (1.0-uDay);
        vec3 st = starLayer(d,140.,0.10,0.10,1.0)*2.4 + starLayer(d,330.,0.35,0.085,1.4)*1.1 + starLayer(d,760.,0.55,0.08,2.0)*0.55*(1.0-uPollution);
        st *= 0.6 + 0.8*mw*3.0 + 0.4;
        col += st * sv;
        // --- moon
        float md = dot(d,uMoonDir);
        float moon = smoothstep(0.99955,0.99975,md);
        col += (1.0-uDay)*(moon*vec3(1.6,1.55,1.4)*(0.85+0.15*fbm(d*90.)) + pow(max(md,0.),900.)*vec3(0.35,0.4,0.6) + pow(max(md,0.),40.)*vec3(0.03,0.04,0.08));
        // --- comet (gnomonic projection around head)
        if(uComet>0.001){
          float dh = dot(d,uCometHead);
          if(dh>0.2){
            vec3 e1 = normalize(uCometTail - dot(uCometTail,uCometHead)*uCometHead);
            vec3 e2 = cross(uCometHead,e1);
            vec2 q = vec2(dot(d,e1), dot(d,e2))/dh;
            float x = q.x, y = q.y;
            float head = exp(-dot(q,q)/0.00002)*3.5 + exp(-dot(q,q)/0.0004)*0.9 + exp(-dot(q,q)/0.004)*0.25;
            float L = 0.95;
            float tx = clamp(x/L,0.,1.);
            float on = step(0.,x)*(1.0-smoothstep(0.75,1.0,tx));
            // ion tail: straight, narrow, blue
            float wI = 0.006 + 0.03*tx;
            float ion = on*exp(-y*y/(wI*wI))*pow(1.0-tx,1.4)*(0.75+0.25*sin(x*60.0-uTime*0.8+fbm(vec3(x*8.,y*30.,uTime*0.1))*4.0));
            // dust tail: curved, broad, golden-white
            float yc = y - 0.12*x*x*1.6;
            float wD = 0.01 + 0.09*tx;
            float dust = on*exp(-yc*yc/(wD*wD))*pow(1.0-tx,1.8);
            vec3 cc = head*vec3(1.0,0.98,0.92) + ion*vec3(0.35,0.7,1.25)*0.9 + dust*vec3(1.0,0.85,0.55)*0.8;
            col += cc * uComet * smoothstep(0.0,0.1,el+0.05);
          }
        }
        // --- day & dusk
        vec3 dayTop = vec3(0.18,0.42,0.85), dayHor = vec3(0.62,0.8,0.98);
        vec3 day = mix(dayHor, dayTop, smoothstep(-0.05,0.6,el));
        float sd = max(dot(d,uSunDir),0.);
        day += pow(sd,600.)*vec3(4.0,3.6,2.8) + pow(sd,8.)*vec3(0.25,0.2,0.1);
        // a few soft clouds
        float cl = smoothstep(0.55,0.8,fbm(vec3(d.xz/(el+0.25)*1.6, 1.0)));
        day = mix(day, vec3(1.0), cl*0.65*smoothstep(0.02,0.2,el));
        vec3 dusk = mix(vec3(1.0,0.5,0.25), vec3(0.22,0.14,0.45), smoothstep(-0.05,0.45,el));
        dusk += pow(sd,10.)*vec3(0.8,0.4,0.15);
        col = mix(col, dusk, uDusk);
        col = mix(col, day, uDay);
        gl_FragColor = vec4(col,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 64, 32), mat);
  sky.frustumCulled = false; sky.renderOrder = -10;
  return { sky, uniforms };
}
