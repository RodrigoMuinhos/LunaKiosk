import { useEffect, useRef, useState } from 'react';
import { PageContainer } from '../PageContainer';
import { FlowType, getFlowSteps } from '@/lib/flowSteps';
import { appointmentAPI, paymentAPI } from '@/lib/api';

const createInFlightByAppointment = new Set<string>();
const RETRY_DELAYS_MS = [800, 1500];
const PIX_POLL_TIMEOUT_MS = 60_000;
const PIX_POLL_TIMEOUT_SECONDS = Math.floor(PIX_POLL_TIMEOUT_MS / 1000);

interface AsaasPixPaymentProps {
  appointmentId: string;
  onComplete: () => void;
  onBack?: () => void;
  flow?: FlowType;
}

export function AsaasPixPayment({ appointmentId, onComplete, onBack, flow = 'payment' }: AsaasPixPaymentProps) {
  const [qrCodeImage, setQrCodeImage] = useState<string>('');
  const [paymentId, setPaymentId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number>(PIX_POLL_TIMEOUT_SECONDS);
  const [timeLeftMs, setTimeLeftMs] = useState<number>(PIX_POLL_TIMEOUT_MS);
  const createdForAppointmentRef = useRef<string | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryAttemptRef = useRef(0);
  const activeRunRef = useRef(0);
  const mountedRef = useRef(false);
  const countdownStartRef = useRef<number>(0);

  const clearPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  };

  const bumpRun = () => {
    activeRunRef.current += 1;
    return activeRunRef.current;
  };

  const isRunActive = (runId: number) => mountedRef.current && runId === activeRunRef.current;

  const cancelAndBack = () => {
    bumpRun();
    clearPolling();
    try {
      createInFlightByAppointment.delete(appointmentId);
    } catch {
      // ignore
    }
    onBack?.();
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      bumpRun();
      clearPolling();
      try {
        createInFlightByAppointment.delete(appointmentId);
      } catch {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (createdForAppointmentRef.current === appointmentId) return;
    createdForAppointmentRef.current = appointmentId;
    createPixPayment();
  }, [appointmentId]);

  useEffect(() => {
    if (!paymentId) return;

    clearPolling();

    // Countdown regressivo (UI) + timeout real (segurança)
    countdownStartRef.current = Date.now();
    setTimeLeftMs(PIX_POLL_TIMEOUT_MS);
    setTimeLeftSeconds(PIX_POLL_TIMEOUT_SECONDS);

    const updateCountdown = () => {
      const elapsed = Date.now() - countdownStartRef.current;
      const remaining = Math.max(0, PIX_POLL_TIMEOUT_MS - elapsed);
      const remainingSeconds = Math.ceil(remaining / 1000);

      setTimeLeftMs(remaining);
      setTimeLeftSeconds(remainingSeconds);

      if (remaining <= 0) {
        clearPolling();
        setPaymentId('');
        setError('Tempo limite de 1 min atingido. Gere um novo QR Code para pagar.');
        setLoading(false);
      }
    };

    // Atualiza suave (barra) sem pesar.
    countdownIntervalRef.current = setInterval(updateCountdown, 250);
    updateCountdown();

    // Polling para verificar status do pagamento a cada 3 segundos
    pollIntervalRef.current = setInterval(() => {
      void checkPaymentStatus();
    }, 3000);

    pollTimeoutRef.current = setTimeout(() => {
      clearPolling();
      setPaymentId('');
      setError('Tempo limite de 1 min atingido. Gere um novo QR Code para pagar.');
      setLoading(false);
    }, PIX_POLL_TIMEOUT_MS);

    return () => {
      clearPolling();
    };
  }, [paymentId]);

  const createPixPayment = async () => {
    const runId = bumpRun();
    if (createInFlightByAppointment.has(appointmentId)) {
      return;
    }
    createInFlightByAppointment.add(appointmentId);
    try {
      clearPolling();
      if (isRunActive(runId)) {
        setLoading(true);
        setError('');
        setQrCodeImage('');
        setPaymentId('');
      }
      retryAttemptRef.current = 0;

      while (true) {
        try {
          const data = await paymentAPI.createPix(appointmentId);
          const nextQrImage = data.qrCodeImageBase64 || '';

          if (!data.paymentId || !nextQrImage) {
            throw new Error('QR Code vazio');
          }

          if (!isRunActive(runId)) {
            return;
          }

          setQrCodeImage(nextQrImage);
          setPaymentId(data.paymentId);
          setLoading(false);
          return;
        } catch (err) {
          const status = typeof err === 'object' && err && 'status' in err ? (err as { status?: number }).status : undefined;
          const shouldRetry = status === 502 || status === 503 || status === 504;
          if (shouldRetry && retryAttemptRef.current < RETRY_DELAYS_MS.length) {
            const delay = RETRY_DELAYS_MS[retryAttemptRef.current];
            retryAttemptRef.current += 1;
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }
          throw err;
        }
      }
    } catch (err) {
      console.error('Erro ao criar pagamento PIX:', err);
      if (isRunActive(runId)) {
        setError('Nao foi possivel gerar o QR Code. Tente novamente.');
        setLoading(false);
      }
    } finally {
      createInFlightByAppointment.delete(appointmentId);
    }
  };
  const checkPaymentStatus = async () => {
    try {
      if (!paymentId) return;
      const data = await paymentAPI.getPixStatus(paymentId);
      const normalizedStatus = (data.status || '').toString().toUpperCase();

      const isPaid =
        normalizedStatus === 'PAGO' ||
        normalizedStatus === 'PAID' ||
        normalizedStatus === 'CONFIRMED' ||
        normalizedStatus === 'RECEIVED';

      if (isPaid) {
        clearPolling();
        try {
          // Atualiza o agendamento para refletir o pagamento confirmado (sem depender do dashboard/polling).
          await appointmentAPI.updatePaid(appointmentId, true);
        } catch (e) {
          // best-effort: não bloqueia o fluxo se o backend falhar temporariamente
          console.warn('Falha ao marcar pagamento como pago no agendamento', e);
        }
        onComplete();
      }
    } catch (err) {
      console.error('Erro ao verificar status:', err);
    }
  };


  const steps = getFlowSteps(flow);
  const currentStep = flow === 'checkin' ? 3 : 2;

  const formatTimeLeft = (seconds: number) => {
    const safe = Math.max(0, Math.floor(seconds));
    const mm = Math.floor(safe / 60);
    const ss = safe % 60;
    return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  };

  const progressPct = Math.max(0, Math.min(100, (timeLeftMs / PIX_POLL_TIMEOUT_MS) * 100));
  const isEnding = timeLeftSeconds <= 10;

  if (loading) {
    return (
      <PageContainer steps={steps} currentStep={currentStep}>
        <div className="w-full flex flex-col items-center gap-8 text-center">
          <div className="relative">
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-[#D3A67F]/20 to-[#CDDCDC]/30 flex items-center justify-center animate-pulse">
              <svg
                width="64"
                height="64"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#D3A67F"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
            </div>
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#D3A67F] animate-spin" />
          </div>
          <h2 className="text-3xl md:text-4xl text-[#D3A67F]">
            Gerando QR Code PIX...
          </h2>

          {onBack && (
            <button
              onClick={cancelAndBack}
              className="px-8 py-3 border border-[#D3A67F] text-[#D3A67F] rounded-lg hover:bg-[#F6EFE9] transition"
            >
              Cancelar
            </button>
          )}
        </div>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer steps={steps} currentStep={currentStep}>
        <div className="w-full flex flex-col items-center gap-8 text-center">
          <div className="w-32 h-32 rounded-full bg-red-100 flex items-center justify-center">
            <svg
              width="64"
              height="64"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#DC2626"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <div className="space-y-4">
            <h2 className="text-3xl md:text-4xl text-red-600">Erro</h2>
            <p className="text-lg text-[#4A4A4A]/70">{error}</p>
          </div>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button
              onClick={createPixPayment}
              className="px-8 py-3 bg-[#D3A67F] text-white rounded-lg hover:bg-[#C89769] transition"
            >
              Tentar novamente
            </button>
            {onBack && (
              <button
                onClick={cancelAndBack}
                className="px-8 py-3 border border-[#D3A67F] text-[#D3A67F] rounded-lg hover:bg-[#F6EFE9] transition"
              >
                Cancelar
              </button>
            )}
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer steps={steps} currentStep={currentStep}>
      <div className="w-full flex flex-col items-center gap-8 text-center">
        <div className="space-y-3">
          <h2 className="text-3xl md:text-4xl text-[#D3A67F]">
            Processando pagamento
          </h2>
          <p className="text-xl text-[#4A4A4A]/70">PIX</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#4A4A4A]/70">Tempo para pagar</span>
              <span className={isEnding ? 'text-red-600 font-semibold' : 'text-[#4A4A4A]/70'}>
                {formatTimeLeft(timeLeftSeconds)}
              </span>
            </div>

            <div
              className="h-2 w-full rounded-full overflow-hidden"
              style={{ backgroundColor: '#F6EFE9' }}
              aria-label="Barra de tempo do PIX"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={PIX_POLL_TIMEOUT_MS}
              aria-valuenow={timeLeftMs}
            >
              <div
                className="h-full transition-[width] duration-200 ease-linear"
                style={{
                  width: `${progressPct}%`,
                  backgroundColor: isEnding ? '#DC2626' : '#D3A67F',
                }}
              />
            </div>

            {isEnding && (
              <p className="text-xs text-red-600">Tempo quase acabando… finalize o PIX agora.</p>
            )}
          </div>

          {/* QR Code real do Asaas */}
          {qrCodeImage && (
            <div className="w-full flex justify-center">
              <img
                src={`data:image/png;base64,${qrCodeImage}`}
                alt="QR Code PIX"
                className="w-64 h-64 rounded-lg"
              />
            </div>
          )}

          <p className="text-lg text-[#4A4A4A]">
            Escaneie o QR Code com seu aplicativo de pagamento
          </p>

        </div>

        <div className="flex items-center gap-2 text-[#4A4A4A]/70">
          <div className="w-2 h-2 bg-[#D3A67F] rounded-full animate-bounce" />
          <div
            className="w-2 h-2 bg-[#D3A67F] rounded-full animate-bounce"
            style={{ animationDelay: '0.2s' }}
          />
          <div
            className="w-2 h-2 bg-[#D3A67F] rounded-full animate-bounce"
            style={{ animationDelay: '0.4s' }}
          />
        </div>

        <p className="text-sm text-[#4A4A4A]/70">
          Aguardando confirmação do pagamento...
        </p>

        {onBack && (
          <button
            onClick={cancelAndBack}
            className="px-8 py-3 border border-[#D3A67F] text-[#D3A67F] rounded-lg hover:bg-[#F6EFE9] transition"
          >
            Cancelar
          </button>
        )}
      </div>
    </PageContainer>
  );
}
