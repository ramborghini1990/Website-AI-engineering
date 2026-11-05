import { z } from "zod";

/**
 * Who is behind the site: the ONE place for the brand name, the owner and the
 * statutory details shown in the footer (docs/IDENTITY.md).
 *
 * - `brand.name` is a PLACEHOLDER token until the trade name is decided. Change
 *   it here and every title, heading and footer line follows.
 * - `vatNumber`, `reaNumber` and `pec` are `null` until the fiscal registration
 *   exists. `null` renders a neutral "not yet available" line; nothing is ever
 *   invented. When filled in they are validated (a mistyped Partita IVA fails
 *   the build, not the visitor).
 * - `reaNumber: false` means "not applicable to this legal form" and removes the
 *   row. Whether it applies, and which other disclosures are required, depends
 *   on the legal form: confirm with your accountant (this is not legal advice).
 *
 * Public information, so it lives in code, not in the environment.
 */

/** Italian Partita IVA: 11 digits, the last one a check digit (Luhn-style). */
export function isValidVatNumber(value: string): boolean {
  if (!/^\d{11}$/.test(value)) return false;
  let sum = 0;
  for (let index = 0; index < 10; index++) {
    const digit = Number(value[index]);
    if (index % 2 === 0) {
      sum += digit;
    } else {
      const doubled = digit * 2;
      sum += doubled > 9 ? doubled - 9 : doubled;
    }
  }
  return (10 - (sum % 10)) % 10 === Number(value[10]);
}

const text = z.string().trim().min(1);

const businessSchema = z.object({
  brand: z.object({ name: text }),
  owner: z.object({ name: text }),
  location: z.object({
    street: text,
    municipality: text,
    /** Two-letter provincial code, e.g. TO. */
    province: z
      .string()
      .regex(/^[A-Z]{2}$/, "must be a two-letter code such as TO"),
  }),
  vatNumber: z.union([
    z.null(),
    z
      .string()
      .refine(
        isValidVatNumber,
        "is not a valid Partita IVA (11 digits with a correct check digit)",
      ),
  ]),
  reaNumber: z.union([
    z.null(),
    z.literal(false),
    z.string().regex(/^[A-Z]{2}-\d{1,9}$/, "must look like TO-1234567"),
  ]),
  pec: z.union([z.null(), z.email()]),
});

export type Business = z.infer<typeof businessSchema>;

/** Validate a business record. Throws a ZodError naming the field, never a stack of guesses. */
export function parseBusiness(input: unknown): Business {
  return businessSchema.parse(input);
}

export const business: Business = parseBusiness({
  brand: { name: "AI Solutions & Engineering" },
  owner: { name: "Ramin Rashidi Alavijeh" },
  location: {
    street: "Corso Regina Margherita",
    municipality: "Torino",
    province: "TO",
  },
  vatNumber: null,
  reaNumber: null,
  pec: null,
});
