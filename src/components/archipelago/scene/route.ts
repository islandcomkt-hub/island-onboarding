import * as THREE from "three";
import { Disposer, PALETTE } from "./util";
import type { RouteModel } from "./layout";

export interface RouteHandle {
  mesh: THREE.Mesh;
  /** u do barco (0..1), próxima parada (u) ou -1, e se deve pulsar */
  setProgress(boatU: number, nextU: number): void;
  update(t: number): void;
}

export function buildRouteMesh(route: RouteModel, disposer: Disposer): RouteHandle {
  const geo = disposer.track(new THREE.TubeGeometry(route.curve, 360, 0.028, 5, false));
  const dashCount = Math.round(route.length / 0.34);
  const material = disposer.track(
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uBoat: { value: 0 },
        uNext: { value: -1 },
        uDash: { value: dashCount },
        uOrange: { value: new THREE.Color(PALETTE.orange) },
        uCyan: { value: new THREE.Color(PALETTE.cyan) },
      },
      vertexShader: `varying float vU; void main(){ vU = uv.x; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `
        varying float vU; uniform float uTime,uBoat,uNext,uDash; uniform vec3 uOrange,uCyan;
        void main(){
          float ph = fract(vU*uDash - uTime*0.6);
          float dash = smoothstep(0.0,0.12,ph)*smoothstep(0.62,0.5,ph);
          vec3 col; float a;
          if (vU <= uBoat) { col = uCyan; a = 0.5; }
          else if (uNext >= 0.0 && vU <= uNext) {
            col = uOrange; a = 0.95*(0.7+0.3*sin(uTime*3.0 - vU*40.0));
          } else { col = vec3(0.45,0.3,0.7); a = 0.16; }
          float fade = smoothstep(0.0,0.01,vU)*smoothstep(1.0,0.99,vU);
          gl_FragColor = vec4(col*dash, a*dash*fade);
        }`,
    }),
  );
  const mesh = new THREE.Mesh(geo, material);
  mesh.renderOrder = 1;
  mesh.frustumCulled = false;
  return {
    mesh,
    setProgress(boatU, nextU) {
      material.uniforms.uBoat.value = boatU;
      material.uniforms.uNext.value = nextU;
    },
    update(t) {
      material.uniforms.uTime.value = t;
    },
  };
}
