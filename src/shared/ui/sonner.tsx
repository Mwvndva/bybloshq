import { useAppTheme } from "@/shared/hooks/useAppTheme";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useAppTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-right"
      offset="calc(var(--sat, 0px) + 64px)"
      mobileOffset="calc(var(--sat, 0px) + 64px)"
      expand={false}
      richColors
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-white dark:group-[.toaster]:bg-[#0d0d0d] group-[.toaster]:text-slate-950 dark:group-[.toaster]:text-white group-[.toaster]:border-slate-200 dark:group-[.toaster]:border-white/10 group-[.toaster]:shadow-2xl w-full sm:w-[356px] max-w-full sm:max-w-[400px] border rounded-2xl transition-colors duration-200",
          description: "group-[.toast]:text-slate-600 dark:group-[.toast]:text-white/60 text-sm",
          actionButton:
            "group-[.toast]:bg-yellow-400 group-[.toast]:text-slate-950 font-bold",
          cancelButton:
            "group-[.toast]:bg-slate-100 dark:group-[.toast]:bg-white/10 group-[.toast]:text-slate-700 dark:group-[.toast]:text-white",
          title: "text-sm sm:text-base font-bold text-slate-950 dark:text-white",
          icon: "w-5 h-5 sm:w-6 sm:h-6"
        },
      }}
      {...props}
    />
  );
};

export { Toaster };


