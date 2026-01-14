export type PrintReceiptInput = {
  saleId: string;
  receiptText?: string;
  receiptModel?: unknown;
  force?: boolean;
};

export interface Printer {
  printReceipt(input: PrintReceiptInput): Promise<{ ok: true; receiptId: string }>;
  reprintReceipt(receiptId: string): Promise<void>;
}
