import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { business as defaultBusiness, type Business } from "@/lib/business";
import {
  processors as defaultProcessors,
  storedKeys as defaultStoredKeys,
  thirdParties as defaultThirdParties,
  type Processor,
  type StoredKey,
  type ThirdParty,
} from "@/lib/consent/registry";

/**
 * The tables of the cookie policy and the privacy notice. They are PRINTED from
 * `src/lib/consent/registry.ts`, never typed: a key or a service added to the
 * registry shows up here, and `legal-structure.test.ts` fails if the code uses
 * one the registry (or the messages) does not know.
 *
 * Semantics: a real <table> with a caption and column headers; the first cell of
 * a row is its row header. The wrapper scrolls sideways on a narrow screen and
 * is a focusable, labelled region, so a keyboard user can scroll it (WCAG 2.1.1)
 * and the page itself never scrolls sideways.
 */

const headClass =
  "border-b border-border-strong px-4 py-3 text-start align-bottom font-mono text-xs font-normal text-text-muted uppercase";
const cellClass =
  "border-b border-border-subtle px-4 py-3 align-top text-sm text-text-secondary";
const rowHeadClass =
  "border-b border-border-subtle px-4 py-3 text-start align-top font-mono text-sm font-normal text-text";

function TableFrame({
  caption,
  children,
}: {
  caption: string;
  children: ReactNode;
}) {
  return (
    <div
      role="region"
      aria-label={caption}
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scrollable region must be reachable by keyboard
      tabIndex={0}
      className="mt-6 overflow-x-auto border border-border-subtle"
    >
      <table className="w-full min-w-176 border-collapse">
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

/** Every cookie and every browser-storage key the site writes. */
export function StorageTable({
  keys = defaultStoredKeys,
}: {
  keys?: readonly StoredKey[];
}) {
  const t = useTranslations("legal");

  return (
    <TableFrame caption={t("tables.storage.caption")}>
      <thead>
        <tr>
          <th scope="col" className={headClass}>
            {t("tables.storage.columns.name")}
          </th>
          <th scope="col" className={headClass}>
            {t("tables.storage.columns.kind")}
          </th>
          <th scope="col" className={headClass}>
            {t("tables.storage.columns.provider")}
          </th>
          <th scope="col" className={headClass}>
            {t("tables.storage.columns.category")}
          </th>
          <th scope="col" className={headClass}>
            {t("tables.storage.columns.purpose")}
          </th>
          <th scope="col" className={headClass}>
            {t("tables.storage.columns.duration")}
          </th>
        </tr>
      </thead>
      <tbody>
        {keys.map((key) => (
          <tr key={key.name} data-storage-key={key.name}>
            <th scope="row" className={rowHeadClass}>
              {key.name}
            </th>
            <td className={cellClass}>
              {t(`tables.storage.kinds.${key.kind}`)}
            </td>
            <td className={cellClass}>{t("tables.storage.firstParty")}</td>
            <td className={cellClass}>
              {t(`tables.storage.categories.${key.category}`)}
            </td>
            <td className={cellClass}>{t(`storage.${key.name}.purpose`)}</td>
            <td className={cellClass}>{t(`storage.${key.name}.duration`)}</td>
          </tr>
        ))}
      </tbody>
    </TableFrame>
  );
}

/** Content from other companies that the visitor can allow in the banner. */
export function ThirdPartiesTable({
  parties = defaultThirdParties,
}: {
  parties?: readonly ThirdParty[];
}) {
  const t = useTranslations("legal");

  return (
    <TableFrame caption={t("tables.thirdParties.caption")}>
      <thead>
        <tr>
          <th scope="col" className={headClass}>
            {t("tables.thirdParties.columns.provider")}
          </th>
          <th scope="col" className={headClass}>
            {t("tables.thirdParties.columns.category")}
          </th>
          <th scope="col" className={headClass}>
            {t("tables.thirdParties.columns.purpose")}
          </th>
          <th scope="col" className={headClass}>
            {t("tables.thirdParties.columns.loads")}
          </th>
          <th scope="col" className={headClass}>
            {t("tables.thirdParties.columns.data")}
          </th>
        </tr>
      </thead>
      <tbody>
        {parties.map((party) => (
          <tr key={party.id} data-third-party={party.id}>
            <th scope="row" className={rowHeadClass}>
              {party.provider}
            </th>
            <td className={cellClass}>
              {t(`tables.thirdParties.categories.${party.category}`)}
            </td>
            <td className={cellClass}>
              {t(`thirdParties.${party.id}.purpose`)}
            </td>
            <td className={cellClass}>
              {t(`tables.thirdParties.triggers.${party.trigger}`)}
            </td>
            <td className={cellClass}>{t(`thirdParties.${party.id}.data`)}</td>
          </tr>
        ))}
      </tbody>
    </TableFrame>
  );
}

/** Every service that can receive a visitor's data, and when. */
export function ProcessorsTable({
  list = defaultProcessors,
}: {
  list?: readonly Processor[];
}) {
  const t = useTranslations("legal");

  return (
    <TableFrame caption={t("tables.processors.caption")}>
      <thead>
        <tr>
          <th scope="col" className={headClass}>
            {t("tables.processors.columns.name")}
          </th>
          <th scope="col" className={headClass}>
            {t("tables.processors.columns.role")}
          </th>
          <th scope="col" className={headClass}>
            {t("tables.processors.columns.when")}
          </th>
          <th scope="col" className={headClass}>
            {t("tables.processors.columns.data")}
          </th>
          <th scope="col" className={headClass}>
            {t("tables.processors.columns.location")}
          </th>
        </tr>
      </thead>
      <tbody>
        {list.map((processor) => (
          <tr key={processor.id} data-processor={processor.id}>
            <th scope="row" className={rowHeadClass}>
              {processor.name}
            </th>
            <td className={cellClass}>
              <span className="font-medium text-text">
                {t(`tables.processors.roles.${processor.role}`)}
              </span>
              <br />
              {t(`processors.${processor.id}.purpose`)}
            </td>
            <td className={cellClass}>
              {t(`tables.processors.whens.${processor.when}`)}
            </td>
            <td className={cellClass}>
              {t(`processors.${processor.id}.data`)}
            </td>
            <td className={cellClass}>
              {t(`processors.${processor.id}.location`)}
            </td>
          </tr>
        ))}
      </tbody>
    </TableFrame>
  );
}

/** Who is behind the site: the same record the footer prints (`src/lib/business.ts`). */
export function BusinessDetails({
  business = defaultBusiness,
}: {
  business?: Business;
}) {
  const t = useTranslations("footer");
  const pending = (
    <span data-status="pending" className="text-text-muted italic">
      {t("pending")}
    </span>
  );
  const rows: Array<[string, ReactNode]> = [
    [t("owner"), business.owner.name],
    [
      t("location"),
      t("address", {
        street: business.location.street,
        municipality: business.location.municipality,
        province: business.location.province,
      }),
    ],
    [t("vat"), business.vatNumber ?? pending],
    ...(business.reaNumber === false
      ? []
      : ([[t("rea"), business.reaNumber ?? pending]] as Array<
          [string, ReactNode]
        >)),
    [t("pec"), business.pec ?? pending],
  ];

  return (
    <dl className="mt-6 grid gap-4 border-t border-border-strong pt-6">
      {rows.map(([term, value]) => (
        <div key={term} className="grid gap-1">
          <dt className="font-mono text-xs text-text-muted uppercase">
            {term}
          </dt>
          <dd className="text-base text-text">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
