// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  processors,
  storedKeys,
  thirdParties,
  type Processor,
  type StoredKey,
  type ThirdParty,
} from "@/lib/consent/registry";
import { parseContent } from "@/lib/content/frontmatter";
import { serverEnvKeys } from "@/lib/env-schema";
import {
  legalKeys,
  legalPaths,
  legalSchema,
  legalTableNames,
  requiredTables,
  splitLegalBody,
} from "@/lib/legal/documents";

/**
 * P4.2 as a gate (ROADMAP: "every processor and storage key in code appears in
 * the policy"). The policy is PRINTED from `src/lib/consent/registry.ts`, so this
 * file proves the two halves that can drift:
 *   1. the code → the registry: every browser-storage name, every service that
 *      the environment schema, the dependencies and the URLs in the code point
 *      at, is in the registry (a new one fails here until it is added);
 *   2. the registry → the words: each entry has its text, in both languages,
 *      and each document prints the tables it must.
 * `legal-tables.test.tsx` then proves the tables really show every entry.
 */

const root = process.cwd();
const norm = (file: string) => file.replace(/\\/g, "/");
const walk = (dir: string): string[] =>
  readdirSync(path.join(root, dir)).flatMap((name) => {
    const rel = path.join(dir, name);
    return statSync(path.join(root, rel)).isDirectory() ? walk(rel) : [rel];
  });

const production = walk("src")
  .filter((file) => /\.(ts|tsx)$/.test(file) && !/\.test\.(ts|tsx)$/.test(file))
  .map(norm);

/** Source without comments, so a URL or a word in a comment is not a use. */
const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const code = (file: string) =>
  stripComments(readFileSync(path.join(root, file), "utf8"));

// ---------------------------------------------------------------------------
// 1. code → registry
// ---------------------------------------------------------------------------

/** The names of the browser-storage keys a piece of source defines or uses. */
function storageNamesIn(source: string): string[] {
  const found = new Set<string>();
  const patterns = [
    // named constants: THEME_STORAGE_KEY, CONSENT_COOKIE, DB_NAME
    /\b(?:[A-Z][A-Z_]*_)?(?:STORAGE_KEY|COOKIE|DB_NAME)\s*=\s*"([^"]+)"/g,
    // direct calls with a literal
    /\b(?:getItem|setItem|removeItem)\(\s*"([^"]+)"/g,
    /\bindexedDB\.open\(\s*"([^"]+)"/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) found.add(match[1]);
  }
  return [...found].sort();
}

