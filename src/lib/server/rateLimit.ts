/**
 * Limitador em memória (janela deslizante). Em serverless cada instância tem a sua própria memória:
 * é uma proteção de melhor esforço. Para produção, combine com Vercel Firewall/WAF ou um store externo.
 */
export class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(
    private limit: number,
    private windowMs: number,
  ) {}

  check(key: string, now = Date.now()): { allowed: boolean; retryAfterSec: number } {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return { allowed: false, retryAfterSec: Math.ceil((this.windowMs - (now - recent[0])) / 1000) };
    }
    recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > 5000) this.prune(now);
    return { allowed: true, retryAfterSec: 0 };
  }

  private prune(now: number) {
    for (const [k, v] of this.hits) {
      if (!v.some((t) => now - t < this.windowMs)) this.hits.delete(k);
    }
  }
}
