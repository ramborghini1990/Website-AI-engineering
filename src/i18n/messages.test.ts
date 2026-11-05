// @vitest-environment node
import { createTranslator } from "next-intl";
import { describe, expect, expectTypeOf, it as test } from "vitest";

import en from "../../messages/en.json";
import it from "../../messages/it.json";

type Json = string | { [key: string]: Json };

/** "a.b.c" -> value, for every leaf string. */
function flatten(tree: Json, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  if (typeof tree === "string") {
    out.set(prefix, tree);
    return out;
  }
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix === "" ? key : `${prefix}.${key}`;
    for (const [k, v] of flatten(value, path)) out.set(k, v);
  }
  return out;
}

const italian = flatten(it);
const english = flatten(en);

/** `{name}` arguments and `<tag>` rich-text markers used by a message. */
const placeholders = (message: string) =>
  [...message.matchAll(/\{[a-zA-Z_][\w]*\}|<\/?[a-zA-Z][\w]*>/g)]
    .map((m) => m[0])
    .sort();

describe("message files", () => {
  test("it.json and en.json have exactly the same keys", () => {
    expect([...english.keys()].sort()).toEqual([...italian.keys()].sort());
  });

  test("have the same shape at compile time (typecheck fails if they drift)", () => {
    expectTypeOf(en).toEqualTypeOf<typeof it>();
  });

  test("never contain an empty message", () => {
    for (const [locale, messages] of [
      ["it", italian],
      ["en", english],
    ] as const) {
      for (const [key, value] of messages) {
        expect(value.trim(), `${locale}: ${key}`).not.toBe("");
      }
    }
  });

  test("use the same {arguments} and <tags> in both languages", () => {
    for (const [key, value] of italian) {
      expect(placeholders(english.get(key) ?? ""), key).toEqual(
        placeholders(value),
      );
    }
  });

  test("keep language names identical in both files (each is written in its own language)", () => {
    expect(en.languageSwitcher.names).toEqual(it.languageSwitcher.names);
    expect(it.languageSwitcher.names).toEqual({
      it: "Italiano",
      en: "English",
    });
  });

  test("the two languages really differ for translated copy", () => {
    expect(en.home.status).not.toBe(it.home.status);
    expect(en.notFound.title).not.toBe(it.notFound.title);
  });
});

describe("type-safe message keys", () => {
  const t = createTranslator({ locale: "it", messages: it });

  test("resolve existing keys", () => {
    expect(t("home.title", { brand: "Brand Token" })).toBe("Brand Token");
    expect(t("notFound.backHome")).toBe("Torna alla home");
  });

  test("a missing key is a COMPILE error, not just a runtime miss", () => {
    // If type safety stopped working these directives would become "unused"
    // and fail `pnpm typecheck`, which is the point of this test.
    // @ts-expect-error unknown top-level key
    void t("doesNotExist");
    // @ts-expect-error unknown nested key
    void t("home.doesNotExist");
    // @ts-expect-error a namespace is not a message
    void t("home");
    expect(true).toBe(true);
  });
});
