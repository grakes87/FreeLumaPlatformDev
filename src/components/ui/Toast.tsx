'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useEffect,
} from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, XCircle, Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toast: {
    success: (message: string) => void;
    error: (message: string) => void;
    info: (message: string) => void;
    warning: (message: string) => void;
  };
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_DURATION = 4000;

const toastStyles: Record<ToastType, string> = {
  success: 'border-green-500 bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200 dark:border-green-700',
  error: 'border-red-500 bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200 dark:border-red-700',
  info: 'border-blue-500 bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-700',
  warning: 'border-yellow-500 bg-yellow-50 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200 dark:border-yellow-700',
};

const toastIcons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="h-5 w-5 shrink-0 text-green-500" />,
  error: <XCircle className="h-5 w-5 shrink-0 text-red-500" />,
  info: <Info className="h-5 w-5 shrink-0 text-blue-500" />,
  warning: <AlertTriangle className="h-5 w-5 shrink-0 text-yellow-500" />,
};

function ToastNotification({
  item,
  onRemove,
}: {
  item: ToastItem;
  onRemove: (id: string) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(item.id), TOAST_DURATION);
    return () => clearTimeout(timer);
  }, [item.id, onRemove]);

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl border px-4 py-3 shadow-lg transition-all',
        toastStyles[item.type]
      )}
      role="alert"
    >
      {toastIcons[item.type]}
      <p className="text-sm font-medium">{item.message}</p>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    setToasts((prev) => [...prev, { id, type, message }]);
  }, []);

  const toast = useMemo(() => ({
    success: (message: string) => addToast('success', message),
    error: (message: string) => addToast('error', message),
    info: (message: string) => addToast('info', message),
    warning: (message: string) => addToast('warning', message),
  }), [addToast]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {mounted &&
        createPortal(
          <div className="pointer-events-none fixed inset-0 z-[100] flex flex-col items-end justify-end gap-2 p-4 sm:justify-start sm:p-6">
            {toasts.map((item) => (
              <div key={item.id} className="pointer-events-auto w-full max-w-sm">
                <ToastNotification item={item} onRemove={removeToast} />
              </div>
            ))}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue['toast'] {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context.toast;
}
