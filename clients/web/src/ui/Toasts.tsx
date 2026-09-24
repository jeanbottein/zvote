import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { CloseIcon } from './icons';

type ToastKind = 'info' | 'error';

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

type ShowToast = (message: string, kind?: ToastKind) => void;

const ToastContext = createContext<ShowToast | null>(null);

/** Short messages that come and go on their own; errors stay a little longer. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const lastId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((all) => all.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback<ShowToast>((message, kind = 'info') => {
    const id = ++lastId.current;
    setToasts((all) => [...all.slice(-2), { id, kind, message }]);
    window.setTimeout(() => dismiss(id), kind === 'error' ? 6000 : 3500);
  }, [dismiss]);

  return (
    <ToastContext value={show}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className="toast" data-kind={toast.kind} role={toast.kind === 'error' ? 'alert' : 'status'}>
            <span>{toast.message}</span>
            <button type="button" className="icon-button" aria-label="Dismiss" onClick={() => dismiss(toast.id)}>
              <CloseIcon />
            </button>
          </div>
        ))}
      </div>
    </ToastContext>
  );
}

export function useToast(): ShowToast {
  const show = useContext(ToastContext);
  if (!show) {
    throw new Error('useToast() must be used inside <ToastProvider>');
  }
  return show;
}
