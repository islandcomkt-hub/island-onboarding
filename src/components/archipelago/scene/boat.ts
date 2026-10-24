import * as THREE from "three";
import { Disposer, PALETTE, merge, paintFlat } from "./util";

/**
 * Barco ORIGINAL da Island: casco compacto arredondado de madeira escura, frisos laranja,
 * pequena cabine, mastro, vela escura com marca geométrica abstrata (dois chevrons + ponto),
 * lanternas laranja, luz ciano sob o casco e rastro leve.
 * Sem carranca/figura de proa, sem bandeiras e sem a logo oficial.
 */
export interface BoatHandle {
  root: THREE.Group;
  body: THREE.Group;
  /** posição de popa em coordenadas de mundo (para o rastro) */
  stern(out: THREE.Vector3): THREE.Vector3;
  update(t: number, speed: number): void;
  setTrailEnabled(on: boolean): void;
  updateTrail(t: number, speed: number): void;
  trail: THREE.Mesh;
  dispose(): void;
}

function hullGeometry(L: number, W: number): THREE.BufferGeometry {
  const stations = 16;
  const ring = 7;
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const wood = new THREE.Color(0x3b1f18);
  const woodLight = new THREE.Color(0x6a3b26);
  const c = new THREE.Color();
  const profile = (s: number) => {
    const e = Math.abs(2 * s - 1);
    const w = W * Math.pow(Math.max(0, 1 - Math.pow(e, s > 0.5 ? 2.3 : 3.2)), 0.55);
    const top = 0.17 + 0.12 * Math.pow(s, 2.6) + 0.05 * Math.pow(1 - s, 3);
    const bot = -0.11 * (1 - Math.pow(e, 2)) - 0.01;
    return { w, top, bot };
  };
  for (let i = 0; i <= stations; i++) {
    const s = i / stations;
    const z = (s - 0.5) * L;
    const { w, top, bot } = profile(s);
    for (let side = 0; side < 2; side++) {
      const sx = side === 0 ? 1 : -1;
      for (let k = 0; k <= ring; k++) {
        const th = (k / ring) * (Math.PI / 2);
        const x = sx * w * Math.cos(th);
        const y = top - (top - bot) * Math.sin(th);
        pos.push(x, y, z);
        c.copy(wood).lerp(woodLight, Math.sin(th * 3) * 0.25 + 0.2 * (1 - k / ring));
        col.push(c.r, c.g, c.b);
      }
    }
  }
  const perStation = 2 * (ring + 1);
  for (let i = 0; i < stations; i++) {
    for (let side = 0; side < 2; side++) {
      for (let k = 0; k < ring; k++) {
        const a = i * perStation + side * (ring + 1) + k;
        const b = a + 1;
        const a2 = a + perStation;
        const b2 = b + perStation;
        if (side === 0) idx.push(a, a2, b, b, a2, b2);
        else idx.push(a, b, a2, b, b2, a2);
      }
    }
  }
  // convés
  const deckStart = pos.length / 3;
  const deck = new THREE.Color(0x5a3524);
  for (let i = 0; i <= stations; i++) {
    const s = i / stations;
    const z = (s - 0.5) * L;
    const { w, top } = profile(s);
    pos.push(w * 0.98, top, z, -w * 0.98, top, z);
    col.push(deck.r, deck.g, deck.b, deck.r, deck.g, deck.b);
  }
  for (let i = 0; i < stations; i++) {
    const a = deckStart + i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** fita laranja acompanhando a borda do casco (friso) */
function trimGeometry(L: number, W: number, yOffset: number, scaleW: number): THREE.BufferGeometry {
  const pts: THREE.Vector3[] = [];
  const stations = 20;
  for (let i = 0; i <= stations; i++) {
    const s = i / stations;
    const e = Math.abs(2 * s - 1);
    const w = W * Math.pow(Math.max(0.001, 1 - Math.pow(e, s > 0.5 ? 2.3 : 3.2)), 0.55) * scaleW;
    const top = 0.17 + 0.12 * Math.pow(s, 2.6) + 0.05 * Math.pow(1 - s, 3) + yOffset;
    pts.push(new THREE.Vector3(w, top, (s - 0.5) * L));
  }
  const mirror = pts.map((p) => new THREE.Vector3(-p.x, p.y, p.z)).reverse();
  const curve = new THREE.CatmullRomCurve3([...pts, ...mirror], true);
  return new THREE.TubeGeometry(curve, 80, 0.011, 4, true);
}

function sailGeometry(w: number, h: number, bulge: number, offset = 0): THREE.PlaneGeometry {
  const g = new THREE.PlaneGeometry(w, h, 8, 8);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) / w + 0.5;
    const v = p.getY(i) / h + 0.5;
    p.setZ(i, Math.sin(Math.PI * u) * bulge * (0.35 + 0.65 * (1 - v)) + offset);
  }
  g.computeVertexNormals();
  return g;
}

function markTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, 256, 256);
  ctx.strokeStyle = "#ff7417";
  ctx.lineWidth = 14;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const y of [96, 150]) {
    ctx.beginPath();
    ctx.moveTo(64, y + 52);
    ctx.lineTo(128, y);
    ctx.lineTo(192, y + 52);
    ctx.stroke();
  }
  ctx.fillStyle = "#00c85a";
  ctx.beginPath();
  ctx.arc(128, 60, 12, 0, Math.PI * 2);
  ctx.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildBoat(glow: THREE.Texture, disposer: Disposer): BoatHandle {
  const d = disposer;
  const L = 1.05;
  const W = 0.2;
  const root = new THREE.Group();
  root.name = "boat";
  const body = new THREE.Group();
  root.add(body);

  const woodMat = d.track(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.05, side: THREE.DoubleSide }));
  const hull = new THREE.Mesh(d.track(hullGeometry(L, W)), woodMat);
  body.add(hull);

  const trimMat = d.track(new THREE.MeshStandardMaterial({ color: 0x3a1500, emissive: PALETTE.orange, emissiveIntensity: 1.1, roughness: 0.5 }));
  body.add(new THREE.Mesh(d.track(trimGeometry(L, W, 0.012, 1.0)), trimMat));
  const trim2 = new THREE.Mesh(d.track(trimGeometry(L, W, -0.07, 0.9)), trimMat);
  body.add(trim2);

  // cabine
  const cabinGeos = [
    (() => {
      const g = new THREE.BoxGeometry(0.2, 0.13, 0.24);
      g.translate(0, 0.17 + 0.065, -0.22);
      return paintFlat(g, 0x4b2a1e);
    })(),
    (() => {
      const g = new THREE.BoxGeometry(0.24, 0.03, 0.28);
      g.translate(0, 0.17 + 0.145, -0.22);
      return paintFlat(g, 0x22111a);
    })(),
  ];
  body.add(new THREE.Mesh(d.track(merge(cabinGeos)), woodMat));
  const winMat = d.track(new THREE.MeshBasicMaterial({ color: 0xffa24a }));
  for (const sx of [-1, 1]) {
    const w = new THREE.Mesh(d.track(new THREE.PlaneGeometry(0.07, 0.05)), winMat);
    w.position.set(sx * 0.1005, 0.25, -0.22);
    w.rotation.y = (sx * Math.PI) / 2;
    body.add(w);
  }

  // mastro e vergas
  const mastMat = d.track(new THREE.MeshStandardMaterial({ color: 0x2b1810, roughness: 0.8 }));
  const mast = new THREE.Mesh(d.track(new THREE.CylinderGeometry(0.012, 0.018, 0.95, 6)), mastMat);
  mast.position.set(0, 0.17 + 0.475, 0.12);
  body.add(mast);
  const yard = new THREE.Mesh(d.track(new THREE.CylinderGeometry(0.008, 0.008, 0.5, 5)), mastMat);
  yard.rotation.z = Math.PI / 2;
  yard.position.set(0, 0.17 + 0.88, 0.12);
  body.add(yard);

  // vela com oscilação sutil + marca geométrica
  const sailMat = d.track(new THREE.MeshStandardMaterial({ color: 0x1b0f33, emissive: 0x120826, emissiveIntensity: 0.6, roughness: 0.9, side: THREE.DoubleSide }));
  const sailGeo = d.track(sailGeometry(0.46, 0.6, 0.06));
  const sail = new THREE.Mesh(sailGeo, sailMat);
  sail.position.set(0, 0.17 + 0.57, 0.12);
  body.add(sail);
  const markTex = d.track(markTexture());
  const markGeo = d.track(sailGeometry(0.3, 0.3, 0.06, 0.006));
  const markMat = d.track(new THREE.MeshBasicMaterial({ map: markTex, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  const mark = new THREE.Mesh(markGeo, markMat);
  mark.position.set(0, 0.17 + 0.6, 0.12);
  body.add(mark);
  const sailBase = (sailGeo.attributes.position as THREE.BufferAttribute).array.slice() as Float32Array;

  // cabos
  const rigMat = d.track(new THREE.LineBasicMaterial({ color: 0x6a4a60, transparent: true, opacity: 0.7 }));
  const rig = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 1.1, 0.12), new THREE.Vector3(0, 0.3, 0.52),
    new THREE.Vector3(0, 1.1, 0.12), new THREE.Vector3(0, 0.26, -0.5),
  ]);
  d.track(rig);
  body.add(new THREE.LineSegments(rig, rigMat));

  // lanternas
  const lampGeos: THREE.BufferGeometry[] = [];
  const lampPositions: Array<[number, number, number, number]> = [
    [0, 0.34, 0.5, 0.03], [0.13, 0.35, -0.46, 0.028], [-0.13, 0.35, -0.46, 0.028], [0, 1.13, 0.12, 0.022],
  ];
  for (const [x, y, z, r] of lampPositions) {
    const g = new THREE.SphereGeometry(r, 8, 6);
    g.translate(x, y, z);
    lampGeos.push(g);
  }
  const lampMat = d.track(new THREE.MeshBasicMaterial({ color: 0xffb066 }));
  body.add(new THREE.Mesh(d.track(merge(lampGeos)), lampMat));
  const glowMats: THREE.SpriteMaterial[] = [];
  for (const [x, y, z] of lampPositions) {
    const m = d.track(new THREE.SpriteMaterial({ map: glow, color: PALETTE.orange, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
    glowMats.push(m);
    const s = new THREE.Sprite(m);
    s.position.set(x, y, z);
    s.scale.setScalar(0.32);
    body.add(s);
  }

  // brilho ciano sob o casco
  const underMat = d.track(new THREE.MeshBasicMaterial({ map: glow, color: PALETTE.cyan, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
  const under = new THREE.Mesh(d.track(new THREE.PlaneGeometry(1.5, 0.8)), underMat);
  under.rotation.x = -Math.PI / 2;
  under.position.y = -0.1;
  root.add(under);

  /* rastro: fita com fade temporal */
  const N = 40;
  const trailPos = new Float32Array(N * 2 * 3);
  const trailCol = new Float32Array(N * 2 * 3);
  const trailGeo = d.track(new THREE.BufferGeometry());
  trailGeo.setAttribute("position", new THREE.BufferAttribute(trailPos, 3));
  trailGeo.setAttribute("color", new THREE.BufferAttribute(trailCol, 3));
  const tIdx: number[] = [];
  for (let i = 0; i < N - 1; i++) tIdx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  trailGeo.setIndex(tIdx);
  trailGeo.setDrawRange(0, 0);
  const trailMat = d.track(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  const trail = new THREE.Mesh(trailGeo, trailMat);
  trail.frustumCulled = false;
  trail.renderOrder = 2;
  const trailPts: Array<{ p: THREE.Vector3; born: number }> = [];
  let trailEnabled = true;
  const tmp = new THREE.Vector3();
  const side = new THREE.Vector3();
  const cyan = new THREE.Color(PALETTE.cyan);

  const stern = (out: THREE.Vector3) => out.set(0, 0.02, -L * 0.48).applyMatrix4(root.matrixWorld);

  const sailPos = sailGeo.attributes.position as THREE.BufferAttribute;
  const update = (t: number, speed: number) => {
    // balanço suave
    body.position.y = Math.sin(t * 1.7) * 0.012 + speed * 0.01;
    body.rotation.z = Math.sin(t * 1.3 + 1.2) * 0.04 + speed * 0.02;
    body.rotation.x = Math.sin(t * 1.5) * 0.02 - speed * 0.03;
    // vela oscila
    for (let i = 0; i < sailPos.count; i++) {
      const bx = sailBase[i * 3];
      const by = sailBase[i * 3 + 1];
      const bz = sailBase[i * 3 + 2];
      const sway = Math.sin(t * 1.6 + by * 4 + bx * 2) * 0.012 * (0.5 + (by / 0.6 + 0.5));
      sailPos.setZ(i, bz + sway);
    }
    sailPos.needsUpdate = true;
    const pulse = 0.8 + Math.sin(t * 3.1) * 0.12;
    glowMats.forEach((m, i) => (m.opacity = pulse * (i === 3 ? 0.7 : 0.9)));
    underMat.opacity = 0.5 + Math.sin(t * 1.9) * 0.1 + speed * 0.25;
  };

  const updateTrail = (t: number, speed: number) => {
    if (!trailEnabled) {
      trailGeo.setDrawRange(0, 0);
      return;
    }
    root.updateMatrixWorld();
    stern(tmp);
    const last = trailPts[trailPts.length - 1];
    if (!last || last.p.distanceTo(tmp) > 0.045) {
      if (speed > 0.02 || !last) trailPts.push({ p: tmp.clone(), born: t });
    }
    while (trailPts.length && t - trailPts[0].born > 1.8) trailPts.shift();
    while (trailPts.length > N) trailPts.shift();
    const n = trailPts.length;
    if (n < 2) {
      trailGeo.setDrawRange(0, 0);
      return;
    }
    for (let i = 0; i < n; i++) {
      const pt = trailPts[i];
      const age = (t - pt.born) / 1.8;
      const dir = trailPts[Math.min(n - 1, i + 1)].p.clone().sub(trailPts[Math.max(0, i - 1)].p);
      side.set(-dir.z, 0, dir.x).normalize().multiplyScalar(0.05 + age * 0.09);
      trailPos.set([pt.p.x + side.x, 0.03, pt.p.z + side.z, pt.p.x - side.x, 0.03, pt.p.z - side.z], i * 6);
      const a = Math.max(0, 1 - age) * 0.38;
      const r = cyan.r * a, g = cyan.g * a, b = cyan.b * a;
      trailCol.set([r, g, b, r, g, b], i * 6);
    }
    trailGeo.setDrawRange(0, (n - 1) * 6);
    (trailGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (trailGeo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  };

  return {
    root,
    body,
    stern,
    update,
    updateTrail,
    setTrailEnabled(on: boolean) {
      trailEnabled = on;
      if (!on) trailPts.length = 0;
    },
    trail,
    dispose() {
      d.disposeAll();
    },
  };
}
