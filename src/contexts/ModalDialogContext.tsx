import React, { createContext, useContext, useState, useCallback } from 'react';
import { 
  AlertCircle, 
  CheckCircle, 
  HelpCircle, 
  Info, 
  X, 
  ShieldAlert 
} from 'lucide-react';

export type DialogType = 'confirm' | 'info' | 'success' | 'warning' | 'error';

interface DialogOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  type?: DialogType;
  destructive?: boolean;
}

interface ModalDialogContextType {
  confirm: (options: DialogOptions) => Promise<boolean>;
  alert: (message: string, options?: Omit<DialogOptions, 'message'>) => Promise<void>;
}

const ModalDialogContext = createContext<ModalDialogContextType | undefined>(undefined);

export const ModalDialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<DialogOptions>({ message: '' });
  const [resolver, setResolver] = useState<{ resolve: (val: boolean) => void } | null>(null);

  const confirm = useCallback((options: DialogOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfig({
        title: options.title || 'Confirm Action',
        message: options.message,
        confirmLabel: options.confirmLabel || 'Confirm',
        cancelLabel: options.cancelLabel || 'Cancel',
        type: options.type || 'confirm',
        destructive: options.destructive ?? false,
      });
      setResolver({ resolve });
      setIsOpen(true);
    });
  }, []);

  const showAlert = useCallback((message: string, options?: Omit<DialogOptions, 'message'>): Promise<void> => {
    return new Promise((resolve) => {
      setConfig({
        title: options?.title || 'Notice',
        message,
        confirmLabel: options?.confirmLabel || 'OK',
        cancelLabel: '', // No cancel for simple alert
        type: options?.type || 'info',
        destructive: false,
      });
      setResolver({
        resolve: () => resolve(),
      });
      setIsOpen(true);
    });
  }, []);

  const handleConfirm = () => {
    setIsOpen(false);
    if (resolver) resolver.resolve(true);
  };

  const handleCancel = () => {
    setIsOpen(false);
    if (resolver) resolver.resolve(false);
  };

  const renderIcon = () => {
    switch (config.type) {
      case 'warning':
      case 'confirm':
        return <ShieldAlert className="w-6 h-6 text-amber-500 shrink-0" />;
      case 'error':
        return <AlertCircle className="w-6 h-6 text-rose-500 shrink-0" />;
      case 'success':
        return <CheckCircle className="w-6 h-6 text-emerald-500 shrink-0" />;
      case 'info':
      default:
        return <Info className="w-6 h-6 text-blue-500 shrink-0" />;
    }
  };

  return (
    <ModalDialogContext.Provider value={{ confirm, alert: showAlert }}>
      {children}
      {isOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          {/* Backdrop blur */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
            onClick={config.cancelLabel ? handleCancel : handleConfirm}
          />
          {/* Modal Container */}
          <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-2xl shadow-2xl p-6 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header / Icon */}
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-2xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/50 dark:border-white/5">
                {renderIcon()}
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <h3 className="text-base font-semibold text-zinc-900 dark:text-white leading-6">
                  {config.title}
                </h3>
                <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed break-words whitespace-pre-line">
                  {config.message}
                </p>
              </div>
              <button 
                onClick={config.cancelLabel ? handleCancel : handleConfirm}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Actions */}
            <div className="mt-6 flex items-center justify-end gap-2.5">
              {config.cancelLabel && (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  {config.cancelLabel}
                </button>
              )}
              <button
                type="button"
                autoFocus
                onClick={handleConfirm}
                className={`px-5 py-2 text-xs font-bold text-white rounded-xl shadow-md transition-all ${
                  config.destructive
                    ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/20'
                    : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20'
                }`}
              >
                {config.confirmLabel || 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ModalDialogContext.Provider>
  );
};

export const useModalDialog = () => {
  const context = useContext(ModalDialogContext);
  if (!context) {
    throw new Error('useModalDialog must be used within a ModalDialogProvider');
  }
  return context;
};
