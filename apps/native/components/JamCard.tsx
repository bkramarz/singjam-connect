import { View, Text, TouchableOpacity } from 'react-native';

export type JamItem = {
  id: string;
  name: string | null;
  visibility: string;
  starts_at: string | null;
  ends_at: string | null;
  timezone: string | null;
  neighborhood: string | null;
  notes: string | null;
  image_url: string | null;
  host_id: string | null;
  host_display_name: string | null;
  host_username: string | null;
  genres: string[];
  rsvp_status: string | null;
  invite_status: string | null;
  capacity: number | null;
};

type BadgeStatus = 'attending' | 'waitlist' | 'hosting' | 'invited' | null;

function StatusBadge({ status }: { status: BadgeStatus }) {
  if (status === 'attending') return (
    <View className="px-2 py-0.5 rounded-full bg-green-100">
      <Text className="text-xs font-medium text-green-700">Going</Text>
    </View>
  );
  if (status === 'waitlist') return (
    <View className="px-2 py-0.5 rounded-full bg-blue-100">
      <Text className="text-xs font-medium text-blue-700">Waitlisted</Text>
    </View>
  );
  if (status === 'hosting') return (
    <View className="px-2 py-0.5 rounded-full bg-amber-100">
      <Text className="text-xs font-medium text-amber-700">Hosting</Text>
    </View>
  );
  if (status === 'invited') return (
    <View className="px-2 py-0.5 rounded-full bg-indigo-100">
      <Text className="text-xs font-medium text-indigo-700">Invited</Text>
    </View>
  );
  return null;
}

function DateBox({ startsAt }: { startsAt: string | null }) {
  if (!startsAt) {
    return <View className="w-12 mr-3" />;
  }
  const d = new Date(startsAt);
  const day = d.getDate().toString();
  const month = d.toLocaleString('en', { month: 'short' }).toUpperCase();
  const weekday = d.toLocaleString('en', { weekday: 'short' }).toUpperCase();
  return (
    <View className="w-12 items-center bg-slate-50 rounded-lg py-2 mr-3">
      <Text className="text-slate-400 text-xs font-medium">{weekday}</Text>
      <Text className="text-slate-900 text-xl font-bold leading-tight">{day}</Text>
      <Text className="text-slate-400 text-xs font-medium">{month}</Text>
    </View>
  );
}

function compactTime(startsAt: string | null, timezone: string | null): string | null {
  if (!startsAt) return null;
  return new Date(startsAt).toLocaleString('en-US', {
    timeZone: timezone ?? undefined,
    hour: 'numeric',
    minute: '2-digit',
  });
}

type Props = {
  jam: JamItem;
  myId: string | null;
  onPress: () => void;
  isPast?: boolean;
};

export default function JamCard({ jam, myId, onPress, isPast }: Props) {
  const isHosting = jam.host_id === myId;

  const badgeStatus: BadgeStatus = isHosting ? 'hosting'
    : jam.invite_status === 'pending' ? 'invited'
    : jam.rsvp_status === 'attending' ? 'attending'
    : jam.rsvp_status === 'waitlist' ? 'waitlist'
    : null;

  const timeStr = compactTime(jam.starts_at, jam.timezone);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className={`flex-row px-4 py-3 border-b border-slate-100 ${isPast ? 'opacity-50' : ''}`}
    >
      <DateBox startsAt={jam.starts_at} />

      <View className="flex-1">
        <View className="flex-row items-start justify-between mb-0.5">
          <Text className="flex-1 font-semibold text-slate-900 mr-2" numberOfLines={1}>
            {jam.name ?? 'Jam Session'}
          </Text>
          <StatusBadge status={badgeStatus} />
        </View>

        {!isHosting && jam.host_username ? (
          <Text className="text-slate-400 text-xs mb-0.5">@{jam.host_username}</Text>
        ) : null}

        {timeStr ? (
          <Text className="text-slate-500 text-sm mb-0.5">{timeStr}</Text>
        ) : null}

        {jam.neighborhood ? (
          <Text className="text-slate-400 text-sm" numberOfLines={1}>{jam.neighborhood}</Text>
        ) : null}

        {jam.genres.length > 0 ? (
          <View className="flex-row flex-wrap mt-1 gap-1">
            {jam.genres.slice(0, 3).map(g => (
              <View key={g} className="bg-slate-100 rounded-full px-2 py-0.5">
                <Text className="text-slate-500 text-xs">{g}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}
