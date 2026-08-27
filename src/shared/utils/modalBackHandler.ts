import { useEffect } from 'react';
import { App } from '@capacitor/app';
import { isNativeApp } from '@/infrastructure/navigation/mobileApp';

type ModalDismissCallback = () => boolean | void;

const modalDismissStack: ModalDismissCallback[] = [];

/**
 * Register a custom modal/sheet/drawer/viewer dismiss handler.
 * Returns an unregister function.
 */
export function registerModalDismiss(handler: ModalDismissCallback): () => void {
  modalDismissStack.push(handler);
  return () => {
    const index = modalDismissStack.indexOf(handler);
    if (index > -1) {
      modalDismissStack.splice(index, 1);
    }
  };
}

/**
 * Attempts to dismiss the topmost open modal, sheet, or overlay.
 * Returns true if an overlay was dismissed, false otherwise.
 */
export function dismissTopmostOverlay(): boolean {
  // 1. Try explicit registered dismiss handlers (LIFO)
  if (modalDismissStack.length > 0) {
    const handler = modalDismissStack.pop();
    if (handler) {
      const result = handler();
      if (result !== false) {
        return true;
      }
    }
  }

  // 2. Try closing any open Radix UI Dialog / Popover / Sheet in DOM
  const openDialog = document.querySelector('[role="dialog"][data-state="open"]');
  if (openDialog) {
    // Send Escape key event to trigger Radix dismiss
    const escapeEvent = new KeyboardEvent('keydown', {
      key: 'Escape',
      code: 'Escape',
      keyCode: 27,
      which: 27,
      bubbles: true,
      cancelable: true
    });
    document.dispatchEvent(escapeEvent);
    return true;
  }

  return false;
}

let isInitialized = false;

/**
 * Global Android Back Button initialization hook.
 * Intercepts physical/gesture back button on Capacitor Android.
 */
export function useAndroidBackHandler() {
  useEffect(() => {
    if (!isNativeApp() || isInitialized) return;

    isInitialized = true;
    const backListener = App.addListener('backButton', ({ canGoBack }) => {
      // If an overlay is open, dismiss it and STOP navigation.
      const handled = dismissTopmostOverlay();
      if (handled) {
        return;
      }

      // No overlay open -> standard navigation
      if (canGoBack) {
        window.history.back();
      } else {
        App.exitApp();
      }
    });

    return () => {
      backListener.then(l => l.remove()).catch(() => {});
      isInitialized = false;
    };
  }, []);
}
