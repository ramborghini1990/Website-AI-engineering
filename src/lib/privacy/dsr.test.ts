// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { runDsr, USAGE, type DsrDeps } from "@/lib/privacy/dsr";
import {
  createMemoryPrivacyStore,
  type InquiryExportRow,
  type PrivacyStore,
} from "@/lib/privacy/store";

const NOW = new Date("2026-11-12T10:00:00.000Z");

const row = (
  over: Partial<InquiryExportRow> & Pick<InquiryExportRow, "email">,
): InquiryExportRow => ({
  id: crypto.randomUUID(),
  createdAt: new Date("2025-03-01T09:00:00.000Z"),
  locale: "it",
  need: "agent",
  description: "Synthetic description for a test.",
  budget: "10-25k",
  timeline: "q1",
  name: "Test Person",
  company: "Synthetic Srl",
  marketingConsent: true,
  consentVersion: "2026-11-v1",
  status: "replied",
  ...over,
});

const ANNA = "anna.test@example.it";
const annaRows = [
  row({ email: ANNA, createdAt: new Date("2025-03-01T09:00:00.000Z") }),
  row({ email: "Anna.Test@Example.it", name: "Anna T." }),
];
const lucaRow = row({ email: "luca.test@example.it", name: "Luca Test" });

function setup(over: Partial<DsrDeps> = {}) {
  const store = createMemoryPrivacyStore([...annaRows, lucaRow]);
  const writeFile = vi.fn<DsrDeps["writeFile"]>(() => Promise.resolve());
  const deps: DsrDeps = {
    store,
    now: () => NOW,
    retentionDays: 730,
    writeFile,
    ...over,
  };
  return { store, writeFile, deps };
}

describe("export (art. 15)", () => {
  it("prints a JSON document with every row of that address (any letter case) and nobody else's", async () => {
    const { deps } = setup();

    const result = await runDsr(["export", " ANNA.test@example.IT "], deps);
    const document = JSON.parse(result.stdout) as {
      subject: string;
      generatedAt: string;
      inquiries: Array<Record<string, unknown>>;
      notes: string[];
    };

    expect(result.exitCode).toBe(0);
    expect(document.subject).toBe(ANNA);
    expect(document.generatedAt).toBe(NOW.toISOString());
    expect(document.inquiries).toHaveLength(2);
    expect(document.inquiries.map((r) => r.id)).toEqual(
      annaRows.map((r) => r.id),
    );
    expect(result.stdout).not.toContain("Luca Test");
    expect(result.stdout).not.toContain("luca.test@example.it");
  });

  it("each row carries all its stored fields and the date the purge deletes it", async () => {
    const { deps } = setup();

    const result = await runDsr(["export", ANNA], deps);
    const first = (
      JSON.parse(result.stdout) as { inquiries: Array<Record<string, unknown>> }
    ).inquiries.at(0);

    expect(Object.keys(first ?? {}).sort()).toEqual(
      [
        "budget",
        "company",
        "consentVersion",
        "createdAt",
        "deletionDue",
        "description",
        "email",
        "id",
        "locale",
        "marketingConsent",
        "name",
        "need",
        "status",
        "timeline",
      ].sort(),
    );
    expect(first?.createdAt).toBe("2025-03-01T09:00:00.000Z");
    expect(first?.deletionDue).toBe("2027-03-01T09:00:00.000Z");
  });

  it("says consent receipts are not included because they are anonymous", async () => {
    const { deps } = setup();

    const result = await runDsr(["export", ANNA], deps);

    expect(
      (JSON.parse(result.stdout) as { notes: string[] }).notes.join(" "),
    ).toMatch(/Consent receipts .* anonymous/);
  });

  it("an address with no rows is a valid, empty answer (the person can be told we hold nothing)", async () => {
    const { deps } = setup();

    const result = await runDsr(["export", "nobody@example.it"], deps);

    expect(result.exitCode).toBe(0);
    expect(
      (JSON.parse(result.stdout) as { inquiries: unknown[] }).inquiries,
    ).toEqual([]);
    expect(result.stderr).toContain("0 inquiry row(s) found");
  });

  it("--out writes the document to the file, leaves stdout empty and never echoes the address or any content", async () => {
    const { deps, writeFile } = setup();

    const result = await runDsr(["export", ANNA, "--out", "export.json"], deps);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");
    expect(writeFile).toHaveBeenCalledTimes(1);
    const [path, content] = writeFile.mock.calls.at(0) ?? ["", ""];
    expect(path).toBe("export.json");
    expect(JSON.parse(content)).toMatchObject({ subject: ANNA });
    expect(result.stderr).not.toContain(ANNA);
    expect(result.stderr).not.toContain("Synthetic");
  });

  it("negative: if the file cannot be written (it exists), it fails and says nothing was exported", async () => {
    const { deps } = setup({
      writeFile: () => Promise.reject(new Error("EEXIST: " + ANNA)),
    });

    const result = await runDsr(["export", ANNA, "--out", "export.json"], deps);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Nothing was exported");
    expect(result.stderr).not.toContain(ANNA);
  });

  it("negative: stderr carries no address, name or description, only counts and instructions", async () => {
    const { deps } = setup();

    const result = await runDsr(["export", ANNA], deps);

    for (const secret of [ANNA, "Anna T.", "Synthetic", "Test Person"]) {
      expect(result.stderr).not.toContain(secret);
    }
    expect(result.stderr).toContain("2 inquiry row(s) found");
    expect(result.stderr).toContain("Not covered by this tool");
  });
});

