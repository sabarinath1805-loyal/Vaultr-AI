import type { SVGProps } from "react";
import { cn } from "@/app/lib/utils";

export type MovingIconName =
    | "arrow-up"
    | "audio-lines"
    | "check"
    | "chevron-down"
    | "copy"
    | "download"
    | "ellipsis"
    | "eye"
    | "eye-off"
    | "folder"
    | "library"
    | "log-out"
    | "message-square"
    | "paperclip"
    | "panel-left"
    | "plus"
    | "refresh-cw"
    | "search"
    | "send"
    | "settings"
    | "square"
    | "table"
    | "trash-2"
    | "upload"
    | "user"
    | "workflow"
    | "x";

export type MovingIconProps = Omit<
    SVGProps<SVGSVGElement>,
    "name" | "color"
> & {
    name: MovingIconName;
    size?: number | string;
    color?: string;
    animate?: boolean;
};

/**
 * React-safe port of the interaction patterns shipped by @jis3r/icons.
 *
 * @jis3r/icons publishes Svelte components, while this application is
 * Next/React. Keeping the paths and motion rules in one local component lets
 * the app use the same moving-icon language without introducing a Svelte
 * runtime or trying to make Next parse .svelte files.
 */
export function MovingIcon({
    name,
    size = 18,
    color,
    strokeWidth = 1.75,
    animate = false,
    className,
    ...props
}: MovingIconProps) {
    const classNames = cn(
        "vaultr-moving-icon",
        `vaultr-moving-icon-${name}`,
        animate && "is-animated",
        className,
    );
    const ariaHidden = props["aria-label"]
        ? props["aria-hidden"]
        : (props["aria-hidden"] ?? true);

    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke={color ?? "currentColor"}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={classNames}
            aria-hidden={ariaHidden}
        >
            {renderMovingIcon(name)}
        </svg>
    );
}

