/**
 * The Markdown the content bodies are allowed to use, parsed into plain data.
 *
 * Why this exists instead of an MDX library (decision D28, B10): the body rules
 * (`bodyProblems` in lint.ts) already forbid everything MDX adds to Markdown
 * (`{ }` expressions, `<Tags />`, `import`/`export`), so the bodies are plain
 * Markdown with a handful of constructs. A renderer for exactly those
 * constructs is small, has no dependency and no build step, and ships no
 * client JavaScript. If a page ever needs a component inside the text, replace
 * `parseMarkdown` + `<Markdown>` with `@next/mdx` or `next-mdx-remote`: the
 * files are already valid MDX, and nothing else changes.
 *
 * Supported: `##` headings, paragraphs, `- ` bullet lists, `**strong**`,
 * `*emphasis*` and `[label](target)` links. Anything else is a content error
 * (`bodyProblems` reports it), never silently rendered as something else.
 *
 * Output is data, never HTML: the renderer builds React elements, so text is
 * escaped by React. A link target that is not an internal path or an https URL
 * becomes plain text, so a `javascript:` target cannot become an `href`.
 */

export type Inline =
  | { type: "text"; value: string }
  | { type: "strong"; children: Inline[] }
  | { type: "em"; children: Inline[] }
  | { type: "link"; href: string; label: string };

export type Block =
  | { type: "heading"; children: Inline[] }
  | { type: "paragraph"; children: Inline[] }
  | { type: "list"; items: Inline[][] };

/** An internal path (`/contact`, not protocol-relative `//host`) or an https URL. */
export function isSafeHref(target: string): boolean {
  return (
    (target.startsWith("/") && !target.startsWith("//")) ||
    target.startsWith("https://")
  );
}

const INLINE = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*\s][^*]*)\*/g;

export function parseInline(source: string): Inline[] {
  const nodes: Inline[] = [];
  let last = 0;
  const text = (value: string) => {
    if (value !== "") nodes.push({ type: "text", value });
  };

  for (const match of source.matchAll(INLINE)) {
    text(source.slice(last, match.index));
    // Groups that did not take part are undefined at runtime; the first
    // characters of the whole match say which alternative matched.
    const [whole, label = "", target = "", strong = "", em = ""] = match;
    if (whole.startsWith("[")) {
      if (isSafeHref(target)) nodes.push({ type: "link", href: target, label });
      else text(label);
    } else if (whole.startsWith("**")) {
      nodes.push({ type: "strong", children: parseInline(strong) });
    } else {
      nodes.push({ type: "em", children: parseInline(em) });
    }
    last = match.index + match[0].length;
  }
  text(source.slice(last));
  return nodes;
}

export function parseMarkdown(body: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: Inline[][] | null = null;

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({
        type: "paragraph",
        children: parseInline(paragraph.join(" ")),
      });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list !== null) {
      blocks.push({ type: "list", items: list });
      list = null;
    }
  };

  for (const raw of body.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    const heading = /^##\s+(.+)$/.exec(line);
    const item = /^-\s+(.+)$/.exec(line);

    if (line === "") {
      flushParagraph();
      flushList();
    } else if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ type: "heading", children: parseInline(heading[1]) });
    } else if (item) {
      flushParagraph();
      list ??= [];
      list.push(parseInline(item[1]));
    } else {
      flushList();
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushList();
  return blocks;
}
