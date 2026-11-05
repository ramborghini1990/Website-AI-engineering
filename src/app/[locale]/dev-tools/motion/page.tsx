import type { Metadata } from "next";

import { MotionDemo } from "./motion-demo";

export const metadata: Metadata = {
  title: "Motion test page (dev)",
  robots: { index: false, follow: false },
};

export default function MotionTestPage() {
  return <MotionDemo />;
}
