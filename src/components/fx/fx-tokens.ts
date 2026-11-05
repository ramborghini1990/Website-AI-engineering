/**
 * Strengths of the FX layers that sit behind or over content. They live in one
 * place because `fx-contrast.test.ts` proves text stays readable at exactly
 * these values in both themes (docs/DESIGN.md §2).
 */

/** Peak opacity of each accent blob of `GradientMesh` (a fade from this to transparent). */
export const meshOpacity = { a: 0.05, b: 0.05, c: 0.04 } as const;

/** Peak opacity of the glow that follows the cursor over a `SpotlightCard` surface. */
export const spotlightSurfaceOpacity = 0.08;
