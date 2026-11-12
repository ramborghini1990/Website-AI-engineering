import { legalMetadata, LegalPage } from "@/lib/legal/page";

export const generateMetadata = () => legalMetadata("terms");

/** /terms (P4.2): terms for the demos (AI disclosure, simulation, no reliance). */
export default function TermsPage() {
  return <LegalPage docKey="terms" />;
}
