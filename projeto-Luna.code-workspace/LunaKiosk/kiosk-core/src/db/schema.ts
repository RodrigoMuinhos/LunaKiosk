export const KIOSK_DB_FILENAME = 'kiosk.sqlite';

export function getSchemaSql(): string[] {
  return [
    `CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      totalCents INTEGER NOT NULL,
      cartJson TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      printedAt TEXT
    );`,
    `CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      saleId TEXT NOT NULL,
      status TEXT NOT NULL,
      nsu TEXT,
      authCode TEXT,
      brand TEXT,
      maskedPan TEXT,
      acquirer TEXT,
      rawJson TEXT,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (saleId) REFERENCES sales(id),
      UNIQUE (saleId)
    );`,
    `CREATE TABLE IF NOT EXISTS receipts (
      id TEXT PRIMARY KEY,
      saleId TEXT NOT NULL,
      status TEXT NOT NULL,
      payload TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      printedAt TEXT,
      FOREIGN KEY (saleId) REFERENCES sales(id),
      UNIQUE (saleId)
    );`,
    `CREATE TABLE IF NOT EXISTS outbox (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      payloadJson TEXT NOT NULL,
      status TEXT NOT NULL,
      retryCount INTEGER NOT NULL,
      nextRetryAt TEXT,
      createdAt TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS kiosk_runtime (
      id TEXT PRIMARY KEY,
      stateJson TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );`
  ];
}
