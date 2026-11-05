// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  business,
  isValidVatNumber,
  parseBusiness,
  type Business,
} from "@/lib/business";

/**
 * Synthetic data only (CLAUDE.md §10). 12345678903 is the textbook example of a
 * Partita IVA with a correct check digit; it is not a real registration.
 */
const VALID_VAT = "12345678903";

const complete: Business = {
  brand: { name: "Brand Token" },
  owner: { name: "Test Owner" },
  location: {
    street: "Via di Prova 1",
    municipality: "Torino",
    province: "TO",
  },
  vatNumber: VALID_VAT,
  reaNumber: "TO-1234567",
  pec: "owner@pec.example.eu",
};

function failures(input: unknown): string[] {
  try {
    parseBusiness(input);
  } catch (error) {
    return (error as { issues: Array<{ path: PropertyKey[] }> }).issues.map(
      (issue) => issue.path.join("."),
    );
  }
  return [];
}

describe("the shipped configuration", () => {
  it("is valid and has the placeholder brand, the owner and the Turin location", () => {
    expect(business.brand.name).toBe("AI Solutions & Engineering");
    expect(business.owner.name).toBe("Ramin Rashidi Alavijeh");
    expect(business.location).toEqual({
      street: "Corso Regina Margherita",
      municipality: "Torino",
      province: "TO",
    });
  });

  it("invents no fiscal data: Partita IVA, REA and PEC are unset until you have them", () => {
    expect(business.vatNumber).toBeNull();
    expect(business.reaNumber).toBeNull();
    expect(business.pec).toBeNull();
  });
});

describe("parseBusiness", () => {
  it("accepts a fully filled record", () => {
    expect(parseBusiness(complete)).toEqual(complete);
  });

  it("accepts REA as not applicable (false) for legal forms without one", () => {
    expect(parseBusiness({ ...complete, reaNumber: false }).reaNumber).toBe(
      false,
    );
  });

  it.each([
    ["an empty brand name", { brand: { name: "  " } }, "brand.name"],
    ["an empty owner name", { owner: { name: "" } }, "owner.name"],
    [
      "a lowercase province",
      { location: { ...complete.location, province: "to" } },
      "location.province",
    ],
    [
      "a province that is not two letters",
      { location: { ...complete.location, province: "TOR" } },
      "location.province",
    ],
    [
      "a Partita IVA with the wrong length",
      { vatNumber: "1234567890" },
      "vatNumber",
    ],
    [
      "a Partita IVA with a wrong check digit",
      { vatNumber: "12345678900" },
      "vatNumber",
    ],
    ["a Partita IVA with letters", { vatNumber: "1234567890A" }, "vatNumber"],
    [
      "a Partita IVA with the IT prefix",
      { vatNumber: "IT12345678903" },
      "vatNumber",
    ],
    ["an REA without the province", { reaNumber: "1234567" }, "reaNumber"],
    ["a lowercase REA", { reaNumber: "to-1234567" }, "reaNumber"],
    ["an REA that is true", { reaNumber: true }, "reaNumber"],
    ["a PEC that is not an email", { pec: "not-an-email" }, "pec"],
  ])("rejects %s (negative)", (_name, patch, path) => {
    expect(failures({ ...complete, ...patch })).toContain(path);
  });

  it("an error names the field, so a typo fails the build with a clear message", () => {
    expect(() =>
      parseBusiness({ ...complete, vatNumber: "12345678900" }),
    ).toThrow(/Partita IVA/);
  });
});

describe("isValidVatNumber (the Italian check digit)", () => {
  it("accepts numbers whose check digit is right", () => {
    for (const value of [VALID_VAT, "00000000000", "01234567897"]) {
      expect(isValidVatNumber(value), value).toBe(true);
    }
  });

  it("rejects every single-digit change of a valid number (the check digit catches typos)", () => {
    for (let position = 0; position < 11; position++) {
      for (const digit of "0123456789") {
        if (digit === VALID_VAT[position]) continue;
        const typo =
          VALID_VAT.slice(0, position) + digit + VALID_VAT.slice(position + 1);
        expect(isValidVatNumber(typo), typo).toBe(false);
      }
    }
  });

  it("rejects non-numeric and wrong-length input", () => {
    for (const value of [
      "",
      "abc",
      "1234567890",
      "123456789012",
      " 12345678903",
    ]) {
      expect(isValidVatNumber(value), value).toBe(false);
    }
  });
});
