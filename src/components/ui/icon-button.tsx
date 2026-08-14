import * as React from "react"
import { cn } from "@/lib/utils"
import { Button, type ButtonProps } from "./button"

export interface IconButtonProps extends Omit<ButtonProps, 'aria-label'> {
  'aria-label': string; // TypeScript-enforced required accessibility label
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, size = "icon", variant = "ghost", 'aria-label': ariaLabel, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        variant={variant}
        size={size}
        aria-label={ariaLabel}
        className={cn("h-11 w-11 shrink-0", className)}
        {...props}
      />
    )
  }
)
IconButton.displayName = "IconButton"

export { IconButton }
