import Link from "next/link";

type SetCardProps = {
  set: {
    id: string;
    name: string;
    description: string | null;
    owner_user_id: string;
  };
  songCount?: number;
  isOwner?: boolean;
};

export default function SetCard({ set, songCount, isOwner }: SetCardProps) {
  return (
    <Link href={`/set/${set.id}`} className="block">
      <div className="flex overflow-hidden rounded-2xl border border-zinc-200 bg-white transition-colors hover:border-zinc-300">
        <div className="flex-1 min-w-0 p-4">
          <div className="flex items-center gap-2 mb-0.5">
            {isOwner && (
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Owner</span>
            )}
            {!isOwner && (
              <span className="text-xs font-semibold uppercase tracking-wide text-sky-600">Collaborator</span>
            )}
          </div>
          <p className="font-semibold text-zinc-900 truncate">{set.name}</p>
          {set.description && (
            <p className="text-sm text-zinc-500 mt-0.5 truncate">{set.description}</p>
          )}
          {songCount != null && (
            <p className="text-xs text-zinc-400 mt-1">
              {songCount} {songCount === 1 ? "song" : "songs"}
            </p>
          )}
        </div>
        <div className="flex items-center pr-4 text-zinc-300">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </div>
      </div>
    </Link>
  );
}
