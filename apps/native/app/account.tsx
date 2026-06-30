import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { Stack } from 'expo-router';
import { supabase } from '@/lib/supabase';

type Section = 'none' | 'email' | 'password';

export default function AccountScreen() {
  const [open, setOpen] = useState<Section>('none');

  // Email change state
  const [newEmail, setNewEmail] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordDone, setPasswordDone] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  function openSection(section: Section) {
    setOpen(section);
    setEmailError(null);
    setPasswordError(null);
    setEmailSent(false);
    setPasswordDone(false);
    setNewEmail('');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  }

  async function handleChangeEmail() {
    setEmailError(null);
    const trimmed = newEmail.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      setEmailError('Enter a valid email address.');
      return;
    }
    setEmailSaving(true);
    const { error } = await supabase.auth.updateUser({ email: trimmed });
    setEmailSaving(false);
    if (error) { setEmailError(error.message); return; }
    setEmailSent(true);
  }

  async function handleChangePassword() {
    setPasswordError(null);
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    setPasswordSaving(true);
    // Re-authenticate first to confirm current password
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) { setPasswordSaving(false); return; }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });

    if (signInError) {
      setPasswordSaving(false);
      setPasswordError('Current password is incorrect.');
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordSaving(false);
    if (error) { setPasswordError(error.message); return; }
    setPasswordDone(true);
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Account', headerTintColor: '#d97706' }} />
      <KeyboardAvoidingView
        className="flex-1 bg-slate-50"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
          <View className="mx-4 mt-6 rounded-xl border border-slate-100 overflow-hidden bg-white">

            {/* Change email row */}
            <TouchableOpacity
              onPress={() => openSection(open === 'email' ? 'none' : 'email')}
              className="px-4 py-4 border-b border-slate-100 flex-row items-center justify-between"
            >
              <Text className="text-slate-900 font-medium">Change email</Text>
              <Text className="text-slate-400 text-sm">{open === 'email' ? '▲' : '▼'}</Text>
            </TouchableOpacity>

            {open === 'email' && (
              <View className="px-4 py-4 border-b border-slate-100 bg-slate-50">
                {emailSent ? (
                  <View className="bg-green-50 border border-green-200 rounded-xl p-3">
                    <Text className="text-green-800 font-medium mb-1">Confirmation sent</Text>
                    <Text className="text-green-700 text-sm">
                      Check {newEmail} for a confirmation link. Your email will update once confirmed.
                    </Text>
                  </View>
                ) : (
                  <>
                    <TextInput
                      className="border border-slate-200 rounded-xl px-4 py-3 mb-3 text-slate-900 bg-white"
                      placeholder="New email address"
                      autoCapitalize="none"
                      keyboardType="email-address"
                      value={newEmail}
                      onChangeText={setNewEmail}
                      autoFocus
                    />
                    {emailError ? (
                      <Text className="text-red-500 text-sm mb-3">{emailError}</Text>
                    ) : null}
                    <TouchableOpacity
                      onPress={handleChangeEmail}
                      disabled={emailSaving}
                      className="bg-amber-500 rounded-xl py-3 items-center"
                    >
                      {emailSaving ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text className="text-white font-semibold">Send confirmation</Text>
                      )}
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}

            {/* Change password row */}
            <TouchableOpacity
              onPress={() => openSection(open === 'password' ? 'none' : 'password')}
              className="px-4 py-4 flex-row items-center justify-between"
            >
              <Text className="text-slate-900 font-medium">Change password</Text>
              <Text className="text-slate-400 text-sm">{open === 'password' ? '▲' : '▼'}</Text>
            </TouchableOpacity>

            {open === 'password' && (
              <View className="px-4 py-4 bg-slate-50">
                {passwordDone ? (
                  <View className="bg-green-50 border border-green-200 rounded-xl p-3">
                    <Text className="text-green-800 font-medium">Password updated</Text>
                    <Text className="text-green-700 text-sm mt-0.5">
                      Your password has been changed successfully.
                    </Text>
                  </View>
                ) : (
                  <>
                    <TextInput
                      className="border border-slate-200 rounded-xl px-4 py-3 mb-3 text-slate-900 bg-white"
                      placeholder="Current password"
                      secureTextEntry
                      value={currentPassword}
                      onChangeText={setCurrentPassword}
                      autoFocus
                    />
                    <TextInput
                      className="border border-slate-200 rounded-xl px-4 py-3 mb-3 text-slate-900 bg-white"
                      placeholder="New password (min 8 characters)"
                      secureTextEntry
                      value={newPassword}
                      onChangeText={setNewPassword}
                    />
                    <TextInput
                      className="border border-slate-200 rounded-xl px-4 py-3 mb-3 text-slate-900 bg-white"
                      placeholder="Confirm new password"
                      secureTextEntry
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                    />
                    {passwordError ? (
                      <Text className="text-red-500 text-sm mb-3">{passwordError}</Text>
                    ) : null}
                    <TouchableOpacity
                      onPress={handleChangePassword}
                      disabled={passwordSaving}
                      className="bg-amber-500 rounded-xl py-3 items-center"
                    >
                      {passwordSaving ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text className="text-white font-semibold">Update password</Text>
                      )}
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
