"use client";

import * as React from "react";
import { cn } from "@/app/lib/utils";

type TabPillButtonProps = React.ComponentProps<"button"> & {
    active?: boolean;
};

export function TabPillButton({
    active,
    type = "button",
    className,
    ...props
}: TabPillButtonProps) {
    const stateClass =
        active === true
            ? "border-[var(--vaultr-border)] bg-[var(--vaultr-surface-raised)] text-[var(--vaultr-primary)] shadow-[0_1px_2px_rgba(37,37,31,0.06)]"
            : active === false
              ? "border-transparent bg-transparent text-[var(--vaultr-secondary)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--vaultr-primary)]"
              : "border-[var(--vaultr-border)] bg-[var(--vaultr-surface-subtle)] text-[var(--vaultr-secondary)] hover:bg-[var(--vaultr-surface-raised)] hover:text-[var(--vaultr-primary)]";

    return (
        <button
            type={type}
            aria-pressed={active}
            className={cn(
                "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100",
                stateClass,
                className,
            )}
            {...props}
        />
    );
}


