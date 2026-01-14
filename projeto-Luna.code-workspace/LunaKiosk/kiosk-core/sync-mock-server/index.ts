import express from 'express';

const app = express();
app.use(express.json({ limit: '1mb' }));

app.post('/sync/outbox', (req, res) => {
  // eslint-disable-next-line no-console
  console.log('[sync-mock] received', req.body);
  res.json({ ok: true });
});

const port = Number.parseInt(process.env.SYNC_PORT || '7090', 10);
app.listen(port, '127.0.0.1', () => {
  // eslint-disable-next-line no-console
  console.log(`[sync-mock] listening on http://127.0.0.1:${port}`);
});
