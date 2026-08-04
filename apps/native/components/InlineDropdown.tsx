import { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type DropdownOption<T extends string> = { key: T; label: string };

// Native counterpart to web's SortDropdown. Deliberately not an ActionSheetIOS
// sheet like the app's other pickers: iOS runs the sheet's dismiss animation to
// completion *before* invoking the JS callback, so a sort or filter couldn't
// apply for ~300ms after the tap. Web applies on click in the same tick, and
// this does too — the picking is instant, the animation was the whole delay.
//
// Rendered in a transparent, unanimated Modal rather than absolutely positioned
// in place, because these triggers live inside list headers that would clip it.
// The trigger is measured on open so the menu still hangs off the control.
export default function InlineDropdown<T extends string>({
  value,
  options,
  onChange,
  accessibilityLabel,
}: {
  value: T;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  accessibilityLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const triggerRef = useRef<View>(null);

  const current = options.find(o => o.key === value);

  function openMenu() {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      const screenWidth = Dimensions.get('window').width;
      setPos({ top: y + height + 4, right: Math.max(screenWidth - (x + width), 8) });
      setOpen(true);
    });
  }

  return (
    <>
      <TouchableOpacity
        ref={triggerRef}
        onPress={openMenu}
        className="h-7 flex-row items-center gap-1 rounded-lg border border-zinc-200 px-3"
        accessibilityLabel={accessibilityLabel}
      >
        <Ionicons name="chevron-down" size={11} color="#71717a" />
        <Text className="text-xs font-medium text-zinc-500">{current?.label}</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="none" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1" onPress={() => setOpen(false)}>
          {pos ? (
            <View
              className="absolute min-w-[120px] rounded-lg border border-zinc-200 bg-white py-1"
              style={{
                top: pos.top,
                right: pos.right,
                shadowColor: '#000',
                shadowOpacity: 0.1,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 2 },
                elevation: 4,
              }}
            >
              {options.map(o => (
                <TouchableOpacity
                  key={o.key}
                  onPress={() => { onChange(o.key); setOpen(false); }}
                  className="px-3 py-2"
                >
                  <Text
                    className={`text-xs font-medium ${
                      o.key === value ? 'text-amber-600' : 'text-zinc-600'
                    }`}
                  >
                    {o.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </Pressable>
      </Modal>
    </>
  );
}
