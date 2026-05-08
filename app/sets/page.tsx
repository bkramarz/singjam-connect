import SetsContent from "@/components/SetsContent";

export default function SetsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Sets</h1>
        <p className="text-sm text-zinc-500">Curate ordered song lists for your performances.</p>
      </div>
      <SetsContent />
    </div>
  );
}
