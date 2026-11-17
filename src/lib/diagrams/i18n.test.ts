// @vitest-environment node
import { describe, expect, it } from "vitest";

import en from "../../../messages/en.json";
import it_ from "../../../messages/it.json";
import { diagramRegistry } from "./registry";

/**
 * Every visible string of a diagram lives in both languages (CLAUDE.md, rules
 * for content): a key missing from one file would render as an error string.
 */

const MAX_LABEL = 16;
/** Label geometry of diagram.tsx: 15-unit mono text is about 0.6 em (9 units) per character. */
const CHAR_WIDTH = 9;
const LABEL_PAD = 12;
const NUMBER_PREFIX = 3; // "01 "
const RESERVED_FOR_MARK = 24;
const locales = { it: it_, en } as const;

function leafPaths(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    leafPaths(child, prefix === "" ? key : `${prefix}.${key}`),
  );
}

function lookup(messages: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (node, key) =>
        typeof node === "object" && node !== null
          ? (node as Record<string, unknown>)[key]
          : undefined,
      messages,
    );
}

describe("diagram messages", () => {
  it("registers the hero, the four service diagrams and the capability map", () => {
    const ids = diagramRegistry.map((entry) => entry.diagram.id);
    for (const id of [
      "hero",
      "ai-agents",
      "workflow-automation",
      "web-applications",
      "document-intelligence",
      "capability-map",
    ]) {
      expect(ids).toContain(id);
    }
  });

  it("has identical key sets under `diagrams` in it.json and en.json", () => {
    expect(leafPaths(en.diagrams).sort()).toEqual(
      leafPaths(it_.diagrams).sort(),
    );
  });

  for (const { diagram, namespace } of diagramRegistry) {
    describe(`${diagram.id} (${namespace})`, () => {
      const keys = [
        "title",
        ...diagram.nodes.flatMap((node) => [
          node.labelKey,
          ...(node.subKey === undefined ? [] : [node.subKey]),
        ]),
        ...diagram.steps.map((step) => `steps.${step}`),
      ];

      for (const [locale, messages] of Object.entries(locales)) {
        it(`${locale}: every label, sub-label, step and the title exists as text`, () => {
          for (const key of keys) {
            const value = lookup(messages, `${namespace}.${key}`);
            expect(typeof value, `${namespace}.${key}`).toBe("string");
            expect((value as string).trim(), `${namespace}.${key}`).not.toBe(
              "",
            );
          }
        });

        it(`${locale}: node labels are at most ${String(MAX_LABEL)} characters`, () => {
          for (const node of diagram.nodes) {
            for (const key of [node.labelKey, node.subKey]) {
              if (key === undefined) continue;
              const value = lookup(messages, `${namespace}.${key}`) as string;
              expect(
                value.length,
                `${locale} ${namespace}.${key} "${value}"`,
              ).toBeLessThanOrEqual(MAX_LABEL);
            }
          }
        });
      }

      for (const [locale, messages] of Object.entries(locales)) {
        it(`${locale}: every label fits inside its node`, () => {
          const tones = new Map(diagram.nodes.map((n) => [n.id, n.tone]));
          for (const node of diagram.nodes) {
            const numbered =
              node.step !== undefined &&
              (node.parent === undefined ||
                tones.get(node.parent) === "boundary");
            // room kept free for the accent dot (human) or the check mark (output)
            const reserved =
              node.tone === "human" || node.tone === "output"
                ? RESERVED_FOR_MARK
                : 0;
            for (const [key, prefix] of [
              [node.labelKey, numbered ? NUMBER_PREFIX : 0],
              [node.subKey, 0],
            ] as const) {
              if (key === undefined) continue;
              const value = lookup(messages, `${namespace}.${key}`) as string;
              const needed =
                LABEL_PAD + (value.length + prefix) * CHAR_WIDTH + reserved;
              expect(
                needed,
                `${locale} ${namespace}.${key} "${value}" needs ${String(needed)} units, node ${node.id} is ${String(node.w)} wide`,
              ).toBeLessThanOrEqual(node.w);
            }
          }
        });
      }

      it("has no message that the diagram does not use", () => {
        const used = new Set(keys.map((key) => `${namespace}.${key}`));
        const unused = leafPaths(lookup(it_, namespace), namespace).filter(
          (path) => !used.has(path),
        );
        expect(unused).toEqual([]);
      });
    });
  }
});
