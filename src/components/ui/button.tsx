import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Sizes never go below the 44px hit target (CLAUDE.md §9).
 * primary = accent fill, secondary = hairline outline, tertiary = text with
 * an accent underline (docs/DESIGN.md §7).
 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-sm font-medium whitespace-nowrap transition-colors duration-(--duration-fast) ease-standard disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-accent text-on-accent hover:bg-accent-hover",
        secondary:
          "border border-border-strong bg-transparent text-text hover:bg-surface-3",
        tertiary:
          "text-accent underline decoration-accent underline-offset-4 hover:text-accent-hover hover:decoration-accent-hover",
      },
      size: {
        md: "min-h-11 px-5 text-base",
        lg: "min-h-12 px-6 text-lg",
        icon: "size-11",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /** Render the child element (e.g. a link) with the button styles. */
    asChild?: boolean;
  };

function Button({
  className,
  variant,
  size,
  asChild = false,
  type,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      // A bare <button> inside a form submits it; make that an explicit choice.
      type={asChild ? type : (type ?? "button")}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants };
