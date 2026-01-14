import { useEffect } from 'react';
import { Button } from '../Button';
import { PageContainer } from '../PageContainer';
import { Appointment } from '../../types';
import { getFlowSteps } from '@/lib/flowSteps';

interface CheckInCompleteProps {
  appointment: Appointment;
  onFinish: () => void;
  onPayNow?: () => void;
}

export function CheckInComplete({ appointment, onFinish, onPayNow }: CheckInCompleteProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onFinish();
    }, 5000);
    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <PageContainer
      showLogo={false}
      showHelp={false}
      steps={getFlowSteps('checkin')}
      currentStep={4}
    >
      <div className="w-full flex flex-col items-center gap-8 text-center">
        {/* Success Icon */}
        <div className="w-32 h-32 rounded-full bg-gradient-to-br from-[#D3A67F] to-[#C89769] flex items-center justify-center shadow-2xl animate-[scale_0.5s_ease-out]">
          <svg
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <div className="space-y-4">
          <h2 className="text-4xl md:text-5xl text-[#D3A67F]">
            Tudo certo!
          </h2>
          <p className="text-xl md:text-2xl text-[#4A4A4A]">
            Você confirmou sua chegada
          </p>
        </div>

        {/* Doctor Info Card */}
        <div className="w-full max-w-2xl bg-white rounded-2xl shadow-lg p-8">
          <div className="flex items-center gap-6">
            {/* Doctor Avatar */}
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#D3A67F]/20 to-[#CDDCDC]/30 flex items-center justify-center flex-shrink-0">
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#D3A67F"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>

            <div className="text-left flex-1">
              <p className="text-sm text-[#4A4A4A]/70 mb-1">
                Você será atendida por:
              </p>
              <h3 className="text-2xl text-[#D3A67F]">
                {appointment.doctor}
              </h3>
              <p className="text-[#4A4A4A]/70">
                {appointment.specialty}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-lg text-[#4A4A4A]/70">
            Aguarde ser chamada na recepção
          </p>
          <p className="text-sm text-[#4A4A4A]/50">
            Retornando ao menu inicial em instantes...
          </p>
          {onPayNow && (
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm text-[#4A4A4A]/70">Deseja pagar agora?</p>
              <Button variant="secondary" size="xl" onClick={onPayNow}>
                Ir para Pagamento
              </Button>
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
