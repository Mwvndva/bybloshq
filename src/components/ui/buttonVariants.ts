import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/70 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-yellow-400 text-black border border-yellow-400 hover:bg-yellow-300 shadow-sm",
        destructive:
          "bg-white text-red-700 border border-red-200 hover:bg-red-50 hover:border-red-300",
        outline:
          "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 hover:border-slate-300",
        secondary:
          "bg-slate-100 text-slate-900 border border-slate-100 hover:bg-slate-200",
        ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
        link: "text-slate-950 underline-offset-4 hover:underline",
        byblos: "bg-yellow-400 text-black hover:bg-yellow-300 border border-yellow-400 shadow-sm",
        "secondary-byblos": "border border-slate-200 bg-white text-slate-900 hover:bg-yellow-50 hover:border-yellow-200",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-xl px-3",
        lg: "h-12 rounded-2xl px-8",
        icon: "h-10 w-10 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);


