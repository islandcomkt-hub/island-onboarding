import * as THREE from "three";
import type { StageId } from "@/config/stages";
import { ISLAND_LAYOUT } from "./layout";
import { Disposer, PALETTE, at, jitter, merge, mulberry32, paintByHeight, paintFlat, rockGeometry } from "./util";

export interface IslandHandle {
  id: StageId;
  root: THREE.Group;
  /** pivô de rótulo (HTML) acima da ilha */
  labelAnchor: THREE.Object3D;
  /** estados suavizados 0..1 (animados por GSAP no controlador) */
  cur: { active: number; done: number };
  light: THREE.PointLight;
  update(t: number): void;
  dispose(): void;
}

export interface IslandAssets {
  glow: THREE.Texture;
  disposer: Disposer;
  maxAnisotropy?: number;
}

type Updater = (t: number) => void;
type StateFn = (cur: { active: number; done: number }, t: number) => void;

class Ctx {
  solid: THREE.BufferGeometry[] = [];
  warmLamps: THREE.BufferGeometry[] = [];
  coolLamps: THREE.BufferGeometry[] = [];
  extras: THREE.Object3D[] = [];
  updaters: Updater[] = [];
  stateFns: StateFn[] = [];
  glows: Array<{ sprite: THREE.Sprite; kind: "warm" | "cool"; base: number }> = [];
  rnd: () => number;
  constructor(
    public seed: number,
    public assets: IslandAssets,
  ) {
    this.rnd = mulberry32(seed);
  }

  rock(r: number, x: number, y: number, z: number, squash = 0.8, low = 0x2c1a38, high = 0x8a5a66) {
    const g = rockGeometry(r, Math.floor(this.rnd() * 9999), squash, low, high, r > 0.5 ? 1 : 0);
    g.rotateY(this.rnd() * 6.28);
    this.solid.push(at(g, x, y, z));
  }
  box(w: number, h: number, d: number, x: number, y: number, z: number, color: number, ry = 0) {
    this.solid.push(at(paintFlat(new THREE.BoxGeometry(w, h, d), color), x, y + h / 2, z, 0, ry, 0));
  }
  cyl(rt: number, rb: number, h: number, x: number, y: number, z: number, color: number, seg = 8) {
    this.solid.push(at(paintFlat(new THREE.CylinderGeometry(rt, rb, h, seg), color), x, y + h / 2, z));
  }
  palm(x: number, y: number, z: number, h = 0.8, lean = 0.2, ry = 0) {
    const trunk = new THREE.CylinderGeometry(0.022, 0.04, h, 5, 4);
    trunk.translate(0, h / 2, 0);
    const p = trunk.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) + lean * Math.pow(p.getY(i) / h, 2) * h);
    paintFlat(trunk, 0x4a2e22);
    const parts: THREE.BufferGeometry[] = [trunk];
    const tipX = lean * h;
    for (let i = 0; i < 6; i++) {
      const leaf = new THREE.ConeGeometry(0.085, 0.52, 4);
      leaf.translate(0, 0.26, 0);
      leaf.scale(1, 1, 0.3);
      leaf.rotateZ(-(Math.PI / 2 - 0.5));
      leaf.rotateY((i / 6) * Math.PI * 2 + this.rnd() * 0.3);
      leaf.translate(tipX, h, 0);
      paintByHeight(leaf, 0x123d33, 0x2a7a55, -0.1, 0.3);
      parts.push(leaf);
    }
    const merged = merge(parts);
    this.solid.push(at(merged, x, y, z, 0, ry));
  }
  lamp(kind: "warm" | "cool", x: number, y: number, z: number, r = 0.045, glowSize = 0.9, glowBase = 1) {
    const g = new THREE.SphereGeometry(r, 8, 6);
    g.translate(x, y, z);
    (kind === "warm" ? this.warmLamps : this.coolLamps).push(g);
    if (glowSize > 0) {
      const mat = this.assets.disposer.track(
        new THREE.SpriteMaterial({
          map: this.assets.glow,
          color: kind === "warm" ? PALETTE.orange : PALETTE.cyan,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      const s = new THREE.Sprite(mat);
      s.position.set(x, y, z);
      s.scale.setScalar(glowSize);
      this.extras.push(s);
      this.glows.push({ sprite: s, kind, base: glowBase });
    }
  }
}

function waterfall(ctx: Ctx, w: number, h: number, x: number, y: number, z: number, ry: number) {
  const mat = ctx.assets.disposer.track(
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uI: { value: 0.3 } },
      vertexShader: "varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} ",
      fragmentShader: `varying vec2 vUv; uniform float uTime; uniform float uI;
        void main(){
          float s = sin(vUv.x*38.0)*0.5+0.5;
          float f = fract(vUv.y*2.6 + uTime*1.1 + s*0.35);
          float a = smoothstep(0.0,0.45,f)*(1.0-f);
          float edge = smoothstep(0.0,0.2,vUv.x)*smoothstep(1.0,0.8,vUv.x);
          vec3 col = mix(vec3(0.19,0.84,0.76), vec3(0.97,0.96,0.94), a);
          gl_FragColor = vec4(col*(a*0.9+0.1), (a*0.75+0.12)*edge*uI);
        }`,
    }),
  );
  const geo = ctx.assets.disposer.track(new THREE.PlaneGeometry(w, h, 1, 1));
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  ctx.extras.push(m);
  ctx.updaters.push((t) => (mat.uniforms.uTime.value = t));
  ctx.stateFns.push((c) => (mat.uniforms.uI.value = 0.35 + c.active * 0.6 + c.done * 0.45));
}