describe("delete (art. 17)", () => {
  it("without --confirm it only counts and deletes nothing", async () => {
    const { deps, store } = setup();

    const result = await runDsr(["delete", ANNA], deps);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain(
      "Dry run: 2 inquiry row(s) would be deleted",
    );
    expect(store.rows).toHaveLength(3);
  });

  it("with --confirm it deletes that person's rows (any letter case) and keeps everyone else's", async () => {
    const { deps, store } = setup();

    const result = await runDsr(
      ["delete", "ANNA.TEST@example.it", "--confirm"],
      deps,
    );

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain("Deleted 2 inquiry row(s)");
    expect(store.rows).toEqual([lucaRow]);
  });

  it("says consent receipts were not touched and lists what it does not cover", async () => {
    const { deps } = setup();

    const result = await runDsr(["delete", ANNA, "--confirm"], deps);

    expect(result.stderr).toContain("Consent receipts were not touched");
    expect(result.stderr).toMatch(/inbox/);
    expect(result.stderr).toMatch(/backups/);
    expect(result.stderr).not.toContain(ANNA);
  });

  it("an address with no rows deletes nothing and succeeds", async () => {
    const { deps, store } = setup();

    const result = await runDsr(
      ["delete", "nobody@example.it", "--confirm"],
      deps,
    );

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain("Deleted 0 inquiry row(s)");
    expect(store.rows).toHaveLength(3);
  });

  it("the store is asked for exactly one thing per run: an address", async () => {
    const calls: string[] = [];
    const store: PrivacyStore = {
      findByEmail: () => {
        calls.push("find");
        return Promise.resolve([]);
      },
      deleteByEmail: () => {
        calls.push("deleteByEmail");
        return Promise.resolve(0);
      },
      deleteCreatedBefore: () => {
        calls.push("deleteCreatedBefore");
        return Promise.resolve(0);
      },
    };
    const { deps } = setup({ store });

    await runDsr(["delete", ANNA, "--confirm"], deps);
    await runDsr(["delete", ANNA], deps);

    // The purge-by-date method is never reachable from the command line.
    expect(calls).toEqual(["deleteByEmail", "find"]);
  });
});

describe("negative: bad input and failures", () => {
  it.each([
    [[], "no command"],
    [["wipe", ANNA], "unknown command"],
    [["export"], "no address"],
    [["export", "not-an-email"], "not an address"],
    [["export", `${"a".repeat(250)}@example.it`], "address too long"],
    [["delete", ANNA, "--force"], "unknown flag"],
    [["delete", ANNA, "--confirm", "--confirm"], "repeated flag"],
    [["export", ANNA, "--confirm"], "delete's flag on export"],
    [["delete", ANNA, "--out", "x.json"], "export's flag on delete"],
    [["export", ANNA, "--out"], "--out without a file"],
    [["export", ANNA, "extra"], "stray argument"],
  ] as Array<[string[], string]>)(
    "%j (%s) → usage, exit 2, nothing touched",
    async (argv) => {
      const { deps, store, writeFile } = setup();

      const result = await runDsr(argv, deps);

      expect(result.exitCode).toBe(2);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("Usage:");
      expect(store.rows).toHaveLength(3);
      expect(writeFile).not.toHaveBeenCalled();
    },
  );

  it("the usage text names both commands and the receipts rule", () => {
    expect(USAGE).toContain("export <email>");
    expect(USAGE).toContain("delete <email>");
    expect(USAGE).toContain("Consent receipts are kept");
  });

  it("a database error is reported by class only: its message can quote the address", async () => {
    const failing: PrivacyStore = {
      findByEmail: () =>
        Promise.reject(new TypeError(`Failed query with params: ${ANNA}`)),
      deleteByEmail: () =>
        Promise.reject(new TypeError(`Failed query with params: ${ANNA}`)),
      deleteCreatedBefore: () => Promise.resolve(0),
    };
    const { deps } = setup({ store: failing });

    for (const argv of [
      ["export", ANNA],
      ["delete", ANNA],
      ["delete", ANNA, "--confirm"],
    ]) {
      const result = await runDsr(argv, deps);

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("TypeError");
      expect(result.stderr).toContain("Nothing was changed");
      expect(result.stderr).not.toContain(ANNA);
    }
  });
});
