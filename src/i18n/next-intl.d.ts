import type { Messages } from "@/i18n/messages";
import type { Locale } from "@/i18n/routing";

// Type-safe locales and message keys: `t("does.not.exist")` is a type error.
declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: Messages;
  }
}
