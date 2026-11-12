// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import GlobalError from "@/app/global-error";

describe("global error page (root layout failure)", () => {
  const html = renderToStaticMarkup(<GlobalError reset={vi.fn()} />);

  it("is a complete document with one h1 and a retry button, in both languages", () => {
    expect(html).toContain('<html lang="it">');
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html).toContain("Qualcosa è andato storto");
    expect(html).toContain("Something went wrong");
    expect(html).toContain("<button");
  });

  it("shows nothing about the error: no message, stack, digest or path (negative)", () => {
    // The component does not receive the error, so it cannot print it.
    expect(GlobalError.length).toBe(1);
    expect(html).not.toMatch(/digest|stack|node_modules|\.tsx?\b|at \w+\s*\(/i);
    expect(html).not.toMatch(/[A-Za-z]:\\|\/src\/|\/app\//);
  });

  it("carries no script, no external resource and no inline event handler (strict CSP)", () => {
    expect(html).not.toMatch(/<script|<link|<img|<iframe|\son\w+=/i);
    expect(html).not.toMatch(/https?:\/\//);
  });
});
