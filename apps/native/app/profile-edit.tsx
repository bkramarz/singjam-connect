import { useRouter } from 'expo-router';
import ProfileForm from '@/components/ProfileForm';

export default function ProfileEditScreen() {
  const router = useRouter();
  return (
    <ProfileForm
      title="Edit Profile"
      subtitle="Update your details below."
      submitLabel="Save"
      onSave={() => router.back()}
    />
  );
}
