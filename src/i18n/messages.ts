import type it from "../../messages/it.json";

/**
 * The shape every locale file must have. Italian is the source: a key used in
 * code but missing here fails `pnpm typecheck` (via the AppConfig augmentation
 * in ./next-intl.d.ts), and `messages.test.ts` proves en.json has exactly the
 * same shape.
 */
export type Messages = typeof it;
