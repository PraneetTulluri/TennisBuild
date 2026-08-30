"use client";

import * as React from "react";
import { cva } from "class-variance-authority";

import { LiquidButton as LiquidButtonPrimitive } from "@/components/animate-ui/primitives/buttons/liquid";
import { cn } from "@/lib/utils";

// Ported from animate-ui's registry (registry/components/buttons/liquid) -
// same variant/size shape as shadcn's own Button, but the `default`
// variant's colors are pointed at our own tokens (--primary = the
// tennis-ball chartreuse, --accent = the dark panel color) via the
// @theme mapping in index.css, so the liquid fill is court-green-palette
// colored instead of shadcn's generic default theme.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold uppercase tracking-wide transition-[box-shadow,_color,_background-color,_border-color] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px]",
  {
    variants: {
      variant: {
        // Always ball-green at rest (matches .spin-button's existing
        // always-prominent look) - the "liquid" fill sweeps in as a
        // paper-white shine on hover instead of a resting-state color
        // inversion, since a primary CTA looking understated until
        // hovered is a real cost on touch devices that never hover at
        // all before tapping.
        tennis:
          "[--liquid-button-background-color:var(--primary)] [--liquid-button-color:var(--foreground)] text-primary-foreground shadow-xs",
        default:
          "[--liquid-button-background-color:var(--accent)] [--liquid-button-color:var(--primary)] text-primary hover:text-primary-foreground shadow-xs",
        secondary:
          "[--liquid-button-background-color:var(--accent)] [--liquid-button-color:var(--secondary)] text-secondary hover:text-secondary-foreground shadow-xs",
        ghost:
          "[--liquid-button-background-color:transparent] [--liquid-button-color:var(--primary)] text-primary hover:text-primary-foreground",
      },
      size: {
        default: "h-11 px-8 has-[>svg]:px-6",
        sm: "h-9 px-5 has-[>svg]:px-4",
        lg: "h-14 px-10 text-base has-[>svg]:px-8",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function LiquidButton({ className, variant, size, ...props }) {
  return (
    <LiquidButtonPrimitive
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { LiquidButton, buttonVariants };
