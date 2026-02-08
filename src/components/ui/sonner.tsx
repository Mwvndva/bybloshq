import { useTheme } from "next-themes"
import { Toaster as Sonner, toast } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-right"
      expand={false}
      richColors
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-black group-[.toaster]:text-white group-[.toaster]:border-white/20 group-[.toaster]:shadow-2xl sm:min-w-[356px] min-w-[90vw] sm:max-w-[420px] max-w-[95vw] border-2",
          description: "group-[.toast]:text-gray-400 text-sm",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          title: "text-sm sm:text-base font-bold",
          icon: "w-5 h-5 sm:w-6 sm:h-6"
        },
      }}
      {...props}
    />
  )
}

export { Toaster, toast }
