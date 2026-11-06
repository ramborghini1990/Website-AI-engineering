"use client";

import { useEffect, useRef } from "react";

/**
 * Cloudflare Turnstile, loaded only when this component mounts, i.e. when the
 * visitor reaches the last step of the form: no request to Cloudflare happens
 * on a page view, and none if the form is never completed. Turnstile is the
 * form's security check (docs/GDPR_CHECKLIST.md §5: the `necessary` category
 * only while it protects the form), and Cloudflare is a processor to be named
 * in the privacy notice (P4.2).
 *
 * The CSP allows the origin only when both Turnstile keys are configured
 * (`src/lib/security/csp.ts`), and `strict-dynamic` lets this nonced bundle add
 * the script. The token goes to the form through `onToken`; the server verifies
 * it (`lib/security/turnstile.ts`), the browser only collects it.
 */

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      theme: "auto";
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let loading: Promise<TurnstileApi> | undefined;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile !== undefined) return Promise.resolve(window.turnstile);
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => {
      if (window.turnstile !== undefined) resolve(window.turnstile);
      else reject(new Error("turnstile missing"));
    };
    script.onerror = () => {
      loading = undefined;
      reject(new Error("turnstile blocked"));
    };
    document.head.append(script);
  });
  return loading;
}

export function TurnstileWidget({
  siteKey,
  onToken,
}: {
  siteKey: string;
  onToken: (token: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const onTokenRef = useRef(onToken);

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    let widgetId: string | undefined;
    let cancelled = false;

    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || container.current === null) return;
        widgetId = turnstile.render(container.current, {
          sitekey: siteKey,
          theme: "auto",
          callback: (token) => {
            onTokenRef.current(token);
          },
          "expired-callback": () => {
            onTokenRef.current("");
          },
          "error-callback": () => {
            onTokenRef.current("");
          },
        });
      })
      .catch(() => {
        // Blocked or offline: no token, so the server refuses and the visitor is told to retry.
        onTokenRef.current("");
      });

    return () => {
      cancelled = true;
      if (widgetId !== undefined) window.turnstile?.remove(widgetId);
    };
  }, [siteKey]);

  return <div ref={container} data-turnstile="" />;
}
