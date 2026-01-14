import type { Printer, PrintReceiptInput } from './Printer.js';

type HttpClient = {
  fetch: typeof fetch;
};

export class PrintBridgePrinter implements Printer {
  private readonly baseUrl: string;
  private readonly http: HttpClient;

  constructor(baseUrl: string, http: HttpClient = { fetch }) {
    this.baseUrl = String(baseUrl || '').replace(/\/$/, '');
    this.http = http;
  }

  async printReceipt(input: PrintReceiptInput): Promise<{ ok: true; receiptId: string }> {
    const res = await this.http.fetch(`${this.baseUrl}/print/receipt`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input)
    });
    if (!res.ok) throw new Error(`PrintBridge falhou: HTTP ${res.status}`);
    return (await res.json()) as { ok: true; receiptId: string };
  }

  async reprintReceipt(receiptId: string): Promise<void> {
    const res = await this.http.fetch(`${this.baseUrl}/print/reprint/${encodeURIComponent(receiptId)}`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error(`PrintBridge reprint falhou: HTTP ${res.status}`);
  }
}
