"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import OnboardingForm from "@/components/OnboardingForm";

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = supabaseBrowser();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.auth.getSession();
      const session = data.session;

      if (!session) {
        router.replace("/auth");
        return;
      }

      const { data: prof } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .maybeSingle();

      setProfile(prof ?? null);
      setLoading(false);
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return <div className="text-sm text-zinc-600">Loading…</div>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Set up your profile</h1>
      <p className="text-sm text-zinc-600">
        Bay Area only for now. Your exact address stays private.
      </p>
      <OnboardingForm initialProfile={profile} />
    </div>
  );
}