/// <reference types="astro/client" />

declare global {
  interface Window {
    toastManager: {
      success(message: string, duration?: number): string;
      error(message: string, duration?: number): string;
      warning(message: string, duration?: number): string;
      info(message: string, duration?: number): string;
      show(options: {
        message: string;
        type?: 'success' | 'error' | 'warning' | 'info';
        duration?: number;
        action?: {
          label: string;
          callback: () => void;
        };
      }): string;
      remove(id: string): void;
      confirm(options: {
        message: string;
        confirmText?: string;
        cancelText?: string;
        type?: 'success' | 'error' | 'warning' | 'info';
      }): Promise<boolean>;
      init(): void;
    };
    showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info', duration?: number) => string;
    showToastConfirm: (options: {
      message: string;
      confirmText?: string;
      cancelText?: string;
      type?: 'success' | 'error' | 'warning' | 'info';
    }) => Promise<boolean>;
  }
}

export {};

