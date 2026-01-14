import { randomUUID } from 'node:crypto';

import pino from 'pino';

import { KioskEventType, KioskState, reduce, type KioskEvent } from './KioskMachine.js';
import type { KioskSnapshot, SideEffectIntent } from './types.js';
import type { PaymentProvider } from '../payment/PaymentProvider.js';
import type { Printer } from '../printer/Printer.js';
import type {
  OutboxRepository,
  PaymentRepository,
  ReceiptRepository,
  RuntimeStateRepository,
  SaleRepository
} from '../db/repositories.js';

export type OrchestratorDeps = {
  paymentProvider: PaymentProvider;
  printer: Printer;
  saleRepo: SaleRepository;
  paymentRepo: PaymentRepository;
  receiptRepo: ReceiptRepository;
  outboxRepo: OutboxRepository;
  runtimeRepo: RuntimeStateRepository;
  logger?: pino.Logger;
};

export class KioskOrchestrator {
  private snapshot: KioskSnapshot;
  private readonly deps: OrchestratorDeps;
  private readonly log: pino.Logger;
  private inflight: Promise<void> = Promise.resolve();

  constructor(deps: OrchestratorDeps) {
    this.deps = deps;
    this.log = deps.logger ?? pino({ level: process.env.LOG_LEVEL ?? 'info' });
    this.snapshot = { state: KioskState.BOOT, cart: { items: [] }, activeSaleId: null };
  }

  getSnapshot(): KioskSnapshot {
    return this.snapshot;
  }

  dispatch(event: KioskEvent): Promise<void> {
    this.inflight = this.inflight.then(() => this.apply(event));
    return this.inflight;
  }

  private async dispatchInternal(event: KioskEvent): Promise<void> {
    // IMPORTANT: executeSideEffect() is called inside apply().
    // Calling dispatch() from there would enqueue behind the currently running apply(),
    // and then await on itself (deadlock). So internal events must call apply() directly.
    await this.apply(event);
  }

  async boot(): Promise<void> {
    const saved = await this.deps.runtimeRepo.get();
    if (saved && typeof saved === 'object' && saved) {
      this.snapshot = saved as KioskSnapshot;
      this.log.info({ state: this.snapshot.state }, 'rehydrated snapshot');
    }

    const openSales = await this.deps.saleRepo.findOpenSales();
    if (openSales.length > 0) {
      const latest = openSales.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
      this.snapshot = { ...this.snapshot, activeSaleId: latest.id };
      if (latest.status === 'PENDING_PAYMENT') {
        await this.dispatch({ type: KioskEventType.TEF_PROCESSING, saleId: latest.id });
        await this.executeSideEffect({ type: 'POLL_TEF_STATUS', saleId: latest.id });
      }
      if (latest.status === 'PAID_NOT_PRINTED' || latest.status === 'PAID') {
        await this.dispatch({ type: KioskEventType.TEF_APPROVED, saleId: latest.id });
      }
    }

    await this.dispatch({ type: KioskEventType.KIOSK_STARTED });
  }

  private async apply(event: KioskEvent): Promise<void> {
    const before = this.snapshot;
    const { next, sideEffects } = reduce(before, event);
    this.snapshot = next;

    this.log.info({ event: event.type, from: before.state, to: next.state, saleId: next.activeSaleId }, 'kiosk transition');
    await this.deps.runtimeRepo.set(this.snapshot);

    for (const effect of sideEffects) {
      await this.executeSideEffect(effect);
    }
  }

