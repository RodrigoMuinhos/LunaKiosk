// API Configuration (normalize NEXT_PUBLIC_API_URL)
function normalizeBaseUrl(input?: string): string {
  let url = (input || '').trim();
  // Support same-origin relative API base.
  // If caller passes '/' or any relative path, treat it as "no base" so endpoints become '/api/...'.
  // This is useful when a reverse proxy (nginx) or Next rewrites proxy /api to the backend.
  if (url === '/' || url.startsWith('/')) return '';
  if (!url) return 'https://lunavita-production.up.railway.app';
  // Add protocol if missing
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }
  // Remove trailing slash
  url = url.replace(/\/$/, '');
  return url;
}

// The UI expects a single "API base" that exposes all /api/* endpoints.
// In this repo, TotemAPI (8081) is the facade that exposes appointments/patients/users/payments.
// LunaCore (8080) does NOT expose /api/payments, which breaks PIX QR generation in kiosk.
// Prefer the TotemAPI URL when available.
const preferredApiUrl =
  process.env.NEXT_PUBLIC_LUNATOTEM_API_URL || process.env.NEXT_PUBLIC_API_URL;

export const API_BASE_URL = normalizeBaseUrl(preferredApiUrl);

// Log configuration on load
if (typeof window !== 'undefined') {
  console.log('[API CONFIG] Base URL:', API_BASE_URL);
  console.log('[API CONFIG] NEXT_PUBLIC_API_URL env:', process.env.NEXT_PUBLIC_API_URL);
  console.log('[API CONFIG] NEXT_PUBLIC_LUNATOTEM_API_URL env:', process.env.NEXT_PUBLIC_LUNATOTEM_API_URL);
}

export const API_ENDPOINTS = {
  // Appointments
  appointments: `${API_BASE_URL}/api/appointments`,
  appointmentById: (id: string) => `${API_BASE_URL}/api/appointments/${id}`,
  appointmentStatus: (id: string) => `${API_BASE_URL}/api/appointments/${id}/status`,
  appointmentPhoto: (id: string) => `${API_BASE_URL}/api/appointments/${id}/photo`,
  appointmentReport: (id: string) => `${API_BASE_URL}/api/appointments/${id}/report`,
  appointmentNotify: (id: string) => `${API_BASE_URL}/api/appointments/${id}/notify`,
  appointmentUpcoming: `${API_BASE_URL}/api/appointments/upcoming`,
  appointmentSearch: (q: string) => `${API_BASE_URL}/api/appointments/search?q=${encodeURIComponent(q)}`,
  
  // Doctors
  doctors: `${API_BASE_URL}/api/doctors`,
  doctorById: (id: string) => `${API_BASE_URL}/api/doctors/${id}`,
  
  // Patients
  patients: `${API_BASE_URL}/api/patients`,
  patientById: (id: string) => `${API_BASE_URL}/api/patients/${id}`,
  patientByCpf: (cpf: string) => `${API_BASE_URL}/api/patients/cpf/${cpf}`,

  // Users
  users: `${API_BASE_URL}/api/users`,
  userById: (id: string | number) => `${API_BASE_URL}/api/users/${id}`,
  
  // Payments
  payments: `${API_BASE_URL}/api/payments`,
  
  // Dashboard
  dashboardSummary: `${API_BASE_URL}/api/dashboard/summary`, // basic (sanitized)
  dashboardSummaryFull: `${API_BASE_URL}/api/dashboard/summary/full`, // admin only

  // Auth
  authLogin: `${API_BASE_URL}/api/auth/login`,
  authRegister: `${API_BASE_URL}/api/auth/register`,
  
  // Health Check
  health: `${API_BASE_URL}/actuator/health`,
};

// API Client Configuration
export const apiConfig = {
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 seconds
};

// Auth token (JWT) holder - updated after login
export let authToken: string | null = null;
export let authRole: string | null = null;

export function normalizeRole(role?: string | null): string | null {
  const normalized = (role || '').trim().toUpperCase();
  if (!normalized) return null;
  switch (normalized) {
    case 'OWNER':
    case 'ADMIN':
    case 'ADMINISTRACAO':
    case 'FINANCE':
    case 'FINANCEIRO':
      return 'ADMINISTRACAO';
    case 'RECEPTION':
    case 'RECEPCAO':
      return 'RECEPCAO';
    case 'DOCTOR':
    case 'MEDICO':
      return 'MEDICO';
    default:
      return normalized;
  }
}

export function setAuth(token: string | null, role: string | null) {
  authToken = token;
  authRole = normalizeRole(role);
}

export function clearAuth() {
  authToken = null;
  authRole = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem('lv_token');
    localStorage.removeItem('lv_role');
    localStorage.removeItem('lv_refresh');
  }
}

export async function ensureFreshToken() {
  if (typeof window === 'undefined') return;
  const token = localStorage.getItem('lv_token');
  const refresh = localStorage.getItem('lv_refresh');
  if (!token && refresh) {
    // Attempt silent refresh (only if token missing; simplistic strategy)
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refresh })
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('lv_token', data.token);
        localStorage.setItem('lv_refresh', data.refreshToken);
        setAuth(data.token, localStorage.getItem('lv_role'));
      } else if (res.status === 400 || res.status === 401) {
        clearAuth();
      }
    } catch {
      // ignore
    }
  }
}
