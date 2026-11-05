import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";

describe("Dialog", () => {
  it("is a named modal dialog whose close button has the caller's label", () => {
    render(
      <Dialog open>
        <DialogContent closeLabel="Chiudi">
          <DialogTitle>Richiedi una call</DialogTitle>
          <DialogDescription>Compila i campi.</DialogDescription>
        </DialogContent>
      </Dialog>,
    );

    const dialog = screen.getByRole("dialog", { name: "Richiedi una call" });
    expect(dialog).toHaveAccessibleDescription("Compila i campi.");
    expect(screen.getByRole("button", { name: "Chiudi" })).toBeInTheDocument();
  });

  it("hides the close icon from assistive technology", () => {
    render(
      <Dialog open>
        <DialogContent closeLabel="Close">
          <DialogTitle>T</DialogTitle>
          <DialogDescription>D</DialogDescription>
        </DialogContent>
      </Dialog>,
    );

    const close = screen.getByRole("button", { name: "Close" });
    expect(close.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});

describe("Sheet", () => {
  it("is a named dialog docked to the requested side", () => {
    render(
      <Sheet open>
        <SheetContent side="left" closeLabel="Close">
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription>Narrow the list.</SheetDescription>
        </SheetContent>
      </Sheet>,
    );

    const sheet = screen.getByRole("dialog", { name: "Filters" });
    expect(sheet).toHaveClass("left-0");
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });
});
