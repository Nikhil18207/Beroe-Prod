import * as React from "react"

import { cn } from "@/lib/utils"

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "bg-card text-card-foreground flex flex-col gap-6 rounded-2xl border border-white/10 py-6 shadow-lg backdrop-blur-sm hover:shadow-xl hover:shadow-black/5 hover:border-white/20 transition-all duration-300",
        className
      )}
      {...props}
    />
  )
}

// Enhanced modern card variants
function ModernCard({ variant = "default", className, ...props }: { variant?: "default" | "glass" | "neon" | "minimal" } & React.ComponentProps<"div">) {
  const variants = {
    default: "glass-card hover:shadow-glow hover:shadow-blue-500/10",
    glass: "glass-card border-white/20 hover:border-white/40 hover:shadow-glow",
    neon: "glass-card border-cyan-400/30 shadow-lg shadow-cyan-500/20 hover:shadow-glow hover:shadow-cyan-500/30",
    minimal: "bg-white/5 backdrop-blur-sm border-white/10 hover:bg-white/10 hover:border-white/20"
  }

  return (
    <Card
      className={cn(variants[variant], className)}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("leading-none font-semibold", className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-6", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center px-6 [.border-t]:pt-6", className)}
      {...props}
    />
  )
}

export {
  Card,
  ModernCard,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
