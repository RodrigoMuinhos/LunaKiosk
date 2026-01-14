import type { Cart, CartItem, ReduceResult } from './types.js';

export enum KioskState {
  BOOT = 'BOOT',
  ATTRACT = 'ATTRACT',
  BROWSE = 'BROWSE',
  CART = 'CART',
  PAYMENT_METHOD = 'PAYMENT_METHOD',
  PAYMENT_INIT = 'PAYMENT_INIT',
  PAYMENT_IN_PROGRESS = 'PAYMENT_IN_PROGRESS',
  PAYMENT_APPROVED = 'PAYMENT_APPROVED',
  PAYMENT_DECLINED = 'PAYMENT_DECLINED',
  PAYMENT_ERROR = 'PAYMENT_ERROR',
  PRINTING = 'PRINTING',
  PRINT_OK = 'PRINT_OK',
  PRINT_ERROR = 'PRINT_ERROR',
  SUCCESS = 'SUCCESS',
  CANCELLED = 'CANCELLED'
}

export enum KioskEventType {
  KIOSK_STARTED = 'KIOSK_STARTED',
  IDLE_TIMEOUT = 'IDLE_TIMEOUT',

  PRODUCT_ADDED = 'PRODUCT_ADDED',
  PRODUCT_REMOVED = 'PRODUCT_REMOVED',
  CART_CONFIRMED = 'CART_CONFIRMED',

  PAYMENT_SELECTED_CARD = 'PAYMENT_SELECTED_CARD',
  PAYMENT_CANCEL_REQUESTED = 'PAYMENT_CANCEL_REQUESTED',

  TEF_WAITING_CARD = 'TEF_WAITING_CARD',
  TEF_PROCESSING = 'TEF_PROCESSING',
  TEF_APPROVED = 'TEF_APPROVED',
  TEF_DECLINED = 'TEF_DECLINED',
  TEF_ERROR = 'TEF_ERROR',

  PRINT_OK = 'PRINT_OK',
  PRINT_FAIL = 'PRINT_FAIL',

  RETRY_PRINT = 'RETRY_PRINT',

  RESET_TO_ATTRACT = 'RESET_TO_ATTRACT'
}

export type KioskEvent =
  | { type: KioskEventType.KIOSK_STARTED }
  | { type: KioskEventType.IDLE_TIMEOUT }
  | { type: KioskEventType.PRODUCT_ADDED; item: CartItem }
  | { type: KioskEventType.PRODUCT_REMOVED; sku: string }
  | { type: KioskEventType.CART_CONFIRMED }
  | { type: KioskEventType.PAYMENT_SELECTED_CARD }
  | { type: KioskEventType.PAYMENT_CANCEL_REQUESTED }
  | { type: KioskEventType.TEF_WAITING_CARD; saleId: string }
  | { type: KioskEventType.TEF_PROCESSING; saleId: string }
  | { type: KioskEventType.TEF_APPROVED; saleId: string }
  | { type: KioskEventType.TEF_DECLINED; saleId: string; reason?: string }
  | { type: KioskEventType.TEF_ERROR; saleId: string; message: string }
  | { type: KioskEventType.PRINT_OK; saleId: string }
  | { type: KioskEventType.PRINT_FAIL; saleId: string; message: string }
  | { type: KioskEventType.RETRY_PRINT; saleId: string }
  | { type: KioskEventType.RESET_TO_ATTRACT };

export function emptyCart(): Cart {
  return { items: [] };
}

export function cartTotalCents(cart: Cart): number {
  return cart.items.reduce((sum, it) => sum + it.unitPriceCents * it.quantity, 0);
}

function addToCart(cart: Cart, item: CartItem): Cart {
  const existing = cart.items.find((i) => i.sku === item.sku);
  if (!existing) return { items: [...cart.items, { ...item }] };
  return {
    items: cart.items.map((i) => (i.sku === item.sku ? { ...i, quantity: i.quantity + item.quantity } : i))
  };
}

function removeFromCart(cart: Cart, sku: string): Cart {
  const existing = cart.items.find((i) => i.sku === sku);
  if (!existing) return cart;
  if (existing.quantity <= 1) return { items: cart.items.filter((i) => i.sku !== sku) };
  return {
    items: cart.items.map((i) => (i.sku === sku ? { ...i, quantity: i.quantity - 1 } : i))
  };
}

/**
 * Reducer puro: recebe snapshot atual + evento e retorna próximo snapshot + intenções de side effects.
 * IMPORTANTÍSSIMO: aqui não chamamos TEF, não imprimimos e não acessamos DB.
 */
