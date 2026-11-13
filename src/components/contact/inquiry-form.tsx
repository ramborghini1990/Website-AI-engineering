"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
  type SyntheticEvent,
} from "react";

import { submitInquiry } from "@/app/[locale]/contact/actions";
import {
  ChoiceGroup,
  TextAreaField,
  TextField,
} from "@/components/contact/form-fields";
import { TurnstileWidget } from "@/components/contact/turnstile-widget";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import type { SubmitResult } from "@/lib/inquiry/result";
import {
  budgetValues,
  firstStepWithError,
  needValues,
  parseStep,
  stepFields,
  stepIds,
  timelineValues,
  type ErrorCode,
  type FieldErrors,
  type FieldName,
  type RawInquiry,
  type StepId,
} from "@/lib/inquiry/schema";
import { fillPlaceholders } from "@/lib/i18n/placeholders";
import { resolveInternalPath } from "@/lib/navigation";

type FormState = SubmitResult | { status: "idle" };

/**
 * The inquiry form: four steps (need, budget, timeline, your details) in one
 * <form> whose Server Action does the real validation. Each step is checked in
 * the browser first, with the same schema, so a mistake is caught where it was
 * made; the server checks everything again and can send the visitor back to
 * the step with the problem.
 *
 * Accessibility: every field has a visible label; a hint and an error are
 * linked with aria-describedby; a failed step shows an error summary that takes
 * focus; moving between steps moves focus to the step's heading; native radios
 * and a real checkbox, all reachable by keyboard.
 *
 * Values of earlier steps travel as hidden inputs, so the one FormData the
 * action receives holds the whole inquiry. The marketing consent is its own
 * unticked checkbox and never blocks sending.
 */
