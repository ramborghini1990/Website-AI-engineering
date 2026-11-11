import { useTranslations } from "next-intl";
import { useEffect, useId, useRef } from "react";

import { useStatusText, VerdictBadge } from "@/components/demos/linkedin/parts";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MAX_DRAFT_LENGTH } from "@/lib/demos/linkedin/draft";
import { FACTOR_POINTS, type Factor } from "@/lib/demos/linkedin/qualify";
import {
  isOpenDraft,
  slotInfo,
  type ItemState,
} from "@/lib/demos/linkedin/state";

const FACTORS = Object.keys(FACTOR_POINTS) as Factor[];

/** The labels are sentences: let them wrap on a phone instead of widening the page. */
const WRAPPING_BUTTON = "h-auto max-w-full py-2 text-start whitespace-normal";

/**
 * The research card, the agent's proposal, the draft and the approval gate for
 * the selected prospect. The gate has three steps the person cannot skip: read
 * (and edit) the message, confirm they read it, approve. The approve button
 * stays disabled until the confirmation, and editing takes the confirmation
 * back. Only one prospect is approved per click: there is no "approve all". The
 * message is shown as plain text (a textarea), never as HTML.
 */
export function ProspectDetail({
  item,
  onEdit,
  onReview,
  onApprove,
  onDiscard,
}: {
  item: ItemState;
  onEdit: (id: ItemState["id"], draft: string) => void;
  onReview: (id: ItemState["id"], reviewed: boolean) => void;
  onApprove: (id: ItemState["id"]) => void;
  onDiscard: (id: ItemState["id"]) => void;
}) {
  const t = useTranslations("demos.linkedin");
  const uid = useId();
  const status = useStatusText(item);
  const outcome = useRef<HTMLParagraphElement>(null);
  const decided = item.decision !== null;
  const { research } = item;
  const open = isOpenDraft(item);

  // After the person decides, focus the outcome so the result is read out and the buttons that vanished leave no gap.
  useEffect(() => {
    if (decided) outcome.current?.focus();
  }, [decided, item.id]);

  return (
    <section
      aria-labelledby={`${uid}-title`}
      className="grid grid-cols-1 content-start gap-6 border border-border-strong p-6"
    >
      <div className="grid gap-2">
        <h3 id={`${uid}-title`} className="text-2xl text-text">
          {t("detail.title")}
        </h3>
        <p className="text-sm text-text-muted">{t("prospects.synthetic")}</p>
      </div>

      <dl className="grid gap-4 sm:grid-cols-2">
        <Fact label={t("detail.name")} value={t(`items.${item.id}.name`)} />
        <Fact label={t("detail.role")} value={t(`items.${item.id}.title`)} />
        <Fact
          label={t("detail.company")}
          value={t(`items.${item.id}.company`)}
        />
        <Fact label={t("detail.place")} value={t(`items.${item.id}.place`)} />
        <Fact label={t("detail.sector")} value={t(`sector.${item.sector}`)} />
        <Fact
          label={t("detail.size")}
          value={t("detail.employees", { count: item.employees })}
        />
      </dl>

      {research === null ? (
        <p className="text-base text-text-muted">{t("detail.unresearched")}</p>
      ) : (
        <>
          <div className="grid gap-3">
            <h4 className="text-lg text-text">{t("detail.summary")}</h4>
            <p className="text-base text-text-secondary">
              {t("detail.summaryText", {
                company: t(`items.${item.id}.company`),
                about: t(`items.${item.id}.about`),
              })}
            </p>
            <p className="text-base text-text-secondary">
              {item.news !== null
                ? t("detail.newsText", {
                    company: t(`items.${item.id}.company`),
                    signal: t(`news.${item.news}`),
                  })
                : t("detail.newsNone")}
            </p>
            <p className="text-sm text-text-muted">{t("detail.origin")}</p>
          </div>

          <div className="grid gap-3">
            <h4 className="text-lg text-text">{t("detail.fit")}</h4>
            <p className="flex flex-wrap items-center gap-3 text-base text-text">
              <VerdictBadge verdict={research.verdict} />
              {research.score !== null ? (
                <span className="font-mono text-2xl">
                  {t("detail.scoreOf", { score: research.score })}
                </span>
              ) : null}
            </p>
            <p className="text-base text-text">
              <span className="text-text-muted">{t("detail.proposal")}: </span>
              {t(`propose.${research.verdict}`)}
            </p>
            {research.score !== null ? (
              <>
                <meter
                  min={0}
                  max={100}
                  value={research.score}
                  aria-label={t("detail.fit")}
                  className="h-3 w-full accent-accent"
                />
                <table className="w-full max-w-md text-start text-base">
                  <caption className="pb-2 text-start text-sm text-text-muted">
                    {t("detail.breakdown")}
                  </caption>
                  <tbody>
                    {FACTORS.map((factor) => {
                      const present = research.factors.includes(factor);
                      return (
                        <tr
                          key={factor}
                          className="border-t border-border-subtle"
                        >
                          <th
                            scope="row"
                            className={
                              present
                                ? "py-2 text-start font-normal text-text"
                                : "py-2 text-start font-normal text-text-muted"
                            }
                          >
                            {t(`factor.${factor}`)}
                          </th>
                          <td className="py-2 text-end font-mono text-text">
                            {present
                              ? `+${String(FACTOR_POINTS[factor])}`
                              : "0"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </>
            ) : (
              <p className="text-base text-text-secondary">
                {t("detail.blockedNote")}
              </p>
            )}
          </div>

          {item.draft !== null ? (
            <div className="grid gap-2">
              <Label htmlFor={`${uid}-draft`}>{t("detail.draftLabel")}</Label>
              <Textarea
                id={`${uid}-draft`}
                rows={10}
                maxLength={MAX_DRAFT_LENGTH}
                value={item.draft}
                readOnly={decided}
                aria-describedby={`${uid}-count`}
                onChange={(event) => {
                  onEdit(item.id, event.target.value);
                }}
              />
              <p id={`${uid}-count`} className="text-sm text-text-muted">
                {t("detail.draftCount", {
                  count: item.draft.length,
                  max: MAX_DRAFT_LENGTH,
                })}
              </p>
            </div>
          ) : (
            <p className="text-base text-text-muted">{t("detail.noDraft")}</p>
          )}

          {research.verdict === "draft" ? (
            <div className="grid gap-4 border-t border-border-strong pt-6">
              <h4 className="text-lg text-text">{t("gate.title")}</h4>
              {!decided ? (
                <>
                  <p className="text-base text-text-secondary">
                    {t("gate.waiting")}
                  </p>
                  <ol className="grid list-decimal gap-1 ps-5 text-base text-text-secondary">
                    <li>{t("gate.step1")}</li>
                    <li>{t("gate.step2")}</li>
                    <li>{t("gate.step3")}</li>
                  </ol>
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id={`${uid}-read`}
                      checked={item.reviewed}
                      disabled={!open}
                      onCheckedChange={(checked) => {
                        onReview(item.id, checked === true);
                      }}
                    />
                    <Label htmlFor={`${uid}-read`} className="leading-normal">
                      {t("gate.confirm")}
                    </Label>
                  </div>
                  <p id={`${uid}-hint`} className="text-sm text-text-muted">
                    {item.reviewed ? t("gate.ready") : t("gate.needConfirm")}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      className={WRAPPING_BUTTON}
                      disabled={!open || !item.reviewed}
                      aria-describedby={`${uid}-hint`}
                      onClick={() => {
                        onApprove(item.id);
                      }}
                    >
                      {t("gate.approve")}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className={WRAPPING_BUTTON}
                      onClick={() => {
                        onDiscard(item.id);
                      }}
                    >
                      {t("gate.discard")}
                    </Button>
                  </div>
                </>
              ) : (
                <p
                  ref={outcome}
                  tabIndex={-1}
                  className="grid gap-1 text-base text-text outline-none"
                >
                  <span className="font-medium">
                    {item.decision === "scheduled"
                      ? t("gate.scheduled", slotInfo(item.slot ?? 1))
                      : status}
                  </span>
                  {item.decision === "scheduled" ? (
                    <span className="text-text-secondary">
                      {t("gate.simulated")}
                    </span>
                  ) : null}
                </p>
              )}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <dt className="text-sm text-text-muted">{label}</dt>
      <dd className="text-base text-text">{value}</dd>
    </div>
  );
}
