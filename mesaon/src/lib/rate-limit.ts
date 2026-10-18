/**
 * Limitador de frequência em memória (janela deslizante), por instância.
 *
 * É uma camada ADICIONAL e de melhor esforço (em ambientes serverless cada
 * instância tem sua própria memória). A proteção definitiva contra spam de
 * chamadas está no banco: public_create_request limita por mesa e por IP e
 * impede duplicidade com índice único parcial.
 */
export class SlidingWindowLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly maxKeys = 10_000,
  ) {}

  check(key: string, now = Date.now()): { allowed: boolean; retryAfterMs: number } {
    const windowStart = now - this.windowMs;
    const list = (this.hits.get(key) ?? []).filter((t) => t > windowStart);
    if (list.length >= this.limit) {
      this.hits.set(key, list);
      return { allowed: false, retryAfterMs: Math.max(0, list[0] + this.windowMs - now) };
    }
    list.push(now);
    this.hits.set(key, list);
    if (this.hits.size > this.maxKeys) this.prune(now);
    return { allowed: true, retryAfterMs: 0 };
  }

  private prune(now: number) {
    const windowStart = now - this.windowMs;
    for (const [key, list] of this.hits) {
      if (!list.some((t) => t > windowStart)) this.hits.delete(key);
    }
    // ainda grande demais? descarta as chaves mais antigas
    while (this.hits.size > this.maxKeys) {
      const first = this.hits.keys().next().value;
      if (first === undefined) break;
      this.hits.delete(first);
    }
  }
}
