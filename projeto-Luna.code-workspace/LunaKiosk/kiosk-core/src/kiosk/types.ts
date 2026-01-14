export type MoneyCents = number;

export type CartItem = {
  sku: string;
  name: string;
  unitPriceCents: MoneyCents;
  quantity: number;
};

export type Cart = {
  items: CartItem[];
};

export type SaleStatus =
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'PAID_NOT_PRINTED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'PAYMENT_DECLINED'
  | 'PAYMENT_ERROR'
  | 'PRINT_ERROR';

export type PaymentData = {
  nsu?: string;
  authCode?: string;
  brand?: string;
  maskedPan?: string;
  acquirer?: string;
  rawJson?: unknown;
};

export type ReceiptPayload = {
  saleId: string;
  text: string;
};

export type KioskSnapshot = {
  state: import('./KioskMachine.js').KioskState;
  cart: Cart;
  activeSaleId: string | null;
  lastError?: string;
};

export type SideEffectIntent =
  | {
      type: 'CALL_TEF_CHARGE';
      saleId?: string;
      amountCents: MoneyCents;
      metadata?: Record<string, unknown>;
    }
  | {
      type: 'POLL_TEF_STATUS';
      saleId: string;
    }
  | {
      type: 'CALL_PRINT_RECEIPT';
      saleId: string;
    }
  | {
      type: 'EMIT_OUTBOX_EVENT';
      eventType: string;
      payload: Record<string, unknown>;
    };

export type ReduceResult = {
  next: KioskSnapshot;
  sideEffects: SideEffectIntent[];
};
