import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive active:scale-[0.97]",
  {
    variants: {
      variant: {
        default:
          "relative bg-gradient-to-r from-[#a489dd] to-[#8f74d6] text-white shadow-sm hover:from-[#8f74d6] hover:to-[#7a63c4] focus-visible:ring-[#a489dd]/30",
        destructive:
          "bg-gradient-to-r from-rose-600 to-rose-500 text-white shadow-sm hover:from-rose-500 hover:to-rose-400 focus-visible:ring-rose-500/30",
        outline:
          "border border-gray-300/60 bg-white text-gray-700 shadow-sm hover:bg-gray-50 hover:border-gray-300 focus-visible:ring-[#a489dd]/25",
        secondary:
          "bg-gray-100 text-gray-800 shadow-sm hover:bg-gray-200 focus-visible:ring-gray-400/30",
        ghost:
          "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
  link: "text-[#6c56a3] hover:text-[#4f3d78] hover:underline underline-offset-4",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5 text-xs",
        lg: "h-11 rounded-md px-6 has-[>svg]:px-4 text-base",
        icon: "size-9",
      },
      rounded: {
        none: "rounded-none",
        sm: "rounded-md",
        full: "rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      rounded: "sm",
    },
  }
)

function Button({
  className,
  variant,
  size,
  rounded,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants>) {
  return (
    <button
      data-slot="button"
      className={cn(buttonVariants({ variant, size, rounded, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