function renderMovingIcon(name: MovingIconName) {
    switch (name) {
        case "arrow-up":
            return (
                <>
                    <path d="m5 12 7-7 7 7" className="moving-arrow-head" />
                    <path d="M12 10V5" className="moving-arrow-head" />
                    <path d="M12 19V10" />
                </>
            );
        case "audio-lines":
            return (
                <>
                    <path d="M2 10v4" className="moving-audio-line moving-audio-line-one" />
                    <path d="M6 7v10" className="moving-audio-line moving-audio-line-two" />
                    <path d="M10 4v16" className="moving-audio-line moving-audio-line-three" />
                    <path d="M14 7v10" className="moving-audio-line moving-audio-line-two" />
                    <path d="M18 10v4" className="moving-audio-line moving-audio-line-one" />
                    <path d="M22 9v6" className="moving-audio-line moving-audio-line-one" />
                </>
            );
        case "check":
            return <path d="M4 12l5 5L20 6" className="moving-check-path" />;
        case "chevron-down":
            return <path d="m6 9 6 6 6-6" className="moving-chevron-path" />;
        case "copy":
            return (
                <>
                    <rect
                        width="14"
                        height="14"
                        x="8"
                        y="8"
                        rx="2"
                        ry="2"
                        className="moving-copy-rect"
                    />
                    <path
                        d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"
                        className="moving-copy-path"
                    />
                </>
            );
        case "download":
            return (
                <>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <g className="moving-download-group">
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" x2="12" y1="15" y2="3" />
                    </g>
                </>
            );
        case "ellipsis":
            return (
                <g className="moving-ellipsis-group">
                    <circle cx="5" cy="12" r="1" />
                    <circle cx="12" cy="12" r="1" />
                    <circle cx="19" cy="12" r="1" />
                </g>
            );
        case "eye":
            return (
                <g className="moving-eye-group">
                    <path d="M2.06 12.35a1 1 0 0 1 0-.7C3.73 7.6 7.52 5 12 5c4.48 0 8.27 2.6 9.94 6.65a1 1 0 0 1 0 .7C20.27 16.4 16.48 19 12 19c-4.48 0-8.27-2.6-9.94-6.65Z" />
                    <circle cx="12" cy="12" r="3" className="moving-eye-pupil" />
                </g>
            );
        case "eye-off":
            return (
                <g className="moving-eye-group">
                    <path d="m2 2 20 20" className="moving-eye-slash" />
                    <path d="M6.71 6.71C4.61 7.88 3 9.61 2.06 11.65a1 1 0 0 0 0 .7C3.73 16.4 7.52 19 12 19a10.6 10.6 0 0 0 5.29-1.42" />
                    <path d="M10.73 5.08A10.8 10.8 0 0 1 12 5c4.48 0 8.27 2.6 9.94 6.65a1 1 0 0 1 0 .7 11.1 11.1 0 0 1-1.09 2" />
                </g>
            );
        case "folder":
            return (
                <>
                    <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.6-.8L9.6 4.8A2 2 0 0 0 8 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z" />
                    <path d="M2 10h20" className="moving-folder-line" />
                </>
            );
        case "library":
            return (
                <>
                    <path d="m16 6 4 14" />
                    <path d="M12 6v14" />
                    <path d="M8 8v12" />
                    <path d="M4 4v16" />
                    <path d="M20 4v16" />
                </>
            );
        case "log-out":
            return (
                <>
                    <path d="M10 17l5-5-5-5" className="moving-log-out-arrow" />
                    <path d="M15 12H3" className="moving-log-out-arrow" />
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                </>
            );
        case "message-square":
            return (
                <path
                    d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                    className="moving-message-square-path"
                />
            );
        case "paperclip":
            return (
                <path
                    d="m16 6-8.414 8.586a2 2 0 0 0 2.829 2.829l8.414-8.586a4 4 0 1 0-5.657-5.657l-8.379 8.551a6 6 0 1 0 8.485 8.485l8.379-8.551"
                    className="moving-paperclip-path"
                />
            );
        case "panel-left":
            return (
                <>
                    <rect width="18" height="18" x="3" y="3" rx="2" />
                    <path d="M9 3v18" className="moving-panel-left-line" />
                </>
            );
        case "plus":
            return (
                <>
                    <path d="M5 12h14" className="moving-plus-horizontal" />
                    <path d="M12 5v14" className="moving-plus-vertical" />
                </>
            );
        case "refresh-cw":
            return (
                <g className="moving-refresh-group">
                    <path d="M20 7h-5V2" />
                    <path d="M20 7a9 9 0 1 0 2 5" />
                </g>
            );
        case "search":
            return (
                <>
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.3-4.3" />
                </>
            );
        case "send":
            return (
                <g className="moving-send-group">
                    <path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" />
                    <path d="m21.854 2.147-10.94 10.939" />
                </g>
            );
        case "settings":
            return (
                <g className="moving-settings-gear">
                    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                    <circle cx="12" cy="12" r="3" />
                </g>
            );
        case "square":
            return <rect width="18" height="18" x="3" y="3" rx="2" fill="currentColor" stroke="none" />;
        case "table":
            return (
                <>
                    <rect width="18" height="18" x="3" y="3" rx="2" />
                    <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
                </>
            );
        case "trash-2":
            return (
                <>
                    <g className="moving-trash-top">
                        <path d="M3 6h18" />
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </g>
                    <path d="M19 8v12c0 1-1 2-2 2H7c-1 0-2-1-2-2V8" className="moving-trash-body" />
                    <line x1="10" x2="10" y1="12" y2="17" className="moving-trash-line" />
                    <line x1="14" x2="14" y1="12" y2="17" className="moving-trash-line" />
                </>
            );
        case "upload":
            return (
                <>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <g className="moving-upload-group">
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" x2="12" y1="3" y2="15" />
                    </g>
                </>
            );
        case "user":
            return (
                <g className="moving-user-icon">
                    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" className="moving-user-path" />
                    <circle cx="12" cy="7" r="4" className="moving-user-circle" />
                </g>
            );
        case "workflow":
            return (
                <>
                    <circle cx="6" cy="19" r="3" className="moving-workflow-start" />
                    <circle cx="18" cy="5" r="3" className="moving-workflow-end" />
                    <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" className="moving-workflow-line" />
                </>
            );
        case "x":
            return (
                <>
                    <path d="M18 6 6 18" className="moving-x-first" />
                    <path d="m6 6 12 12" className="moving-x-second" />
                </>
            );
    }
}
