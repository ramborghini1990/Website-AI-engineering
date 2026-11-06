// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Executable form of CLAUDE.md §12 for the work pages: "client names, logos and
 * metrics appear only when `clientConsent: true`". The one reader of those
 * fields is `clientDisclosure` (lib/content/work-view.ts). A work component or
 * page that reads `client`, `outcomes` or `clientConsent` off an entry itself,
 * or renders an image, would bypass the guard, so it fails here.
 */

const root = process.cwd();
const dirs = [
  "src/components/work",
  "src/app/[locale]/work",
  "src/app/[locale]/work/[slug]",
  "src/app/[locale]/dev-tools/work",
];

function sources(): Array<{ file: string; code: string }> {
  return dirs.flatMap((dir) =>
    readdirSync(path.join(root, dir), { withFileTypes: true })
      .filter(
        (item) =>
          item.isFile() &&
          /\.tsx?$/.test(item.name) &&
          !/\.test\./.test(item.name),
      )
      .map((item) => {
        const file = path.join(dir, item.name);
        const code = readFileSync(path.join(root, file), "utf8")
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/^\s*\/\/.*$/gm, "")
          // message keys such as "labels.client" are text, not property reads
          .replace(/"[^"\n]*"|'[^'\n]*'|`[^`]*`/g, '""');
        return { file, code };
      }),
  );
}

describe("work pages and components obey the client-consent guard", () => {
  it("finds the files it is meant to guard", () => {
    const names = sources().map((source) => source.file.replace(/\\/g, "/"));
    expect(names).toEqual(
      expect.arrayContaining([
        "src/components/work/work-card.tsx",
        "src/components/work/work-detail.tsx",
        "src/components/work/work-index.tsx",
        "src/app/[locale]/work/page.tsx",
        "src/app/[locale]/work/[slug]/page.tsx",
      ]),
    );
  });

  it("nothing reads .client, .outcomes or .clientConsent directly (only clientDisclosure does)", () => {
    for (const { file, code } of sources()) {
      expect(code, file).not.toMatch(/\.(client|outcomes|clientConsent)\b/);
    }
  });

  it("the components that show client data go through clientDisclosure", () => {
    for (const name of ["work-card.tsx", "work-detail.tsx"]) {
      const code = readFileSync(
        path.join(root, "src/components/work", name),
        "utf8",
      );
      expect(code, name).toContain("clientDisclosure(");
    }
  });

  it("no work file renders an image or mentions a logo", () => {
    for (const { file, code } of sources()) {
      expect(code, file).not.toMatch(/<img\b|next\/image|<Image\b|\blogo\b/i);
    }
  });

  it("the public pages read only published entries: getWork is never asked for drafts", () => {
    for (const { file, code } of sources()) {
      expect(code, file).not.toContain("includeDrafts");
    }
  });
});
