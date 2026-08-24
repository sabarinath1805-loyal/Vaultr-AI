"use client";

import { MovingIcon } from "@/app/components/ui/moving-icon";

interface Props {
    onBrowseAll: () => void;
    selectedDocIds?: string[];
    hideLabel?: boolean;
}

export function AddDocButton({
    onBrowseAll,
    selectedDocIds = [],
    hideLabel = false,
}: Props) {
    return (
        <button
            type="button"
            onClick={onBrowseAll}
            className={`vaultr-composer-tool flex items-center gap-1 px-2 h-8 rounded-lg text-sm transition-colors cursor-pointer ${
                selectedDocIds.length > 0 ? "vaultr-composer-tool-selected" : ""
            } ${
                selectedDocIds.length > 0
                    ? "text-gray-700"
                    : "text-gray-400"
            }`}
            title="Add documents"
            aria-label="Add documents"
        >
            {selectedDocIds.length > 0 ? (
                <span className="font-medium tabular-nums">
                    {selectedDocIds.length}
                </span>
            ) : (
                <MovingIcon name="plus" size={16} />
            )}
            <span className={hideLabel ? "hidden" : "hidden sm:inline"}>
                {selectedDocIds.length === 1 ? "Document" : "Documents"}
            </span>
        </button>
    );
}

