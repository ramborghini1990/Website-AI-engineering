import type { ComponentProps, ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/** The id of a field's error message, so the control can point at it with aria-describedby. */
const errorId = (id: string) => `${id}-error`;
const hintId = (id: string) => `${id}-hint`;

function describedBy(id: string, hint: boolean, error: boolean) {
  const ids = [hint ? hintId(id) : null, error ? errorId(id) : null].filter(
    (value): value is string => value !== null,
  );
  return ids.length > 0 ? ids.join(" ") : undefined;
}

function FieldError({ id, message }: { id: string; message: string | null }) {
  if (message === null) return null;
  return (
    <p id={errorId(id)} className="text-sm text-danger">
      {message}
    </p>
  );
}

function Hint({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={hintId(id)} className="text-sm text-text-muted">
      {children}
    </p>
  );
}

/** A labelled single-line input: visible label, optional hint, error linked by aria-describedby. */
export function TextField({
  id,
  label,
  hint,
  error,
  ...input
}: {
  id: string;
  label: string;
  hint?: string;
  error: string | null;
} & Omit<ComponentProps<"input">, "id" | "aria-describedby" | "aria-invalid">) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {hint !== undefined ? <Hint id={id}>{hint}</Hint> : null}
      <Input
        id={id}
        aria-invalid={error !== null}
        aria-describedby={describedBy(id, hint !== undefined, error !== null)}
        {...input}
      />
      <FieldError id={id} message={error} />
    </div>
  );
}

export function TextAreaField({
  id,
  label,
  hint,
  error,
  ...input
}: {
  id: string;
  label: string;
  hint?: string;
  error: string | null;
} & Omit<
  ComponentProps<"textarea">,
  "id" | "aria-describedby" | "aria-invalid"
>) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {hint !== undefined ? <Hint id={id}>{hint}</Hint> : null}
      <Textarea
        id={id}
        aria-invalid={error !== null}
        aria-describedby={describedBy(id, hint !== undefined, error !== null)}
        {...input}
      />
      <FieldError id={id} message={error} />
    </div>
  );
}

/**
 * A group of native radio buttons: a fieldset with a legend, so a screen reader
 * announces the question with each option. Native inputs give arrow-key
 * navigation and the selected state for free.
 */
export function ChoiceGroup({
  id,
  name,
  legend,
  hint,
  options,
  value,
  onChange,
  error,
}: {
  id: string;
  name: string;
  legend: string;
  hint?: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  value: string | undefined;
  onChange: (value: string) => void;
  error: string | null;
}) {
  return (
    <fieldset
      id={id}
      className="grid gap-3"
      aria-describedby={describedBy(id, hint !== undefined, error !== null)}
    >
      <legend className="mb-1 text-lg font-medium text-text">{legend}</legend>
      {hint !== undefined ? <Hint id={id}>{hint}</Hint> : null}
      <div className="grid gap-2">
        {options.map((option) => {
          const optionId = `${id}-${option.value}`;
          return (
            <label
              key={option.value}
              htmlFor={optionId}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-3 rounded-sm border px-4 py-2 text-base text-text",
                value === option.value
                  ? "border-accent bg-surface-2"
                  : "border-border-strong hover:border-accent",
              )}
            >
              <input
                id={optionId}
                type="radio"
                name={name}
                value={option.value}
                checked={value === option.value}
                onChange={() => {
                  onChange(option.value);
                }}
                className="size-5 shrink-0 accent-accent"
              />
              {option.label}
            </label>
          );
        })}
      </div>
      <FieldError id={id} message={error} />
    </fieldset>
  );
}
