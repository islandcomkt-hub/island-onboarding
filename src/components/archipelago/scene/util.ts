import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export const PALETTE = {
  ocean: 0x090313,
  purple: 0x10051f,
  shadow: 0x190a2d,
  orange: 0xff7417,
  cyan: 0x00c85a, // GREEN CYAN da marca (#00C85A); chave mantida por compatibilidade
  warm: 0xf7f4f0,
} as const;

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** ruído determinístico por posição: vértices duplicados deslocam igual (malha sem fendas) */
function hash3(x: number, y: number, z: number, seed: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed * 19.19) * 43758.5453;
  return s - Math.floor(s);
}

export function jitter(geo: THREE.BufferGeometry, amp: number, seed: number): THREE.BufferGeometry {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const k = (hash3(Math.round(v.x * 1000) / 1000, Math.round(v.y * 1000) / 1000, Math.round(v.z * 1000) / 1000, seed) - 0.5) * 2;
    const n = v.clone().normalize().multiplyScalar(k * amp);
    pos.setXYZ(i, v.x + n.x, v.y + n.y, v.z + n.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/** pinta vértices por altura (mais escuro embaixo, mais claro no topo) */
export function paintByHeight(
  geo: THREE.BufferGeometry,
  low: number,
  high: number,
  y0: number,
  y1: number,
  tint = 0,
): THREE.BufferGeometry {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const a = new THREE.Color(low);
  const b = new THREE.Color(high);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = THREE.MathUtils.clamp((pos.getY(i) - y0) / Math.max(1e-4, y1 - y0), 0, 1);
    c.copy(a).lerp(b, t);
    if (tint) c.offsetHSL(0, 0, tint);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geo;
}

export function paintFlat(geo: THREE.BufferGeometry, color: number): THREE.BufferGeometry {
  const n = geo.attributes.position.count;
  const colors = new Float32Array(n * 3);
  const c = new THREE.Color(color);
  for (let i = 0; i < n; i++) {
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geo;
}

/** garante atributos compatíveis (não indexado + cor) e mescla */
export function merge(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const prepared = geos.map((g) => {
    const ng = g.index ? g.toNonIndexed() : g;
    if (!ng.attributes.color) paintFlat(ng, 0xffffff);
    for (const name of Object.keys(ng.attributes)) {
      if (!["position", "normal", "color"].includes(name)) ng.deleteAttribute(name);
    }
    return ng;
  });
  const merged = mergeGeometries(prepared, false);
  prepared.forEach((g) => g.dispose());
  return merged ?? new THREE.BufferGeometry();
}

export function at(geo: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(sx, sy, sz),
  );
  geo.applyMatrix4(m);
  return geo;
}

export function rockGeometry(radius: number, seed: number, squashY = 0.8, low = 0x2c1a38, high = 0x8a5a66, detail = 1) {
  const g = new THREE.IcosahedronGeometry(radius, detail);
  jitter(g, radius * 0.28, seed);
  g.scale(1, squashY, 1);
  const top = radius * squashY;
  paintByHeight(g, low, high, -top, top);
  g.computeVertexNormals();
  return g;
}

export function glowTexture(inner = "rgba(255,255,255,1)", outer = "rgba(255,255,255,0)"): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.35, "rgba(255,255,255,0.35)");
  grad.addColorStop(1, outer);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Coleta recursos para descarte garantido */
export class Disposer {
  private items: Array<{ dispose(): void }> = [];
  track<T extends { dispose(): void }>(item: T): T {
    this.items.push(item);
    return item;
  }
  disposeAll() {
    this.items.forEach((i) => i.dispose());
    this.items = [];
  }
}

export const lerp = THREE.MathUtils.lerp;
export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
