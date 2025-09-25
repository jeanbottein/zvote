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
        <div 
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            background: toast.type === 'success' ? '#4ade80' : toast.type === 'error' ? '#ef4444' : '#2563eb',
            color: 'white',
            padding: '12px 16px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            zIndex: 1000,
            animation: 'slideInRight 0.3s ease-out',
            fontSize: '14px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            maxWidth: '400px'
          }}
        >
          <span>{toast.message}</span>
          <button
            onClick={hideToast}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'white',
              fontSize: '16px',
              cursor: 'pointer',
              padding: '2px',
              lineHeight: 1,
              opacity: 0.8
            }}
            title="Close"
          >
            ×
          </button>
        </div>
      )}
    </ToastContext.Provider>
  );
};
