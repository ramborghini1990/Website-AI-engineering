import { Fragment, type ReactNode } from "react";

import { Link } from "@/i18n/navigation";
import {
  parseMarkdown,
  type Block,
  type Inline,
} from "@/lib/content/markdown";
import { resolveInternalPath } from "@/lib/navigation";

const linkClass =
  "text-accent underline decoration-accent underline-offset-4 hover:text-accent-hover";

function renderInline(nodes: readonly Inline[]): ReactNode {
  return nodes.map((node, index) => {
    switch (node.type) {
      case "text":
        return <Fragment key={index}>{node.value}</Fragment>;
      case "strong":
        return (
          <strong key={index} className="font-semibold text-text">
            {renderInline(node.children)}
          </strong>
        );
      case "em":
        return <em key={index}>{renderInline(node.children)}</em>;
      case "link": {
        if (!node.href.startsWith("/")) {
          return (
            <a
              key={index}
              href={node.href}
              rel="noopener noreferrer"
              className={linkClass}
            >
              {node.label}
            </a>
          );
        }
        // An internal link never points at a page that does not exist yet.
        const target = resolveInternalPath(node.href);
        if (target.kind === "none") {
          return <Fragment key={index}>{node.label}</Fragment>;
        }
        if (target.kind === "anchor") {
          return (
            <a key={index} href={target.href} className={linkClass}>
              {node.label}
            </a>
          );
        }
        return (
          <Link key={index} href={target.href} className={linkClass}>
            {node.label}
          </Link>
        );
      }
    }
  });
}

function renderBlock(block: Block, index: number): ReactNode {
  switch (block.type) {
    case "heading":
      return (
        <h2 key={index} className="mt-12 text-2xl text-text first:mt-0">
          {renderInline(block.children)}
        </h2>
      );
    case "paragraph":
      return (
        <p key={index} className="mt-4 text-base text-text-secondary">
          {renderInline(block.children)}
        </p>
      );
    case "list":
      return (
        <ul
          key={index}
          className="mt-4 grid list-disc gap-2 ps-6 text-base text-text-secondary"
        >
          {block.items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInline(item)}</li>
          ))}
        </ul>
      );
  }
}

/**
 * Renders a content body (the Markdown subset in `lib/content/markdown.ts`) on
 * the server: no client JavaScript, text escaped by React, headings are `h2`
 * because the page owns the `h1`. Internal links go through `resolveInternalPath`.
 */
export function Markdown({ body }: { body: string }) {
  return <div className="max-w-prose">{parseMarkdown(body).map(renderBlock)}</div>;
}
