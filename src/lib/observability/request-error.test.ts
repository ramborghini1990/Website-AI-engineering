// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import type { Logger } from "@/lib/logger";
import { reportRequestError } from "@/lib/observability/request-error";
import type { ErrorSink } from "@/lib/observability/sink";

const makeLog = () =>
  ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) satisfies Logger;

const error = Object.assign(
  new Error("anna.rossi@example.com sent 203.0.113.42"),
  { digest: "42" },
);
const context = { routePath: "/[locale]/contact", routeType: "action" };

describe("reportRequestError", () => {
  it("logs one scrubbed line and sends the same report to the tracker", async () => {
    const log = makeLog();
    const capture = vi.fn(() => Promise.resolve(true));

    await reportRequestError(error, { method: "POST" }, context, {
      sink: { capture },
      log,
    });

    expect(log.error).toHaveBeenCalledWith(
      "request.error",
      expect.objectContaining({
        route: "/[locale]/contact",
        errorClass: "Error",
        code: "42",
      }),
    );
    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({ route: "/[locale]/contact", method: "POST" }),
    );
    expect(
      JSON.stringify([log.error.mock.calls, capture.mock.calls]),
    ).not.toMatch(/anna|example\.com|203\.0\.113/);
  });

  it("with no tracker configured, it only logs (nothing leaves the server)", async () => {
    const log = makeLog();

    await reportRequestError(error, {}, context, { sink: null, log });

    expect(log.error).toHaveBeenCalledTimes(1);
    expect(log.warn).not.toHaveBeenCalled();
  });

  it("notes a failed delivery without throwing", async () => {
    const log = makeLog();
    const sink: ErrorSink = { capture: () => Promise.resolve(false) };

    await expect(
      reportRequestError(error, {}, context, { sink, log }),
    ).resolves.toBeUndefined();
    expect(log.warn).toHaveBeenCalledWith("request.error.not-reported", {
      provider: "sentry",
    });
  });

  it("never throws, even when the sink or the logger does (negative)", async () => {
    const boom = () => {
      throw new Error("down");
    };
    const log: Logger = { info: boom, warn: boom, error: boom };

    await expect(
      reportRequestError(error, {}, context, {
        sink: { capture: () => Promise.reject(new Error("down")) },
        log,
      }),
    ).resolves.toBeUndefined();
  });
});
