import pino from 'pino';
import { getConfig } from '../config/runtime.js';
import { createRepositories } from '../db/factory.js';
import { KioskOrchestrator } from '../kiosk/KioskOrchestrator.js';
import { StoneTefProvider } from '../payment/StoneTefProvider.js';
import { PrintBridgePrinter } from '../printer/PrintBridgePrinter.js';
import { OutboxWorker } from '../outbox/OutboxWorker.js';

async function main() {
  const cfg = getConfig();
  const log = pino({ level: process.env.LOG_LEVEL ?? 'info' });

  const repos = await createRepositories(cfg);

  const orchestrator = new KioskOrchestrator({
    paymentProvider: new StoneTefProvider(cfg.TEF_BRIDGE_URL),
    printer: new PrintBridgePrinter(cfg.PRINT_BRIDGE_URL),
    saleRepo: repos.saleRepo,
    paymentRepo: repos.paymentRepo,
    receiptRepo: repos.receiptRepo,
    outboxRepo: repos.outboxRepo,
    runtimeRepo: repos.runtimeRepo,
    logger: log
  });

  await orchestrator.boot();
  log.info({ snapshot: orchestrator.getSnapshot() }, 'v2 engine booted');

  let worker: OutboxWorker | null = null;
  if (cfg.OUTBOX_ENABLED) {
    worker = new OutboxWorker({ repo: repos.outboxRepo, endpointUrl: cfg.OUTBOX_SYNC_URL, logger: log });
    worker.start();
  }

  // Keep process alive; expose basic status logs
  setInterval(() => {
    const s = orchestrator.getSnapshot();
    log.info({ state: s.state, saleId: s.activeSaleId }, 'v2 heartbeat');
  }, 5000);

  // graceful exit
  const shutdown = async () => {
    if (worker) await worker.stop();
    await Promise.resolve(repos.close());
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