  private async executeSideEffect(effect: SideEffectIntent): Promise<void> {
    switch (effect.type) {
      case 'CALL_TEF_CHARGE': {
        const saleId = effect.saleId ?? randomUUID();
        const now = new Date().toISOString();
        const existing = await this.deps.saleRepo.getById(saleId);

        if (!existing) {
          await this.deps.saleRepo.upsert({
            id: saleId,
            status: 'PENDING_PAYMENT',
            totalCents: effect.amountCents,
            cart: this.snapshot.cart,
            createdAt: now,
            updatedAt: now
          });
        }

        if (this.snapshot.activeSaleId !== saleId) {
          this.snapshot = { ...this.snapshot, activeSaleId: saleId };
          await this.deps.runtimeRepo.set(this.snapshot);
        }

        this.log.info({ saleId, amountCents: effect.amountCents }, 'calling tef charge');

        const res = await this.deps.paymentProvider.charge({
          saleId,
          amountCents: effect.amountCents,
          orderRef: saleId,
          items: (effect.metadata?.cartItems as any[]) ?? undefined
        });

        if (res.status === 'IN_PROGRESS') {
          await this.dispatchInternal({ type: KioskEventType.TEF_PROCESSING, saleId });
          await this.executeSideEffect({ type: 'POLL_TEF_STATUS', saleId });
          return;
        }
        if (res.status === 'APPROVED') {
          await this.dispatchInternal({ type: KioskEventType.TEF_APPROVED, saleId });
          return;
        }
        if (res.status === 'DECLINED') {
          await this.dispatchInternal({ type: KioskEventType.TEF_DECLINED, saleId, reason: res.error });
          return;
        }
        await this.dispatchInternal({ type: KioskEventType.TEF_ERROR, saleId, message: res.error ?? 'TEF error' });
        return;
      }

      case 'POLL_TEF_STATUS': {
        const { saleId } = effect;
        const maxMs = 60_000;
        const started = Date.now();

        while (Date.now() - started < maxMs) {
          try {
            const s = await this.deps.paymentProvider.getStatus(saleId);
            if (s.status === 'IN_PROGRESS') {
              await new Promise((r) => setTimeout(r, 1500));
              continue;
            }

            if (s.status === 'APPROVED') {
              const now = new Date().toISOString();
              await this.deps.paymentRepo.upsert({
                id: randomUUID(),
                saleId,
                status: 'APPROVED',
                data: {
                  nsu: String((s.approvedData as any)?.nsu ?? ''),
                  authCode: String((s.approvedData as any)?.authCode ?? ''),
                  brand: String((s.approvedData as any)?.brand ?? ''),
                  maskedPan: String((s.approvedData as any)?.maskedPan ?? ''),
                  acquirer: String((s.approvedData as any)?.acquirer ?? ''),
                  rawJson: s.approvedData
                },
                createdAt: now
              });
              const sale = await this.deps.saleRepo.getById(saleId);
              if (sale) {
                await this.deps.saleRepo.upsert({ ...sale, status: 'PAID_NOT_PRINTED', updatedAt: now });
              }
              await this.dispatchInternal({ type: KioskEventType.TEF_APPROVED, saleId });
              return;
            }
            if (s.status === 'DECLINED') {
              const now = new Date().toISOString();
              const sale = await this.deps.saleRepo.getById(saleId);
              if (sale) {
                await this.deps.saleRepo.upsert({ ...sale, status: 'PAYMENT_DECLINED', updatedAt: now });
              }
              await this.dispatchInternal({ type: KioskEventType.TEF_DECLINED, saleId, reason: s.error });
              return;
            }
            const now = new Date().toISOString();
            const sale = await this.deps.saleRepo.getById(saleId);
            if (sale) {
              await this.deps.saleRepo.upsert({ ...sale, status: 'PAYMENT_ERROR', updatedAt: now });
            }
            await this.dispatchInternal({ type: KioskEventType.TEF_ERROR, saleId, message: s.error ?? 'TEF error' });
            return;
          } catch (e: any) {
            this.log.warn({ saleId, err: String(e?.message ?? e) }, 'poll tef failed, retrying');
            await new Promise((r) => setTimeout(r, 1500));
          }
        }

        this.log.warn({ saleId }, 'tef status timeout');
        return;
      }

      case 'CALL_PRINT_RECEIPT': {
        const { saleId } = effect;
        const existing = await this.deps.receiptRepo.getBySaleId(saleId);
        if (existing?.status === 'PRINTED') {
          await this.dispatchInternal({ type: KioskEventType.PRINT_OK, saleId });
          return;
        }

        const sale = await this.deps.saleRepo.getById(saleId);
        const totalCents = sale?.totalCents ?? 0;
        const payloadText = `LUNA KIOSK\nSALE ${saleId}\nTOTAL: ${totalCents} cents\n`;

        const attempt = async () => {
          const res = await this.deps.printer.printReceipt({ saleId, receiptText: payloadText });
          const now = new Date().toISOString();
          await this.deps.receiptRepo.upsert({
            id: res.receiptId,
            saleId,
            status: 'PRINTED',
            payload: { receiptText: payloadText },
            createdAt: now,
            printedAt: now
          });
          const s = await this.deps.saleRepo.getById(saleId);
          if (s) {
            await this.deps.saleRepo.upsert({ ...s, status: 'COMPLETED', printedAt: now, updatedAt: now });
          }
          await this.deps.outboxRepo.enqueue({
            id: randomUUID(),
            type: 'SALE_COMPLETED',
            payload: { saleId },
            status: 'PENDING',
            retryCount: 0,
            createdAt: now
          });
          await this.dispatchInternal({ type: KioskEventType.PRINT_OK, saleId });
        };

        const maxAttempts = 3;
        for (let i = 1; i <= maxAttempts; i++) {
          try {
            this.log.info({ saleId, attempt: i }, 'printing receipt');
            await attempt();
            return;
          } catch (e: any) {
            const msg = String(e?.message ?? e);
            this.log.warn({ saleId, attempt: i, err: msg }, 'print failed');
            if (i === maxAttempts) {
              const now = new Date().toISOString();
              await this.deps.receiptRepo.upsert({
                id: existing?.id ?? randomUUID(),
                saleId,
                status: 'ERROR',
                payload: { receiptText: payloadText },
                createdAt: existing?.createdAt ?? now
              });
              const s = await this.deps.saleRepo.getById(saleId);
              if (s) {
                await this.deps.saleRepo.upsert({ ...s, status: 'PRINT_ERROR', updatedAt: now });
              }
              await this.dispatchInternal({ type: KioskEventType.PRINT_FAIL, saleId, message: msg });
              return;
            }
            await new Promise((r) => setTimeout(r, 400 * i));
          }
        }
        return;
      }

      case 'EMIT_OUTBOX_EVENT': {
        const now = new Date().toISOString();
        await this.deps.outboxRepo.enqueue({
          id: randomUUID(),
          type: effect.eventType,
          payload: effect.payload,
          status: 'PENDING',
          retryCount: 0,
          createdAt: now
        });
        return;
      }

      default:
        return;
    }
  }
}