export function InquiryForm({
  turnstileSiteKey,
  initialNeed,
}: {
  turnstileSiteKey?: string;
  /** Pre-selected need, from `?service=` (a topic, never personal data). */
  initialNeed?: (typeof needValues)[number] | undefined;
}) {
  const t = useTranslations("contact.form");
  const locale = useLocale();
  const uid = useId();

  const [state, formAction, pending] = useActionState<FormState, FormData>(
    submitInquiry,
    { status: "idle" },
  );
  const [seen, setSeen] = useState<FormState>(state);
  const [step, setStep] = useState<StepId>("need");
  const [values, setValues] = useState<RawInquiry>({
    marketingConsent: false,
    ...(initialNeed !== undefined ? { need: initialNeed } : {}),
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [attention, setAttention] = useState(0);
  const [token, setToken] = useState("");

  const heading = useRef<HTMLHeadingElement>(null);
  const alert = useRef<HTMLDivElement>(null);
  const movedBefore = useRef(false);

  // A result from the server arrived: show what it says (render-time update, the documented pattern).
  if (state !== seen) {
    setSeen(state);
    if (state.status === "error") {
      if (state.code === "validation") {
        setErrors(state.fieldErrors);
        const target = firstStepWithError(state.fieldErrors);
        if (target !== null) setStep(target);
      }
      setAttention((count) => count + 1);
    }
  }

  const index = stepIds.indexOf(step);
  const isLast = index === stepIds.length - 1;

  // After a step change, put the focus on the step's heading (not on first render).
  useEffect(() => {
    if (movedBefore.current) heading.current?.focus();
    movedBefore.current = true;
  }, [step]);

  // After a failed check, the summary or failure message takes focus.
  useEffect(() => {
    if (attention > 0) alert.current?.focus();
  }, [attention]);

  const fieldId = (name: FieldName) => `${uid}-${name}`;
  const set = (name: FieldName, value: string | boolean) => {
    setValues((current) => ({ ...current, [name]: value }));
  };

  const message = (name: FieldName): string | null => {
    const code: ErrorCode | undefined = errors[name];
    if (code === undefined) return null;
    if (name === "email" && code === "invalid") return t("errors.emailInvalid");
    if (code === "required" && ["need", "budget", "timeline"].includes(name))
      return t("errors.choose");
    return t(`errors.${code}`);
  };

  // The consent checkbox cannot be invalid, so it has no label for the summary.
  const fieldLabel = (name: FieldName): string =>
    name === "marketingConsent" ? "" : t(`fields.${name}`);

  const goNext = () => {
    const result = parseStep(step, values);
    if (!result.ok) {
      setErrors(result.errors);
      setAttention((count) => count + 1);
      return false;
    }
    setErrors({});
    const following = stepIds.at(index + 1);
    if (following !== undefined) setStep(following);
    return true;
  };

  const onSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    if (pending) {
      event.preventDefault();
      return;
    }
    if (!isLast) {
      event.preventDefault();
      goNext();
      return;
    }
    const result = parseStep("contact", values);
    if (!result.ok) {
      event.preventDefault();
      setErrors(result.errors);
      setAttention((count) => count + 1);
    }
  };

  const goBack = () => {
    setErrors({});
    const previous = index > 0 ? stepIds.at(index - 1) : undefined;
    if (previous !== undefined) setStep(previous);
  };

  const errorFields = (Object.keys(errors) as FieldName[]).filter(
    (name) => errors[name] !== undefined,
  );
  const failure =
    state.status === "error" && state.code !== "validation" ? state : null;

  const privacyTarget = resolveInternalPath("/privacy");

  return (
    <form
      action={formAction}
      onSubmit={onSubmit}
      noValidate
      aria-labelledby={`${uid}-title`}
      className="grid gap-8"
    >
      <h2 id={`${uid}-title`} className="text-3xl text-text">
        {t("title")}
      </h2>

      {/*
        The steps need JavaScript to move between them; without it the visitor
        is told, not left with a button that does nothing useful. Not a <noscript>
        element: React renders no children inside it, so the text would never
        reach the HTML. It is a normal paragraph that is hidden, and shown only
        where scripting is off (`@media (scripting: none)`), so nothing flashes
        or shifts for people who have JavaScript.
      */}
      <p
        data-no-js-notice=""
        className="hidden border border-border-strong p-4 text-base text-text [@media(scripting:none)]:block"
      >
        {t("noscript")}
      </p>

      {/* The page's language, for the reply and the confirmation page; the action checks it is one of ours. */}
      <input type="hidden" name="locale" value={locale} />

      <nav aria-label={t("progressLabel")}>
        <ol className="flex flex-wrap gap-x-6 gap-y-2">
          {stepIds.map((id, position) => (
            <li
              key={id}
              aria-current={id === step ? "step" : undefined}
              className={
                id === step
                  ? "border-b-2 border-accent pb-1 font-mono text-xs text-text uppercase"
                  : "pb-1 font-mono text-xs text-text-muted uppercase"
              }
            >
              {position + 1}. {t(`steps.${id}`)}
            </li>
          ))}
        </ol>
      </nav>

      {errorFields.length > 0 ? (
        <div
          ref={alert}
          role="alert"
          tabIndex={-1}
          className="grid gap-2 border border-danger p-4"
        >
          <p className="font-medium text-text">{t("errors.summaryTitle")}</p>
          <ul className="grid list-disc gap-1 ps-5 text-base text-text-secondary">
            {errorFields.map((name) => (
              <li key={name}>
                {stepFields[step].some((field) => field === name) ? (
                  <a
                    href={`#${fieldId(name)}`}
                    className="text-accent underline underline-offset-4"
                  >
                    {fieldLabel(name)}
                  </a>
                ) : (
                  fieldLabel(name)
                )}
                : {message(name)}
              </li>
            ))}
          </ul>
        </div>
      ) : failure !== null ? (
        <div
          ref={alert}
          role="alert"
          tabIndex={-1}
          className="border border-danger p-4 text-base text-text"
        >
          {failure.code === "rate_limited"
            ? t("failure.rate_limited", {
                minutes: Math.max(1, Math.ceil(failure.retryAfterSec / 60)),
              })
            : t(`failure.${failure.code}`)}
        </div>
      ) : null}

      <div className="grid gap-6">
        <p className="text-sm text-text-muted">
          {/* fillPlaceholders, not t("progress", values): that loads the ICU engine on first render (P4.7, src/lib/i18n/placeholders.ts). */}
          {fillPlaceholders(t.raw("progress") as string, {
            current: index + 1,
            total: stepIds.length,
          })}
        </p>
        <h3
          ref={heading}
          tabIndex={-1}
          className="text-2xl text-text outline-none"
        >
          {t(`steps.${step}`)}
        </h3>

        {step === "need" ? (
          <>
            <ChoiceGroup
              id={fieldId("need")}
              name="need"
              legend={t("need.legend")}
              options={needValues.map((value) => ({
                value,
                label: t(`need.options.${value}`),
              }))}
              value={values.need as string | undefined}
              onChange={(value) => {
                set("need", value);
              }}
              error={message("need")}
            />
            <TextAreaField
              id={fieldId("description")}
              name="description"
              label={t("need.descriptionLabel")}
              hint={t("need.descriptionHint")}
              rows={6}
              value={(values.description as string | undefined) ?? ""}
              onChange={(event) => {
                set("description", event.target.value);
              }}
              error={message("description")}
            />
          </>
        ) : null}

        {step === "budget" ? (
          <ChoiceGroup
            id={fieldId("budget")}
            name="budget"
            legend={t("budget.legend")}
            hint={t("budget.hint")}
            options={budgetValues.map((value) => ({
              value,
              label: t(`budget.options.${value}`),
            }))}
            value={values.budget as string | undefined}
            onChange={(value) => {
              set("budget", value);
            }}
            error={message("budget")}
          />
        ) : null}

        {step === "timeline" ? (
          <ChoiceGroup
            id={fieldId("timeline")}
            name="timeline"
            legend={t("timeline.legend")}
            hint={t("timeline.hint")}
            options={timelineValues.map((value) => ({
              value,
              label: t(`timeline.options.${value}`),
            }))}
            value={values.timeline as string | undefined}
            onChange={(value) => {
              set("timeline", value);
            }}
            error={message("timeline")}
          />
        ) : null}

        {step === "contact" ? (
          <>
            <p className="text-lg text-text-secondary">{t("contact.intro")}</p>
            <TextField
              id={fieldId("name")}
              name="name"
              label={t("contact.nameLabel")}
              autoComplete="name"
              value={(values.name as string | undefined) ?? ""}
              onChange={(event) => {
                set("name", event.target.value);
              }}
              error={message("name")}
            />
            <TextField
              id={fieldId("email")}
              name="email"
              type="email"
              label={t("contact.emailLabel")}
              hint={t("contact.emailHint")}
              autoComplete="email"
              inputMode="email"
              value={(values.email as string | undefined) ?? ""}
              onChange={(event) => {
                set("email", event.target.value);
              }}
              error={message("email")}
            />
            <TextField
              id={fieldId("company")}
              name="company"
              label={t("contact.companyLabel")}
              autoComplete="organization"
              value={(values.company as string | undefined) ?? ""}
              onChange={(event) => {
                set("company", event.target.value);
              }}
              error={message("company")}
            />

            <div className="flex items-start gap-3">
              <Checkbox
                id={fieldId("marketingConsent")}
                checked={values.marketingConsent === true}
                onCheckedChange={(checked) => {
                  set("marketingConsent", checked === true);
                }}
                aria-describedby={`${fieldId("marketingConsent")}-hint`}
              />
              <div className="grid gap-1">
                <Label htmlFor={fieldId("marketingConsent")}>
                  {t("consent.marketing")}
                </Label>
                <p
                  id={`${fieldId("marketingConsent")}-hint`}
                  className="text-sm text-text-muted"
                >
                  {t("consent.marketingHint")}
                </p>
              </div>
            </div>
            {values.marketingConsent === true ? (
              <input type="hidden" name="marketingConsent" value="on" />
            ) : null}

            {turnstileSiteKey !== undefined ? (
              <div className="grid gap-2">
                <p className="text-sm text-text-muted">{t("turnstile")}</p>
                <TurnstileWidget
                  key={attention}
                  siteKey={turnstileSiteKey}
                  onToken={setToken}
                />
                <input type="hidden" name="turnstileToken" value={token} />
              </div>
            ) : null}

            <p className="text-sm text-text-muted">
              {t.rich("privacy", {
                link: (chunks) =>
                  privacyTarget.kind === "page" ? (
                    <Link
                      href={privacyTarget.href}
                      className="text-accent underline underline-offset-4"
                    >
                      {chunks}
                    </Link>
                  ) : (
                    chunks
                  ),
              })}
            </p>
          </>
        ) : null}
      </div>

      {/* Earlier steps' answers travel with the last submit. */}
      {stepIds
        .filter((id) => id !== step)
        .flatMap((id) => stepFields[id])
        .filter((name) => name !== "marketingConsent")
        .map((name) =>
          typeof values[name] === "string" ? (
            <input key={name} type="hidden" name={name} value={values[name]} />
          ) : null,
        )}

      {/* Honeypot: invisible and unfocusable for people; bots that fill every field give themselves away. */}
      <div aria-hidden="true" className="sr-only">
        <label>
          Website
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            defaultValue=""
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        {index > 0 ? (
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={goBack}
            disabled={pending}
          >
            {t("buttons.back")}
          </Button>
        ) : null}
        <Button type="submit" size="lg" disabled={pending} aria-busy={pending}>
          {isLast
            ? pending
              ? t("buttons.sending")
              : t("buttons.submit")
            : t("buttons.next")}
        </Button>
      </div>
    </form>
  );
}
