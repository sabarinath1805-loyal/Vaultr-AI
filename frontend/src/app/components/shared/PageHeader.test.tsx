import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageHeader } from "./PageHeader";

describe("PageHeader", () => {
    it("exposes the current breadcrumb as the page heading", () => {
        render(
            <PageHeader
                breadcrumbs={[
                    { label: "Library", onClick: () => undefined },
                    { label: "Files" },
                ]}
            />,
        );

        expect(
            screen.getByRole("heading", { level: 1, name: "Files" }),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole("heading", { level: 1, name: "Library" }),
        ).not.toBeInTheDocument();
    });
});
