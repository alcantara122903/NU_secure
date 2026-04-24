import {
  AlertModal,
  type AlertModalAction,
  type AlertModalProps,
  type AlertVariant,
} from '@/components/ui/alert-modal';
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type ShowAlertOptions = {
  variant: AlertVariant;
  title: string;
  message?: string;
  dismissOnBackdropPress?: boolean;
  confirmText?: string;
  onConfirm?: () => void;
  cancelText?: string;
  onCancel?: () => void;
  actions?: AlertModalAction[];
};

const AlertModalContext = createContext<{
  showAlert: (options: ShowAlertOptions) => void;
  hideAlert: () => void;
} | null>(null);

export function AlertModalProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ShowAlertOptions | null>(null);

  const hideAlert = useCallback(() => {
    setState(null);
  }, []);

  const showAlert = useCallback((options: ShowAlertOptions) => {
    setState(options);
  }, []);

  const value = useMemo(() => ({ showAlert, hideAlert }), [showAlert, hideAlert]);

  const modalProps: AlertModalProps = {
    visible: !!state,
    variant: state?.variant ?? 'success',
    title: state?.title ?? '',
    message: state?.message,
    dismissOnBackdropPress: state?.dismissOnBackdropPress,
    confirmText: state?.confirmText,
    onConfirm: state?.onConfirm,
    cancelText: state?.cancelText,
    onCancel: state?.onCancel,
    actions: state?.actions,
    onRequestClose: hideAlert,
  };

  return (
    <AlertModalContext.Provider value={value}>
      {children}
      <AlertModal {...modalProps} />
    </AlertModalContext.Provider>
  );
}

export function useAlertModal() {
  const ctx = useContext(AlertModalContext);
  if (!ctx) {
    throw new Error('useAlertModal must be used within AlertModalProvider');
  }
  return ctx;
}
