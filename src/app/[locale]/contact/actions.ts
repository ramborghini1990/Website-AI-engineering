"use server";

import { headers } from "next/headers";

import { redirect } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { clientIp } from "@/lib/inquiry/client-ip";
import { processInquiry } from "@/lib/inquiry/process";
import type { SubmitResult } from "@/lib/inquiry/result";
import { getInquiryRuntime } from "@/lib/inquiry/runtime";
import { readFields } from "@/lib/inquiry/schema";
import { logger, newRequestId } from "@/lib/logger";
import { hashIp } from "@/lib/security/rate-limit";

const text = (value: FormDataEntryValue | null): string =>
  typeof value === "string" ? value : "";

function readLocale(value: FormDataEntryValue | null): Locale {
  return (
    routing.locales.find((locale) => locale === value) ?? routing.defaultLocale
  );
}

/**
 * The inquiry form's Server Action: validate → rate-limit → bot check → store
 * → notify (`processInquiry`), then the confirmation page. The form data is
 * never logged. A rejection comes back as a typed result the form shows; only
 * success redirects.
 *
 * Next.js checks the request's Origin against the Host for Server Actions, so
 * a form posted from another site is refused before this runs.
 */
export async function submitInquiry(
  _previous: SubmitResult | { status: "idle" },
  formData: FormData,
): Promise<SubmitResult> {
  const requestId = newRequestId();
  const runtime = getInquiryRuntime();

  if (!runtime.ready || runtime.ipSalt === null) {
    logger.error("inquiry.unavailable", {
      route: "/contact",
      requestId,
      code: "not_configured",
    });
    return { status: "error", code: "unavailable" };
  }

  // The language comes from the form, not from next-intl's request helpers:
  // those resolve the locale through next/root-params, which Next.js does not
  // support inside a Server Action. It only picks the reply language and the
  // confirmation page, so a forged value is harmless: it must be one of ours.
  const locale = readLocale(formData.get("locale"));
  const clientKey = hashIp(clientIp(await headers()), runtime.ipSalt);

  const result = await processInquiry(
    {
      raw: readFields(formData),
      honeypot: text(formData.get("website")),
      turnstileToken: text(formData.get("turnstileToken")) || undefined,
      clientKey,
      locale,
      requestId,
    },
    runtime.deps,
  );

  if (result.status === "success") {
    redirect({ href: "/contact/thanks", locale });
  }
  return result;
}
