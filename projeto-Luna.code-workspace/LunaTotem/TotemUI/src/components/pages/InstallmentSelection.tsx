import { Button } from '../Button';
import { PageContainer } from '../PageContainer';
import { ActionFooter } from '../ActionFooter';
import { FlowType, getFlowSteps } from '@/lib/flowSteps';

interface InstallmentSelectionProps {
  amount: number;
  onSelectInstallment: (installments: number) => void;
  onBack: () => void;
  flow?: FlowType;
}

export function InstallmentSelection({
  amount,
  onSelectInstallment,
  onBack,
  flow = 'payment',
}: InstallmentSelectionProps) {
  const maxInstallments = 4;
  const installmentOptions = Array.from({ length: maxInstallments }, (_, i) => i + 1);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const steps = getFlowSteps(flow);
  const currentStep = flow === 'checkin' ? 3 : 1;

  return (
    <PageContainer steps={steps} currentStep={currentStep}>
      <div className="w-full flex flex-col items-center gap-8">
        <div className="text-center space-y-3">
          <h2 className="text-3xl md:text-4xl text-[#D3A67F]">
            Selecione a quantidade de parcelas
          </h2>
          <p className="text-xl text-[#4A4A4A]/70">
            Total: {formatCurrency(amount)}
          </p>
        </div>

        <div className="w-full max-w-2xl space-y-3 mb-24">
          {installmentOptions.map((installments) => {
            const installmentValue = amount / installments;
            return (
              <button
                key={installments}
                onClick={() => onSelectInstallment(installments)}
                className="w-full bg-white hover:bg-[#D3A67F] hover:text-white text-[#4A4A4A] rounded-2xl p-6 shadow-lg transition-all duration-200 active:scale-95 flex justify-between items-center group"
              >
                <span className="text-xl">
                  {installments}x de {formatCurrency(installmentValue)}
                </span>
                <span className="text-sm opacity-70">
                  {installments === 1 ? 'à vista' : `Total: ${formatCurrency(amount)}`}
                </span>
              </button>
            );
          })}
        </div>
        <ActionFooter onBack={onBack} showConfirm={false} />
      </div>
    </PageContainer>
  );
}