export function reduce(snapshot: import('./types.js').KioskSnapshot, event: KioskEvent): ReduceResult {
  const { state } = snapshot;
  const sideEffects: ReduceResult['sideEffects'] = [];

  if (event.type === KioskEventType.RESET_TO_ATTRACT) {
    return {
      next: { state: KioskState.ATTRACT, cart: emptyCart(), activeSaleId: null },
      sideEffects
    };
  }

  if (event.type === KioskEventType.IDLE_TIMEOUT) {
    if (state === KioskState.ATTRACT || state === KioskState.BROWSE || state === KioskState.CART) {
      return {
        next: { ...snapshot, state: KioskState.ATTRACT, cart: emptyCart(), activeSaleId: null },
        sideEffects
      };
    }
  }

  switch (state) {
    case KioskState.BOOT: {
      if (event.type === KioskEventType.KIOSK_STARTED) {
        return {
          next: { ...snapshot, state: KioskState.ATTRACT },
          sideEffects
        };
      }
      return { next: snapshot, sideEffects };
    }

    case KioskState.ATTRACT: {
      if (event.type === KioskEventType.PRODUCT_ADDED) {
        const cart = addToCart(snapshot.cart, event.item);
        return { next: { ...snapshot, state: KioskState.CART, cart }, sideEffects };
      }
      return { next: snapshot, sideEffects };
    }

    case KioskState.BROWSE:
    case KioskState.CART: {
      if (event.type === KioskEventType.PRODUCT_ADDED) {
        const cart = addToCart(snapshot.cart, event.item);
        return { next: { ...snapshot, state: KioskState.CART, cart }, sideEffects };
      }
      if (event.type === KioskEventType.PRODUCT_REMOVED) {
        const cart = removeFromCart(snapshot.cart, event.sku);
        return { next: { ...snapshot, cart, state: cart.items.length ? KioskState.CART : KioskState.ATTRACT }, sideEffects };
      }
      if (event.type === KioskEventType.CART_CONFIRMED) {
        if (cartTotalCents(snapshot.cart) <= 0) return { next: snapshot, sideEffects };
        return { next: { ...snapshot, state: KioskState.PAYMENT_METHOD }, sideEffects };
      }
      return { next: snapshot, sideEffects };
    }

    case KioskState.PAYMENT_METHOD: {
      if (event.type === KioskEventType.PAYMENT_SELECTED_CARD) {
        const amountCents = cartTotalCents(snapshot.cart);
        sideEffects.push({
          type: 'CALL_TEF_CHARGE',
          amountCents,
          metadata: { cartItems: snapshot.cart.items }
        });
        return {
          next: { ...snapshot, state: KioskState.PAYMENT_INIT },
          sideEffects
        };
      }
      if (event.type === KioskEventType.PAYMENT_CANCEL_REQUESTED) {
        return { next: { ...snapshot, state: KioskState.CANCELLED }, sideEffects };
      }
      return { next: snapshot, sideEffects };
    }

    case KioskState.PAYMENT_INIT:
    case KioskState.PAYMENT_IN_PROGRESS: {
      if (event.type === KioskEventType.TEF_WAITING_CARD || event.type === KioskEventType.TEF_PROCESSING) {
        return {
          next: { ...snapshot, state: KioskState.PAYMENT_IN_PROGRESS, activeSaleId: event.saleId },
          sideEffects
        };
      }
      if (event.type === KioskEventType.TEF_APPROVED) {
        sideEffects.push({ type: 'CALL_PRINT_RECEIPT', saleId: event.saleId });
        return {
          next: { ...snapshot, state: KioskState.PAYMENT_APPROVED, activeSaleId: event.saleId },
          sideEffects
        };
      }
      if (event.type === KioskEventType.TEF_DECLINED) {
        return {
          next: { ...snapshot, state: KioskState.PAYMENT_DECLINED, activeSaleId: event.saleId, lastError: event.reason },
          sideEffects
        };
      }
      if (event.type === KioskEventType.TEF_ERROR) {
        return {
          next: { ...snapshot, state: KioskState.PAYMENT_ERROR, activeSaleId: event.saleId, lastError: event.message },
          sideEffects
        };
      }
      if (event.type === KioskEventType.PAYMENT_CANCEL_REQUESTED) {
        return { next: { ...snapshot, state: KioskState.CANCELLED }, sideEffects };
      }
      return { next: snapshot, sideEffects };
    }

    case KioskState.PAYMENT_APPROVED:
    case KioskState.PRINTING:
    case KioskState.PRINT_ERROR: {
      if (event.type === KioskEventType.PRINT_OK) {
        return { next: { ...snapshot, state: KioskState.SUCCESS, activeSaleId: event.saleId }, sideEffects };
      }
      if (event.type === KioskEventType.PRINT_FAIL) {
        return {
          next: { ...snapshot, state: KioskState.PRINT_ERROR, activeSaleId: event.saleId, lastError: event.message },
          sideEffects
        };
      }
      if (event.type === KioskEventType.RETRY_PRINT) {
        sideEffects.push({ type: 'CALL_PRINT_RECEIPT', saleId: event.saleId });
        return { next: { ...snapshot, state: KioskState.PRINTING, activeSaleId: event.saleId }, sideEffects };
      }
      return { next: snapshot, sideEffects };
    }

    case KioskState.PAYMENT_DECLINED:
    case KioskState.PAYMENT_ERROR:
    case KioskState.SUCCESS:
    case KioskState.CANCELLED:
    default:
      return { next: snapshot, sideEffects };
  }
}
