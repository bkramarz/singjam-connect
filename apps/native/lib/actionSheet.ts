import { ActionSheetIOS, Alert, Platform } from 'react-native';
import type { GestureResponderEvent } from 'react-native';
import { buildOptionSheet, type OptionSheetItem } from '@singjam/core';

export type SheetOption = OptionSheetItem & {
  onPress?: () => void;
};

type SheetConfig = {
  title?: string;
  message?: string;
  options: SheetOption[];
  cancelLabel?: string;
  anchor?: number;
};

// On iPad an action sheet is a popover and has to point at the control that
// opened it. With no anchor, RCTActionSheetManager falls back to the whole
// screen as the source view and sets permittedArrowDirections = 0 — so it
// floats dead centre with no arrow, disconnected from whatever was tapped. On
// iPhone the anchor is ignored, and on Android there is no popover at all.
// Usage: onPress={(e) => showOptionsSheet({ …, anchor: anchorFrom(e) })}
export function anchorFrom(event: GestureResponderEvent): number | undefined {
  // Fabric serialises the touched view's react tag as nativeEvent.target (an
  // int), which is what the native side resolves through its view registry.
  // RN's typings still declare it as a string, hence the cast.
  // findNodeHandle is deliberately not used here: it resolves through the
  // legacy Paper renderer, which isn't the renderer mounting these views.
  const target = event.nativeEvent?.target as unknown;
  return typeof target === 'number' ? target : undefined;
}

// One option-picker for the whole app: a native action sheet on iOS, the
// closest Alert equivalent on Android. Every "pick one of a short list" menu
// goes through here so they behave identically everywhere.
export function showOptionsSheet({
  title,
  message,
  options,
  cancelLabel = 'Cancel',
  anchor,
}: SheetConfig) {
  const layout = buildOptionSheet(options, cancelLabel);

  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: layout.labels,
        cancelButtonIndex: layout.cancelButtonIndex,
        ...(layout.destructiveButtonIndex >= 0
          ? { destructiveButtonIndex: layout.destructiveButtonIndex }
          : {}),
        ...(layout.disabledButtonIndices.length > 0
          ? { disabledButtonIndices: layout.disabledButtonIndices }
          : {}),
        ...(title ? { title } : {}),
        ...(message ? { message } : {}),
        ...(anchor !== undefined ? { anchor } : {}),
      },
      index => { if (index < options.length) options[index].onPress?.(); },
    );
  } else {
    Alert.alert(title ?? '', message, [
      ...layout.enabledIndices.map(index => ({
        text: options[index].label,
        style: options[index].destructive ? ('destructive' as const) : undefined,
        onPress: options[index].onPress,
      })),
      { text: cancelLabel, style: 'cancel' as const },
    ]);
  }
}
