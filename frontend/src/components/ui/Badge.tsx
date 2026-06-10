import React from "react";
import { cn } from "../../utils/cn";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "success" | "warning" | "danger" | "outline";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500",
        {
          "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100": variant === "default",
          "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100": variant === "success",
          "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100": variant === "warning",
          "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100": variant === "danger",
          "text-slate-950 border border-slate-200 dark:border-slate-800 dark:text-slate-50": variant === "outline",
        },
        className
      )}
      {...props}
    />
  );
}
