import { PageContainer } from '../PageContainer';
import { ActionFooter } from '../ActionFooter';
import { PaymentMethod } from '../../types';
import { FlowType, getFlowSteps } from '@/lib/flowSteps';

interface PaymentProcessingProps {
  method: PaymentMethod;
  installments?: number;
  onComplete: () => void;
  onBack: () => void;
  flow?: FlowType;
}

export function PaymentProcessing({
  method,
  installments,
  onComplete,
  onBack,
  flow = 'payment',
}: PaymentProcessingProps) {
  const getMethodLabel = () => {
    if (method === 'pix') return 'PIX';
    if (method === 'debit') return 'Débito';
    if (method === 'credit') {
      return installments === 1 ? 'Crédito à vista' : `Crédito ${installments}x`;
    }
    return '';
  };

  const steps = getFlowSteps(flow);
  const currentStep = flow === 'checkin' ? 3 : 2;

  return (
    <PageContainer showLogo={false} showHelp={false} steps={steps} currentStep={currentStep}>
      <div className="w-full flex flex-col items-center gap-8 text-center">
        {/* Processing Animation */}
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
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
              <line x1="1" y1="10" x2="23" y2="10" />
            </svg>
          </div>
          {/* Rotating ring */}
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#D3A67F] animate-spin" />
        </div>

        <div className="space-y-4">
          <h2 className="text-3xl md:text-4xl text-[#D3A67F]">
            Processando pagamento
          </h2>
          <p className="text-xl text-[#4A4A4A]/70">
            {getMethodLabel()}
          </p>
        </div>

        {method !== 'pix' && (
          <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md space-y-4">
            <p className="text-lg text-[#4A4A4A]">
              {method === 'debit'
                ? 'Aproxime ou insira seu cartao de debito'
                : 'Aproxime ou insira seu cartao de credito'}
            </p>
          </div>
        )}
        {method === 'pix' && (
          <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md space-y-6">
            {/* QR Code Mock */}
            <div className="w-48 h-48 mx-auto bg-gradient-to-br from-[#CDDCDC] to-[#ECE0DE] rounded-2xl flex items-center justify-center">
              <div className="grid grid-cols-8 gap-1 p-4">
                {Array.from({ length: 64 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-sm ${
                      Math.random() > 0.5 ? 'bg-[#D3A67F]' : 'bg-white'
                    }`}
                  />
                ))}
              </div>
            </div>
            <p className="text-lg text-[#4A4A4A]">
              Escaneie o QR Code com seu aplicativo de pagamento
            </p>
          </div>
        )}

        <div className="flex items-center gap-2 text-[#4A4A4A]/70">
          <div className="w-2 h-2 bg-[#D3A67F] rounded-full animate-bounce" />
          <div className="w-2 h-2 bg-[#D3A67F] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
          <div className="w-2 h-2 bg-[#D3A67F] rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
        </div>
      </div>
      <ActionFooter onBack={onBack} showConfirm={false} />
    </PageContainer>
  );
}