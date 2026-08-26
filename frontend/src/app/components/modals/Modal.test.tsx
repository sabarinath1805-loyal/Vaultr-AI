import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { Modal } from "./Modal";

function ModalHarness() {
    const [open, setOpen] = useState(false);

    return (
        <>
            <button type="button" onClick={() => setOpen(true)}>
                Open details
            </button>
            <Modal
                open={open}
                onClose={() => setOpen(false)}
                breadcrumbs={["Projects", "Details"]}
            >
                <label htmlFor="matter-name">Matter name</label>
                <input id="matter-name" />
            </Modal>
        </>
    );
}

describe("Modal", () => {
    it("traps the page, closes on Escape, and restores trigger focus", async () => {
        const user = userEvent.setup();
        render(<ModalHarness />);

        const trigger = screen.getByRole("button", { name: "Open details" });
        await user.click(trigger);

        const dialog = screen.getByRole("dialog", { name: "Details" });
        expect(dialog).toHaveAttribute("aria-modal", "true");
        expect(document.body.style.overflow).toBe("hidden");
        await waitFor(() =>
            expect(screen.getByLabelText("Matter name")).toHaveFocus(),
        );

        await user.tab();
        expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
        await user.tab({ shift: true });
        expect(screen.getByLabelText("Matter name")).toHaveFocus();

        await user.keyboard("{Escape}");

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(document.body.style.overflow).toBe("");
        expect(trigger).toHaveFocus();
    });
});
