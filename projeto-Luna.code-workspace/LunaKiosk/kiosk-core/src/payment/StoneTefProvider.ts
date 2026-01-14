import type { ChargeInput, ChargeResult, PaymentProvider, StatusResult } from './PaymentProvider.js';

type HttpClient = {
  fetch: typeof fetch;
};

export class StoneTefProvider implements PaymentProvider {
  private readonly baseUrl: string;
  private readonly http: HttpClient;

  constructor(baseUrl: string, http: HttpClient = { fetch }) {
    this.baseUrl = String(baseUrl || '').replace(/\/$/, '');
    this.http = http;
  }

  async charge(input: ChargeInput): Promise<ChargeResult> {
    const res = await this.http.fetch(`${this.baseUrl}/tef/charge`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input)
    });

    if (!res.ok && res.status !== 202) {
      throw new Error(`TEF charge falhou: HTTP ${res.status}`);
    }
    return (await res.json()) as ChargeResult;
  }

  async getStatus(saleId: string): Promise<StatusResult> {
    const res = await this.http.fetch(`${this.baseUrl}/tef/status/${encodeURIComponent(saleId)}`, {
      method: 'GET'
    });
    if (!res.ok) throw new Error(`TEF status falhou: HTTP ${res.status}`);
    return (await res.json()) as StatusResult;
  }
}
