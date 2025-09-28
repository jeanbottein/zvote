import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastData {
  message: string;
  type: ToastType;
  durationMs?: number; // default 3000 for success/info, 5000 for error
}

interface ToastContextValue {
  showToast: (data: ToastData) => void;
  hideToast: () => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }>
  = ({ children }) => {
  const [toast, setToast] = useState<ToastData | null>(null);

  const hideToast = useCallback(() => setToast(null), []);

  const showToast = useCallback((data: ToastData) => {
    setToast(data);
    const isError = data.type === 'error';
    const duration = data.durationMs ?? (isError ? 5000 : 3000);
    window.setTimeout(() => setToast(null), duration);
  }, []);

  const value = useMemo(() => ({ showToast, hideToast }), [showToast, hideToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && (
        <div id="toast" className="toast" data-type={toast.type}>
          <span>{toast.message}</span>
          <button id="toast-close" className="toast-close" onClick={hideToast} title="Close">
            ×
          </button>
        </div>
      )}
    </ToastContext.Provider>
  );
};
