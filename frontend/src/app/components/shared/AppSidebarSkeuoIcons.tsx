import type { SVGProps } from "react";
import {
    Folder,
    Library,
    MessageSquare,
    TableProperties,
    Waypoints,
} from "lucide-react";

type IconProps = SVGProps<SVGSVGElement>;

const sharedIconProps = {
    "aria-hidden": true,
    fill: "none",
    strokeWidth: 1.5,
} as const;

export function ChatSkeuoIcon(props: IconProps) {
    return <MessageSquare {...sharedIconProps} {...props} />;
}

export function FolderSkeuoIcon(props: IconProps) {
    return <Folder {...sharedIconProps} {...props} />;
}

export function LibrarySkeuoIcon(props: IconProps) {
    return <Library {...sharedIconProps} {...props} />;
}

export function TabularReviewSkeuoIcon(props: IconProps) {
    return <TableProperties {...sharedIconProps} {...props} />;
}

export function WorkflowSkeuoIcon(props: IconProps) {
    return <Waypoints {...sharedIconProps} {...props} />;
}


