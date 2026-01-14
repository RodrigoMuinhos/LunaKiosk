import fs from 'node:fs';
import { getConfig, type RuntimeConfig } from '../config/runtime.js';
import {
  MemoryOutboxRepository,
  MemoryPaymentRepository,
  MemoryReceiptRepository,
  MemoryRuntimeStateRepository,
  MemorySaleRepository
} from './MemoryRepositories.js';
import {
  SqliteConnection,
  SqliteOutboxRepository,
  SqlitePaymentRepository,
  SqliteReceiptRepository,
  SqliteRuntimeStateRepository,
  SqliteSaleRepository
} from './SqliteRepositories.js';
import type { OutboxRepository, PaymentRepository, ReceiptRepository, RuntimeStateRepository, SaleRepository } from './repositories.js';

export type Repositories = {
  saleRepo: SaleRepository;
  paymentRepo: PaymentRepository;
  receiptRepo: ReceiptRepository;
  outboxRepo: OutboxRepository;
  runtimeRepo: RuntimeStateRepository;
  close: () => Promise<void> | void;
  isPersistent: boolean;
  dbFile?: string;
};

export async function createRepositories(cfg: RuntimeConfig = getConfig()): Promise<Repositories> {
  if (!cfg.USE_PERSISTENT_DB) {
    return {
      saleRepo: new MemorySaleRepository(),
      paymentRepo: new MemoryPaymentRepository(),
      receiptRepo: new MemoryReceiptRepository(),
      outboxRepo: new MemoryOutboxRepository(),
      runtimeRepo: new MemoryRuntimeStateRepository(),
      close: () => {},
      isPersistent: false
    };
  }

  const conn = await SqliteConnection.open(cfg.DB_FILE_PATH);
  return {
    saleRepo: new SqliteSaleRepository(conn),
    paymentRepo: new SqlitePaymentRepository(conn),
    receiptRepo: new SqliteReceiptRepository(conn),
    outboxRepo: new SqliteOutboxRepository(conn),
    runtimeRepo: new SqliteRuntimeStateRepository(conn),
    close: () => {
      conn.flushToDisk();
      conn.close();
    },
    isPersistent: true,
    dbFile: cfg.DB_FILE_PATH
  };
}

export function resetDbIfRequested(cfg: RuntimeConfig = getConfig()): void {
  const args = process.argv.slice(2);
  const reset = args.includes('--reset-db') || (process.env.RESET_DB ?? '').toLowerCase() === 'true';
  if (reset && cfg.USE_PERSISTENT_DB && cfg.DB_FILE_PATH && fs.existsSync(cfg.DB_FILE_PATH)) {
    try {
      fs.rmSync(cfg.DB_FILE_PATH, { force: true });
    } catch {}
  }
}
