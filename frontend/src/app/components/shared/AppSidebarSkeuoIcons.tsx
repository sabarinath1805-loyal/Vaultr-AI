import type { SVGProps } from "react";
import { MovingIcon, type MovingIconName } from "@/app/components/ui/moving-icon";

type IconProps = SVGProps<SVGSVGElement>;

function SkeuoMovingIcon(name: MovingIconName, props: IconProps) {
    const { width, height, ...rest } = props;
    return (
        <MovingIcon
            {...rest}
            name={name}
            size={width ?? height ?? 16}
            aria-hidden={true}
        />
    );
}

export function ChatSkeuoIcon(props: IconProps) {
    return SkeuoMovingIcon("message-square", props);
}

export function FolderSkeuoIcon(props: IconProps) {
    return SkeuoMovingIcon("folder", props);
}

export function LibrarySkeuoIcon(props: IconProps) {
    return SkeuoMovingIcon("library", props);
}

export function TabularReviewSkeuoIcon(props: IconProps) {
    return SkeuoMovingIcon("table", props);
}

export function WorkflowSkeuoIcon(props: IconProps) {
    return SkeuoMovingIcon("workflow", props);
}
