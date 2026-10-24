/**
 * Ponte entre o formulário (fonte de verdade) e a cena 3D (somente leitura).
 * A cena consome: activeStep, completedSteps, transitionProgress.
 * Ela NUNCA escreve respostas nem persistência.
 */
export type Phase = "hero" | "form" | "done";

export interface SceneState {
  phase: Phase;
  /** -1 no hero (barco no ponto de partida); 0..5 nas etapas */
  activeStep: number;
  /** índices das etapas cuja resposta foi validada */
  completedSteps: number[];
  /** 1 = avançando, -1 = voltando */
  direction: 1 | -1;
  /** se o usuário pediu movimento reduzido no sistema */
  reducedMotion: boolean;
}

type Listener = (state: SceneState) => void;
type ProgressListener = (progress: number) => void;

const initial: SceneState = {
  phase: "hero",
  activeStep: -1,
  completedSteps: [],
  direction: 1,
  reducedMotion: false,
};

export class SceneBridge {
  state: SceneState = { ...initial };
  /** 0..1 do trecho atual da travessia do barco (apenas leitura para a UI) */
  transitionProgress = 0;
  private listeners = new Set<Listener>();
  private progressListeners = new Set<ProgressListener>();

  set(partial: Partial<SceneState>): void {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach((fn) => fn(this.state));
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  setProgress(p: number): void {
    this.transitionProgress = p;
    this.progressListeners.forEach((fn) => fn(p));
  }

  onProgress(fn: ProgressListener): () => void {
    this.progressListeners.add(fn);
    return () => this.progressListeners.delete(fn);
  }

  reset(): void {
    this.state = { ...initial };
    this.transitionProgress = 0;
    this.listeners.forEach((fn) => fn(this.state));
  }
}

export const sceneBridge = new SceneBridge();

/** Telemetria opcional para testes (window.__island). Só existe em dev ou com NEXT_PUBLIC_ISLAND_DEBUG=1. */
export interface IslandDebug {
  boatT: number;
  boatTarget: number;
  boatMoving: boolean;
  fps: number;
  tier: string;
  webgl: boolean;
  lastTransition: { startedAt: number; boatStartedAt: number; boatEndedAt: number; contentVisibleAt: number } | null;
  islandStates: string[];
}

export function debugEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_ISLAND_DEBUG === "1";
}

export function getDebug(): IslandDebug | null {
  if (typeof window === "undefined" || !debugEnabled()) return null;
  const w = window as unknown as { __island?: IslandDebug };
  if (!w.__island) {
    w.__island = {
      boatT: 0,
      boatTarget: 0,
      boatMoving: false,
      fps: 0,
      tier: "?",
      webgl: false,
      lastTransition: null,
      islandStates: [],
    };
  }
  return w.__island;
}
