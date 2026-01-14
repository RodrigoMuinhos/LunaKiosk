export type LunaCoreLoginResponse = {
  token: string;
  userId?: string;
  email?: string;
  name?: string;
  role?: string;
  tenantId?: string;
  tenantName?: string;
  availableModules?: string[];
};

export async function lunaCoreLogin(coreBaseUrl: string, email: string, password: string): Promise<LunaCoreLoginResponse> {
  const url = `${coreBaseUrl.replace(/\/$/, '')}/auth/login`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Login falhou (${res.status})`);
  }

  return res.json();
}
