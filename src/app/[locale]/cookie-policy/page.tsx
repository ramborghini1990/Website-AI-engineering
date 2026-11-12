import { legalMetadata, LegalPage } from "@/lib/legal/page";

export const generateMetadata = () => legalMetadata("cookie-policy");

/** /cookie-policy (P4.2): the tables are printed from the consent registry. */
export default function CookiePolicyPage() {
  return <LegalPage docKey="cookie-policy" />;
}
