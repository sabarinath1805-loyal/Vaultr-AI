"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/app/lib/utils";

type ModalTextInputVariant = "glass" | "minimal";

type ModalTextInputProps = InputHTMLAttributes<HTMLInputElement> & {
    variant?: ModalTextInputVariant;
};

const variantClasses: Record<ModalTextInputVariant, string> = {
    glass: "h-10 w-full rounded-lg border border-[var(--vaultr-border)] bg-[var(--vaultr-surface-subtle)] px-3 text-sm text-[var(--vaultr-primary)] shadow-[inset_0_1px_1px_rgba(37,37,31,0.025)] outline-none placeholder:text-[var(--vaultr-muted)] transition-[background-color,border-color,box-shadow] hover:border-[var(--vaultr-border-strong)] focus:border-[rgba(92,77,58,0.58)] focus:bg-[var(--vaultr-surface-raised)] focus:shadow-[0_0_0_3px_rgba(92,77,58,0.1)] disabled:cursor-not-allowed disabled:opacity-60",
    minimal:
        "w-full bg-transparent font-serif text-2xl text-gray-800 outline-none placeholder:text-gray-300 disabled:cursor-not-allowed disabled:text-gray-400",
};

export const ModalTextInput = forwardRef<HTMLInputElement, ModalTextInputProps>(
    ({ className, variant = "glass", ...props }, ref) => (
        <input
            ref={ref}
            className={cn(variantClasses[variant], className)}
            {...props}
        />
    ),
);

ModalTextInput.displayName = "ModalTextInput";
