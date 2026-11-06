// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { parseContent } from "@/lib/content/frontmatter";
import {
  isSafeHref,
  parseInline,
  parseMarkdown,
} from "@/lib/content/markdown";
import { serviceSchema } from "@/lib/content/schemas";

describe("parseMarkdown", () => {
  it("reads headings, paragraphs and bullet lists, and joins wrapped lines", () => {
    const blocks = parseMarkdown(
      "## Title\n\nFirst line\nsecond line.\n\n- one\n- two\n\nLast.\n",
    );

    expect(blocks.map((block) => block.type)).toEqual([
      "heading",
      "paragraph",
      "list",
      "paragraph",
    ]);
    expect(blocks[1]).toEqual({
      type: "paragraph",
      children: [{ type: "text", value: "First line second line." }],
    });
    expect(blocks[2]).toMatchObject({ items: [[{ value: "one" }], [{ value: "two" }]] });
  });

  it("accepts Windows line endings", () => {
    expect(parseMarkdown("## A\r\n\r\nText\r\n").map((b) => b.type)).toEqual([
      "heading",
      "paragraph",
    ]);
  });

  it("returns nothing for an empty body", () => {
    expect(parseMarkdown("  \n\n")).toEqual([]);
  });
});

describe("parseInline", () => {
  it("reads links, strong and emphasis", () => {
    expect(parseInline("a [b](/contact) **c** *d* e")).toEqual([
      { type: "text", value: "a " },
      { type: "link", href: "/contact", label: "b" },
      { type: "text", value: " " },
      { type: "strong", children: [{ type: "text", value: "c" }] },
      { type: "text", value: " " },
      { type: "em", children: [{ type: "text", value: "d" }] },
      { type: "text", value: " e" },
    ]);
  });

  it("keeps markup-looking text as plain text (React escapes it on render)", () => {
    expect(parseInline("<script>alert(1)</script>")).toEqual([
      { type: "text", value: "<script>alert(1)</script>" },
    ]);
  });
});

describe("link targets (negative tests)", () => {
  it.each([
    "javascript:alert",
    "JaVaScRiPt:alert",
    "data:text/html,x",
    "http://insecure.example",
    "//evil.example/x",
    "mailto:someone@example.com",
    "vbscript:x",
    "relative/path",
  ])("%s never becomes a link: only its label is kept", (target) => {
    expect(isSafeHref(target)).toBe(false);
    const nodes = parseInline(`[label](${target})`);
    expect(nodes.filter((node) => node.type === "link")).toEqual([]);
    expect(nodes[0]).toEqual({ type: "text", value: "label" });
  });

  it("a target with parentheses cannot smuggle a link either", () => {
    const nodes = parseInline("[x](javascript:alert(1))");

    expect(nodes.some((node) => node.type === "link")).toBe(false);
  });

  it.each(["/contact", "/services/ai-agents", "https://example.com/a"])(
    "%s is a safe target",
    (target) => {
      expect(isSafeHref(target)).toBe(true);
    },
  );
});

describe("the real service bodies", () => {
  const root = path.join(process.cwd(), "content", "services");

  for (const locale of ["it", "en"]) {
    it(`${locale}: every body parses to headings, paragraphs and links only, starting with a heading`, () => {
      for (const name of readdirSync(path.join(root, locale))) {
        const file = path.join(root, locale, name);
        const { body } = parseContent(
          readFileSync(file, "utf8"),
          serviceSchema,
          file,
        );
        const blocks = parseMarkdown(body);
        expect(blocks[0]?.type, file).toBe("heading");
        expect(blocks.filter((b) => b.type === "heading").length, file).toBe(3);
        // Nothing of the source is left unparsed in the output text.
        const text = JSON.stringify(blocks);
        expect(text, file).not.toMatch(/\]\(|\*\*|##/);
      }
    });
  }
});
