import * as THREE from "three";
import gsap from "gsap";
import { ISLAND_LAYOUT, WORLD_HALF, buildRoute, uForStep, type RouteModel } from "./layout";
import { buildIsland, createSharedMaterials, type IslandHandle } from "./islands";
import { buildBoat, type BoatHandle } from "./boat";
import { buildOcean, type OceanHandle } from "./ocean";
import { buildRouteMesh, type RouteHandle } from "./route";
import { buildAmbient, type AmbientHandle } from "./ambient";
import { Disposer, PALETTE, glowTexture } from "./util";
import { getDebug, sceneBridge, type SceneState } from "@/lib/motion/sceneBridge";

export type Tier = "high" | "medium" | "low";

const TIERS: Record<Tier, { dpr: number; lights: boolean; particles: number; trail: boolean; antialias: boolean }> = {
  high: { dpr: 2, lights: true, particles: 90, trail: true, antialias: true },
  medium: { dpr: 1.5, lights: true, particles: 50, trail: true, antialias: true },
  low: { dpr: 1.15, lights: false, particles: 22, trail: true, antialias: false },
};

export function pickTier(): Tier {
  if (typeof navigator === "undefined") return "medium";
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency ?? 4;
  const mem = nav.deviceMemory ?? 4;
  const coarse = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;
  if (!coarse && cores >= 8 && mem >= 8) return "high";
  if (cores >= 4 && mem >= 3) return "medium";
  return "low";
}

export function supportsWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export interface SceneOptions {
  host: HTMLElement;
  labels: HTMLElement[];
  /** largura (px) ocupada pelo painel do formulário sobre a cena (0 no mobile) */
  panelWidth: () => number;
  onFail: () => void;
  onReady: () => void;
}

const PITCH = THREE.MathUtils.degToRad(52);
const FOV = 32;

