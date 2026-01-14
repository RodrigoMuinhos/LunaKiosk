import express from 'express';

type ChargeInput = {
  saleId: string;
  amountCents: number;
  orderRef?: string;
  items?: unknown;
  operatorId?: string;
  storeId?: string;
};

type Status = 'IN_PROGRESS' | 'APPROVED' | 'DECLINED' | 'ERROR';
type StatusPayload = {
  saleId: string;
  status: Status;
  approvedData?: Record<string, unknown>;
  error?: string;
};

const app = express();
app.use(express.json({ limit: '1mb' }));

const port = Number.parseInt(process.env.TEF_BRIDGE_PORT || '7071', 10);
const host = process.env.TEF_BRIDGE_HOST || '127.0.0.1';

const statusBySaleId = new Map<string, StatusPayload>();

function nowIso() {
  return new Date().toISOString();
}

function simulateStoneTef(input: ChargeInput): void {
  setTimeout(() => {
    const approved: StatusPayload = {
      saleId: input.saleId,
      status: 'APPROVED',
      approvedData: {
        nsu: String(Math.floor(Math.random() * 1_000_000)),
        authCode: String(Math.floor(Math.random() * 100_000)),
        brand: 'VISA',
        maskedPan: '**** **** **** 1234',
        acquirer: 'STONE',
        approvedAt: nowIso()
      }
    };
    statusBySaleId.set(input.saleId, approved);
  }, 2500);
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'tef-bridge' });
});

app.post('/tef/charge', (req, res) => {
  const input = req.body as ChargeInput;
  if (!input?.saleId || !Number.isFinite(input.amountCents)) {
    res.status(400).json({ error: 'invalid input' });
    return;
  }

  const existing = statusBySaleId.get(input.saleId);
  if (existing && existing.status !== 'IN_PROGRESS') {
    res.status(200).json(existing);
    return;
  }

  statusBySaleId.set(input.saleId, { saleId: input.saleId, status: 'IN_PROGRESS' });
  simulateStoneTef(input);
  res.status(202).json({ saleId: input.saleId, status: 'IN_PROGRESS' });
});

app.get('/tef/status/:saleId', (req, res) => {
  const saleId = String(req.params.saleId || '');
  const s = statusBySaleId.get(saleId);
  if (!s) {
    res.status(404).json({ saleId, status: 'ERROR', error: 'unknown saleId' });
    return;
  }
  res.json(s);
});

app.listen(port, host, () => {
  // eslint-disable-next-line no-console
  console.log(`[tef-bridge] listening on http://${host}:${port}`);
});