describe("code → registry: browser storage", () => {
  it("the storage names in the code are exactly the registry's (a new cookie, localStorage or IndexedDB key fails here until the cookie policy lists it)", () => {
    const names = production.flatMap((file) => storageNamesIn(code(file)));

    expect([...new Set(names)].sort()).toEqual(
      storedKeys.map((key) => key.name).sort(),
    );
  });

  it("the finder really finds a new key, however it is written (negative control)", () => {
    expect(storageNamesIn(`localStorage.setItem("tracking-id", "1")`)).toEqual([
      "tracking-id",
    ]);
    expect(storageNamesIn(`const TRACKING_COOKIE = "uid"`)).toEqual(["uid"]);
    expect(storageNamesIn(`indexedDB.open("history", 1)`)).toEqual(["history"]);
    expect(storageNamesIn(`const FLAG_STORAGE_KEY = "flag"`)).toEqual(["flag"]);
    expect(storageNamesIn(`const x = "theme"`)).toEqual([]);
  });

  it("each registry entry is the kind of storage its owner module really uses", () => {
    const api: Record<StoredKey["kind"], RegExp> = {
      cookie: /document\.cookie/,
      localStorage: /\blocalStorage\b/,
      indexedDB: /\bindexedDB\b/,
    };
    for (const key of storedKeys) {
      expect(production, key.name).toContain(key.owner);
      expect(code(key.owner), key.name).toMatch(api[key.kind]);
    }
  });

  it("nothing sets a cookie from the server and no session storage is used: the browser keeps only what the registry lists", () => {
    for (const file of production) {
      expect(code(file), file).not.toMatch(
        /\bsessionStorage\b|\bSet-Cookie\b|\bcookies\(\)|\.cookies\.set\(|\bres\.cookie\(/,
      );
    }
  });

  it("the site sets no language cookie, as the cookie policy says", () => {
    expect(code("src/i18n/routing.ts")).toMatch(/localeCookie:\s*false/);
  });
});

/**
 * Environment variables that name a service are claimed by a processor; the
 * rest are listed here with the reason they are not one. A new variable fails
 * the first test below until someone decides which it is.
 */
const NOT_A_SERVICE: Record<string, string> = {
  NODE_ENV: "runtime mode",
  NEXT_PHASE: "build phase flag",
  SKIP_ENV_VALIDATION: "build-time switch for CI",
  CSP_MODE: "the site's own security-header mode",
  SECURITY_CONTACT:
    "the owner's own address, published in security.txt so researchers can report a vulnerability (no third party receives data)",
  CSP_REPORT_URI:
    "optional report collector, unset: if it is ever set it receives violation reports and needs a processors entry",
  SENTRY_DSN:
    "optional EU error tracker, unset: if it is ever set it receives scrubbed error reports (class, route pattern, stack frames; no message, URL or request data) and needs a processors entry first (docs/DEPLOYMENT.md §8)",
  RATE_LIMIT_IP_SALT: "a secret key used to hash IPs before the limiter",
  CRON_SECRET:
    "the shared secret that lets the platform's scheduler call the site's own purge route (no third party receives data)",
  INQUIRY_RETENTION_DAYS:
    "how many days the site keeps an inquiry: a number, the 24 months of the privacy notice",
  NEXT_PUBLIC_SITE_URL: "the site's own address",
  NEXT_PUBLIC_PLAUSIBLE_ORIGIN:
    "declared for the CSP, but no code loads it (docs/ANALYTICS.md): the demos count on our own server",
};

describe("code → registry: services", () => {
  const claimedEnv = new Set(processors.flatMap((entry) => entry.envVars));

  it("every environment variable is either a processor's or listed as not a service", () => {
    const unknown = serverEnvKeys.filter(
      (name) => !claimedEnv.has(name) && !(name in NOT_A_SERVICE),
    );

    expect(unknown).toEqual([]);
  });

  it("every variable a processor names exists in the environment schema (no typo hides a service)", () => {
    for (const name of claimedEnv) expect(serverEnvKeys, name).toContain(name);
    for (const name of Object.keys(NOT_A_SERVICE)) {
      expect(serverEnvKeys, name).toContain(name);
    }
  });

  it("every external host named in the code belongs to a registered processor (or is a namespace, not a request)", () => {
    const NOT_A_REQUEST = new Set([
      "schema.org", // JSON-LD @context, a name not a fetch
      "localhost", // development fallback
      "example.eu", // the example in an error message
      "host", // the example in an error message
    ]);
    const registered = processors.flatMap((entry) => entry.hosts);
    const hosts = new Set<string>();
    for (const file of production) {
      for (const match of code(file).matchAll(/https?:\/\/([a-z0-9.-]+)/gi)) {
        hosts.add(match[1].toLowerCase());
      }
    }

    const unregistered = [...hosts].filter(
      (host) =>
        !NOT_A_REQUEST.has(host) &&
        !registered.some(
          (known) => host === known || host.endsWith(`.${known}`),
        ),
    );
    expect(unregistered).toEqual([]);
    // and the hosts the registry claims are really in the code (a stale entry is as wrong as a missing one)
    const everything = production.map((file) => code(file)).join("\n");
    for (const known of registered) expect(everything, known).toContain(known);
  });

  it("every dependency that talks to a service is claimed by a processor", () => {
    const pkg = JSON.parse(
      readFileSync(path.join(root, "package.json"), "utf8"),
    ) as { dependencies: Record<string, string> };
    const SERVICE_CLIENT =
      /upstash|anthropic|openai|sentry|resend|stripe|posthog|plausible|umami|supabase|neon|planetscale|turso|cloudflare|vercel\/|analytics|segment|mixpanel|hotjar|intercom|twilio|sendgrid|postmark|brevo|mailgun|algolia|firebase|aws-sdk|^postgres$|^pg$|^drizzle-orm$|cal\.com|@calcom/i;
    const claimed = new Set(processors.flatMap((entry) => entry.packages));

    const serviceClients = Object.keys(pkg.dependencies).filter((name) =>
      SERVICE_CLIENT.test(name),
    );
    expect(serviceClients.length).toBeGreaterThan(0);
    expect(serviceClients.filter((name) => !claimed.has(name))).toEqual([]);
  });

  it("the CSP's third-party origins are registered hosts", () => {
    const csp = code("src/lib/security/csp.ts");
    const origins = [...csp.matchAll(/"https:\/\/([a-z0-9.-]+)"/g)].map(
      (match) => match[1],
    );

    expect(origins.length).toBeGreaterThan(0);
    const registered = processors.flatMap((entry) => entry.hosts);
    for (const host of origins) expect(registered, host).toContain(host);
  });

  it("every consent-gated third party points at a processor whose load is the visitor's consent", () => {
    for (const party of thirdParties) {
      const entry = processors.find(
        (candidate) => candidate.id === party.processor,
      );
      expect(entry, party.id).toBeDefined();
      expect(entry?.when, party.id).toBe("booking-consent");
    }
  });

  it("ids are unique", () => {
    for (const list of [
      processors.map((entry) => entry.id),
      thirdParties.map((entry) => entry.id),
      storedKeys.map((entry) => entry.name),
    ]) {
      expect(new Set(list).size).toBe(list.length);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. registry → words, in both languages
// ---------------------------------------------------------------------------

type Tree = { [key: string]: Tree | string };
const read = (locale: string) =>
  (
    JSON.parse(
      readFileSync(path.join(root, `messages/${locale}.json`), "utf8"),
    ) as { legal: Tree }
  ).legal;

function at(tree: Tree, dotted: string): string | undefined {
  let node: Tree | string | undefined = tree;
  for (const part of dotted.split(".")) {
    if (typeof node !== "object") return undefined;
    node = node[part];
  }
  return typeof node === "string" && node.trim() !== "" ? node : undefined;
}

/** What is missing from the messages for a registry. Pure, so it can be tested with a bad registry. */
function missingText(
  legal: Tree,
  registry: {
    storedKeys: readonly StoredKey[];
    thirdParties: readonly ThirdParty[];
    processors: readonly Processor[];
  },
): string[] {
  const need: string[] = [];
  for (const key of registry.storedKeys) {
    need.push(
      `storage.${key.name}.purpose`,
      `storage.${key.name}.duration`,
      `tables.storage.kinds.${key.kind}`,
      `tables.storage.categories.${key.category}`,
    );
  }
  for (const party of registry.thirdParties) {
    need.push(
      `thirdParties.${party.id}.purpose`,
      `thirdParties.${party.id}.data`,
      `tables.thirdParties.triggers.${party.trigger}`,
      `tables.thirdParties.categories.${party.category}`,
    );
  }
  for (const entry of registry.processors) {
    need.push(
      `processors.${entry.id}.purpose`,
      `processors.${entry.id}.data`,
      `processors.${entry.id}.location`,
      `tables.processors.roles.${entry.role}`,
      `tables.processors.whens.${entry.when}`,
    );
  }
  return need.filter((dotted) => at(legal, dotted) === undefined);
}

describe("registry → words", () => {
  for (const locale of ["it", "en"]) {
    it(`${locale}: every stored key, third party and processor has its text`, () => {
      expect(
        missingText(read(locale), { storedKeys, thirdParties, processors }),
      ).toEqual([]);
    });
  }

  it("an entry the registry gains without text is reported (negative control)", () => {
    const extra: StoredKey = {
      name: "analytics-id" as StoredKey["name"],
      kind: "cookie",
      category: "necessary",
      provider: "this site",
      owner: "src/lib/consent/client.ts",
    };
    const problems = missingText(read("en"), {
      storedKeys: [...storedKeys, extra],
      thirdParties: [],
      processors: [],
    });

    expect(problems).toEqual([
      "storage.analytics-id.purpose",
      "storage.analytics-id.duration",
    ]);
  });

  it("every provider the policy lists says where its data goes (no empty 'location')", () => {
    for (const locale of ["it", "en"]) {
      for (const entry of processors) {
        expect(
          at(read(locale), `processors.${entry.id}.location`)?.length,
          `${locale} ${entry.id}`,
        ).toBeGreaterThan(40);
      }
    }
  });
});

describe("the documents", () => {
  const load = (locale: string, key: string) => {
    const file = path.join("content/legal", locale, `${key}.mdx`);
    return parseContent(
      readFileSync(path.join(root, file), "utf8"),
      legalSchema,
      file,
    );
  };

  it("exist, in both languages, with a valid frontmatter", () => {
    for (const locale of ["it", "en"]) {
      const onDisk = readdirSync(
        path.join(root, "content/legal", locale),
      ).sort();
      expect(onDisk).toEqual(legalKeys.map((key) => `${key}.mdx`).sort());
      for (const key of legalKeys)
        expect(() => load(locale, key), `${locale}/${key}`).not.toThrow();
    }
  });

  it("Italian and English are the same version of the text, written on the same day", () => {
    for (const key of legalKeys) {
      const it_ = load("it", key).data;
      const en = load("en", key).data;
      expect(en.version, key).toBe(it_.version);
      expect(en.updated, key).toBe(it_.updated);
      expect(en.status, key).toBe(it_.status);
      expect(en.seoTitle, key).not.toBe(it_.seoTitle);
    }
  });

  it("each prints the generated tables it must, in both languages, and no table marker is unknown", () => {
    for (const locale of ["it", "en"]) {
      for (const key of legalKeys) {
        const printed = splitLegalBody(load(locale, key).body)
          .flatMap((segment) =>
            segment.kind === "table" ? [segment.name] : [],
          )
          .sort();
        expect(printed, `${locale}/${key}`).toEqual(
          [...requiredTables[key]].sort(),
        );
      }
    }
  });

  it("the cookie policy prints everything the registry has; the table markers are the registry's views", () => {
    expect([...legalTableNames].sort()).toEqual(
      ["business", "processors", "storage", "third-parties"].sort(),
    );
    expect(requiredTables["cookie-policy"]).toEqual(
      expect.arrayContaining(["storage", "third-parties", "processors"]),
    );
  });

  it("an unknown marker fails the build of the page instead of printing as text (negative)", () => {
    expect(() => splitLegalBody("## A\n\n[[table:everything]]\n")).toThrow(
      /Unknown legal table marker/,
    );
    expect(
      splitLegalBody("intro\n\n[[table:storage]]\n\noutro").map(
        (segment) => segment.kind,
      ),
    ).toEqual(["markdown", "table", "markdown"]);
  });

  it("no text invents a fiscal identifier, an email address or a phone number (they come from business.ts or do not exist yet)", () => {
    for (const locale of ["it", "en"]) {
      for (const key of legalKeys) {
        const { body } = load(locale, key);
        expect(body, `${locale}/${key}`).not.toMatch(/\b\d{11}\b/);
        expect(body, `${locale}/${key}`).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
        expect(body, `${locale}/${key}`).not.toMatch(/\+\d[\d\s]{7,}/);
      }
    }
  });

  it("while a text is a draft it says so on the page: no legal document is 'published' without the review (B4)", () => {
    for (const key of legalKeys) {
      expect(load("it", key).data.status, key).toBe("draft");
    }
  });

  it("no message lets an apostrophe quote a tag or a placeholder (in ICU, l'<link> prints the tag as text: found in the Italian privacy sentence)", () => {
    for (const locale of ["it", "en"]) {
      const raw = readFileSync(
        path.join(root, `messages/${locale}.json`),
        "utf8",
      );
      expect(raw.match(/'[<{>}]/g) ?? [], locale).toEqual([]);
    }
  });

  it("the links in the bodies go to pages that exist", () => {
    const known = new Set<string>([
      ...Object.values(legalPaths),
      "/contact",
      "/privacy",
    ]);
    for (const locale of ["it", "en"]) {
      for (const key of legalKeys) {
        for (const match of load(locale, key).body.matchAll(
          /\]\((\/[a-z-]*)\)/g,
        )) {
          expect(known, `${locale}/${key} → ${match[1]}`).toContain(match[1]);
        }
      }
    }
  });
});
