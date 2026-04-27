import { Suspense } from "react";
import AccountPanel from "@/components/AccountPanel";

export default function AccountPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Account</h1>
      <Suspense>
        <AccountPanel />
      </Suspense>
    </div>
  );
}
