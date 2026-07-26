import React, { createContext, useContext, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  toasts: ToastItem[];
  addToast: (type: ToastType, message: string) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
    
    // Automatically clear toast
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={twMerge(
                "pointer-events-auto w-full glass border p-4 rounded-xl flex items-start gap-3 shadow-xl backdrop-blur-md",
                toast.type === 'success' && 'border-emerald-500/20 bg-emerald-500/5 text-emerald-800 dark:text-emerald-300',
                toast.type === 'error' && 'border-destructive/20 bg-destructive/5 text-destructive-foreground',
                toast.type === 'warning' && 'border-amber-500/20 bg-amber-500/5 text-amber-800 dark:text-amber-300',
                toast.type === 'info' && 'border-blue-500/20 bg-blue-500/5 text-blue-800 dark:text-blue-300'
              )}
            >
              {/* Toast Icon */}
              <div className="shrink-0 mt-0.5">
                {toast.type === 'success' && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
                {toast.type === 'error' && <XCircle className="h-5 w-5 text-destructive" />}
                {toast.type === 'warning' && <AlertTriangle className="h-5 w-5 text-amber-500" />}
                {toast.type === 'info' && <Info className="h-5 w-5 text-blue-500" />}
              </div>

              {/* Toast Message */}
              <div className="flex-1 text-sm font-medium leading-relaxed">
                {toast.message}
              </div>

              {/* Close Button */}
              <button
                onClick={() => removeToast(toast.id)}
                className="shrink-0 text-muted-foreground hover:text-foreground opacity-60 hover:opacity-100 transition-opacity p-0.5 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return {
    success: (msg: string) => context.addToast('success', msg),
    error: (msg: string) => context.addToast('error', msg),
    warning: (msg: string) => context.addToast('warning', msg),
    info: (msg: string) => context.addToast('info', msg),
    toasts: context.toasts,
    removeToast: context.removeToast,
  };
};
