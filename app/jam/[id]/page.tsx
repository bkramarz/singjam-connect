import { Suspense } from "react";
import JamContent from "@/components/JamContent";

export default function JamPage() {
  return (
    <Suspense>
      <JamContent />
    </Suspense>
  );
}
