import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TableRow } from "./TablePrimitive";

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
