import * as THREE from "three";
import { Disposer } from "./util";

export interface OceanHandle {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  /** luz de cada ilha sobre a água (x, z, raio, intensidade, cor) */
  setIsland(i: number, x: number, z: number, radius: number, intensity: number, color: THREE.Color): void;
  update(t: number): void;
}

export function buildOcean(disposer: Disposer, islandCount: number): OceanHandle {
  const uIsl = Array.from({ length: islandCount }, () => new THREE.Vector4(0, 0, 3, 0));
  const uCol = Array.from({ length: islandCount }, () => new THREE.Color(0xff7417));
  const material = disposer.track(
    new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uIsl: { value: uIsl }, uCol: { value: uCol } },
      vertexShader: `varying vec2 vP; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vP = w.xz; gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `
        varying vec2 vP; uniform float uTime; uniform vec4 uIsl[${islandCount}]; uniform vec3 uCol[${islandCount}];
        void main(){
          vec2 p = vP;
          float d0 = length(p*vec2(0.055,0.085));
          vec3 deep = vec3(0.035,0.012,0.075);
          vec3 mid = vec3(0.10,0.04,0.18);
          vec3 col = mix(mid, deep, smoothstep(0.1,1.0,d0));
          float n = sin(p.x*1.3+uTime*0.5)*sin(p.y*1.7-uTime*0.4) + 0.5*sin((p.x+p.y)*2.2+uTime*0.8);
          float shimmer = smoothstep(0.7,1.4,n);
          col += vec3(0.16,0.10,0.34)*shimmer*0.12 + vec3(0.05,0.25,0.25)*smoothstep(1.0,1.5,n)*0.08;
          for(int i=0;i<${islandCount};i++){
            vec4 L = uIsl[i];
            float d = length(p - L.xy);
            float g = exp(-(d*d)/(L.z*L.z))*L.w;
            float rip = 0.65+0.35*sin(d*5.0 - uTime*1.4);
            col += uCol[i]*g*rip*0.5;
          }
          gl_FragColor = vec4(col,1.0);
        }`,
    }),
  );
  const geo = disposer.track(new THREE.PlaneGeometry(80, 50, 1, 1));
  const mesh = new THREE.Mesh(geo, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -0.002;
  mesh.name = "ocean";
  return {
    mesh,
    material,
    setIsland(i, x, z, radius, intensity, color) {
      uIsl[i].set(x, z, radius, intensity);
      uCol[i].copy(color);
    },
    update(t) {
      material.uniforms.uTime.value = t;
    },
  };
}
