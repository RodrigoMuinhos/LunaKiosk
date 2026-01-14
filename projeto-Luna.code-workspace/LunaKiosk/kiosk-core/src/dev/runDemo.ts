import pino from 'pino';

import { KioskEventType, KioskState } from '../kiosk/KioskMachine.js';
import { KioskOrchestrator } from '../kiosk/KioskOrchestrator.js';
import { StoneTefProvider } from '../payment/StoneTefProvider.js';
import { PrintBridgePrinter } from '../printer/PrintBridgePrinter.js';
import { getConfig } from '../config/runtime.js';
import { createRepositories, resetDbIfRequested } from '../db/factory.js';

const log = pino({ level: 'info' });

const cfg = getConfig();
resetDbIfRequested(cfg);

const tefBaseUrl = cfg.TEF_BRIDGE_URL;
const printBaseUrl = cfg.PRINT_BRIDGE_URL;

const repos = await createRepositories(cfg);

const orchestrator = new KioskOrchestrator({
  paymentProvider: new StoneTefProvider(tefBaseUrl),
  printer: new PrintBridgePrinter(printBaseUrl),
  saleRepo: repos.saleRepo,
  paymentRepo: repos.paymentRepo,
  receiptRepo: repos.receiptRepo,
  outboxRepo: repos.outboxRepo,
  runtimeRepo: repos.runtimeRepo,
  logger: log
});

await orchestrator.boot();
log.info({ state: orchestrator.getSnapshot().state }, 'booted');

await orchestrator.dispatch({
  type: KioskEventType.PRODUCT_ADDED,
  item: { sku: 'A1', name: 'Produto A', unitPriceCents: 1290, quantity: 1 }
});

await orchestrator.dispatch({ type: KioskEventType.CART_CONFIRMED });
await orchestrator.dispatch({ type: KioskEventType.PAYMENT_SELECTED_CARD });

for (let i = 0; i < 40; i++) {
  const s = orchestrator.getSnapshot();
  log.info({ state: s.state, saleId: s.activeSaleId }, 'tick');
  if (s.state === KioskState.SUCCESS) break;
  if (s.state === KioskState.PAYMENT_DECLINED || s.state === KioskState.PAYMENT_ERROR || s.state === KioskState.PRINT_ERROR) {
    break;
  }
  await new Promise((r) => setTimeout(r, 500));
}

log.info({ snapshot: orchestrator.getSnapshot() }, 'done');

// ensure DB is flushed/closed when persistent
await Promise.resolve(repos.close());
