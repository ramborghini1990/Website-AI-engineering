import type { Kind } from "@/lib/demos/instagram/analyze";

/**
 * The sample inbox of the fictional profile. Everything here is invented:
 * handles end in `.demo`, domains are the reserved `.example`, no real person,
 * brand or account is meant. The texts are in the messages
 * (`demos.instagram.items.<id>.text`) so they exist in both languages.
 */

export type InboxFixture = { id: FixtureId; kind: Kind; handle: string };

export const fixtureIds = [
  "shipping",
  "hotel",
  "order",
  "sizing",
  "spam",
  "shop",
  "injection",
  "damaged",
  "price",
  "embroidery",
  "hours",
  "follow",
] as const;
export type FixtureId = (typeof fixtureIds)[number];

export const fixtures: readonly InboxFixture[] = [
  { id: "shipping", kind: "dm", handle: "@marta.demo" },
  { id: "hotel", kind: "dm", handle: "@hotel.collina.demo" },
  { id: "order", kind: "dm", handle: "@giulia.demo" },
  { id: "sizing", kind: "comment", handle: "@paolo.demo" },
  { id: "spam", kind: "dm", handle: "@promo.win.demo" },
  { id: "shop", kind: "dm", handle: "@negozio.nord.demo" },
  { id: "injection", kind: "dm", handle: "@bot.test.demo" },
  { id: "damaged", kind: "dm", handle: "@sara.demo" },
  { id: "price", kind: "comment", handle: "@andrea.demo" },
  { id: "embroidery", kind: "dm", handle: "@elena.demo" },
  { id: "hours", kind: "dm", handle: "@luca.demo" },
  { id: "follow", kind: "comment", handle: "@follow4follow.demo" },
];
