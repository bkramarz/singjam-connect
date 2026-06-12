export const SINGING_LABEL: Record<string, string> = {
  lead: "Lead vocals",
  backup: "Backup vocals",
  none: "Doesn't sing",
};

export function voiceBadgeClass(voice: "lead" | "backup" | null): string {
  if (voice === "lead") return "bg-amber-50 border-amber-200 text-amber-700";
  if (voice === "backup") return "bg-violet-50 border-violet-200 text-violet-700";
  return "bg-zinc-50 border-zinc-200 text-zinc-600";
}
