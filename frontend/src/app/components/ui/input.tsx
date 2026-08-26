import * as React from "react"

import { cn } from "@/app/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-[var(--vaultr-border)] h-10 w-full min-w-0 rounded-lg border bg-[var(--vaultr-surface-subtle)] px-3 py-1 text-base shadow-[inset_0_1px_1px_rgba(37,37,31,0.025)] transition-[background-color,border-color,color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "hover:border-[var(--vaultr-border-strong)] focus-visible:border-[rgba(92,77,58,0.58)] focus-visible:bg-[var(--vaultr-surface-raised)] focus-visible:ring-[rgba(92,77,58,0.1)] focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }
