import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LazyToaster } from "@/components/ui/lazy-toaster";
import { toast } from "@/components/ui/use-toast";

// Stands in for the Radix Toaster: this test is about WHEN it is loaded.
const loaded = vi.hoisted(() => ({ count: 0 }));
vi.mock("@/components/ui/toaster", () => {
  loaded.count += 1;
  return {
    Toaster: ({
      viewportLabel,
      closeLabel,
    }: {
      viewportLabel: string;
      closeLabel: string;
    }) => (
      <div data-testid="toaster" data-viewport={viewportLabel}>
        {closeLabel}
      </div>
    ),
  };
});

const labels = { viewportLabel: "Notifiche (F8)", closeLabel: "Chiudi" };

describe("LazyToaster (the Toaster is not part of the start-up work)", () => {
  it("renders nothing, and does not even load the Toaster module, until a toast is raised", () => {
    render(<LazyToaster {...labels} />);
    expect(screen.queryByTestId("toaster")).toBeNull();
    expect(loaded.count).toBe(0);
  });

  it("mounts the Toaster, with its labels, as soon as a toast is raised", async () => {
    render(<LazyToaster {...labels} />);
    expect(screen.queryByTestId("toaster")).toBeNull();

    act(() => {
      toast({ title: "Salvato" });
    });

    const toaster = await screen.findByTestId("toaster");
    expect(toaster.dataset.viewport).toBe("Notifiche (F8)");
    expect(toaster.textContent).toBe("Chiudi");
    expect(loaded.count).toBe(1);
  });

  it("shows a toast that was raised before the component mounted (nothing is lost)", async () => {
    // The queue from the previous test still holds a toast.
    render(<LazyToaster {...labels} />);
    expect(await screen.findByTestId("toaster")).toBeDefined();
  });
});
