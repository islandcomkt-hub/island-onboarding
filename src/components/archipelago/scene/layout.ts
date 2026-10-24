import * as THREE from "three";
import type { StageId } from "@/config/stages";

/** Coordenadas no plano do mar (x, z). Inspirado na composição da referência (6 ilhas em arco). */
export interface IslandLayout {
  id: StageId;
  x: number;
  z: number;
  rotY: number;
  scale: number;
  /** ponto onde o barco atraca (mundo) */
  dock: [number, number];
}

export const ISLAND_LAYOUT: IslandLayout[] = [
  { id: "partida", x: -3.6, z: 2.3, rotY: 0.35, scale: 1.0, dock: [-1.75, 2.75] },
  { id: "negocio", x: -6.7, z: -1.1, rotY: -0.2, scale: 1.0, dock: [-4.75, -0.35] },
  { id: "desafio", x: -0.9, z: -2.9, rotY: 0.1, scale: 1.05, dock: [-1.3, -1.15] },
  { id: "destino", x: 4.9, z: -3.1, rotY: -0.15, scale: 1.05, dock: [3.2, -1.7] },
  { id: "momento", x: 6.7, z: 0.0, rotY: 0.25, scale: 1.0, dock: [4.9, 0.55] },
  { id: "conexao", x: 4.0, z: 3.2, rotY: -0.3, scale: 1.05, dock: [2.15, 2.2] },
];

/** pontos de controle da rota em S: início em mar aberto, depois cada dock com curvas entre eles */
const ROUTE_POINTS: Array<[number, number]> = [
  [-0.4, 4.35],
  [-1.0, 3.45],
  [ISLAND_LAYOUT[0].dock[0], ISLAND_LAYOUT[0].dock[1]],
  [-2.6, 1.15],
  [ISLAND_LAYOUT[1].dock[0], ISLAND_LAYOUT[1].dock[1]],
  [-3.4, -2.1],
  [ISLAND_LAYOUT[2].dock[0], ISLAND_LAYOUT[2].dock[1]],
  [1.0, -0.4],
  [ISLAND_LAYOUT[3].dock[0], ISLAND_LAYOUT[3].dock[1]],
  [4.35, -0.7],
  [ISLAND_LAYOUT[4].dock[0], ISLAND_LAYOUT[4].dock[1]],
  [3.9, 1.7],
  [ISLAND_LAYOUT[5].dock[0], ISLAND_LAYOUT[5].dock[1]],
];

export const WORLD_HALF = { x: 9.6, z: 5.3 };

export interface RouteModel {
  curve: THREE.CatmullRomCurve3;
  /** parâmetro u (comprimento de arco, 0..1) de cada ilha */
  stopU: number[];
  length: number;
}

export function buildRoute(): RouteModel {
  const pts = ROUTE_POINTS.map(([x, z]) => new THREE.Vector3(x, 0.05, z));
  const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
  const samples = 900;
  const stopU = ISLAND_LAYOUT.map((l) => {
    let best = 0;
    let bestD = Infinity;
    const target = new THREE.Vector3(l.dock[0], 0.05, l.dock[1]);
    for (let i = 0; i <= samples; i++) {
      const u = i / samples;
      const d = curve.getPointAt(u).distanceToSquared(target);
      if (d < bestD) {
        bestD = d;
        best = u;
      }
    }
    return best;
  });
  return { curve, stopU, length: curve.getLength() };
}

/** u em que o barco fica em cada estado do fluxo: hero = início; etapa i = dock da ilha i */
export function uForStep(route: RouteModel, step: number): number {
  if (step < 0) return 0;
  return route.stopU[Math.min(step, route.stopU.length - 1)];
}
