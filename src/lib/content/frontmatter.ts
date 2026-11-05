import type { z } from "zod";

/**
 * Content files are `.mdx` with a frontmatter block written as ONE JSON object
 * between `---` lines:
 *
 *     ---
 *     { "title": "...", "order": 1 }
 *     ---
 *     Markdown body
 *
 * A JSON object is valid YAML, so any frontmatter-aware tool that appears later
 * (an MDX pipeline, an editor, `gray-matter`) reads these files unchanged, and
 * until then no parser dependency is needed.
 */

export class ContentError extends Error {
  readonly file: string;

  constructor(file: string, message: string) {
    super(`${file}: ${message}`);
    this.name = "ContentError";
    this.file = file;
  }
}

/** Split a raw file into its frontmatter text and body. Throws if the fences are missing. */
export function splitFrontmatter(
  raw: string,
  file = "(content)",
): { frontmatter: string; body: string } {
  const text = raw.replace(/^﻿/, "").replace(/\r\n/g, "\n");
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)([\s\S]*)$/.exec(text);
  if (!match) {
    throw new ContentError(
      file,
      "missing frontmatter: the file must start with a --- line, a JSON object, and a closing --- line",
    );
  }
  return { frontmatter: match[1], body: match[2].replace(/^\n+/, "") };
}

/** Parse the JSON object in a frontmatter block. */
export function parseFrontmatterObject(
  frontmatter: string,
  file = "(content)",
): Record<string, unknown> {
  let value: unknown;
  try {
    value = JSON.parse(frontmatter);
  } catch (error) {
    throw new ContentError(
      file,
      `the frontmatter is not valid JSON (${error instanceof Error ? error.message : "unknown error"})`,
    );
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ContentError(file, "the frontmatter must be a JSON object");
  }
  return value as Record<string, unknown>;
}

export type ParsedContent<S extends z.ZodType> = {
  data: z.output<S>;
  body: string;
};

/** Split, parse and validate one content file. Errors name the file and every failing field. */
export function parseContent<S extends z.ZodType>(
  raw: string,
  schema: S,
  file = "(content)",
): ParsedContent<S> {
  const { frontmatter, body } = splitFrontmatter(raw, file);
  const object = parseFrontmatterObject(frontmatter, file);
  const result = schema.safeParse(object);
  if (!result.success) {
    const problems = result.error.issues
      .map(
        (issue) =>
          `${issue.path.length > 0 ? issue.path.join(".") : "(frontmatter)"}: ${issue.message}`,
      )
      .join("; ");
    throw new ContentError(file, problems);
  }
  return { data: result.data, body };
}
