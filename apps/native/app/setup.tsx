import { useRouter } from 'expo-router';
import ProfileForm from '@/components/ProfileForm';

export default function SetupScreen() {
  const router = useRouter();
  return (
    <ProfileForm
      title="Set up your profile"
      subtitle="Tell us a bit about yourself."
      submitLabel="Save and continue"
      onSave={() => router.replace('/(tabs)')}
    />
  );
}
