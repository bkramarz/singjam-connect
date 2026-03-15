"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

function AuthCallbackInner() {
    const router = useRouter();
    const params = useSearchParams();
    const supabase = supabaseBrowser();
    const [status, setStatus] = useState("Signing you in...");

    useEffect(() => {
        async function run() {
            const code = params.get("code");
            const rawNext = params.get("next") ?? "";
            // Only allow relative internal paths — prevent open redirect
            const next = /^\/[^/]/.test(rawNext) ? rawNext : "/onboarding";

            // If there's a code, exchange it for a session
            if (code) {
                const { error } = await supabase.auth.exchangeCodeForSession(code);
                if (error) {
                    setStatus(`Sign-in failed: ${error.message}`);
                    // fall back to auth page
                    setTimeout(() => router.replace("/auth"), 1200);
                    return;
                }
            }

            // If session already exists, just proceed
            router.replace(next);
        }

        run();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="mx-auto max-w-md rounded-2xl border border-zinc-200 p-6 shadow-sm">
            <div className="text-sm text-zinc-700">{status}</div>
        </div>
    );
}

export default function AuthCallbackPage() {
    return (
        <Suspense>
            <AuthCallbackInner />
        </Suspense>
    );
}
