import * as THREE from "three";
import { Disposer, PALETTE, mulberry32 } from "./util";

export interface AmbientHandle {
  group: THREE.Group;
  setCount(n: number): void;
  update(t: number): void;
}

/** brasas/vaga-lumes (orange/cyan) + bancos de névoa roxa à deriva. Tudo contínuo, sem hover. */
export function buildAmbient(glow: THREE.Texture, disposer: Disposer, maxParticles: number): AmbientHandle {
  const group = new THREE.Group();
  const rnd = mulberry32(4242);
  const pos = new Float32Array(maxParticles * 3);
  const phase = new Float32Array(maxParticles);
  const col = new Float32Array(maxParticles * 3);
  const orange = new THREE.Color(PALETTE.orange);
  const cyan = new THREE.Color(PALETTE.cyan);
  for (let i = 0; i < maxParticles; i++) {
    pos[i * 3] = (rnd() - 0.5) * 18;
    pos[i * 3 + 1] = 0.4 + rnd() * 2.6;
    pos[i * 3 + 2] = (rnd() - 0.5) * 9;
    phase[i] = rnd() * 6.28;
    const c = rnd() > 0.35 ? orange : cyan;
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  const geo = disposer.track(new THREE.BufferGeometry());
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.setDrawRange(0, maxParticles);
  const mat = disposer.track(
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uMap: { value: glow }, uScale: { value: 1 } },
      vertexShader: `
        attribute float aPhase; attribute vec3 color; varying vec3 vC; varying float vA; uniform float uTime;
        void main(){
          vec3 p = position;
          p.y += sin(uTime*0.6 + aPhase)*0.35 + mod(uTime*0.05 + aPhase, 1.0)*0.4;
          p.x += sin(uTime*0.25 + aPhase*2.0)*0.4;
          p.z += cos(uTime*0.2 + aPhase)*0.3;
          vec4 mv = modelViewMatrix*vec4(p,1.0);
          gl_Position = projectionMatrix*mv;
          gl_PointSize = (7.0 + 5.0*sin(uTime*1.3+aPhase)) * (14.0 / -mv.z) * 3.0;
          vC = color; vA = 0.35 + 0.45*(0.5+0.5*sin(uTime*1.7+aPhase*3.0));
        }`,
      fragmentShader: `
        uniform sampler2D uMap; varying vec3 vC; varying float vA;
        void main(){ vec4 t = texture2D(uMap, gl_PointCoord); gl_FragColor = vec4(vC*t.a*vA, t.a*vA); }`,
    }),
  );
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  group.add(points);

  const mistTex = disposer.track(
    (() => {
      const c = document.createElement("canvas");
      c.width = c.height = 128;
      const ctx = c.getContext("2d")!;
      const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, "rgba(120,60,190,0.55)");
      g.addColorStop(1, "rgba(120,60,190,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 128, 128);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })(),
  );
  const mists: Array<{ s: THREE.Sprite; bx: number; bz: number; sp: number; ph: number }> = [];
  const spots: Array<[number, number, number]> = [[-9.5, -4.5, 7], [9.8, -4.8, 7], [-9.8, 4.6, 6], [10, 4.4, 6.5], [0, -5.6, 9]];
  spots.forEach(([x, z, size], i) => {
    const m = disposer.track(new THREE.SpriteMaterial({ map: mistTex, transparent: true, opacity: 0.55, depthWrite: false, color: 0x4a1d86 }));
    const s = new THREE.Sprite(m);
    s.position.set(x, 1.0, z);
    s.scale.set(size * 1.6, size, 1);
    group.add(s);
    mists.push({ s, bx: x, bz: z, sp: 0.05 + i * 0.01, ph: i * 1.7 });
  });

  return {
    group,
    setCount(n) {
      geo.setDrawRange(0, Math.min(n, maxParticles));
    },
    update(t) {
      mat.uniforms.uTime.value = t;
      for (const m of mists) {
        m.s.position.x = m.bx + Math.sin(t * m.sp + m.ph) * 1.4;
        m.s.position.z = m.bz + Math.cos(t * m.sp * 0.8 + m.ph) * 0.6;
      }
    },
  };
}
