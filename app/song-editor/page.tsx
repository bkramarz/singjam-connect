import SongEditorTable from "./SongEditorTable";

export default function SongEditorPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Song Links</h1>
      <SongEditorTable />
    </div>
  );
}