export class ArchipelagoScene {
  private renderer!: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 120);
  private disposer = new Disposer();
  private route: RouteModel = buildRoute();
  private islands: IslandHandle[] = [];
  /** entrada: cada ilha emerge do mar, uma por vez (0 = submersa, 1 = completa) */
  private rev: Array<{ v: number }> = [];
  private boat!: BoatHandle;
  private ocean!: OceanHandle;
  private routeMesh!: RouteHandle;
  private ambient!: AmbientHandle;
  private tier: Tier;
  private tierCfg;
  private dprScale = 1;
  private lastW = 0;
  private lastH = 0;
  private resizeRaf = 0;
  private sinceRender = 0;
  private coarse = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;
  private motion = { u: 0 };
  private boatTween: gsap.core.Tween | null = null;
  private dir: 1 | -1 = 1;
  private moving = false;
  private yaw = 0;
  private state: SceneState = sceneBridge.state;
  private unsub?: () => void;
  private io?: IntersectionObserver;
  private ro?: ResizeObserver;
  private running = false;
  private visible = true;
  private disposed = false;
  private start = performance.now();
  private frameCount = 0;
  private frameAcc = 0;
  private focus = new THREE.Vector3(0, 0, 0.2);
  private tmp = new THREE.Vector3();
  private firstState = true;
  private pendingRender = 0;
  private lostHandler = (e: Event) => {
    e.preventDefault();
    this.opts.onFail();
  };

  constructor(private opts: SceneOptions) {
    this.tier = pickTier();
    this.tierCfg = { ...TIERS[this.tier] };
    this.renderer = new THREE.WebGLRenderer({
      antialias: this.tierCfg.antialias,
      alpha: false,
      powerPreference: "high-performance",
    });
    const canvas = this.renderer.domElement;
    canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block";
    canvas.setAttribute("aria-hidden", "true");
    canvas.addEventListener("webglcontextlost", this.lostHandler);
    opts.host.appendChild(canvas);
    this.renderer.setClearColor(PALETTE.ocean, 1);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.build();
    this.startIntro();
    this.resize();

    // debounce em rAF: evita tempestade de resize (barra do navegador mobile) que fazia a cena piscar
    this.ro = new ResizeObserver(() => {
      cancelAnimationFrame(this.resizeRaf);
      this.resizeRaf = requestAnimationFrame(() => this.resize());
    });
    this.ro.observe(opts.host);
    this.io = new IntersectionObserver((entries) => {
      this.visible = entries[0]?.isIntersecting ?? true;
      this.syncLoop();
    });
    this.io.observe(opts.host);
    document.addEventListener("visibilitychange", this.syncLoop);

    this.unsub = sceneBridge.subscribe((s) => this.applyState(s));
    this.applyState(sceneBridge.state);
    const dbg = getDebug();
    if (dbg) {
      dbg.tier = this.tier;
      dbg.webgl = true;
    }
    this.syncLoop();
    this.renderOnce();
    opts.onReady();
  }

  private mq = typeof matchMedia !== "undefined" ? matchMedia("(prefers-reduced-motion: reduce)") : null;

  /** lê a preferência do sistema diretamente: não depende de o React já ter propagado o valor */
  private get reduced() {
    return this.state.reducedMotion || !!this.mq?.matches;
  }

  /** as ilhas surgem uma por uma (sem tela de carregamento); com movimento reduzido já nascem completas */
  private startIntro() {
    if (this.reduced) return;
    this.rev.forEach((o) => (o.v = 0));
    this.opts.labels.forEach((el) => (el.style.opacity = "0"));
    gsap.to(this.rev, { v: 1, duration: 1.15, ease: "power3.out", stagger: 0.32, delay: 0.12 });
  }

  private build() {
    const d = this.disposer;
    const glow = d.track(glowTexture());
    this.scene.add(new THREE.HemisphereLight(0x9a7cf0, 0x2a1240, 1.5));
    const moon = new THREE.DirectionalLight(0xb0c8ff, 1.3);
    moon.position.set(-6, 10, 4);
    this.scene.add(moon);

    this.ocean = buildOcean(d, ISLAND_LAYOUT.length);
    this.scene.add(this.ocean.mesh);

    this.routeMesh = buildRouteMesh(this.route, d);
    this.scene.add(this.routeMesh.mesh);

    const shared = createSharedMaterials(d);
    for (const layout of ISLAND_LAYOUT) {
      const h = buildIsland(layout.id, { glow, disposer: d }, shared.foam, shared.rock);
      this.islands.push(h);
      this.rev.push({ v: 1 });
      this.scene.add(h.root);
    }
    this.islands.forEach((h) => (h.light.visible = this.tierCfg.lights));

    this.boat = buildBoat(glow, d);
    this.scene.add(this.boat.root);
    this.scene.add(this.boat.trail);
    this.boat.setTrailEnabled(this.tierCfg.trail);

    this.ambient = buildAmbient(glow, d, TIERS.high.particles);
    this.ambient.setCount(this.tierCfg.particles);
    this.scene.add(this.ambient.group);
  }

  /* ───── estado vindo do formulário ───── */
  applyState(s: SceneState) {
    if (this.disposed) return;
    this.state = s;
    const targetU = s.phase === "hero" ? 0 : uForStep(this.route, s.phase === "done" ? 5 : s.activeStep);

    const from = this.motion.u;
    const delta = targetU - from;
    this.dir = delta >= 0 ? 1 : -1;
    this.boatTween?.kill();

    const instant = this.reduced || this.firstState || Math.abs(delta) < 1e-4;
    const legs = Math.max(1, Math.abs(delta) / 0.12);
    const duration = instant ? 0 : Math.min(1.5, 0.75 * Math.pow(legs, 0.45));
    const dbg = getDebug();
    const now = performance.now();

    if (instant) {
      this.motion.u = targetU;
      this.moving = false;
      sceneBridge.setProgress(1);
      if (dbg) dbg.boatMoving = false;
    } else {
      this.moving = true;
      sceneBridge.setProgress(0);
      if (dbg) {
        dbg.boatMoving = true;
        dbg.boatTarget = targetU;
        dbg.lastTransition = { startedAt: now, boatStartedAt: now, boatEndedAt: 0, contentVisibleAt: dbg.lastTransition?.contentVisibleAt ?? 0 };
      }
      this.boatTween = gsap.to(this.motion, {
        u: targetU,
        duration,
        ease: "power2.inOut",
        onUpdate: () => sceneBridge.setProgress(Math.abs(delta) > 0 ? (this.motion.u - from) / delta : 1),
        onComplete: () => {
          this.moving = false;
          sceneBridge.setProgress(1);
          const dd = getDebug();
          if (dd) {
            dd.boatMoving = false;
            if (dd.lastTransition) dd.lastTransition.boatEndedAt = performance.now();
          }
          this.renderOnce();
        },
      });
    }
    this.firstState = false;

    // ilhas: ativa (laranja) / concluída (ciano) / futura (reduzida)
    this.islands.forEach((h, i) => {
      const active = s.phase === "form" && s.activeStep === i ? 1 : s.phase === "hero" && i === 0 ? 0.45 : 0;
      const completed = s.completedSteps.includes(i) || s.phase === "done";
      const done = completed ? (active > 0.5 ? 0.35 : 1) : 0;
      gsap.killTweensOf(h.cur);
      if (this.reduced) {
        h.cur.active = active;
        h.cur.done = done;
      } else {
        gsap.to(h.cur, { active, done, duration: 0.6, ease: "power2.out" });
      }
    });
    if (dbg) dbg.islandStates = this.islands.map((_, i) => (s.phase === "done" || s.completedSteps.includes(i) ? "done" : s.phase === "form" && s.activeStep === i ? "active" : "future"));
    this.syncLoop();
    this.renderOnce();
  }

  /* ───── loop ───── */
  private syncLoop = () => {
    const shouldRun = !this.disposed && !this.reduced && this.visible && !document.hidden;
    if (shouldRun && !this.running) {
      this.running = true;
      gsap.ticker.add(this.tick);
    } else if (!shouldRun && this.running) {
      this.running = false;
      gsap.ticker.remove(this.tick);
    }
  };

  private tick = (_time: number, deltaMs: number) => {
    // celulares: limita a 30 fps para sobrar CPU/GPU ao scroll e ao formulário
    this.sinceRender += deltaMs;
    if (this.coarse && this.sinceRender < 31) return;
    const step = this.sinceRender;
    this.sinceRender = 0;
    deltaMs = step;
    this.frame(performance.now(), deltaMs / 1000);
    // monitor de desempenho: rebaixa a qualidade (sem remover a narrativa)
    this.frameAcc += deltaMs;
    this.frameCount++;
    if (this.frameCount >= 90) {
      const avg = this.frameAcc / this.frameCount;
      const dbg = getDebug();
      if (dbg) dbg.fps = Math.round(1000 / avg);
      if (avg > 42) {
        if (this.tier !== "low") this.downgrade();
        else if (this.dprScale > 0.5) {
          // último recurso: reduz resolução, mantendo toda a narrativa visual
          this.dprScale = Math.max(0.5, this.dprScale * 0.8);
          this.lastW = 0;
          this.resize();
        }
      }
      this.frameAcc = 0;
      this.frameCount = 0;
    }
  };

  private downgrade() {
    this.tier = this.tier === "high" ? "medium" : "low";
    this.tierCfg = { ...TIERS[this.tier] };
    this.islands.forEach((h) => (h.light.visible = this.tierCfg.lights));
    this.ambient.setCount(this.tierCfg.particles);
    this.lastW = 0;
    this.resize();
    const dbg = getDebug();
    if (dbg) dbg.tier = this.tier;
  }

  private renderOnce() {
    if (this.disposed || this.running) return;
    cancelAnimationFrame(this.pendingRender);
    this.pendingRender = requestAnimationFrame(() => {
      if (this.disposed) return;
      this.frame(this.start + 3000, 0.016);
    });
  }

  private frame(nowMs: number, dt: number) {
    if (this.disposed) return;
    const t = this.reduced ? 3 : (nowMs - this.start) / 1000;
    const u = this.motion.u;

    // barco sobre a rota, orientado pela tangente
    const p = this.route.curve.getPointAt(Math.min(1, Math.max(0, u)));
    const tan = this.route.curve.getTangentAt(Math.min(0.9999, Math.max(0.0001, u)));
    const sign = this.moving ? this.dir : 1;
    const targetYaw = Math.atan2(tan.x * sign, tan.z * sign);
    let dy = targetYaw - this.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.yaw += dy * Math.min(1, dt * 8 || 1);
    this.boat.root.position.set(p.x, 0, p.z);
    this.boat.root.rotation.y = this.yaw;
    const speed = this.moving ? 1 : 0;
    this.boat.update(t, speed);
    if (!this.reduced) this.boat.updateTrail(t, speed);

    // ilhas, água e rota respondem ao progresso real
    const orange = new THREE.Color(PALETTE.orange);
    const cyan = new THREE.Color(PALETTE.cyan);
    const overshoot = (x: number) => {
      if (x >= 1) return 1;
      const y = x - 1;
      return 1 + 2.35 * y * y * y + 1.35 * y * y; // easeOutBack: surge e assenta
    };
    let revealMean = 0;
    this.islands.forEach((h, i) => {
      if (!this.reduced) h.update(t);
      else h.update(3);
      const l = ISLAND_LAYOUT[i];
      const r = this.rev[i]?.v ?? 1;
      revealMean += r / this.islands.length;
      h.root.visible = r > 0.002;
      h.root.scale.setScalar(l.scale * Math.max(0.0001, overshoot(r)));
      h.root.position.y = (r - 1) * 0.9;
      const c = orange.clone().lerp(cyan, h.cur.done * (1 - h.cur.active));
      this.ocean.setIsland(i, l.x, l.z, 2.1, (0.05 + h.cur.active * 0.5 + h.cur.done * 0.26) * r, c);
    });
    const r0 = this.rev[0]?.v ?? 1;
    this.boat.root.visible = r0 > 0.05;
    this.boat.trail.visible = r0 > 0.05;
    this.routeMesh.setMaster(revealMean);
    this.ocean.update(t);
    const next = this.route.stopU.find((su) => su > u + 0.002);
    this.routeMesh.setProgress(u, this.state.phase === "done" ? -1 : (next ?? -1));
    this.routeMesh.update(t);
    this.ambient.update(t);

    // câmera: respiração + acompanhamento leve da ilha ativa
    const idx = this.state.phase === "form" ? this.state.activeStep : -1;
    const fx = idx >= 0 ? ISLAND_LAYOUT[idx].x * 0.1 : 0;
    const fz = idx >= 0 ? ISLAND_LAYOUT[idx].z * 0.06 + 0.2 : 0.2;
    this.focus.x += (fx - this.focus.x) * Math.min(1, (dt || 0.016) * 2);
    this.focus.z += (fz - this.focus.z) * Math.min(1, (dt || 0.016) * 2);
    this.placeCamera(t);

    this.renderer.render(this.scene, this.camera);
    this.updateLabels();

    const dbg = getDebug();
    if (dbg) {
      dbg.boatT = u;
      dbg.boatMoving = this.moving;
    }
  }

  private placeCamera(t: number) {
    const w = this.opts.host.clientWidth || 1;
    const h = this.opts.host.clientHeight || 1;
    const panel = Math.min(this.opts.panelWidth(), w * 0.5);
    const usable = Math.max(120, w - panel);
    const tanH = Math.tan(THREE.MathUtils.degToRad(FOV) / 2);
    const dW = (WORLD_HALF.x * 1.04 * h) / (usable * tanH);
    const dH = (WORLD_HALF.z * 1.3 * Math.sin(PITCH)) / tanH;
    const d = Math.max(dW, dH);
    const sway = this.reduced ? 0 : Math.sin(t * 0.25) * 0.12;
    this.camera.position.set(this.focus.x + sway, Math.sin(PITCH) * d, this.focus.z + Math.cos(PITCH) * d);
    this.camera.lookAt(this.focus.x, 0, this.focus.z);
    this.camera.setViewOffset(w, h, -panel / 2, 0, w, h);
  }

  private updateLabels() {
    const w = this.opts.host.clientWidth;
    const h = this.opts.host.clientHeight;
    this.islands.forEach((isl, i) => {
      const el = this.opts.labels[i];
      if (!el) return;
      isl.labelAnchor.getWorldPosition(this.tmp);
      this.tmp.project(this.camera);
      const x = (this.tmp.x * 0.5 + 0.5) * w;
      const y = (-this.tmp.y * 0.5 + 0.5) * h;
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      const o = Math.min(1, (this.rev[i]?.v ?? 1) * 1.6).toFixed(2);
      if (el.style.opacity !== o) el.style.opacity = o;
      const st =
        this.state.phase === "form" && this.state.activeStep === i
          ? "active"
          : this.state.phase === "done" || this.state.completedSteps.includes(i)
            ? "done"
            : "future";
      if (el.dataset.state !== st) el.dataset.state = st;
    });
  }

  resize() {
    if (this.disposed) return;
    const w = this.opts.host.clientWidth;
    const h = this.opts.host.clientHeight;
    if (!w || !h) return;
    if (w === this.lastW && h === this.lastH) return;
    this.lastW = w;
    this.lastH = h;
    const cap = this.coarse ? 1.25 : Infinity;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.tierCfg.dpr, cap) * this.dprScale);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderOnce();
    if (this.running) return;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.running = false;
    gsap.ticker.remove(this.tick);
    cancelAnimationFrame(this.pendingRender);
    cancelAnimationFrame(this.resizeRaf);
    this.boatTween?.kill();
    this.islands.forEach((h) => gsap.killTweensOf(h.cur));
    gsap.killTweensOf(this.rev);
    this.unsub?.();
    this.io?.disconnect();
    this.ro?.disconnect();
    document.removeEventListener("visibilitychange", this.syncLoop);
    this.renderer.domElement.removeEventListener("webglcontextlost", this.lostHandler);
    this.disposer.disposeAll();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}
