import { cn } from "@/shared/utils/formatting"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-slate-200 dark:bg-[#232323]", className)}
      {...props}
    />
  )
}

export { Skeleton }


