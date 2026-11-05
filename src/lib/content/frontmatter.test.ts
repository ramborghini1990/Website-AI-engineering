// @vitest-environment node
import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  ContentError,
  parseContent,
  parseFrontmatterObject,
  splitFrontmatter,
} from "@/lib/content/frontmatter";

const schema = z.strictObject({ title: z.string().min(3), order: z.number() });

const valid = `---
{
  "title": "Hello",
  "order": 2
}
---

## Body

Text.
`;

describe("splitFrontmatter", () => {
  it("separates the JSON block from the Markdown body", () => {
    const { frontmatter, body } = splitFrontmatter(valid);

    expect(JSON.parse(frontmatter)).toEqual({ title: "Hello", order: 2 });
    expect(body).toBe("## Body\n\nText.\n");
  });

  it("accepts Windows line endings and a byte-order mark (a Windows checkout)", () => {
    const crlf = "﻿" + valid.replace(/\n/g, "\r\n");

    const { frontmatter, body } = splitFrontmatter(crlf);

    expect(JSON.parse(frontmatter)).toEqual({ title: "Hello", order: 2 });
    expect(body.startsWith("## Body")).toBe(true);
  });

  it("a body may itself contain a horizontal rule (---) without confusing the split", () => {
    const { body } = splitFrontmatter(`---\n{"a":1}\n---\n\n## A\n\n---\n\nText\n`);

    expect(body).toContain("---");
    expect(body).toContain("Text");
  });

  it.each([
    ["no fences at all", "## Just a body\n"],
    ["an opening fence only", '---\n{"a":1}\n'],
    ["frontmatter that does not start the file", '\n---\n{"a":1}\n---\nbody'],
    ["an empty file", ""],
  ])("rejects %s, naming the file (negative)", (_name, raw) => {
    expect(() => splitFrontmatter(raw, "content/x.mdx")).toThrow(ContentError);
    expect(() => splitFrontmatter(raw, "content/x.mdx")).toThrow(/content\/x\.mdx: missing frontmatter/);
  });
});

describe("parseFrontmatterObject", () => {
  it.each([
    ["broken JSON", '{ "title": "x", }'],
    ["YAML key: value lines (not JSON)", "title: x"],
    ["a JSON array", "[1, 2]"],
    ["a JSON string", '"x"'],
    ["null", "null"],
  ])("rejects %s (negative)", (_name, text) => {
    expect(() => parseFrontmatterObject(text, "f.mdx")).toThrow(ContentError);
  });

  it("explains that it must be JSON", () => {
    expect(() => parseFrontmatterObject("title: x", "f.mdx")).toThrow(/not valid JSON/);
  });
});

describe("parseContent", () => {
  it("returns validated data and the body", () => {
    const result = parseContent(valid, schema, "f.mdx");

    expect(result.data).toEqual({ title: "Hello", order: 2 });
    expect(result.body).toContain("## Body");
  });

  it("names the file and EVERY failing field (negative)", () => {
    const raw = '---\n{ "title": "x", "order": "two" }\n---\nbody';

    let message = "";
    try {
      parseContent(raw, schema, "content/services/it/a.mdx");
    } catch (error) {
      message = String(error instanceof Error ? error.message : error);
    }

    expect(message).toContain("content/services/it/a.mdx");
    expect(message).toContain("title:");
    expect(message).toContain("order:");
  });

  it("rejects an unknown key: a typo in a field name is an error, not silently ignored (negative)", () => {
    const raw = '---\n{ "title": "Hello", "order": 1, "ordr": 1 }\n---\nbody';

    expect(() => parseContent(raw, schema, "f.mdx")).toThrow(/ordr/i);
  });

  it("the frontmatter is valid YAML too: a JSON object is a YAML flow mapping (documented compatibility)", () => {
    // Not a YAML parser, but the shape the docs promise: braces, quoted keys, no tabs.
    const { frontmatter } = splitFrontmatter(valid);

    expect(frontmatter.trim().startsWith("{")).toBe(true);
    expect(frontmatter).not.toMatch(/\t/);
  });
});
