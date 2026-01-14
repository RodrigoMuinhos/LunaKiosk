import express from 'express';
import { randomUUID } from 'node:crypto';

type PrintInput = {
  saleId: string;
  receiptText?: string;
  receiptModel?: unknown;
  force?: boolean;
};

type ReceiptRecord = {
  receiptId: string;
  saleId: string;
  payload: PrintInput;
  printedAt: string;
};

const app = express();
app.use(express.json({ limit: '1mb' }));

const port = Number.parseInt(process.env.PRINT_BRIDGE_PORT || '7072', 10);
const host = process.env.PRINT_BRIDGE_HOST || '127.0.0.1';

const bySaleId = new Map<string, ReceiptRecord>();
const byReceiptId = new Map<string, ReceiptRecord>();

function nowIso() {
  return new Date().toISOString();
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'print-bridge' });
});

app.post('/print/receipt', (req, res) => {
  const input = req.body as PrintInput;
  if (!input?.saleId) {
    res.status(400).json({ ok: false, error: 'saleId required' });
    return;
  }

  const existing = bySaleId.get(input.saleId);
  if (existing && !input.force) {
    res.json({ ok: true, receiptId: existing.receiptId });
    return;
  }

  const receiptId = randomUUID();
  const rec: ReceiptRecord = {
    receiptId,
    saleId: input.saleId,
    payload: input,
    printedAt: nowIso()
  };
  bySaleId.set(input.saleId, rec);
  byReceiptId.set(receiptId, rec);

  // eslint-disable-next-line no-console
  console.log(`[print-bridge] printed saleId=${input.saleId} receiptId=${receiptId}`);
  res.json({ ok: true, receiptId });
});

app.post('/print/reprint/:receiptId', (req, res) => {
  const receiptId = String(req.params.receiptId || '');
  const rec = byReceiptId.get(receiptId);
  if (!rec) {
    res.status(404).json({ ok: false, error: 'receiptId not found' });
    return;
  }
  // eslint-disable-next-line no-console
  console.log(`[print-bridge] reprinted receiptId=${receiptId} saleId=${rec.saleId}`);
  res.json({ ok: true });
});

app.listen(port, host, () => {
  // eslint-disable-next-line no-console
  console.log(`[print-bridge] listening on http://${host}:${port}`);
});
