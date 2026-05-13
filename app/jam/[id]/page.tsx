import { Suspense } from "react";
import JamContent from "@/components/JamContent";
import JamLoading from "./loading";

export default function JamPage() {
  return (
    <Suspense fallback={<JamLoading />}>
      <JamContent />
    </Suspense>
  );
}
