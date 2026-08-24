import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
    TableBody,
    TableCell,
    TableControlRow,
    TableHeaderCell,
    TableHeaderRow,
    TablePrimaryCell,
    TableRow,
    TableScrollArea,
} from "./TablePrimitive";

describe("Table semantics", () => {
    it("exposes loading state and the expected table structure", () => {
        render(
            <TableScrollArea
                aria-label="Matters"
                aria-busy="true"
                header={
                    <TableHeaderRow>
                        <TableHeaderCell>Name</TableHeaderCell>
                    </TableHeaderRow>
                }
            >
                <TableBody>
                    <TableRow interactive={false}>
                        <TablePrimaryCell
                            selected={false}
                            onSelectionChange={vi.fn()}
                            label="Matter Alpha"
                        />
                        <TableCell>Owner</TableCell>
                        <div role="cell">
                            <button type="button" aria-label="Matter actions" />
                        </div>
                    </TableRow>
                </TableBody>
                <TableControlRow className="flex justify-center py-3">
                    <button type="button">Load more</button>
                </TableControlRow>
            </TableScrollArea>,
        );

        const table = screen.getByRole("table", { name: "Matters" });
        expect(table).toHaveAttribute("aria-busy", "true");
        expect(screen.getByRole("columnheader", { name: "Name" })).toBeVisible();
        expect(screen.getAllByRole("rowgroup")).toHaveLength(2);
        expect(
            screen.getByRole("checkbox", { name: "Select Matter Alpha" }),
        ).toBeVisible();
        expect(screen.getByRole("cell", { name: /Matter Alpha/ })).toBeVisible();
        expect(screen.getAllByRole("cell")).toHaveLength(4);
        expect(
            screen.getByRole("button", { name: "Matter actions" }),
        ).toBeVisible();
        expect(screen.getByRole("button", { name: "Load more" })).toBeVisible();
        expect(screen.getByRole("cell", { name: "Load more" })).toBeVisible();
    });
});

describe("TableRow", () => {
    it("supports keyboard activation without stealing child control keys", async () => {
        const user = userEvent.setup();
        const onClick = vi.fn();
        const onCheckboxChange = vi.fn();

        render(
            <TableRow onClick={onClick}>
                <span>Matter Alpha</span>
                <input
                    type="checkbox"
                    aria-label="Select Matter Alpha"
                    onChange={onCheckboxChange}
                />
            </TableRow>,
        );

        const row = screen.getByRole("row", { name: /Matter Alpha/ });
        expect(row).toHaveAttribute("tabindex", "0");

        row.focus();
        await user.keyboard("{Enter}");
        expect(onClick).toHaveBeenCalledTimes(1);

        const checkbox = screen.getByRole("checkbox", {
            name: "Select Matter Alpha",
        });
        checkbox.focus();
        await user.keyboard(" ");
        expect(onCheckboxChange).toHaveBeenCalledTimes(1);
        expect(onClick).toHaveBeenCalledTimes(1);
    });
});