/* ───────── base compartilhada: rocha, areia, palmeiras ───────── */
function base(ctx: Ctx, opts: { mound: number; palms: Array<[number, number, number, number]> }) {
  const sand = new THREE.CylinderGeometry(1.12, 1.3, 0.16, 11);
  jitter(sand, 0.07, ctx.seed + 3);
  paintByHeight(sand, 0x3a2430, 0xb68660, -0.08, 0.08);
  ctx.solid.push(at(sand, 0, 0.02, 0));
  ctx.rock(opts.mound * 1.12, 0, 0.35, 0, 0.8);
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + ctx.rnd() * 0.5;
    const d = 1.25 + ctx.rnd() * 0.45;
    ctx.rock(0.14 + ctx.rnd() * 0.2, Math.cos(a) * d, 0.08, Math.sin(a) * d, 0.8);
  }
  for (const [x, z, h, lean] of opts.palms) ctx.palm(x, 0.1, z, h, lean, ctx.rnd() * 6);
}

/* ───────── as seis ilhas ───────── */
const builders: Record<StageId, (ctx: Ctx) => { lampY: number }> = {
  // 01 — farol de partida
  partida(ctx) {
    base(ctx, { mound: 0.95, palms: [[0.95, 0.5, 0.75, 0.25], [-0.2, 1.15, 0.65, -0.2], [1.15, -0.4, 0.6, 0.2]] });
    ctx.rock(0.55, -0.35, 0.75, -0.1, 0.9, 0x32203e, 0x8e5c68);
    const bands = [0xefe3d3, 0xd65a1d, 0xefe3d3, 0xd65a1d];
    bands.forEach((c, i) => ctx.cyl(0.2 - i * 0.025, 0.24 - i * 0.025, 0.28, -0.35, 0.95 + i * 0.28, -0.1, c, 10));
    ctx.cyl(0.26, 0.2, 0.06, -0.35, 2.07, -0.1, 0x2b1a2f, 10);
    ctx.cyl(0.11, 0.11, 0.2, -0.35, 2.13, -0.1, 0x2b1a2f, 8);
    const roof = new THREE.ConeGeometry(0.17, 0.2, 8);
    ctx.solid.push(at(paintFlat(roof, 0x2b1a2f), -0.35, 2.43, -0.1));
    ctx.lamp("warm", -0.35, 2.23, -0.1, 0.095, 1.6, 1.2);
    ctx.lamp("warm", 1.15, 0.28, 1.0, 0.05, 0.6, 0.8);
    ctx.lamp("cool", -1.0, 0.18, 0.7, 0.04, 0.5, 0.7);
    // feixe giratório
    const beamGeo = ctx.assets.disposer.track(new THREE.ConeGeometry(0.42, 3.2, 20, 1, true));
    beamGeo.translate(0, -1.6, 0);
    beamGeo.rotateZ(Math.PI / 2);
    const cols = new Float32Array(beamGeo.attributes.position.count * 3);
    for (let i = 0; i < beamGeo.attributes.position.count; i++) {
      const k = 1 - Math.min(1, Math.abs(beamGeo.attributes.position.getX(i)) / 3.2);
      cols[i * 3] = 1 * k;
      cols[i * 3 + 1] = 0.45 * k;
      cols[i * 3 + 2] = 0.09 * k;
    }
    beamGeo.setAttribute("color", new THREE.BufferAttribute(cols, 3));
    const beamMat = ctx.assets.disposer.track(
      new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
    );
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.set(-0.35, 2.23, -0.1);
    ctx.extras.push(beam);
    ctx.updaters.push((t) => (beam.rotation.y = t * 0.7 + 2.2));
    ctx.stateFns.push((c) => (beamMat.opacity = 0.07 + c.active * 0.28 + c.done * 0.05));
    return { lampY: 2.2 };
  },
  // 02 — ilha de negócios: pico + cachoeiras + elemento técnico (antena)
  negocio(ctx) {
    base(ctx, { mound: 0.9, palms: [[0.9, 0.7, 0.7, 0.2], [-1.0, 0.5, 0.6, -0.25], [0.4, -1.1, 0.65, 0.1]] });
    ctx.rock(0.62, 0.0, 0.95, -0.15, 1.35, 0x32203e, 0x8e5c68);
    ctx.rock(0.32, -0.55, 0.55, 0.2, 1.0);
    ctx.box(0.34, 0.2, 0.3, 0.75, 0.25, 0.1, 0x3a2430);
    ctx.solid.push(at(paintFlat(new THREE.ConeGeometry(0.28, 0.16, 4), 0x20121f), 0.75, 0.55, 0.1, 0, Math.PI / 4));
    ctx.lamp("warm", 0.75, 0.38, 0.27, 0.035, 0.45, 0.8);
    ctx.lamp("warm", 0.2, 0.6, 0.55, 0.03, 0.4, 0.6);
    // antena técnica com luz ciano pulsante
    ctx.cyl(0.012, 0.018, 0.75, -0.2, 1.7, -0.15, 0x6c5a7a, 5);
    ctx.box(0.22, 0.012, 0.012, -0.2, 2.25, -0.15, 0x6c5a7a);
    ctx.lamp("cool", -0.2, 2.5, -0.15, 0.045, 0.8, 1);
    waterfall(ctx, 0.2, 0.75, 0.48, 0.58, 0.62, 0.55);
    waterfall(ctx, 0.14, 0.6, 0.18, 0.5, 0.78, 0.2);
    return { lampY: 2.3 };
  },
  // 03 — desafio: formação rochosa com espiras
  desafio(ctx) {
    base(ctx, { mound: 1.0, palms: [[1.05, 0.55, 0.7, 0.25], [-1.05, 0.6, 0.62, -0.2]] });
    ctx.rock(0.55, 0.0, 0.9, 0.0, 1.9, 0x2c1a38, 0x9a6470);
    ctx.rock(0.4, 0.55, 0.75, -0.3, 1.5, 0x32203e, 0x8e5c68);
    ctx.rock(0.34, -0.5, 0.7, 0.25, 1.4);
    ctx.rock(0.22, 0.2, 1.7, 0.1, 1.5, 0x3a2030, 0x9a6560);
    ctx.lamp("warm", 0.85, 0.35, 0.45, 0.045, 0.7, 1);
    ctx.lamp("warm", -0.8, 0.3, 0.7, 0.04, 0.55, 0.8);
    ctx.lamp("warm", 0.1, 0.35, 1.0, 0.04, 0.55, 0.8);
    ctx.lamp("cool", -0.1, 2.0, -0.1, 0.04, 0.5, 0.8);
    return { lampY: 2.1 };
  },
  // 04 — destino: passagem em arco + estrutura/templo
  destino(ctx) {
    base(ctx, { mound: 0.8, palms: [[1.1, 0.45, 0.7, 0.2], [-1.15, -0.2, 0.6, -0.2], [0.6, -1.0, 0.62, 0.15]] });
    // arco rochoso
    const arch = new THREE.TorusGeometry(0.5, 0.2, 6, 9, Math.PI);
    jitter(arch, 0.05, ctx.seed + 7);
    paintByHeight(arch, 0x32203e, 0x8e5c68, 0, 0.7);
    ctx.solid.push(at(arch, 0.55, 0.15, 0.85, 0, 0.25));
    ctx.rock(0.45, -0.3, 0.55, 0.0, 1.0);
    // templo em degraus
    ctx.box(0.7, 0.14, 0.6, -0.3, 0.7, -0.15, 0x4a2c3a);
    ctx.box(0.5, 0.14, 0.42, -0.3, 0.84, -0.15, 0x5a3547);
    ctx.box(0.3, 0.22, 0.26, -0.3, 0.98, -0.15, 0x6a4052);
    ctx.solid.push(at(paintFlat(new THREE.ConeGeometry(0.28, 0.24, 4), 0x20121f), -0.3, 1.32, -0.15, 0, Math.PI / 4));
    ctx.lamp("warm", -0.3, 1.1, 0.0, 0.05, 0.9, 1.1);
    ctx.lamp("warm", 0.55, 0.15, 0.85, 0.04, 0.5, 0.7);
    ctx.lamp("warm", 1.05, 0.3, 0.2, 0.04, 0.5, 0.7);
    ctx.lamp("cool", -0.9, 0.2, 0.55, 0.035, 0.4, 0.6);
    return { lampY: 1.3 };
  },
  // 05 — momento: torre com lanterna + marco circular (anel)
  momento(ctx) {
    base(ctx, { mound: 0.9, palms: [[1.0, 0.5, 0.68, 0.2], [-1.0, 0.7, 0.6, -0.2], [0.8, -0.9, 0.62, 0.2]] });
    ctx.rock(0.5, 0.2, 0.85, -0.1, 1.0);
    ctx.cyl(0.14, 0.2, 0.7, 0.2, 1.1, -0.1, 0x3a2430, 8);
    ctx.cyl(0.2, 0.16, 0.06, 0.2, 1.8, -0.1, 0x2b1a2f, 8);
    ctx.cyl(0.09, 0.09, 0.16, 0.2, 1.86, -0.1, 0x2b1a2f, 6);
    ctx.solid.push(at(paintFlat(new THREE.ConeGeometry(0.13, 0.16, 6), 0x2b1a2f), 0.2, 2.1, -0.1));
    ctx.lamp("warm", 0.2, 1.95, -0.1, 0.075, 1.3, 1.1);
    // marco circular ciano (anel girando)
    const ringMat = ctx.assets.disposer.track(new THREE.MeshBasicMaterial({ color: PALETTE.cyan, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }));
    const ringGeo = ctx.assets.disposer.track(new THREE.TorusGeometry(0.46, 0.022, 6, 40));
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0.15, 0.62, 0.95);
    ctx.extras.push(ring);
    ctx.updaters.push((t) => {
      ring.rotation.z = t * 0.5;
      ring.position.y = 0.62 + Math.sin(t * 1.3) * 0.03;
    });
    ctx.stateFns.push((c) => (ringMat.opacity = 0.22 + c.active * 0.4 + c.done * 0.4));
    ctx.cyl(0.4, 0.46, 0.08, 0.15, 0.3, 0.95, 0x2b1a2f, 16);
    ctx.lamp("cool", 0.15, 0.7, 0.95, 0.04, 0.6, 0.9);
    waterfall(ctx, 0.2, 0.7, 0.7, 0.5, -0.5, -0.6);
    return { lampY: 2.0 };
  },
  // 06 — conexão: feixe ciano + plataforma + escadas
  conexao(ctx) {
    base(ctx, { mound: 0.95, palms: [[1.1, 0.4, 0.72, 0.2], [-1.1, 0.6, 0.62, -0.2], [0.9, -0.9, 0.6, 0.15]] });
    ctx.rock(0.5, 0.0, 0.8, -0.1, 1.1, 0x32203e, 0x8e5c68);
    ctx.cyl(0.46, 0.5, 0.1, 0.0, 1.2, -0.1, 0x2b1a2f, 16);
    for (let i = 0; i < 4; i++) ctx.box(0.5 - i * 0.04, 0.07, 0.16, 0.65 + i * 0.12, 0.2 + i * 0.1, 0.3 + i * 0.1, 0x5a3547, -0.4);
    ctx.box(0.34, 0.2, 0.28, -0.8, 0.28, 0.5, 0x3a2430);
    ctx.solid.push(at(paintFlat(new THREE.ConeGeometry(0.26, 0.15, 4), 0x20121f), -0.8, 0.58, 0.5, 0, Math.PI / 4));
    ctx.lamp("warm", -0.8, 0.4, 0.66, 0.035, 0.55, 0.8);
    ctx.lamp("warm", 1.1, 0.25, 0.2, 0.04, 0.5, 0.7);
    // anel + feixe ciano vertical
    const ringMat = ctx.assets.disposer.track(new THREE.MeshBasicMaterial({ color: PALETTE.cyan, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
    const ring = new THREE.Mesh(ctx.assets.disposer.track(new THREE.TorusGeometry(0.4, 0.02, 6, 36)), ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, 1.3, -0.1);
    ctx.extras.push(ring);
    const beamMat = ctx.assets.disposer.track(new THREE.MeshBasicMaterial({ color: PALETTE.cyan, transparent: true, opacity: 0.15, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    const beam = new THREE.Mesh(ctx.assets.disposer.track(new THREE.CylinderGeometry(0.05, 0.3, 2.2, 16, 1, true)), beamMat);
    beam.position.set(0, 2.4, -0.1);
    ctx.extras.push(beam);
    ctx.updaters.push((t) => {
      ring.rotation.z = -t * 0.7;
      ring.scale.setScalar(1 + Math.sin(t * 1.6) * 0.04);
    });
    ctx.stateFns.push((c) => {
      beamMat.opacity = 0.07 + c.active * 0.22 + c.done * 0.4;
      ringMat.opacity = 0.3 + c.active * 0.3 + c.done * 0.4;
    });
    ctx.lamp("cool", 0, 1.35, -0.1, 0.06, 1.1, 1.1);
    return { lampY: 2.4 };
  },
};

/** Constrói uma ilha independente (grupo próprio, pivô no centro da ilha ao nível do mar). */
export function buildIsland(id: StageId, assets: IslandAssets, sharedFoam: THREE.Material, rockMat: THREE.Material): IslandHandle {
  const layout = ISLAND_LAYOUT.find((l) => l.id === id)!;
  const index = ISLAND_LAYOUT.indexOf(layout);
  const ctx = new Ctx(1000 + index * 77, assets);
  const { lampY } = builders[id](ctx);
  const d = assets.disposer;

  const root = new THREE.Group();
  root.name = `island:${id}`;
  root.userData.id = id;
  root.position.set(layout.x, 0, layout.z);
  root.rotation.y = layout.rotY;
  root.scale.setScalar(layout.scale);

  const solidGeo = d.track(merge(ctx.solid));
  ctx.solid.forEach((g) => g.dispose());
  const solid = new THREE.Mesh(solidGeo, rockMat);
  solid.name = "solid";
  root.add(solid);

  const warmMat = d.track(new THREE.MeshStandardMaterial({ color: 0x2a1208, emissive: PALETTE.orange, emissiveIntensity: 0.2, roughness: 0.6 }));
  const coolMat = d.track(new THREE.MeshStandardMaterial({ color: 0x082a28, emissive: PALETTE.cyan, emissiveIntensity: 0.2, roughness: 0.6 }));
  if (ctx.warmLamps.length) {
    const g = d.track(merge(ctx.warmLamps));
    root.add(new THREE.Mesh(g, warmMat));
  }
  if (ctx.coolLamps.length) {
    const g = d.track(merge(ctx.coolLamps));
    root.add(new THREE.Mesh(g, coolMat));
  }
  ctx.extras.forEach((o) => root.add(o));

  const foam = new THREE.Mesh(d.track(new THREE.RingGeometry(1.32, 1.62, 40, 1)), sharedFoam);
  foam.rotation.x = -Math.PI / 2;
  foam.position.y = 0.03;
  foam.name = "foam";
  root.add(foam);

  const light = new THREE.PointLight(PALETTE.orange, 0, 5.5, 1.6);
  light.position.set(0, lampY, 0);
  root.add(light);

  const labelAnchor = new THREE.Object3D();
  labelAnchor.position.set(-0.2, lampY + 0.9, 0);
  root.add(labelAnchor);

  const cur = { active: 0, done: 0 };
  const phase = index * 1.3;
  const orange = new THREE.Color(PALETTE.orange);
  const cyan = new THREE.Color(PALETTE.cyan);

  const update = (t: number) => {
    const pulse = Math.sin(t * 2.1 + phase);
    warmMat.emissiveIntensity = 0.22 + cur.active * (1.35 + 0.3 * pulse) + cur.done * 0.2;
    coolMat.emissiveIntensity = 0.18 + cur.active * 0.45 + cur.done * (1.1 + 0.15 * Math.sin(t * 1.6 + phase));
    for (const g of ctx.glows) {
      const o =
        g.kind === "warm"
          ? 0.12 + cur.active * (0.8 + 0.12 * pulse) + cur.done * 0.12
          : 0.1 + cur.active * 0.25 + cur.done * 0.6;
      (g.sprite.material as THREE.SpriteMaterial).opacity = Math.min(1, o * g.base);
    }
    light.color.copy(orange).lerp(cyan, cur.done * (1 - cur.active));
    light.intensity = (0.15 + cur.active * 1.4 + cur.done * 0.7) * (1 + 0.1 * pulse);
    foam.rotation.z = t * 0.05 + phase;
    ctx.stateFns.forEach((fn) => fn(cur, t));
    ctx.updaters.forEach((fn) => fn(t));
  };

  return {
    id,
    root,
    labelAnchor,
    cur,
    light,
    update,
    dispose() {
      d.disposeAll();
    },
  };
}

export function createSharedMaterials(disposer: Disposer) {
  const rock = disposer.track(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92, metalness: 0.02 }));
  const foam = disposer.track(
    new THREE.MeshBasicMaterial({ color: 0xbff7ee, transparent: true, opacity: 0.1, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
  );
  return { rock, foam };
}
