import JamsContent from "@/components/JamsContent";

export default function JamsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Jams</h1>
        <p className="text-sm text-zinc-500">Browse open jams or post your own.</p>
      </div>
      <JamsContent />
    </div>
  );
}
