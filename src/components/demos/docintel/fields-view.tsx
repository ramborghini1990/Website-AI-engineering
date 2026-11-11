import { useLocale, useTranslations } from "next-intl";
import { useId } from "react";

import { useDocCopy } from "@/components/demos/docintel/use-doc-copy";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { sumCheck, type FieldResult } from "@/lib/demos/docintel/extract";
import { formatValue } from "@/lib/demos/docintel/format";
import { documents, type DocumentId } from "@/lib/demos/docintel/fixtures";
import { cn } from "@/lib/utils";

/** Left bar per status: a token, never the only signal (the status is also written out). */
const TONE = {
  read: "border-l-accent",
  review: "border-l-warning",
  missing: "border-l-danger",
  pending: "border-l-border-strong",
} as const;

/** The labels are sentences: let them wrap on a phone instead of widening the page. */
const WRAPPING_BUTTON = "h-auto max-w-full py-2 text-start whitespace-normal";

function Row({
  doc,
  field,
  result,
  checked,
  onSource,
  onCheck,
}: {
  doc: DocumentId;
  field: string;
  result: FieldResult | undefined;
  checked: boolean;
  onSource: (section: string, page: number) => void;
  onCheck: (field: string, checked: boolean) => void;
}) {
  const t = useTranslations("demos.docIntel.fields");
  const locale = useLocale();
  const { text } = useDocCopy();
  const uid = useId();
  const label = text(`docs.${doc}.fields.${field}`);
  const tone = result === undefined ? "pending" : result.status;

  return (
    <div
      data-field={field}
      data-status={tone}
      className={cn(
        "grid gap-1 border border-l-4 border-border-strong px-4 py-3",
        TONE[tone],
      )}
    >
      <dt id={`${uid}-label`} className="text-sm text-text-muted">
        {label}
      </dt>
      <dd className="min-h-6 text-lg break-words text-text">
        {result?.value ? (
          formatValue(result.value, locale)
        ) : (
          <span className="text-base text-text-muted">
            {result === undefined ? t("pending") : t("reason.missing")}
          </span>
        )}
      </dd>
      <dd className="flex min-h-11 flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-secondary">
        {result && result.status !== "missing" ? (
          <>
            <Button
              type="button"
              variant="tertiary"
              className={WRAPPING_BUTTON}
              aria-describedby={`${uid}-label`}
              onClick={() => {
                onSource(result.section, result.page);
              }}
            >
              {t("source", {
                page: result.page,
                section: text(`docs.${doc}.sections.${result.section}.heading`),
              })}
            </Button>
            <span>
              {result.status === "review" && checked
                ? t("checked")
                : t(`status.${result.status}`)}
            </span>
          </>
        ) : result ? (
          <span>{t("status.missing")}</span>
        ) : null}
      </dd>
      {result?.status === "review" && result.review !== null ? (
        <dd className="grid gap-3 text-base text-text-secondary">
          <span>{t(`reason.${result.review}`)}</span>
          <span className="flex items-center gap-3">
            <Checkbox
              id={`${uid}-check`}
              checked={checked}
              onCheckedChange={(next) => {
                onCheck(field, next === true);
              }}
            />
            <Label htmlFor={`${uid}-check`} className="leading-normal">
              {t("check", { field: label })}
            </Label>
          </span>
        </dd>
      ) : null}
    </div>
  );
}

/**
 * The extracted fields as structured key/value pairs. Every field of the
 * document is listed from the start ("not read yet") so the layout does not
 * move while the reading progresses; a value that was found but is doubtful
 * says why and waits for the person to mark it as checked.
 */
export function FieldsView({
  doc,
  results,
  checked,
  onSource,
  onCheck,
}: {
  doc: DocumentId;
  results: readonly FieldResult[];
  checked: readonly string[];
  onSource: (section: string, page: number) => void;
  onCheck: (field: string, checked: boolean) => void;
}) {
  const t = useTranslations("demos.docIntel.fields");
  const spec = documents[doc];
  const finished = results.length === spec.fields.length;
  const sums = finished ? sumCheck(spec, results) : null;

  return (
    <section
      aria-labelledby="di-fields-title"
      className="grid grid-cols-1 content-start gap-4"
    >
      <h3 id="di-fields-title" className="text-2xl text-text">
        {t("title")}
      </h3>
      <p className="text-sm text-text-muted">{t("hint")}</p>
      <dl className="grid gap-2">
        {spec.fields.map((field) => (
          <Row
            key={field.id}
            doc={doc}
            field={field.id}
            result={results.find((r) => r.id === field.id)}
            checked={checked.includes(field.id)}
            onSource={onSource}
            onCheck={onCheck}
          />
        ))}
      </dl>
      {sums !== null ? (
        <p
          data-sum-check={sums}
          className="border-s-4 border-border-strong ps-4 text-base text-text-secondary"
        >
          {t(
            sums === "ok"
              ? "sumOk"
              : sums === "mismatch"
                ? "sumMismatch"
                : "sumUnavailable",
          )}
        </p>
      ) : null}
    </section>
  );
}
