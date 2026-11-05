"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import type * as React from "react";

import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

/** Arrow keys move between tabs and Home/End jump (built into Radix). */
function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn("flex border-b border-border-subtle", className)}
      {...props}
    />
  );
}

/** Active tab: primary text colour plus a 2px accent underline (not colour alone). */
function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "relative inline-flex min-h-11 items-center justify-center px-4 text-base font-medium whitespace-nowrap text-text-secondary transition-colors duration-(--duration-fast) ease-standard after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-transparent hover:text-text disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-text data-[state=active]:after:bg-accent",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn("pt-4", className)} {...props} />;
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
