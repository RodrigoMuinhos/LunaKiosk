export type Appointment = {
  id: string;
  tenantId?: string;
  patient: string;
  patientId: string;
  doctor: string;
  specialty: string;
  type: string;
  patientEmail?: string;
  date: string;
  time: string;
  status: string;
  paid: boolean;
  amount: number;
  cpf: string;
};

export async function searchAppointments(totemBaseUrl: string, authHeader: string, q: string): Promise<Appointment[]> {
  const base = totemBaseUrl.replace(/\/$/, '');
  const url = `${base}/api/appointments/search?q=${encodeURIComponent(q)}`;
  const res = await fetch(url, {
    headers: { Authorization: authHeader }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Falha na busca (${res.status})`);
  }
  return res.json();
}

export type PixInitResponse = {
  paymentId: string;
  qrCodeImageBase64?: string;
  qrCodeText?: string;
  status?: string;
};

export async function createPixPayment(totemBaseUrl: string, authHeader: string, appointmentId: string): Promise<PixInitResponse> {
  const base = totemBaseUrl.replace(/\/$/, '');
  const url = `${base}/api/payments/pix`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader,
    },
    body: JSON.stringify({ appointmentId })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Falha ao criar PIX (${res.status})`);
  }
  return res.json();
}

export type PixStatusResponse = { id: string; status: string; gatewayPaymentId?: string };

export async function getPixStatus(totemBaseUrl: string, authHeader: string, paymentId: string): Promise<PixStatusResponse> {
  const base = totemBaseUrl.replace(/\/$/, '');
  const url = `${base}/api/payments/status/${encodeURIComponent(paymentId)}`;
  const res = await fetch(url, {
    headers: { Authorization: authHeader }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Falha ao buscar status (${res.status})`);
  }
  return res.json();
}

export async function markAppointmentConfirmed(totemBaseUrl: string, authHeader: string, appointmentId: string): Promise<void> {
  const base = totemBaseUrl.replace(/\/$/, '');
  const url = `${base}/api/appointments/${encodeURIComponent(appointmentId)}/status`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader,
    },
    body: JSON.stringify({ status: 'confirmado' })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Falha ao confirmar consulta (${res.status})`);
  }
}
