import type {
  OutboxRepository,
  OutboxRow,
  PaymentRepository,
  PaymentRow,
  ReceiptRepository,
  ReceiptRow,
  RuntimeStateRepository,
  SaleRepository,
  SaleRow
} from './repositories.js';

export class MemorySaleRepository implements SaleRepository {
  private readonly rows = new Map<string, SaleRow>();
  async upsert(row: SaleRow): Promise<void> {
    this.rows.set(row.id, row);
  }
  async getById(id: string): Promise<SaleRow | null> {
    return this.rows.get(id) ?? null;
  }
  async findOpenSales(): Promise<SaleRow[]> {
    return [...this.rows.values()].filter(
      (s) => s.status === 'PENDING_PAYMENT' || s.status === 'PAID_NOT_PRINTED' || s.status === 'PAID'
    );
  }
}

export class MemoryPaymentRepository implements PaymentRepository {
  private readonly bySaleId = new Map<string, PaymentRow>();
  async upsert(row: PaymentRow): Promise<void> {
    this.bySaleId.set(row.saleId, row);
  }
  async getBySaleId(saleId: string): Promise<PaymentRow | null> {
    return this.bySaleId.get(saleId) ?? null;
  }
}

export class MemoryReceiptRepository implements ReceiptRepository {
  private readonly bySaleId = new Map<string, ReceiptRow>();
  async upsert(row: ReceiptRow): Promise<void> {
    this.bySaleId.set(row.saleId, row);
  }
  async getBySaleId(saleId: string): Promise<ReceiptRow | null> {
    return this.bySaleId.get(saleId) ?? null;
  }
}

export class MemoryOutboxRepository implements OutboxRepository {
  private readonly rows = new Map<string, OutboxRow>();
  async enqueue(row: OutboxRow): Promise<void> {
    this.rows.set(row.id, row);
  }
  async listPending(): Promise<OutboxRow[]> {
    return [...this.rows.values()].filter((o) => o.status === 'PENDING');
  }
  async markSent(id: string, _sentAtIso: string): Promise<void> {
    const r = this.rows.get(id);
    if (!r) return;
    this.rows.set(id, { ...r, status: 'SENT', nextRetryAt: undefined });
  }
  async scheduleRetry(id: string, retryCount: number, nextRetryAtIso: string): Promise<void> {
    const r = this.rows.get(id);
    if (!r) return;
    this.rows.set(id, { ...r, retryCount, nextRetryAt: nextRetryAtIso, status: 'PENDING' });
  }
}

export class MemoryRuntimeStateRepository implements RuntimeStateRepository {
  private current: { id: string; stateJson: unknown; updatedAt: string } | null = null;
  async set(stateJson: unknown): Promise<void> {
    this.current = { id: 'singleton', stateJson, updatedAt: new Date().toISOString() };
  }
  async get(): Promise<unknown | null> {
    return this.current?.stateJson ?? null;
  }
}
