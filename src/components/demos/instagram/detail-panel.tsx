import { useTranslations } from "next-intl";
import { useEffect, useId, useRef } from "react";

import {
  CategoryBadge,
  KindIcon,
  useStatusText,
} from "@/components/demos/instagram/parts";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  FACTOR_POINTS,
  type Action,
  type Factor,
} from "@/lib/demos/instagram/analyze";
import type { Decision, ItemState } from "@/lib/demos/instagram/state";

const APPROVE_LABEL = {
  reply: "approveReply",
  "reply-handoff": "approveReplyHandoff",
  "hide-report": "approveHide",
  escalate: "approveEscalate",
} as const satisfies Record<Action, string>;

const FACTORS = Object.keys(FACTOR_POINTS) as Factor[];

/** The labels are sentences: let them wrap on a phone instead of widening the page. */
const WRAPPING_BUTTON = "h-auto max-w-full py-2 text-start whitespace-normal";

/**
 * What the agent decided about the selected item, why, from which sources, and
 * the approval step. Nothing is sent, hidden or handed over until the person
 * presses the approve button; "discard" keeps the item as it is. The text of the
 * message and the draft are shown as plain text (a textarea), never as HTML.
 */
export function DetailPanel({
  item,
  onEdit,
  onDecide,
}: {
  item: ItemState;
  onEdit: (id: string, draft: string) => void;
  onDecide: (id: string, decision: Decision) => void;
}) {
  const t = useTranslations("demos.instagram");
  const uid = useId();
  const status = useStatusText(item);
  const outcome = useRef<HTMLParagraphElement>(null);
  const decided = item.decision !== null;
  const { analysis } = item;

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
        <p className="flex items-center gap-2 text-base text-text-secondary">
          <KindIcon kind={item.kind} />
          {t("detail.from", { handle: item.handle })}
          <span className="sr-only">
            {item.kind === "dm" ? t("inbox.dmLabel") : t("inbox.commentLabel")}
          </span>
        </p>
        <blockquote className="border-s-4 border-border-strong ps-4 text-lg whitespace-pre-wrap text-text">
          {item.text}
        </blockquote>
      </div>

      {analysis === null ? (
        <p className="text-base text-text-muted">{t("detail.unanalyzed")}</p>
      ) : (
        <>
          <dl className="grid gap-4">
            <div className="grid gap-1">
              <dt className="text-sm text-text-muted">
                {t("detail.category")}
              </dt>
              <dd>
                <CategoryBadge category={analysis.category} />
              </dd>
            </div>
            <div className="grid gap-1">
              <dt className="text-sm text-text-muted">{t("detail.why")}</dt>
              <dd>
                <ul className="grid list-disc gap-1 ps-5 text-base text-text-secondary">
                  {analysis.signals.map((signal) => (
                    <li key={signal}>{t(`signals.${signal}`)}</li>
                  ))}
                </ul>
              </dd>
            </div>
            <div className="grid gap-1">
              <dt className="text-sm text-text-muted">
                {t("detail.proposal")}
              </dt>
              <dd className="text-base text-text">
                {t(`action.${analysis.action}`)}
              </dd>
            </div>
          </dl>

          {analysis.score !== null ? (
            <div className="grid gap-3">
              <h4 className="text-lg text-text">{t("detail.score")}</h4>
              <p className="flex flex-wrap items-center gap-3 text-base text-text">
                <span className="font-mono text-2xl">
                  {t("detail.scoreOf", { score: analysis.score })}
                </span>
                {analysis.bucket !== null ? (
                  <span className="border border-border-strong px-2 py-0.5 text-sm">
                    {t(`bucket.${analysis.bucket}`)}
                  </span>
                ) : null}
              </p>
              <meter
                min={0}
                max={100}
                value={analysis.score}
                aria-label={t("detail.score")}
                className="h-3 w-full accent-accent"
              />
              <table className="w-full max-w-md text-start text-base">
                <caption className="pb-2 text-start text-sm text-text-muted">
                  {t("detail.breakdown")}
                </caption>
                <tbody>
                  {FACTORS.map((factor) => {
                    const present = analysis.factors.includes(factor);
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
                          {t(`signals.${factor}`)}
                        </th>
                        <td className="py-2 text-end font-mono text-text">
                          {present ? `+${String(FACTOR_POINTS[factor])}` : "0"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}

          <div className="grid gap-3">
            <h4 className="text-lg text-text">{t("detail.sources")}</h4>
            {analysis.sources.length > 0 ? (
              <ul className="grid gap-2">
                {analysis.sources.map((source) => (
                  <li
                    key={source}
                    className="grid gap-1 border border-border-subtle p-3"
                  >
                    <span className="font-medium text-text">
                      {t(`kb.${source}.title`)}
                    </span>
                    <span className="text-base text-text-secondary">
                      {t(`kb.${source}.answer`)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-base text-text-muted">
                {t("detail.sourcesNone")}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            {item.draft !== null ? (
              <>
                <Label htmlFor={`${uid}-draft`}>{t("detail.draftLabel")}</Label>
                <Textarea
                  id={`${uid}-draft`}
                  rows={6}
                  value={item.draft}
                  readOnly={decided}
                  onChange={(event) => {
                    onEdit(item.id, event.target.value);
                  }}
                />
              </>
            ) : (
              <p className="text-base text-text-muted">{t("detail.noDraft")}</p>
            )}
          </div>

          <div className="grid gap-3 border-t border-border-strong pt-6">
            <h4 className="text-lg text-text">{t("decision.title")}</h4>
            {!decided ? (
              <>
                <p className="text-base text-text-secondary">
                  {t("decision.waiting")}
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    className={WRAPPING_BUTTON}
                    onClick={() => {
                      onDecide(item.id, "approved");
                    }}
                  >
                    {t(`decision.${APPROVE_LABEL[analysis.action]}`)}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className={WRAPPING_BUTTON}
                    onClick={() => {
                      onDecide(item.id, "rejected");
                    }}
                  >
                    {t("decision.reject")}
                  </Button>
                </div>
              </>
            ) : (
              <p
                ref={outcome}
                tabIndex={-1}
                className="grid gap-1 text-base text-text outline-none"
              >
                <span className="font-medium">{status}</span>
                {item.decision === "approved" ? (
                  <span className="text-text-secondary">
                    {t("decision.simulated")}
                  </span>
                ) : null}
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
