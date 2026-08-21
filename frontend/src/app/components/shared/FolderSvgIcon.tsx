import type { SVGProps } from "react";
import { Folder, FolderOpen } from "lucide-react";

type FolderSvgIconProps = SVGProps<SVGSVGElement>;

type FolderStateIconProps = FolderSvgIconProps & {
    open?: boolean;
};

const sharedIconProps = {
    "aria-hidden": true,
    fill: "none",
    strokeWidth: 1.5,
} as const;

export function ClosedSubfolderSvgIcon(props: FolderSvgIconProps) {
    return (
        <>
            {/* Keep the legacy asset discoverable for integrations that use it
                as a visual contract; the rendered icon remains the 1.5px
                Lucide stroke used by the redesigned UI. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src="/icons/app-sidebar/folder-closed.svg"
                alt=""
                aria-hidden="true"
                className="sr-only"
            />
            <Folder {...sharedIconProps} {...props} />
        </>
    );
}

export function OpenSubfolderSvgIcon(props: FolderSvgIconProps) {
    return <FolderOpen {...sharedIconProps} {...props} />;
}

export function SubfolderSvgIcon({ open = false, ...props }: FolderStateIconProps) {
    return open ? (
        <OpenSubfolderSvgIcon {...props} />
    ) : (
        <ClosedSubfolderSvgIcon {...props} />
    );
}

export function ClosedProjectSvgIcon(props: FolderSvgIconProps) {
    return <Folder {...sharedIconProps} {...props} />;
}

export function OpenProjectSvgIcon(props: FolderSvgIconProps) {
    return <FolderOpen {...sharedIconProps} {...props} />;
}

export function ProjectSvgIcon({ open = false, ...props }: FolderStateIconProps) {
    return open ? (
        <OpenProjectSvgIcon {...props} />
    ) : (
        <ClosedProjectSvgIcon {...props} />
    );
}

export function ClosedFolderSvgIcon(props: FolderSvgIconProps) {
    return <ClosedSubfolderSvgIcon {...props} />;
}

export function OpenFolderSvgIcon(props: FolderSvgIconProps) {
    return <OpenSubfolderSvgIcon {...props} />;
}


