import { legalMetadata, LegalPage } from "@/lib/legal/page";

export const generateMetadata = () => legalMetadata("legal");

/** /legal (P4.2): legal notice / imprint. The business details come from src/lib/business.ts. */
export default function LegalNoticePage() {
  return <LegalPage docKey="legal" />;
}
