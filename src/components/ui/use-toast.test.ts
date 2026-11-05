import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** A fresh module per test: the store is module-level state. */
async function freshStore() {
  vi.resetModules();
  return import("@/components/ui/use-toast");
}

describe("toast store", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("adds toasts newest first with deterministic ids and a default variant", async () => {
    const { toast, useToasts } = await freshStore();
    const { result } = renderHook(() => useToasts());

    act(() => {
      toast({ title: "first" });
      toast({ title: "second", variant: "success" });
    });

    expect(result.current.map((t) => t.title)).toEqual(["second", "first"]);
    expect(result.current.map((t) => t.id)).toEqual(["2", "1"]);
    expect(result.current.map((t) => t.variant)).toEqual([
      "success",
      "default",
    ]);
    expect(result.current.every((t) => t.open)).toBe(true);
  });

  it("keeps at most three toasts and drops the oldest", async () => {
    const { toast, useToasts } = await freshStore();
    const { result } = renderHook(() => useToasts());

    act(() => {
      for (const title of ["a", "b", "c", "d"]) toast({ title });
    });

    expect(result.current.map((t) => t.title)).toEqual(["d", "c", "b"]);
  });

  it("closes a toast first, then removes it after the exit animation", async () => {
    const { toast, useToasts } = await freshStore();
    const { result } = renderHook(() => useToasts());
    let handle: ReturnType<typeof toast> | undefined;

    act(() => {
      handle = toast({ title: "bye" });
    });
    act(() => {
      handle?.dismiss();
    });

    expect(result.current).toHaveLength(1);
    expect(result.current[0]?.open).toBe(false);

    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(result.current).toHaveLength(0);
  });

  it("dismissing twice schedules a single removal and never throws", async () => {
    const { toast, dismissToast, useToasts } = await freshStore();
    const { result } = renderHook(() => useToasts());
    let id = "";

    act(() => {
      id = toast({ title: "x" }).id;
    });
    act(() => {
      dismissToast(id);
      dismissToast(id);
      dismissToast("does-not-exist");
    });
    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(result.current).toHaveLength(0);
  });
});
