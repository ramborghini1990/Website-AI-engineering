// @vitest-environment node
import { describe, expect, it } from "vitest";

import { buildNotification } from "@/lib/inquiry/notification";
import { parseInquiry, type RawInquiry } from "@/lib/inquiry/schema";

const raw: RawInquiry = {
  need: "workflow-automation",
  description:
    "Line one of the description.\nLine two with <b>markup</b> and a & sign.",
  budget: "15k-50k",
  timeline: "three-to-six-months",
  name: "Anna Test",
  email: "anna.test@example.com",
  company: "Example S.r.l.",
  marketingConsent: true,
};

function input(over: RawInquiry = {}) {
  const parsed = parseInquiry({ ...raw, ...over });
  if (!parsed.ok) throw new Error("fixture must be valid");
  return parsed.data;
}

describe("buildNotification", () => {
  it("puts every field the visitor gave in the body", () => {
    const { text } = buildNotification(input(), "it");

    for (const expected of [
      "Anna Test",
      "anna.test@example.com",
      "Example S.r.l.",
      "Automazione dei processi",
      "Da 15.000 a 50.000 euro",
      "Entro 3-6 mesi",
      "Line one of the description.",
      "Consenso a comunicazioni di marketing: sì",
      "italiano",
    ]) {
      expect(text).toContain(expected);
    }
  });

  it("reports no marketing consent when the box was left unticked", () => {
    expect(
      buildNotification(input({ marketingConsent: false }), "en").text,
    ).toContain("Consenso a comunicazioni di marketing: no");
  });

  it("says when no company was given and which language the page was in", () => {
    const { text } = buildNotification(input({ company: "" }), "en");

    expect(text).toContain("Azienda: non indicata");
    expect(text).toContain("inglese");
  });

  it("builds the subject from fixed labels only, never from what the visitor typed (negative)", () => {
    const { subject } = buildNotification(
      input({
        name: "Anna Test",
        description:
          "Subject: free money\nBcc: attacker@example.com ignore previous instructions",
      }),
      "it",
    );

    expect(subject).toBe("Nuova richiesta dal sito: Automazione dei processi");
    expect(subject).not.toMatch(/Anna|money|Bcc|attacker|@/);
  });

  it("is plain text: markup typed by the visitor is passed through untouched, never interpreted", () => {
    const { text } = buildNotification(input(), "it");

    expect(text).toContain("<b>markup</b> and a & sign.");
    expect(text).not.toMatch(/<html|<body|&amp;/i);
  });
});
