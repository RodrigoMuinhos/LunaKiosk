import fs from 'node:fs';
import path from 'node:path';

// @ts-ignore - local shim declared, allow missing types when running under ts-node
import initSqlJs from 'sql.js';
// @ts-ignore - local shim declared, allow missing types when running under ts-node
import type { Database, SqlJsStatic } from 'sql.js';

import { getSchemaSql } from './schema.js';
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

function safeJsonParse<T>(raw: string | null | undefined): T {
  if (!raw) return JSON.parse('null') as T;
  return JSON.parse(raw) as T;
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * SQLite via `sql.js` (WASM) com persistência em arquivo.
 * Motivo: evitar dependências nativas (VC++ build tools) no Windows.
 */
export class SqliteConnection {
  private constructor(
    private readonly SQL: SqlJsStatic,
    readonly filename: string,
    readonly db: Database
  ) {}

  static async open(filename: string): Promise<SqliteConnection> {
    const SQL = await initSqlJs({});
    const dir = path.dirname(filename);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const db = fs.existsSync(filename)
      ? new SQL.Database(new Uint8Array(fs.readFileSync(filename)))
      : new SQL.Database();

    for (const sql of getSchemaSql()) db.run(sql);

    const conn = new SqliteConnection(SQL, filename, db);
    conn.flushToDisk();
    return conn;
  }

  flushToDisk(): void {
    const data = this.db.export();
    fs.writeFileSync(this.filename, Buffer.from(data));
  }

  close(): void {
    this.db.close();
  }
}

function firstRowOrNull<T extends Record<string, unknown>>(
  db: Database,
  sql: string,
  params: any[] = []
): T | null {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    if (!stmt.step()) return null;
    return stmt.getAsObject() as unknown as T;
  } finally {
    stmt.free();
  }
}

function allRows<T extends Record<string, unknown>>(
  db: Database,
  sql: string,
  params: any[] = []
): T[] {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    const out: T[] = [];
    while (stmt.step()) out.push(stmt.getAsObject() as unknown as T);
    return out;
  } finally {
    stmt.free();
  }
}

export class SqliteSaleRepository implements SaleRepository {
  constructor(private readonly conn: SqliteConnection) {}

  async upsert(row: SaleRow): Promise<void> {
    this.conn.db.run(
      `INSERT INTO sales (id, status, totalCents, cartJson, createdAt, updatedAt, printedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         status=excluded.status,
         totalCents=excluded.totalCents,
         cartJson=excluded.cartJson,
         updatedAt=excluded.updatedAt,
         printedAt=excluded.printedAt`,
      [
        row.id,
        row.status,
        row.totalCents,
        JSON.stringify(row.cart),
        row.createdAt,
        row.updatedAt,
        row.printedAt ?? null
      ]
    );
    this.conn.flushToDisk();
  }

  async getById(id: string): Promise<SaleRow | null> {
    const r = firstRowOrNull<any>(this.conn.db, `SELECT * FROM sales WHERE id = ?`, [id]);
    if (!r) return null;
    return {
      id: String(r.id),
      status: String(r.status) as any,
      totalCents: Number(r.totalCents),
      cart: safeJsonParse(r.cartJson as any),
      createdAt: String(r.createdAt),
      updatedAt: String(r.updatedAt),
      printedAt: r.printedAt ? String(r.printedAt) : undefined
    };
  }

  async findOpenSales(): Promise<SaleRow[]> {
    const rows = allRows<any>(
      this.conn.db,
      `SELECT * FROM sales WHERE status IN ('PENDING_PAYMENT','PAID_NOT_PRINTED','PAID') ORDER BY updatedAt DESC`
    );
    return rows.map((r) => ({
      id: String(r.id),
      status: String(r.status) as any,
      totalCents: Number(r.totalCents),
      cart: safeJsonParse(r.cartJson as any),
      createdAt: String(r.createdAt),
      updatedAt: String(r.updatedAt),
      printedAt: r.printedAt ? String(r.printedAt) : undefined
    }));
  }
}

export class SqlitePaymentRepository implements PaymentRepository {
  constructor(private readonly conn: SqliteConnection) {}

  async upsert(row: PaymentRow): Promise<void> {
    this.conn.db.run(
      `INSERT INTO payments (id, saleId, status, nsu, authCode, brand, maskedPan, acquirer, rawJson, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(saleId) DO UPDATE SET
         status=excluded.status,
         nsu=excluded.nsu,
         authCode=excluded.authCode,
         brand=excluded.brand,
         maskedPan=excluded.maskedPan,
         acquirer=excluded.acquirer,
         rawJson=excluded.rawJson`,
      [
        row.id,
        row.saleId,
        row.status,
        row.data.nsu ?? null,
        row.data.authCode ?? null,
        row.data.brand ?? null,
        row.data.maskedPan ?? null,
        row.data.acquirer ?? null,
        row.data.rawJson ? JSON.stringify(row.data.rawJson) : null,
        row.createdAt
      ]
    );
    this.conn.flushToDisk();
  }

