'use client';

import { createContext, useCallback, useContext, useState, useRef } from 'react';

/* ── Types ── */
type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
  exiting?: boolean;
}

interface ToastCtx {
  toast: (message: string, type?: ToastType) => void;
}

const Ctx = createContext<ToastCtx>({ toast: () => {} });

export function useToast() { return useContext(Ctx); }

/* ── Provider ── */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++nextId.current;
    setToasts(prev => [...prev.slice(-4), { id, message, type }]);

    // Start exit animation after 2.5s
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    }, 2500);

    // Remove after animation
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 2800);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 300);
  }, []);

  return (
    <Ctx.Provider value={{ toast }}>
      {children}

      {/* Toast container */}
      {toasts.length > 0 && (
        <div style={{
          position: 'fixed',
          bottom: 'calc(70px + env(safe-area-inset-bottom, 0px))',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10000,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          pointerEvents: 'none',
          width: 'calc(100% - 32px)',
          maxWidth: 360,
        }}>
          {toasts.map(t => (
            <div
              key={t.id}
              onClick={() => dismiss(t.id)}
              style={{
                pointerEvents: 'all',
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                padding: '10px 16px',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
                animation: t.exiting ? 'toastOut 0.3s ease-in forwards' : 'toastIn 0.3s ease-out',
                ...toastStyle(t.type),
              }}
            >
              <span style={{ fontSize: 16, flexShrink: 0 }}>{toastIcon(t.type)}</span>
              <span style={{ flex: 1 }}>{t.message}</span>
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(16px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes toastOut {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to   { opacity: 0; transform: translateY(-8px) scale(0.95); }
        }
      `}</style>
    </Ctx.Provider>
  );
}

function toastStyle(type: ToastType): React.CSSProperties {
  switch (type) {
    case 'success': return { background: 'rgba(0,200,81,0.15)', border: '1px solid rgba(0,200,81,0.4)', color: '#a0ffbf' };
    case 'error':   return { background: 'rgba(255,50,50,0.15)', border: '1px solid rgba(255,50,50,0.4)', color: '#ffa0a0' };
    case 'info':    return { background: 'rgba(255,106,0,0.15)', border: '1px solid rgba(255,106,0,0.4)', color: 'var(--bone)' };
  }
}

function toastIcon(type: ToastType): string {
  switch (type) {
    case 'success': return '✓';
    case 'error':   return '✕';
    case 'info':    return 'ℹ';
  }
}
