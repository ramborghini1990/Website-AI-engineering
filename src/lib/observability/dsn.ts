/**
 * The error-tracker address (P4.5), as pure functions so `env-schema.ts` can
 * validate it and the sink can use it.
 *
 * Only the EU region of Sentry is accepted: a DSN whose host does not end in
 * `.de.sentry.io` (for example `o123.ingest.de.sentry.io`) is refused at build
 * and at start, so error reports cannot be sent to a US ingest host by a
 * copy-paste mistake. The DSN's "public key" is not a secret in Sentry's model
 * (it only allows sending events), but it is still kept out of logs and pages.
 */

/** Hosts under this suffix are Sentry's EU ("de") region. */
export const SENTRY_EU_HOST_SUFFIX = ".de.sentry.io";

export type SentryDsn = {
  /** Where to POST the envelope. */
  endpoint: string;
  /** The DSN's public key, sent in the auth header. */
  key: string;
};

/**
 * `https://<key>@<host>/<project id>` on an EU host, no password, no query.
 * Returns null for anything else (never throws, never echoes the input).
 */
export function parseSentryDsn(dsn: string): SentryDsn | null {
  if (!URL.canParse(dsn)) return null;
  const url = new URL(dsn);
  const projectId = /^\/(\d{1,12})$/.exec(url.pathname)?.[1];
  if (
    url.protocol !== "https:" ||
    url.username === "" ||
    url.password !== "" ||
    url.port !== "" ||
    url.search !== "" ||
    url.hash !== "" ||
    !url.hostname.endsWith(SENTRY_EU_HOST_SUFFIX) ||
    projectId === undefined
  ) {
    return null;
  }
  return {
    endpoint: `https://${url.hostname}/api/${projectId}/envelope/`,
    key: decodeURIComponent(url.username),
  };
}
