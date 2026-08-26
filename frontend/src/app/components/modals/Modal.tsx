"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { PillButton } from "@/app/components/ui/pill-button";
import { cn } from "@/app/lib/utils";
import { MovingIcon } from "@/app/components/ui/moving-icon";

type ModalSize = "sm" | "md" | "lg" | "xl";
type ModalAction = Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    "className"
> & {
    label: ReactNode;
    icon?: ReactNode;
    variant?: "primary" | "secondary" | "danger";
};

interface ModalProps {
    open: boolean;
    onClose: () => void;
    children: ReactNode;
    breadcrumbs?: ReactNode[];
    headerAction?: ReactNode;
    size?: ModalSize;
    className?: string;
    footerStatus?: ReactNode;
    primaryAction?: ModalAction;
    secondaryAction?: ModalAction;
    cancelAction?: ModalAction | false;
    /**
     * Keep the modal (and its children's state) mounted while closed,
     * rendering it hidden instead of unmounting. Lets content like loaded
     * directory listings survive close/reopen cycles.
     */
    keepMounted?: boolean;
}

const sizeClassName: Record<ModalSize, string> = {
    sm: "max-w-md",
    md: "max-w-xl",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
};

export function Modal({
    open,
    onClose,
    children,
    breadcrumbs,
    headerAction,
    size = "lg",
    className,
    footerStatus,
    primaryAction,
    secondaryAction,
    cancelAction,
    keepMounted = false,
}: ModalProps) {
    // Portals can't render during SSR, so a keep-mounted modal only renders
    // (hidden) after the first client mount.
    const [hasMounted, setHasMounted] = useState(false);
    const dialogRef = useRef<HTMLDivElement>(null);
    const restoreFocusRef = useRef<HTMLElement | null>(null);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR portal gate: must flip after first client mount
    useEffect(() => setHasMounted(true), []);
    const hasHeader = breadcrumbs?.length;
    const hasFooter =
        footerStatus ||
        primaryAction ||
        secondaryAction ||
        cancelAction;
    const resolvedCancelAction = cancelAction;
    const dialogLabel =
        typeof breadcrumbs?.[breadcrumbs.length - 1] === "string"
            ? (breadcrumbs[breadcrumbs.length - 1] as string)
            : "Dialog";

    useEffect(() => {
        if (!open) return;
        restoreFocusRef.current =
            document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const frame = window.requestAnimationFrame(() => {
            const focusTarget =
                dialogRef.current?.querySelector<HTMLElement>(
                    "input, textarea, select",
                ) ??
                dialogRef.current?.querySelector<HTMLElement>(
                    'button, [href], [tabindex]:not([tabindex="-1"])',
                );
            focusTarget?.focus();
        });
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault();
                onClose();
                return;
            }
            if (event.key !== "Tab" || !dialogRef.current) return;
            const focusable = Array.from(
                dialogRef.current.querySelectorAll<HTMLElement>(
                    'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
                ),
            ).filter((element) => !element.hasAttribute("hidden"));
            if (focusable.length === 0) {
                event.preventDefault();
                dialogRef.current.focus();
                return;
            }
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            window.cancelAnimationFrame(frame);
            document.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = previousOverflow;
            restoreFocusRef.current?.focus();
        };
    }, [open, onClose]);

    if (!open && (!keepMounted || !hasMounted)) return null;

    return createPortal(
        <div
            className={cn(
                "vaultr-modal-backdrop fixed inset-0 z-[200] flex items-center justify-center px-4",
                "bg-white/10 backdrop-blur-[2px]",
                !open && "hidden",
            )}
            onClick={onClose}
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-label={dialogLabel}
                tabIndex={-1}
                className={cn(
                    "vaultr-modal-surface flex h-[min(600px,calc(100dvh-2rem))] w-full flex-col rounded-2xl",
                    sizeClassName[size],
                    "border border-[var(--vaultr-border)] bg-[var(--vaultr-surface-raised)] shadow-[0_20px_56px_rgba(37,37,31,0.18),0_2px_8px_rgba(37,37,31,0.08)]",
                    className,
                )}
                onClick={(e) => e.stopPropagation()}
            >
                {hasHeader && (
                    <div className="flex items-center justify-between gap-3 p-4 pl-5">
                        <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                            <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs leading-none text-gray-400">
                                {breadcrumbs?.map((segment, index) => (
                                    <span
                                        key={index}
                                        className="flex items-center gap-1.5"
                                    >
                                        {index > 0 && <span>›</span>}
                                        <span
                                            className={cn(
                                                "truncate",
                                                index ===
                                                    (breadcrumbs?.length ?? 0) -
                                                        1 && "text-gray-700",
                                            )}
                                        >
                                            {segment}
                                        </span>
                                    </span>
                                ))}
                            </div>
                            {headerAction}
                        </div>
                        <button
                            onClick={onClose}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--vaultr-border)] bg-[var(--vaultr-surface-subtle)] text-[var(--vaultr-secondary)] transition-colors hover:bg-[var(--app-surface-hover)] hover:text-[var(--vaultr-primary)]"
                            aria-label="Close"
                        >
                            <MovingIcon name="x" className="h-3.5 w-3.5" />
                        </button>
                    </div>
                )}
                {/* Body never scrolls itself (so children's edge shadows are
                    never clipped by the header/footer). Content that can exceed
                    the modal height wraps its scrollable region in an inner
                    `overflow-y-auto` div. */}
                <div className="flex min-h-0 flex-1 flex-col px-5">
                    {children}
                </div>
                {hasFooter && (
                    <div
                        className={cn(
                            "flex items-center gap-3 p-3",
                            secondaryAction
                                ? "justify-between"
                                : "justify-end",
                            "border-t border-[var(--vaultr-border)]",
                        )}
                    >
                        {secondaryAction && (
                            <div className="flex min-w-0 items-center gap-2">
                                <ModalActionButton
                                    action={secondaryAction}
                                    fallbackVariant="secondary"
                                />
                            </div>
                        )}
                        <div className="flex items-center gap-2">
                            {footerStatus}
                            {resolvedCancelAction && (
                                <ModalActionButton
                                    action={resolvedCancelAction}
                                    fallbackVariant="cancel"
                                />
                            )}
                            {primaryAction && (
                                <ModalActionButton
                                    action={primaryAction}
                                    fallbackVariant="primary"
                                />
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>,
        document.body,
    );
}

function ModalActionButton({
    action,
    fallbackVariant,
}: {
    action: ModalAction;
    fallbackVariant: "primary" | "secondary" | "danger" | "cancel";
}) {
    const {
        label,
        icon,
        variant = fallbackVariant === "cancel" ? "secondary" : fallbackVariant,
        ...props
    } = action;

    if (fallbackVariant === "cancel") {
        return (
            <button
                type="button"
                className="px-2 py-1.5 text-sm text-gray-500 transition-colors hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
                {...props}
            >
                {label}
            </button>
        );
    }

    const tone =
        variant === "danger"
            ? "danger"
        : fallbackVariant === "secondary" && variant === "secondary"
              ? "white"
              : variant === "primary"
                ? "black"
                : "white";

    return (
        <PillButton tone={tone} size="normal" {...props}>
            {icon}
            {label}
        </PillButton>
    );
}
