import { useState } from 'react';
import { PageContainer } from '../PageContainer';
import { ActionFooter } from '../ActionFooter';
import { Button } from '../Button';
import { PaymentMethod } from '../../types';
import { FlowType, getFlowSteps } from '@/lib/flowSteps';
import { API_BASE_URL } from '@/lib/apiConfig';

interface Appointment {
  id: string;
  patient: {
    name: string;
    cpf: string;
  };
  amount: number;
  date: string;
  time: string;
  doctor?: string;
  specialty?: string;
}

interface PaymentProcessingProps {
  method: PaymentMethod;
  installments?: number;
  onComplete: () => void;
  onBack: () => void;
  flow?: FlowType;
  selectedAppointment?: Appointment | null;
}

export function PaymentProcessing({
  method,
  installments,
  onComplete,
  onBack,
  flow = 'payment',
  selectedAppointment,
}: PaymentProcessingProps) {
  const [enqueuingPrint, setEnqueuingPrint] = useState(false);
  const [printMessage, setPrintMessage] = useState<string>('');

  // Função para gerar recibo completo e formatado
  const generateFormattedReceipt = () => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-BR');
    const timeStr = now.toLocaleTimeString('pt-BR');
    
    if (selectedAppointment) {
      // Recibo com dados reais do agendamento
      const cpfFormatted = selectedAppointment.patient.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
      const amountFormatted = selectedAppointment.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      const methodLabel = method === 'pix' ? 'PIX' : method === 'debit' ? 'Débito' : installments && installments > 1 ? `Crédito ${installments}x` : 'Crédito à vista';
      
      return `
========================================
       LUNA VITA CLINICA
    RECIBO DE PAGAMENTO
========================================

Data/Hora: ${dateStr} ${timeStr}

----------------------------------------

DADOS DO PACIENTE
Nome: ${selectedAppointment.patient.name}
CPF: ${cpfFormatted}

AGENDAMENTO
Data: ${selectedAppointment.date}
Horario: ${selectedAppointment.time}
${selectedAppointment.doctor ? `Medico: ${selectedAppointment.doctor}` : ''}
${selectedAppointment.specialty ? `Especialidade: ${selectedAppointment.specialty}` : ''}

----------------------------------------

        VALOR PAGO
        ${amountFormatted}

    Forma: ${methodLabel}

----------------------------------------

    PAGAMENTO CONFIRMADO
    Aguarde ser chamado

  Obrigado pela preferencia!

========================================
`;
    } else {
      // Recibo de teste com dados fictícios
      return `
========================================
       LUNA VITA CLINICA
    RECIBO DE PAGAMENTO
         [TESTE]
========================================

Data/Hora: ${dateStr} ${timeStr}

----------------------------------------

DADOS DO PACIENTE
Nome: Paciente Teste Silva
CPF: 123.456.789-00

AGENDAMENTO
Data: ${dateStr}
Horario: 14:30
Medico: Dr. Joao Silva
Especialidade: Cardiologia

----------------------------------------

        VALOR PAGO
        R$ 150,00

    Forma: ${method === 'pix' ? 'PIX' : method === 'debit' ? 'Debito' : 'Credito'}

----------------------------------------

    PAGAMENTO CONFIRMADO
    Aguarde ser chamado

  Obrigado pela preferencia!

========================================

   [RECIBO SIMULADO - TESTE]
`;
    }
  };

  const enqueuePrintReceipt = async () => {
    try {
      setEnqueuingPrint(true);
      setPrintMessage('');

      // Gerar recibo completo e formatado
      const formattedReceipt = generateFormattedReceipt();
      
      // Preparar dados para envio à API
      const receiptData = selectedAppointment
        ? {
            terminalId: 'TOTEM-001',
            tenantId: 'tenant-1',
            receiptType: 'PAYMENT',
            payload: btoa(formattedReceipt),
            priority: 0,
            appointmentId: selectedAppointment.id,
            metadata: JSON.stringify({
              patientName: selectedAppointment.patient.name,
              cpf: selectedAppointment.patient.cpf,
              amount: selectedAppointment.amount,
              paymentMethod: method,
              installments: installments,
              date: selectedAppointment.date,
              time: selectedAppointment.time,
              doctor: selectedAppointment.doctor,
              specialty: selectedAppointment.specialty,
            }),
          }
        : {
            terminalId: 'TOTEM-001',
            tenantId: 'tenant-1',
            receiptType: 'TEST',
            payload: btoa(formattedReceipt),
            priority: 0,
            metadata: JSON.stringify({
              testReceipt: true,
              generatedAt: new Date().toISOString(),
            }),
          };

      const response = await fetch(`${API_BASE_URL}/api/print-queue/enqueue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(receiptData),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('[PRINT] Recibo enfileirado:', result.id);
        console.log('[PRINT] Conteúdo do recibo:\n' + formattedReceipt);
        setPrintMessage('✅ Recibo enviado para impressão!');
        setTimeout(() => setPrintMessage(''), 3000);
      } else {
        console.error('[PRINT] Erro ao enfileirar recibo');
        setPrintMessage('❌ Erro ao enfileirar impressão');
        setTimeout(() => setPrintMessage(''), 3000);
      }
    } catch (error) {
      console.error('[PRINT] Erro:', error);
      setPrintMessage('❌ Erro ao conectar com servidor');
      setTimeout(() => setPrintMessage(''), 3000);
    } finally {
      setEnqueuingPrint(false);
    }
  };

  const handleSimulatePayment = async () => {
    // Enfileira impressão antes de completar o pagamento
    await enqueuePrintReceipt();
    // Aguarda um pouco para mostrar feedback antes de avançar
    setTimeout(() => {
      onComplete();
    }, 1000);
  };

  const getMethodLabel = () => {
    if (method === 'pix') return 'PIX';
    if (method === 'debit') return 'Débito';
    if (method === 'credit') {
      return installments === 1 ? 'Crédito à vista' : `Crédito ${installments}x`;
    }
    return '';
  };

  const steps = getFlowSteps(flow);
  const currentStep = flow === 'checkin' ? 3 : 1;

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

        <div className="w-full max-w-md space-y-2">
          <Button
            variant="outline"
            size="lg"
            onClick={handleSimulatePayment}
            disabled={enqueuingPrint}
            className="w-full"
          >
            {enqueuingPrint ? '🖨️ Enfileirando impressão...' : 'Simular pagamento'}
          </Button>
          {printMessage && (
            <p className="text-sm font-semibold text-center text-[#4CAF50]">
              {printMessage}
            </p>
          )}
          <p className="text-xs text-[#4A4A4A]/60">Botão de teste para acionar a impressão.</p>
        </div>
      </div>
      <ActionFooter onBack={onBack} showConfirm={false} />
    </PageContainer>
  );
}