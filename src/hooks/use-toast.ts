import type { ReactNode } from "react";
import { toast as sonnerToast } from "sonner";

type ToastVariant = "default" | "destructive";

type ToastOptions = {
  id?: string;
  title?: ReactNode;
  description?: ReactNode;
  variant?: ToastVariant;
  duration?: number;
};

type ToastUpdateOptions = Omit<ToastOptions, "id">;

const getToastContent = ({ title, description }: ToastOptions) => {
  if (title && description) {
    return { message: title, options: { description } };
  }

  return {
    message: title || description || "",
    options: description ? { description } : undefined,
  };
};

function toast(props: ToastOptions) {
  const { id, variant, duration } = props;
  const { message, options } = getToastContent(props);
  const toastOptions = { ...options, id, duration };

  const toastId = variant === "destructive"
    ? sonnerToast.error(message, toastOptions)
    : sonnerToast(message, toastOptions);

  return {
    id: String(toastId),
    dismiss: () => sonnerToast.dismiss(toastId),
    update: (nextProps: ToastUpdateOptions) => {
      const next = getToastContent(nextProps);
      const nextOptions = {
        ...next.options,
        id: toastId,
        duration: nextProps.duration,
      };

      return nextProps.variant === "destructive"
        ? sonnerToast.error(next.message, nextOptions)
        : sonnerToast(next.message, nextOptions);
    },
  };
}

function useToast() {
  return {
    toasts: [],
    toast,
    dismiss: (toastId?: string) => sonnerToast.dismiss(toastId),
  };
}

export { useToast, toast };
