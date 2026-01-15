import { useEffect } from 'react';
import { PageContainer } from '../PageContainer';
import { FlowType, getFlowSteps } from '@/lib/flowSteps';

interface PaymentSuccessProps {
  onFinish: () => void;
  flow?: FlowType;
}

export function PaymentSuccess({ onFinish, flow = 'payment' }: PaymentSuccessProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onFinish();
    }, 5000);
    return () => clearTimeout(timer);
  }, [onFinish]);

  const steps = getFlowSteps(flow);
  const currentStep = flow === 'checkin' ? 4 : 2;

  return (
    <PageContainer showLogo={false} showHelp={false} steps={steps} currentStep={currentStep}>
      <div className="w-full flex flex-col items-center gap-8 text-center">
        {/* Success Icon with celebration effect */}
        <div className="relative">
          <div className="w-32 h-32 rounded-full bg-gradient-to-br from-[#4CAF50] to-[#1B5E20] flex items-center justify-center shadow-2xl shadow-[#4CAF50]/60 animate-[scale_0.5s_ease-out]">
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

          {/* Celebration particles */}
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="absolute w-3 h-3 rounded-full bg-[#4CAF50]"
              style={{
                top: '50%',
                left: '50%',
                transform: `translate(-50%, -50%) rotate(${i * 45}deg) translateY(-80px)`,
                opacity: 0,
                animation: `celebrate 1s ease-out ${i * 0.1}s`,
              }}
            />
          ))}
        </div>

        <div className="space-y-4">
          <h2 className="text-4xl md:text-5xl text-[#1B5E20]">
            Pagamento aprovado!
          </h2>
          <div className="flex items-center justify-center gap-2">
            <p className="text-xl md:text-2xl text-[#2E7D32]">
              Obrigada
            </p>
            <span className="text-3xl">💚</span>
          </div>
        </div>

        <div className="w-full max-w-2xl bg-white rounded-2xl shadow-lg p-8">
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-3 text-[#2E7D32]">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span className="text-lg">Pagamento confirmado com sucesso</span>
            </div>
            <p className="text-[#2E7D32]/80">
              Você pode aguardar na recepção
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-lg text-[#2E7D32]/70">
            Tenha um ótimo atendimento!
          </p>
          <p className="text-sm text-[#2E7D32]/60">
            Retornando ao menu inicial em instantes...
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes celebrate {
          0% {
            opacity: 1;
            transform: translate(-50%, -50%) rotate(var(--rotation)) translateY(0px) scale(1);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -50%) rotate(var(--rotation)) translateY(-120px) scale(0.5);
          }
        }
        @keyframes scale {
          0% {
            transform: scale(0);
          }
          50% {
            transform: scale(1.1);
          }
          100% {
            transform: scale(1);
          }
        }
      `}</style>
    </PageContainer>
  );
}
