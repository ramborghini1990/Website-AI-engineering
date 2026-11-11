import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MAX_TEXT_LENGTH } from "@/lib/demos/instagram/analyze";

/**
 * "Try your own message": the visitor types a sample direct message and the same
 * rules classify it. The text never leaves the page (no request, no storage);
 * it is shown back as plain text. Capped at 280 characters.
 */
export function TryIt({ onSubmit }: { onSubmit: (text: string) => void }) {
  const t = useTranslations("demos.instagram.try");
  const uid = useId();
  const [value, setValue] = useState("");
  const [error, setError] = useState<"empty" | "tooLong" | null>(null);

  return (
    <section aria-labelledby={`${uid}-title`} className="grid max-w-3xl gap-4">
      <h3 id={`${uid}-title`} className="text-2xl text-text">
        {t("title")}
      </h3>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const text = value.trim();
          if (text.length < 3) {
            setError("empty");
            return;
          }
          if (text.length > MAX_TEXT_LENGTH) {
            setError("tooLong");
            return;
          }
          setError(null);
          onSubmit(text);
          setValue("");
        }}
        className="grid gap-3"
      >
        <Label htmlFor={`${uid}-text`}>{t("label")}</Label>
        <p id={`${uid}-hint`} className="text-sm text-text-muted">
          {t("hint")}
        </p>
        <Textarea
          id={`${uid}-text`}
          rows={3}
          maxLength={MAX_TEXT_LENGTH + 50}
          value={value}
          aria-invalid={error !== null}
          aria-describedby={
            error !== null ? `${uid}-hint ${uid}-error` : `${uid}-hint`
          }
          onChange={(event) => {
            setValue(event.target.value);
            if (error !== null) setError(null);
          }}
        />
        {error !== null ? (
          <p id={`${uid}-error`} className="text-sm text-danger">
            {t(error)}
          </p>
        ) : null}
        <div>
          <Button type="submit" variant="secondary">
            {t("submit")}
          </Button>
        </div>
      </form>
    </section>
  );
}
