import { legalMetadata, LegalPage } from "@/lib/legal/page";

export const generateMetadata = () => legalMetadata("privacy");

/** /privacy (P4.2): the privacy notice, art. 13 GDPR. Text: content/legal/<locale>/privacy.mdx. */
export default function PrivacyPage() {
  return <LegalPage docKey="privacy" />;
}
