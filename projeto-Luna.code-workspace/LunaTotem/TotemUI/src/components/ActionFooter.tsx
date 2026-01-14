import { Button } from './Button';

interface ActionFooterProps {
  onBack: () => void;
  onConfirm?: () => void;
  confirmLabel?: string;
  showConfirm?: boolean;
}

export function ActionFooter({ onBack, onConfirm, confirmLabel = 'Confirmar', showConfirm = true }: ActionFooterProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-10 bg-[#F8F6F1]/95 backdrop-blur-sm border-t border-[#E8E2DA]">
      <div className="mx-auto w-full max-w-2xl px-4 py-4 flex gap-4">
        <Button variant="ghost" size="lg" onClick={onBack} className="flex-1">
          ← Voltar
        </Button>
        {showConfirm && (
          <Button variant="primary" size="lg" onClick={onConfirm} className="flex-1">
            {confirmLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
