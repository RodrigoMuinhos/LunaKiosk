import type { Cart, PaymentData, SaleStatus } from '../kiosk/types.js';

export type SaleRow = {
  id: string;
  status: SaleStatus;
  totalCents: number;
  cart: Cart;
  createdAt: string;
  updatedAt: string;
  printedAt?: string;
};

export type PaymentRow = {
  id: string;
  saleId: string;
  status: 'APPROVED' | 'DECLINED' | 'ERROR';
  data: PaymentData;
  createdAt: string;
};

export type ReceiptRow = {
  id: string;
  saleId: string;
  status: 'PRINTED' | 'ERROR' | 'PENDING';
  payload: unknown;
  createdAt: string;
  printedAt?: string;
};

export type OutboxRow = {
  id: string;
  type: string;
  payload: unknown;
  status: 'PENDING' | 'SENT' | 'ERROR';
  retryCount: number;
  nextRetryAt?: string;
  createdAt: string;
};

export interface SaleRepository {
  upsert(row: SaleRow): Promise<void>;
  getById(id: string): Promise<SaleRow | null>;
  findOpenSales(): Promise<SaleRow[]>;
}

export interface PaymentRepository {
  upsert(row: PaymentRow): Promise<void>;
  getBySaleId(saleId: string): Promise<PaymentRow | null>;
}

export interface ReceiptRepository {
  upsert(row: ReceiptRow): Promise<void>;
  getBySaleId(saleId: string): Promise<ReceiptRow | null>;
}

export interface OutboxRepository {
  enqueue(row: OutboxRow): Promise<void>;
  listPending(): Promise<OutboxRow[]>;
  markSent(id: string, sentAtIso: string): Promise<void>;
  scheduleRetry(id: string, retryCount: number, nextRetryAtIso: string): Promise<void>;
}

export interface RuntimeStateRepository {
  set(stateJson: unknown): Promise<void>;
  get(): Promise<unknown | null>;
}
