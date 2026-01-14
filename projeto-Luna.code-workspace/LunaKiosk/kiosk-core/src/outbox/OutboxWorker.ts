import pino from 'pino';
import type { OutboxRepository, OutboxRow } from '../db/repositories.js';

export type OutboxWorkerOptions = {
  repo: OutboxRepository;
  endpointUrl: string; // e.g. http://127.0.0.1:7090/sync/outbox
  intervalMs?: number; // default 2000
  maxPerTick?: number; // default 20
  logger?: pino.Logger;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export class OutboxWorker {
  private running = false;
  private loopPromise: Promise<void> | null = null;
  private readonly log: pino.Logger;

  constructor(private readonly opts: OutboxWorkerOptions) {
    this.log = opts.logger ?? pino({ level: process.env.LOG_LEVEL ?? 'info' });
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.loopPromise = this.loop();
  }

  async stop() {
    this.running = false;
    await this.loopPromise;
  }

  private async loop() {
    const every = this.opts.intervalMs ?? 2000;
    const limit = this.opts.maxPerTick ?? 20;
    while (this.running) {
      try {
        const batch = await this.fetchEligible(limit);
        for (const item of batch) {
          await this.process(item);
        }
      } catch (e: any) {
        this.log.warn({ err: String(e?.message ?? e) }, 'outbox loop error');
      }
      await sleep(every);
    }
  }

  private async fetchEligible(limit: number): Promise<OutboxRow[]> {
    const all = await this.opts.repo.listPending();
    const now = Date.now();
    const eligible = all.filter((o) => !o.nextRetryAt || Date.parse(o.nextRetryAt) <= now);
    return eligible.slice(0, limit);
  }

  private async process(item: OutboxRow) {
    const { endpointUrl } = this.opts;
    const gfetch = (globalThis as any).fetch as (input: any, init?: any) => Promise<any>;
    const maxRetries = 5;

    try {
      const res = await gfetch(endpointUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: item.id, type: item.type, payload: item.payload })
      });
      if (!res.ok) throw new Error(`sync failed: HTTP ${res.status}`);
      await this.opts.repo.markSent(item.id, new Date().toISOString());
      this.log.info({ id: item.id, type: item.type }, 'outbox sent');
    } catch (e: any) {
      const retry = Math.min(item.retryCount + 1, maxRetries);
      const jitter = Math.random() * 300;
      const backoff = Math.pow(2, retry) * 500 + jitter; // 500ms, 1s, 2s, 4s, ...
      const next = new Date(Date.now() + backoff).toISOString();
      await this.opts.repo.scheduleRetry(item.id, retry, next);
      this.log.warn({ id: item.id, retry, next, err: String(e?.message ?? e) }, 'outbox retry scheduled');
    }
  }
}
