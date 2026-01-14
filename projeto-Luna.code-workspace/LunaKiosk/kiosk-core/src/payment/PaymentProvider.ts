export type ChargeInput = {
  saleId: string;
  amountCents: number;
  orderRef?: string;
  items?: Array<{ sku: string; name: string; unitPriceCents: number; quantity: number }>;
  operatorId?: string;
  storeId?: string;
};

export type ChargeResult = {
  saleId: string;
  status: 'IN_PROGRESS' | 'APPROVED' | 'DECLINED' | 'ERROR';
  approvedData?: Record<string, unknown>;
  error?: string;
};

export type StatusResult = ChargeResult;

export interface PaymentProvider {
  charge(input: ChargeInput): Promise<ChargeResult>;
  getStatus(saleId: string): Promise<StatusResult>;
  cancel?(saleId: string): Promise<void>;
}
