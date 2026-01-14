import { describe, expect, it } from 'vitest';

import { KioskEventType, KioskState, reduce } from '../src/kiosk/KioskMachine.js';
import type { KioskSnapshot } from '../src/kiosk/types.js';

function baseSnapshot(state: KioskState): KioskSnapshot {
  return { state, cart: { items: [] }, activeSaleId: null };
}

describe('KioskMachine reducer', () => {
  it('goes BOOT -> ATTRACT on KIOSK_STARTED', () => {
    const res = reduce(baseSnapshot(KioskState.BOOT), { type: KioskEventType.KIOSK_STARTED });
    expect(res.next.state).toBe(KioskState.ATTRACT);
  });

  it('adds product and goes to CART', () => {
    const res = reduce(baseSnapshot(KioskState.ATTRACT), {
      type: KioskEventType.PRODUCT_ADDED,
      item: { sku: 'X', name: 'Item', unitPriceCents: 100, quantity: 1 }
    });
    expect(res.next.state).toBe(KioskState.CART);
    expect(res.next.cart.items.length).toBe(1);
  });

  it('enter PAYMENT_INIT emits CALL_TEF_CHARGE intent', () => {
    const snap: KioskSnapshot = {
      state: KioskState.PAYMENT_METHOD,
      cart: { items: [{ sku: 'X', name: 'Item', unitPriceCents: 100, quantity: 1 }] },
      activeSaleId: null
    };
    const res = reduce(snap, { type: KioskEventType.PAYMENT_SELECTED_CARD });
    expect(res.next.state).toBe(KioskState.PAYMENT_INIT);
    expect(res.sideEffects.some((e) => e.type === 'CALL_TEF_CHARGE')).toBe(true);
  });

  it('on TEF_APPROVED emits CALL_PRINT_RECEIPT', () => {
    const snap: KioskSnapshot = {
      state: KioskState.PAYMENT_IN_PROGRESS,
      cart: { items: [{ sku: 'X', name: 'Item', unitPriceCents: 100, quantity: 1 }] },
      activeSaleId: 's1'
    };
    const res = reduce(snap, { type: KioskEventType.TEF_APPROVED, saleId: 's1' });
    expect(res.next.state).toBe(KioskState.PAYMENT_APPROVED);
    expect(res.sideEffects).toEqual([{ type: 'CALL_PRINT_RECEIPT', saleId: 's1' }]);
  });

  it('PRINT_FAIL leads to PRINT_ERROR and allows RETRY_PRINT', () => {
    const snap: KioskSnapshot = { state: KioskState.PRINTING, cart: { items: [] }, activeSaleId: 's1' };
    const fail = reduce(snap, { type: KioskEventType.PRINT_FAIL, saleId: 's1', message: 'paper jam' });
    expect(fail.next.state).toBe(KioskState.PRINT_ERROR);

    const retry = reduce(fail.next, { type: KioskEventType.RETRY_PRINT, saleId: 's1' });
    expect(retry.next.state).toBe(KioskState.PRINTING);
    expect(retry.sideEffects).toEqual([{ type: 'CALL_PRINT_RECEIPT', saleId: 's1' }]);
  });
});
