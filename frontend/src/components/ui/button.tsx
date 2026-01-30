import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-300 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 text-white shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/40 hover:scale-[1.02] hover:from-blue-500 hover:via-purple-500 hover:to-blue-600",
        destructive:
          "bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg shadow-red-500/25 hover:shadow-xl hover:shadow-red-500/40 hover:scale-[1.02] focus-visible:ring-red-500/20 dark:bg-red-600/60",
        outline:
          "border border-white/20 bg-white/5 backdrop-blur-sm shadow-lg hover:bg-white/10 hover:border-white/30 hover:shadow-xl hover:scale-[1.02] dark:bg-black/5 dark:border-white/10 dark:hover:bg-white/5",
        secondary:
          "bg-gradient-to-r from-gray-100 to-gray-200 text-gray-900 shadow-lg hover:shadow-xl hover:scale-[1.02] hover:from-gray-50 hover:to-gray-100 dark:from-gray-800 dark:to-gray-700 dark:text-white",
        ghost:
          "hover:bg-white/10 hover:backdrop-blur-sm hover:scale-[1.02] dark:hover:bg-white/5",
        link: "text-primary underline-offset-4 hover:underline hover:text-primary/80",
        glass:
          "glass border-0 bg-white/10 hover:bg-white/20 hover:shadow-glow text-white backdrop-blur-xl",
        neon:
          "bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 text-white shadow-lg shadow-cyan-500/50 hover:shadow-xl hover:shadow-cyan-500/70 hover:scale-[1.02] animate-pulse",
        premium:
          "bg-gradient-to-r from-amber-400 via-yellow-500 to-orange-500 text-black shadow-lg shadow-yellow-500/30 hover:shadow-xl hover:shadow-yellow-500/50 hover:scale-[1.02] font-semibold",
      },
      size: {
        default: "h-11 px-6 py-3 has-[>svg]:px-4",
        sm: "h-9 rounded-lg gap-1.5 px-4 has-[>svg]:px-3 text-xs",
        lg: "h-13 rounded-xl px-8 has-[>svg]:px-5 text-base font-semibold",
        xl: "h-16 rounded-2xl px-10 has-[>svg]:px-6 text-lg font-semibold",
        icon: "size-11 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