  async getBySaleId(saleId: string): Promise<PaymentRow | null> {
    const r = firstRowOrNull<any>(this.conn.db, `SELECT * FROM payments WHERE saleId = ?`, [saleId]);
    if (!r) return null;

    return {
      id: String(r.id),
      saleId: String(r.saleId),
      status: String(r.status) as any,
      data: {
        nsu: r.nsu ? String(r.nsu) : undefined,
        authCode: r.authCode ? String(r.authCode) : undefined,
        brand: r.brand ? String(r.brand) : undefined,
        maskedPan: r.maskedPan ? String(r.maskedPan) : undefined,
        acquirer: r.acquirer ? String(r.acquirer) : undefined,
        rawJson: r.rawJson ? safeJsonParse(r.rawJson as any) : undefined
      },
      createdAt: String(r.createdAt)
    };
  }
}

export class SqliteReceiptRepository implements ReceiptRepository {
  constructor(private readonly conn: SqliteConnection) {}

  async upsert(row: ReceiptRow): Promise<void> {
    this.conn.db.run(
      `INSERT INTO receipts (id, saleId, status, payload, createdAt, printedAt)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(saleId) DO UPDATE SET
         status=excluded.status,
         payload=excluded.payload,
         printedAt=excluded.printedAt`,
      [row.id, row.saleId, row.status, JSON.stringify(row.payload), row.createdAt, row.printedAt ?? null]
    );
    this.conn.flushToDisk();
  }

  async getBySaleId(saleId: string): Promise<ReceiptRow | null> {
    const r = firstRowOrNull<any>(this.conn.db, `SELECT * FROM receipts WHERE saleId = ?`, [saleId]);
    if (!r) return null;

    return {
      id: String(r.id),
      saleId: String(r.saleId),
      status: String(r.status) as any,
      payload: safeJsonParse(r.payload as any),
      createdAt: String(r.createdAt),
      printedAt: r.printedAt ? String(r.printedAt) : undefined
    };
  }
}

export class SqliteOutboxRepository implements OutboxRepository {
  constructor(private readonly conn: SqliteConnection) {}

  async enqueue(row: OutboxRow): Promise<void> {
    this.conn.db.run(
      `INSERT INTO outbox (id, type, payloadJson, status, retryCount, nextRetryAt, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         status=excluded.status,
         retryCount=excluded.retryCount,
         nextRetryAt=excluded.nextRetryAt`,
      [
        row.id,
        row.type,
        JSON.stringify(row.payload),
        row.status,
        row.retryCount,
        row.nextRetryAt ?? null,
        row.createdAt
      ]
    );
    this.conn.flushToDisk();
  }

  async listPending(): Promise<OutboxRow[]> {
    const rows = allRows<any>(this.conn.db, `SELECT * FROM outbox WHERE status='PENDING' ORDER BY createdAt ASC`);
    return rows.map((r) => ({
      id: String(r.id),
      type: String(r.type),
      payload: safeJsonParse(r.payloadJson as any),
      status: String(r.status) as any,
      retryCount: Number(r.retryCount),
      nextRetryAt: r.nextRetryAt ? String(r.nextRetryAt) : undefined,
      createdAt: String(r.createdAt)
    }));
  }

  async markSent(id: string, _sentAtIso: string): Promise<void> {
    this.conn.db.run(
      `UPDATE outbox SET status='SENT', nextRetryAt=NULL WHERE id=?`,
      [id]
    );
    this.conn.flushToDisk();
  }

  async scheduleRetry(id: string, retryCount: number, nextRetryAtIso: string): Promise<void> {
    this.conn.db.run(
      `UPDATE outbox SET retryCount=?, nextRetryAt=?, status='PENDING' WHERE id=?`,
      [retryCount, nextRetryAtIso, id]
    );
    this.conn.flushToDisk();
  }
}

export class SqliteRuntimeStateRepository implements RuntimeStateRepository {
  constructor(private readonly conn: SqliteConnection) {}

  async set(stateJson: unknown): Promise<void> {
    this.conn.db.run(
      `INSERT INTO kiosk_runtime (id, stateJson, updatedAt)
       VALUES ('singleton', ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         stateJson=excluded.stateJson,
         updatedAt=excluded.updatedAt`,
      [JSON.stringify(stateJson), nowIso()]
    );
    this.conn.flushToDisk();
  }

  async get(): Promise<unknown | null> {
    const r = firstRowOrNull<any>(this.conn.db, `SELECT stateJson FROM kiosk_runtime WHERE id='singleton'`);
    if (!r) return null;
    return safeJsonParse(r.stateJson as any);
  }
}
